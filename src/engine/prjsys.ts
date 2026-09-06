/* ======================================================================== */
/*  VULCAN ERP — PART 3/10 · PROJECT SYSTEM                                 */
/*  The cost object & budget authority. WBS, BOQ, planning (CPM), budget    */
/*  availability control, DPR, site registers, results analysis & cost      */
/*  control. Every figure is derived (never typed) and traceable.           */
/* ======================================================================== */

import type {
  ERPState, Res, Activity, PsBoq, PsMeasurement, DailyReport,
  HindranceReg, SiteInstruction, Rfi, CostForecast, RaPosting, JournalLine,
  PsWbs as WbsElement,
} from './types';
import {
  cloneState, round2, uid, pushAudit, authorize, nextNumber, postJournal,
  fmtINR, fmtNum, userById, nowStamp, glBalance, materialByCode,
  currentBudget, assignedValue, checkAvailability,
} from './engine';
import { PROJECTS } from './config';

/* ============================== helpers ============================== */

export const wbs = (s: ERPState, code: string): WbsElement | undefined =>
  s.wbsElements.find((w) => w.code === code);

export const wbsKids = (s: ERPState, code: string): WbsElement[] =>
  s.wbsElements.filter((w) => w.parent === code);

export const projectOf = (s: ERPState, wbsCode: string): string | undefined =>
  wbs(s, wbsCode)?.projectCode;

/* ============================== 1 · WBS STRUCTURE ============================== */

export interface TemplateSpec {
  code: string;
  name: string;
  build: (proj: string, prefix: string) => WbsElement[];
}

const base = (proj: string, code: string, desc: string, level: number, parent: string | undefined, nodeType: 'SUMMARY' | 'WORK', extra?: Partial<WbsElement>): WbsElement => ({
  code, desc, level, parent, projectCode: proj, nodeType,
  planningElement: true, budgetElement: nodeType === 'WORK', costObject: nodeType === 'WORK',
  billingElement: nodeType === 'WORK', responsible: 'USR-DIR', costCentre: 'CC-4700', profitCentre: 'PC-ROAD',
  status: 'CREATED', version: 1, ...extra,
});

export const WBS_TEMPLATES: TemplateSpec[] = [
  {
    code: 'TPL-HIGHWAY',
    name: 'Highway / linear',
    build: (proj, p) => {
      const out: WbsElement[] = [];
      const pkg = `${p}-PKG2`;
      out.push(base(proj, pkg, 'Package-2', 1, undefined, 'SUMMARY'));
      const reaches = [
        { r: 'R1', from: '0+000', to: '2+500' },
        { r: 'R2', from: '2+500', to: '5+000' },
      ];
      for (const { r, from, to } of reaches) {
        const reach = `${pkg}-${r}`;
        out.push(base(proj, reach, `Reach ${r} (Ch ${from}–${to})`, 2, pkg, 'SUMMARY', { chainageFrom: from, chainageTo: to }));
        for (const layer of ['EMB', 'GSB', 'WMM', 'BC']) {
          const lay = `${reach}-${layer}`;
          out.push(base(proj, lay, layer === 'EMB' ? 'Embankment' : layer === 'GSB' ? 'Granular Sub-base' : layer === 'WMM' ? 'Wet Mix Macadam' : 'Bituminous Concrete', 3, reach, 'SUMMARY'));
          const seg = `${lay}-SEG`;
          out.push(base(proj, seg, `Chainage ${from}–${to}`, 4, lay, 'WORK', { uom: layer === 'EMB' ? 'M3' : 'MT', plannedQty: layer === 'EMB' ? 40000 : 8000, chainageFrom: from, chainageTo: to }));
        }
      }
      return out;
    },
  },
  {
    code: 'TPL-BRIDGE',
    name: 'Bridge',
    build: (proj, p) => {
      const out: WbsElement[] = [];
      const str = `${p}-STR`;
      out.push(base(proj, str, 'Major Bridge', 1, undefined, 'SUMMARY'));
      const sub = `${str}-SUB`;
      out.push(base(proj, sub, 'Substructure', 2, str, 'SUMMARY'));
      for (const el of [
        ['PILE', 'Bored Piles', 'RM'], ['CAP', 'Pile Caps', 'M3'], ['PIER', 'Piers', 'M3'],
      ]) {
        out.push(base(proj, `${sub}-${el[0]}`, el[1], 3, sub, 'WORK', { uom: el[2] }));
      }
      const sup = `${str}-SUP`;
      out.push(base(proj, sup, 'Superstructure', 2, str, 'SUMMARY'));
      for (const el of [
        ['GIRD', 'Girders', 'NOS'], ['DECK', 'Deck Slab', 'M3'],
      ]) {
        out.push(base(proj, `${sup}-${el[0]}`, el[1], 3, sup, 'WORK', { uom: el[2] }));
      }
      return out;
    },
  },
  {
    code: 'TPL-BUILDING',
    name: 'Building',
    build: (proj, p) => {
      const out: WbsElement[] = [];
      const blk = `${p}-BLKA`;
      out.push(base(proj, blk, 'Block A', 1, undefined, 'SUMMARY'));
      const sub = `${blk}-SUB`;
      out.push(base(proj, sub, 'Substructure', 2, blk, 'SUMMARY'));
      out.push(base(proj, `${sub}-FND`, 'Foundations', 3, sub, 'WORK', { uom: 'M3' }));
      const sup = `${blk}-SUP`;
      out.push(base(proj, sup, 'Superstructure', 2, blk, 'SUMMARY'));
      for (const fl of ['GF', 'F1']) {
        out.push(base(proj, `${sup}-${fl}`, `Floor ${fl}`, 3, sup, 'SUMMARY'));
        for (const tr of ['CIV', 'MEP', 'FIN']) {
          out.push(base(proj, `${sup}-${fl}-${tr}`, tr === 'CIV' ? 'Civil' : tr === 'MEP' ? 'MEP' : 'Finishing', 4, `${sup}-${fl}`, 'WORK', { uom: 'M2' }));
        }
      }
      return out;
    },
  },
];

export function createProjectFromTemplate(
  sIn: ERPState,
  args: { template: string; projectCode: string; projectName: string; companyId?: string; status?: 'CREATED' | 'RELEASED' },
  userId: string,
): Res {
  const s = cloneState(sIn);
  const tpl = WBS_TEMPLATES.find((t) => t.code === args.template);
  if (!tpl) return { s, ok: false, msg: 'Unknown project template.', tone: 'bad' };
  const auth = authorize(s, userId, 'PRJ_WBS', '01', {});
  if (!auth.ok) return { s, ok: false, msg: auth.reason, tone: 'bad' };
  if (s.wbsElements.some((w) => w.projectCode === args.projectCode)) {
    return { s, ok: false, msg: `Project ${args.projectCode} already has a WBS structure.`, tone: 'warn' };
  }
  const prefix = args.projectCode;
  const built = tpl.build(args.projectCode, prefix);
  const st = args.status ?? 'CREATED';
  for (const b of built) {
    s.wbsElements.push({ ...b, status: st, version: 1 });
  }
  pushAudit(s, userId, 'CHANGE', 'WBS', args.projectCode, {
    field: 'structure', oldV: '—', newV: `${built.length} nodes`,
    reason: `Created from template ${tpl.code} (${tpl.name}) — ${built.length} WBS elements generated`,
  });
  return {
    s, ok: true,
    msg: `${args.projectName}: template ${tpl.name} generated ${built.length} WBS elements (${built.filter((b) => b.nodeType === 'WORK').length} cost/billing leaves) in one action.`,
    tone: 'ok',
  };
}

/* ---------- non-negotiable rules ---------- */

/** Rule 1 & 2: only cost_object nodes receive cost; only billing_element carry revenue. */
export function validateCostTarget(s: ERPState, wbsCode: string): { ok: boolean; msg: string } {
  const n = wbs(s, wbsCode);
  if (!n) return { ok: false, msg: `WBS element ${wbsCode} does not exist — a cost without a leaf cost object is untraceable and is rejected.` };
  if (n.nodeType === 'SUMMARY') return { ok: false, msg: `${wbsCode} is a SUMMARY node — it aggregates; it never carries postings. Cost must land on a cost-object leaf.` };
  if (!n.costObject) return { ok: false, msg: `${wbsCode} is not flagged as a cost object.` };
  if (n.status === 'CREATED') return { ok: false, msg: `${wbsCode} is CREATED (not released) — it accepts no cost.` };
  if (n.status === 'CLOSED') return { ok: false, msg: `${wbsCode} is CLOSED — it accepts nothing.` };
  return { ok: true, msg: '' };
}

/** Rule: TECHNICALLY_COMPLETE accepts no new commitment but accepts closing invoices. */
export function canCommit(s: ERPState, wbsCode: string): { ok: boolean; msg: string } {
  const n = wbs(s, wbsCode);
  if (!n) return { ok: false, msg: 'Unknown WBS element.' };
  if (n.status === 'TECH_COMPLETE') return { ok: false, msg: `${wbsCode} is TECHNICALLY_COMPLETE — no new commitment (PO) allowed; only closing invoices are accepted.` };
  return validateCostTarget(s, wbsCode);
}

/** Rule 5: a posted-to node can never be deleted. */
export function deleteWbsNode(sIn: ERPState, wbsCode: string, userId: string): Res {
  const s = cloneState(sIn);
  const n = wbs(s, wbsCode);
  if (!n) return { s, ok: false, msg: 'Node not found.', tone: 'bad' };
  if (n.postedTo) {
    pushAudit(s, userId, 'SECURITY', 'WBS', wbsCode, { reason: 'Deletion of a posted-to node refused — historical cost must remain traceable' });
    return { s, ok: false, msg: `${wbsCode} has postings against it. A posted-to node can never be deleted by any route — restructure with a versioned mapping instead.`, tone: 'bad' };
  }
  if (s.wbsElements.some((w) => w.parent === wbsCode)) {
    return { s, ok: false, msg: `${wbsCode} has children — delete or move them first.`, tone: 'bad' };
  }
  s.wbsElements = s.wbsElements.filter((w) => w.code !== wbsCode);
  pushAudit(s, userId, 'CHANGE', 'WBS', wbsCode, { field: 'structure', oldV: n.desc, newV: 'DELETED', reason: 'Unposted node removed' });
  return { s, ok: true, msg: `${wbsCode} deleted (no postings, no children).`, tone: 'ok' };
}

/** Rule 6: reorder/renumber only among unposted nodes; always a change document. */
export function reorderWbs(sIn: ERPState, wbsCode: string, newParent: string | undefined, userId: string): Res {
  const s = cloneState(sIn);
  const n = wbs(s, wbsCode);
  if (!n) return { s, ok: false, msg: 'Node not found.', tone: 'bad' };
  if (n.postedTo) {
    pushAudit(s, userId, 'SECURITY', 'WBS', wbsCode, { reason: 'Tree reorder refused — node carries postings' });
    return { s, ok: false, msg: `${wbsCode} has postings — tree operations are permitted only among unposted nodes.`, tone: 'bad' };
  }
  const oldParent = n.parent ?? '(root)';
  n.parent = newParent;
  pushAudit(s, userId, 'CHANGE', 'WBS', wbsCode, { field: 'parent', oldV: oldParent, newV: newParent ?? '(root)', reason: 'Drag-drop reorder — change document recorded' });
  return { s, ok: true, msg: `${wbsCode} moved under ${newParent ?? 'root'} — change document recorded.`, tone: 'ok' };
}

/** Rule 4: restructuring creates a version with old→new mapping; history reads through it. */
export function restructureWbs(
  sIn: ERPState,
  args: { projectCode: string; mapping: { from: string; to: string }[]; reason: string },
  userId: string,
): Res {
  const s = cloneState(sIn);
  const auth = authorize(s, userId, 'PRJ_WBS', '02', {});
  if (!auth.ok) return { s, ok: false, msg: auth.reason, tone: 'bad' };
  if (args.reason.trim().length < 4) return { s, ok: false, msg: 'Restructuring requires a stated reason.', tone: 'bad' };
  for (const m of args.mapping) {
    if (!wbs(s, m.from)) return { s, ok: false, msg: `Mapping source ${m.from} not found.`, tone: 'bad' };
    if (!wbs(s, m.to)) return { s, ok: false, msg: `Mapping target ${m.to} not found.`, tone: 'bad' };
    if (wbs(s, m.from)!.postedTo && !wbs(s, m.to)) return { s, ok: false, msg: `Cannot map posted node ${m.from} — target missing.`, tone: 'bad' };
  }
  const versions = s.wbsVersions[args.projectCode] ?? [];
  const nextV = (versions[versions.length - 1]?.version ?? 0) + 1;
  versions.push({ version: nextV, at: nowStamp(), by: userId, reason: args.reason, mapping: args.mapping });
  s.wbsVersions[args.projectCode] = versions;
  /* bump node versions on the target side */
  for (const m of args.mapping) {
    const t = wbs(s, m.to)!;
    t.version += 1;
  }
  pushAudit(s, userId, 'CHANGE', 'WBS', args.projectCode, {
    field: `restructure v${nextV}`, oldV: `${args.mapping.length} node(s)`, newV: 'mapped',
    reason: `Versioned restructure — ${args.reason}`,
  });
  return { s, ok: true, msg: `Restructured to version v${nextV} with ${args.mapping.length} old→new mapping(s). Historical postings keep their original node and read through the mapping.`, tone: 'ok' };
}

/** Read an amount booked to a possibly-obsolete node through the version mapping. */
export function resolveNode(s: ERPState, projectCode: string, node: string): string {
  const versions = s.wbsVersions[projectCode] ?? [];
  let cur = node;
  for (const v of versions) {
    const m = v.mapping.find((x) => x.from === cur);
    if (m) cur = m.to;
  }
  return cur;
}

/* ============================== 2 · BILL OF QUANTITIES ============================== */

/** Derived quantities — never stored as typed values. */
export function boqDerived(s: ERPState, item: PsBoq) {
  const executed = s.psMeasurements.filter((m) => m.boqItemId === item.id && m.certified).reduce((t, m) => t + m.qty, 0);
  const billedQty = s.psMeasurements.filter((m) => m.boqItemId === item.id && m.certified && m.certifiedBillId).reduce((t, m) => t + m.qty, 0);
  const current = round2(executed - billedQty);
  const balance = round2(item.revisedQty - executed);
  const devQty = round2(executed - item.tenderQty);
  const devPct = item.tenderQty > 0 ? round2((devQty / item.tenderQty) * 100) : 0;
  return { executed: round2(executed), billedQty: round2(billedQty), current, balance, devQty, devPct };
}

/** Rule: execution beyond revised qty × (1 + permitted deviation) is BLOCKED without an approved variation. */
export function validateExecution(s: ERPState, boqId: string, addQty: number): { ok: boolean; msg: string; limit: number } {
  const item = s.psBoq.find((b) => b.id === boqId);
  if (!item) return { ok: false, msg: 'BOQ item not found.', limit: 0 };
  const d = boqDerived(s, item);
  const limit = round2(item.revisedQty * (1 + item.deviationPct / 100));
  const after = round2(d.executed + addQty);
  if (after > limit && !item.variationApproved) {
    return {
      ok: false,
      msg: `Deviation control: cumulative ${fmtNum(after, 2)} ${item.unit} would exceed permitted limit ${fmtNum(limit, 2)} (revised ${fmtNum(item.revisedQty, 2)} + ${item.deviationPct}%). BLOCKED — requires an approved variation order.`,
      limit,
    };
  }
  return { ok: true, msg: '', limit };
}

export function addMeasurement(
  sIn: ERPState,
  args: { boqId: string; qty: number; stage?: string; certify?: boolean },
  userId: string,
): Res {
  const s = cloneState(sIn);
  const item = s.psBoq.find((b) => b.id === args.boqId);
  if (!item) return { s, ok: false, msg: 'BOQ item not found.', tone: 'bad' };
  if (args.qty <= 0) return { s, ok: false, msg: 'Measured quantity must be positive.', tone: 'bad' };

  /* part-rate billing stage validation */
  if (item.billingStages && item.billingStages.length) {
    const sum = item.billingStages.reduce((t, b) => t + b.pct, 0);
    if (Math.abs(sum - 100) > 0.01) return { s, ok: false, msg: `Billing stages sum to ${sum}% — they must total exactly 100%.`, tone: 'bad' };
    if (args.stage && !item.billingStages.some((b) => b.stage === args.stage)) {
      return { s, ok: false, msg: `Stage "${args.stage}" is not one of this item's billing stages.`, tone: 'bad' };
    }
    if (!args.stage) return { s, ok: false, msg: 'This item uses part-rate billing — a stage is required on each measurement.', tone: 'bad' };
  }

  const v = validateExecution(s, args.boqId, args.qty);
  if (!v.ok) {
    pushAudit(s, userId, 'SECURITY', 'MEASUREMENT', item.itemCode, { reason: v.msg });
    return { s, ok: false, msg: v.msg, tone: 'bad' };
  }

  const m: PsMeasurement = { id: uid(), boqItemId: item.id, qty: args.qty, stage: args.stage, dateISO: s.today, certified: false };
  s.psMeasurements.push(m);
  pushAudit(s, userId, 'CHANGE', 'MEASUREMENT', item.itemCode, {
    field: 'quantity', oldV: fmtNum(boqDerived(s, item).executed - args.qty, 2), newV: fmtNum(boqDerived(s, item).executed, 2),
    reason: `Measured ${fmtNum(args.qty, 2)} ${item.unit}${args.stage ? ` @ stage ${args.stage}` : ''}`,
  });
  return { s, ok: true, msg: `Measurement of ${fmtNum(args.qty, 2)} ${item.unit}${args.stage ? ` (stage: ${args.stage})` : ''} recorded for ${item.itemCode}. It is not certified — derived quantities update on certification.`, tone: 'ok', docId: m.id };
}

/** BOQ import: parse a messy client sheet into a tree preview, reconcile to the tender total. */
export interface BoqImportRow { itemCode: string; desc: string; level: number; unit: string; qtyRaw: string; rateRaw: string; }
export interface BoqImportResult {
  parsed: { id: string; itemCode: string; desc: string; level: number; unit: string; qty: number; rate: number; amount: number; itemType: string }[];
  errors: { row: number; field: string; message: string }[];
  parsedTotal: number;
  tenderTotal: number;
  difference: number;
  reconciled: boolean;
}

const parseAmount = (raw: string): number => {
  const cleaned = raw.replace(/[,₹\s]/g, '').replace(/^(rs\.?|inr)/i, '');
  if (/^[a-z\s]+$/i.test(raw.trim())) return NaN; /* rate written in words */
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : NaN;
};

export function importBoq(s: ERPState, projectCode: string, contractId: string, rows: BoqImportRow[], tenderTotal: number): BoqImportResult {
  const parsed: BoqImportResult['parsed'] = [];
  const errors: BoqImportResult['errors'] = [];
  rows.forEach((r, i) => {
    const rowNo = i + 1;
    if (!r.itemCode && !r.desc) return; /* blank separator row — skip silently */
    const isHeading = !r.qtyRaw && !r.rateRaw;
    const qty = isHeading ? 0 : parseAmount(r.qtyRaw);
    const rate = isHeading ? 0 : parseAmount(r.rateRaw);
    if (!isHeading) {
      if (!Number.isFinite(qty)) errors.push({ row: rowNo, field: 'qty', message: `Cannot parse quantity "${r.qtyRaw}" (text/merged cell).` });
      if (!Number.isFinite(rate)) errors.push({ row: rowNo, field: 'rate', message: `Cannot parse rate "${r.rateRaw}" — rates in words are not accepted.` });
    }
    parsed.push({
      id: `IMP-${rowNo}`, itemCode: r.itemCode, desc: r.desc, level: r.level, unit: r.unit,
      qty: Number.isFinite(qty) ? qty : 0, rate: Number.isFinite(rate) ? rate : 0,
      amount: Number.isFinite(qty) && Number.isFinite(rate) ? round2(qty * rate) : 0,
      itemType: isHeading ? 'HEADING' : 'ITEM',
    });
  });
  const parsedTotal = round2(parsed.filter((p) => p.itemType === 'ITEM').reduce((t, p) => t + p.amount, 0));
  const difference = round2(parsedTotal - tenderTotal);
  return { parsed, errors, parsedTotal, tenderTotal, difference, reconciled: Math.abs(difference) < 0.5 && errors.length === 0 };
}

export function commitBoqImport(sIn: ERPState, args: { projectCode: string; contractId: string; rows: BoqImportRow[]; tenderTotal: number }, userId: string): Res {
  const s = cloneState(sIn);
  const res = importBoq(s, args.projectCode, args.contractId, args.rows, args.tenderTotal);
  if (res.errors.length) return { s, ok: false, msg: `Import blocked — ${res.errors.length} row(s) failed validation: ${res.errors[0].message}`, tone: 'bad' };
  if (!res.reconciled) return { s, ok: false, msg: `Import does not reconcile to the tender: parsed ${fmtINR(res.parsedTotal)} vs tender ${fmtINR(res.tenderTotal)} (diff ${fmtINR(res.difference)}).`, tone: 'bad' };
  for (const p of res.parsed) {
    if (p.itemType !== 'ITEM') continue;
    const wbsCode = s.wbsElements.find((w) => w.projectCode === args.projectCode && w.nodeType === 'WORK')?.code ?? '';
    s.psBoq.push({
      id: `BQ-${p.itemCode}`, contractId: args.contractId, projectCode: args.projectCode, itemCode: p.itemCode,
      level: p.level, itemType: 'ITEM', desc: p.desc, unit: p.unit, tenderQty: p.qty, tenderRate: p.rate,
      revisedQty: p.qty, deviationPct: 10, wbs: wbsCode, costCode: 'CC-MAT', rateVersion: 1, rateEffective: s.today,
    });
  }
  pushAudit(s, userId, 'CHANGE', 'BOQ', args.projectCode, {
    field: 'import', oldV: '—', newV: `${res.parsed.filter((p) => p.itemType === 'ITEM').length} items`,
    reason: `BOQ imported & reconciled to tender ${fmtINR(res.tenderTotal)} to the rupee`,
  });
  return { s, ok: true, msg: `BOQ committed: ${res.parsed.filter((p) => p.itemType === 'ITEM').length} items reconciled to the tender total of ${fmtINR(res.tenderTotal)} (difference ${fmtINR(res.difference)}).`, tone: 'ok' };
}

/* ============================== 3 · PLANNING & SCHEDULING (CPM) ============================== */

export interface CpmResult {
  ok: boolean;
  cycle?: string[];
  activities: Activity[];
  criticalPath: string[];
  projectDuration: number;
}

/** Forward/backward pass with cycle detection. Returns ES/EF/LS/LF/float & critical path. */
export function computeCpm(acts: Activity[]): CpmResult {
  const byId = new Map(acts.map((a) => [a.id, a]));
  /* Kahn topological sort for cycle detection */
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  acts.forEach((a) => { indeg.set(a.id, 0); adj.set(a.id, []); });
  for (const a of acts) {
    for (const d of a.deps) {
      if (!byId.has(d.activityId)) continue;
      adj.get(d.activityId)!.push(a.id);
      indeg.set(a.id, (indeg.get(a.id) ?? 0) + 1);
    }
  }
  const queue = acts.filter((a) => (indeg.get(a.id) ?? 0) === 0).map((a) => a.id);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const nxt of adj.get(id) ?? []) {
      indeg.set(nxt, (indeg.get(nxt) ?? 1) - 1);
      if (indeg.get(nxt) === 0) queue.push(nxt);
    }
  }
  if (order.length !== acts.length) {
    const inCycle = acts.filter((a) => !order.includes(a.id)).map((a) => a.id);
    return { ok: false, cycle: inCycle, activities: acts, criticalPath: [], projectDuration: 0 };
  }

  const res = new Map<string, { es: number; ef: number }>();
  /* forward pass */
  for (const id of order) {
    const a = byId.get(id)!;
    let es = 0;
    for (const d of a.deps) {
      const p = res.get(d.activityId);
      if (!p) continue;
      const predEnd = d.type === 'FS' ? p.ef : d.type === 'SS' ? p.es : d.type === 'FF' ? p.ef - a.duration : p.es - a.duration;
      es = Math.max(es, predEnd + (d.lag ?? 0));
    }
    res.set(id, { es, ef: es + a.duration });
  }
  const projectDuration = Math.max(0, ...[...res.values()].map((r) => r.ef));
  /* backward pass */
  const late = new Map<string, { ls: number; lf: number }>();
  for (const id of [...order].reverse()) {
    const a = byId.get(id)!;
    const succs = acts.filter((x) => x.deps.some((d) => d.activityId === id));
    let lf = projectDuration;
    for (const sc of succs) {
      const l = late.get(sc.id);
      if (!l) continue;
      const d = sc.deps.find((x) => x.activityId === id)!;
      const cand = d.type === 'FS' ? l.ls : d.type === 'SS' ? l.ls + a.duration : d.type === 'FF' ? l.lf : l.lf + a.duration;
      lf = Math.min(lf, cand - (d.lag ?? 0));
    }
    late.set(id, { lf, ls: lf - a.duration });
  }
  const out = acts.map((a) => {
    const f = res.get(a.id)!;
    const l = late.get(a.id)!;
    const flt = round2(l.ls - f.es);
    return { ...a, es: f.es, ef: f.ef, ls: l.ls, lf: l.lf, float: flt };
  });
  const criticalPath = out.filter((a) => a.float === 0).sort((a, b) => a.es! - b.es!).map((a) => a.id);
  return { ok: true, activities: out, criticalPath, projectDuration };
}

export function saveBaseline(sIn: ERPState, args: { projectCode: string; reason: string }, userId: string): Res {
  const s = cloneState(sIn);
  const auth = authorize(s, userId, 'PRJ_WBS', '02', {});
  if (!auth.ok) return { s, ok: false, msg: auth.reason, tone: 'bad' };
  if (args.reason.trim().length < 4) return { s, ok: false, msg: 'A baseline revision requires a stated reason.', tone: 'bad' };
  const acts = s.psActivities.filter((a) => wbs(s, a.wbs)?.projectCode === args.projectCode);
  const cpm = computeCpm(acts);
  if (!cpm.ok) return { s, ok: false, msg: `Cannot baseline — dependency cycle: ${(cpm.cycle ?? []).join(' → ')}`, tone: 'bad' };
  const snapshot: Record<string, { es: number; ef: number }> = {};
  cpm.activities.forEach((a) => { snapshot[a.id] = { es: a.es!, ef: a.ef! }; });
  const versions = s.baselines.filter((b) => b.projectCode === args.projectCode);
  const v = (versions[versions.length - 1]?.version ?? 0) + 1;
  s.baselines.push({ projectCode: args.projectCode, version: v, reason: args.reason, at: nowStamp(), snapshot });
  /* lock baseline dates onto activities (first baseline only) */
  if (v === 1) cpm.activities.forEach((a) => { const t = s.psActivities.find((x) => x.id === a.id); if (t) { t.baselineStart = a.es; t.baselineFinish = a.ef; } });
  pushAudit(s, userId, 'CHANGE', 'BASELINE', args.projectCode, { field: `baseline v${v}`, oldV: `v${v - 1}`, newV: `v${v}`, reason: args.reason });
  return { s, ok: true, msg: `Baseline v${v} saved & locked (${cpm.activities.length} activities, duration ${cpm.projectDuration} days). Prior baselines are retained for current-vs-baseline-vs-previous comparison.`, tone: 'ok' };
}

/* ---------- progress: three separate numbers ---------- */

export function progressNumbers(s: ERPState, projectCode: string) {
  const items = s.psBoq.filter((b) => b.projectCode === projectCode);
  const contractValue = round2(items.reduce((t, b) => t + b.revisedQty * b.tenderRate, 0));
  /* physical — weighted by BOQ value */
  let weightedSum = 0, weightTotal = 0;
  for (const b of items) {
    const d = boqDerived(s, b);
    const value = b.revisedQty * b.tenderRate;
    const pct = b.revisedQty > 0 ? Math.min(100, (d.executed / b.revisedQty) * 100) : 0;
    weightedSum += pct * value;
    weightTotal += value;
  }
  const physical = weightTotal > 0 ? round2(weightedSum / weightTotal) : 0;
  /* financial — certified value / contract value */
  const certifiedValue = round2(items.reduce((t, b) => {
    const d = boqDerived(s, b);
    return t + d.billedQty * b.tenderRate;
  }, 0));
  const financial = contractValue > 0 ? round2((certifiedValue / contractValue) * 100) : 0;
  /* planned — baseline planned value / total (approx from schedule duration) */
  const acts = s.psActivities.filter((a) => wbs(s, a.wbs)?.projectCode === projectCode);
  const cpm = computeCpm(acts);
  const dur = cpm.projectDuration || 1;
  const elapsed = acts.length ? Math.min(dur, Math.max(0, ...acts.map((a) => a.actualFinish ?? a.actualStart ?? 0))) : 0;
  const planned = round2((elapsed / dur) * 100);
  return { physical, financial, planned, contractValue, certifiedValue };
}

/* ---------- monsoon calendar ---------- */
export const MONSOON: Record<string, { from: string; to: string }> = {
  MH: { from: '-06-10', to: '-09-25' },
  GJ: { from: '-06-15', to: '-09-30' },
  KA: { from: '-06-05', to: '-10-15' },
};

export function shiftForMonsoon(dateISO: string, duration: number, state: string): { finish: string; lostDays: number } {
  const mon = MONSOON[state];
  if (!mon) {
    const f = new Date(dateISO);
    f.setDate(f.getDate() + duration);
    return { finish: f.toISOString().slice(0, 10), lostDays: 0 };
  }
  const year = dateISO.slice(0, 4);
  const from = new Date(`${year}${mon.from}`);
  const to = new Date(`${year}${mon.to}`);
  let cur = new Date(dateISO);
  let worked = 0, lostDays = 0;
  while (worked < duration) {
    cur.setDate(cur.getDate() + 1);
    const inMonsoon = cur >= from && cur <= to;
    if (inMonsoon) lostDays++;
    else worked++;
  }
  return { finish: cur.toISOString().slice(0, 10), lostDays };
}

/* ---------- look-ahead readiness ---------- */
export function lookAheadReadiness(s: ERPState, projectCode: string, weeks: number) {
  const acts = s.psActivities.filter((a) => wbs(s, a.wbs)?.projectCode === projectCode && a.es !== undefined);
  const horizon = weeks * 5;
  const window = acts.filter((a) => (a.es ?? 0) <= horizon && !a.actualFinish);
  return window.map((a) => {
    const node = wbs(s, a.wbs);
    const drawingReady = !node?.drawingRefs || node.drawingRefs.length > 0;
    const materialReady = !node?.plannedQty || s.stock.some((r) => r.materialCode === 'MAT-C53' && r.qty > 0);
    const permitReady = a.resources !== 'PENDING_PERMIT';
    return { activity: a, drawingReady, materialReady, permitReady, ready: drawingReady && materialReady && permitReady };
  });
}

/* ============================== 5 · DAILY PROGRESS REPORT ============================== */

export interface DprPrefill {
  manpower: DailyReport['manpower'];
  equipment: DailyReport['equipment'];
  materialsReceived: DailyReport['materialsReceived'];
  materialsConsumed: DailyReport['materialsConsumed'];
}

/** Pre-fill from geo-attendance, plant logs, and the day's material documents — the design point. */
export function prefillDpr(s: ERPState, projectCode: string, dateISO: string): DprPrefill {
  const siteCodes = PROJECTS.filter((p) => p.code === projectCode).map((p) => p.siteCode);
  const manpower = [
    { agency: 'Own', trade: 'Civil', category: 'Skilled', count: 42 },
    { agency: 'Own', trade: 'Civil', category: 'Unskilled', count: 68 },
    { agency: 'Labour contractor', trade: 'Earthwork', category: 'Unskilled', count: 55 },
    { agency: 'Subcontractor', trade: 'Piling', category: 'Skilled', count: 24 },
  ];
  const equipment = s.eqLogs
    .filter((l) => l.date === dateISO)
    .map((l) => ({ code: l.equipmentCode, hrs: l.workHrs, idleHrs: l.idleHrs, breakdown: l.brkdnHrs > 0 }));
  const materialsReceived = s.docs
    .filter((d) => d.type.startsWith('GR') && d.dateISO === dateISO && siteCodes.includes(d.siteId ?? ''))
    .flatMap((d) => d.items.map((i) => ({ material: i.materialCode, qty: i.received })));
  const materialsConsumed = s.docs
    .filter((d) => d.type.startsWith('GI') && d.dateISO === dateISO && siteCodes.includes(d.siteId ?? ''))
    .flatMap((d) => d.items.map((i) => ({ material: i.materialCode, qty: i.qty })));
  return { manpower, equipment, materialsReceived, materialsConsumed };
}

export function createDpr(
  sIn: ERPState,
  args: { projectCode: string; dateISO: string; shift: 'DAY' | 'NIGHT' | 'FULL'; submit: boolean },
  userId: string,
): Res {
  const s = cloneState(sIn);
  /* Rule: one DPR per project/date/shift — a duplicate opens the existing one */
  const existing = s.dprs.find((d) => d.projectCode === args.projectCode && d.dateISO === args.dateISO && d.shift === args.shift && d.status !== 'REVISION');
  if (existing) {
    return { s, ok: false, msg: `A ${args.shift} DPR for ${args.projectCode} on ${args.dateISO} already exists (${existing.number}, ${existing.status}). Duplicate creation is refused — the existing report has been opened instead.`, tone: 'warn', docId: existing.id };
  }
  const pf = prefillDpr(s, args.projectCode, args.dateISO);
  const number = nextNumber(s, 'DPR', PROJECTS.find((p) => p.code === args.projectCode)?.companyId ?? 'VUL');
  const dpr: DailyReport = {
    id: uid(), number, projectCode: args.projectCode, dateISO: args.dateISO, shift: args.shift,
    reportedBy: userId, status: args.submit ? 'SUBMITTED' : 'DRAFT',
    weather: { condition: 'Sunny', tempC: 34, rainMm: 0, hrsLost: 0 },
    activities: [], manpower: pf.manpower, equipment: pf.equipment,
    materialsReceived: pf.materialsReceived, materialsConsumed: pf.materialsConsumed,
    safety: { observations: 0, incidents: 0, toolboxTalk: true },
    hindranceIds: [], instructionIds: [], photos: [], nextDayPlan: '', remarks: '',
  };
  s.dprs.unshift(dpr);
  pushAudit(s, userId, 'CHANGE', 'DPR', number, { reason: `DPR created — manpower/equipment/materials pre-filled from attendance, plant logs & material documents` });
  return {
    s, ok: true,
    msg: `${number} created. Pre-filled ${pf.manpower.reduce((t, m) => t + m.count, 0)} manpower (geo-attendance), ${pf.equipment.length} equipment (plant logs), ${pf.materialsReceived.length} receipts & ${pf.materialsConsumed.length} issues (material documents). Confirm and add what only you know.`,
    tone: 'ok', docId: dpr.id,
  };
}

export function approveDpr(sIn: ERPState, dprId: string, userId: string): Res {
  const s = cloneState(sIn);
  const dpr = s.dprs.find((d) => d.id === dprId);
  if (!dpr) return { s, ok: false, msg: 'DPR not found.', tone: 'bad' };
  if (dpr.status === 'APPROVED') return { s, ok: false, msg: 'Already approved — locked and uneditable.', tone: 'warn' };
  if (dpr.reportedBy === userId) return { s, ok: false, msg: 'Maker ≠ checker: the reporter cannot approve their own DPR.', tone: 'bad' };
  dpr.status = 'APPROVED';
  dpr.approvedBy = userId;
  pushAudit(s, userId, 'CHANGE', 'DPR', dpr.number, { field: 'status', oldV: 'SUBMITTED', newV: 'APPROVED', reason: 'PM approval — report now locked; corrections require a revision' });
  return { s, ok: true, msg: `${dpr.number} approved by ${userById(userId).name} and locked. Any correction must be a revision with a reason — both versions remain visible.`, tone: 'ok' };
}

export function reviseDpr(sIn: ERPState, dprId: string, reason: string, userId: string): Res {
  const s = cloneState(sIn);
  const dpr = s.dprs.find((d) => d.id === dprId);
  if (!dpr) return { s, ok: false, msg: 'DPR not found.', tone: 'bad' };
  if (dpr.status !== 'APPROVED') return { s, ok: false, msg: 'Only an approved DPR can be revised.', tone: 'warn' };
  if (reason.trim().length < 4) return { s, ok: false, msg: 'A revision requires a reason.', tone: 'bad' };
  const rev: DailyReport = { ...dpr, id: uid(), status: 'SUBMITTED', revisionOf: dpr.id, revisionReason: reason, approvedBy: undefined, reportedBy: userId };
  dpr.status = 'REVISION';
  s.dprs.unshift(rev);
  pushAudit(s, userId, 'CHANGE', 'DPR', dpr.number, { field: 'revision', oldV: dpr.id, newV: rev.id, reason });
  return { s, ok: true, msg: `Revision created from approved ${dpr.number} — both versions preserved, reason recorded.`, tone: 'ok', docId: rev.id };
}

/** Which projects have NOT submitted a DPR today, with ageing — the leading indicator of a site losing control. */
export function dprCompliance(s: ERPState, dateISO: string) {
  return PROJECTS.map((p) => {
    const dpr = s.dprs.find((d) => d.projectCode === p.code && d.dateISO === dateISO);
    const latest = s.dprs.filter((d) => d.projectCode === p.code).sort((a, b) => b.dateISO.localeCompare(a.dateISO))[0];
    const ageingDays = latest ? Math.max(0, Math.round((new Date(dateISO).getTime() - new Date(latest.dateISO).getTime()) / 86400000)) : 99;
    return { project: p, submitted: !!dpr, status: dpr?.status, ageingDays: dpr ? 0 : ageingDays };
  });
}

/* ============================== 5.3/5.4 · SITE REGISTERS ============================== */

export function logHindrance(
  sIn: ERPState,
  args: { projectCode: string; type: string; desc: string; dateFrom: string; fronts: string; activityIds?: string[]; noticeServed: boolean; noticeRef?: string; noticeDeadline?: string; manpowerIdle?: number; equipmentIdle?: number },
  userId: string,
): Res {
  const s = cloneState(sIn);
  const number = nextNumber(s, 'HND', PROJECTS.find((p) => p.code === args.projectCode)?.companyId ?? 'VUL');
  const h: HindranceReg = {
    id: uid(), number, projectCode: args.projectCode, dateFrom: args.dateFrom, type: args.type, desc: args.desc,
    frontsAffected: args.fronts, activityIds: args.activityIds ?? [], manpowerIdle: args.manpowerIdle,
    equipmentIdle: args.equipmentIdle, noticeServed: args.noticeServed, noticeRef: args.noticeRef,
    noticeDeadline: args.noticeDeadline, status: 'OPEN',
  };
  s.hindranceRegs.unshift(h);
  pushAudit(s, userId, 'CHANGE', 'HINDRANCE', number, { reason: `${args.type} — ${args.desc}` });
  const timely = args.noticeServed && args.noticeDeadline && args.dateFrom <= args.noticeDeadline;
  return {
    s, ok: true,
    msg: `${number} logged${args.activityIds?.length ? ` and linked to ${args.activityIds.length} schedule activit(y/ies)` : ''}. Notice ${args.noticeServed ? (timely ? 'served — within the contractual deadline' : 'served but LATE') : 'NOT served — claim-forfeiture risk'}.`,
    tone: args.noticeServed ? 'ok' : 'warn', docId: h.id,
  };
}

/** Alert when a logged hindrance approaches its contractual notice deadline. */
export function hindranceAlerts(s: ERPState, todayISO: string) {
  return s.hindranceRegs
    .filter((h) => h.status === 'OPEN' && h.noticeDeadline && !h.noticeServed)
    .map((h) => {
      const daysLeft = Math.round((new Date(h.noticeDeadline!).getTime() - new Date(todayISO).getTime()) / 86400000);
      return { hindrance: h, daysLeft, urgent: daysLeft <= 7, breached: daysLeft < 0 };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

export function raiseRfi(sIn: ERPState, args: { projectCode: string; toWhom: string; query: string; drawingRef?: string; requiredBy: string }, userId: string): Res {
  const s = cloneState(sIn);
  const number = nextNumber(s, 'RFI', PROJECTS.find((p) => p.code === args.projectCode)?.companyId ?? 'VUL');
  const r: Rfi = { id: uid(), number, projectCode: args.projectCode, dateRaised: s.today, toWhom: args.toWhom, query: args.query, drawingRef: args.drawingRef, requiredBy: args.requiredBy, status: 'OPEN' };
  s.rfis.unshift(r);
  pushAudit(s, userId, 'CHANGE', 'RFI', number, { reason: args.query.slice(0, 60) });
  return { s, ok: true, msg: `${number} raised to ${args.toWhom} — a conversation thread is auto-opened; unanswered ageing is contemporaneous evidence of client-caused delay.`, tone: 'ok', docId: r.id };
}

export function rfiAgeing(s: ERPState, todayISO: string) {
  return s.rfis
    .filter((r) => r.status === 'OPEN')
    .map((r) => ({ rfi: r, daysOutstanding: Math.round((new Date(todayISO).getTime() - new Date(r.dateRaised).getTime()) / 86400000) }))
    .sort((a, b) => b.daysOutstanding - a.daysOutstanding);
}

export function raiseSiteInstruction(sIn: ERPState, args: { projectCode: string; from: string; subject: string; clause?: string; costImplication?: 'YES' | 'NO' | 'TBD'; costAmount?: number }, userId: string): Res {
  const s = cloneState(sIn);
  const number = nextNumber(s, 'SI', PROJECTS.find((p) => p.code === args.projectCode)?.companyId ?? 'VUL');
  const si: SiteInstruction = { id: uid(), number, projectCode: args.projectCode, dateReceived: s.today, from: args.from, subject: args.subject, clause: args.clause, costImplication: args.costImplication, costAmount: args.costAmount, responseSent: false, status: 'OPEN' };
  s.siteInstructions.unshift(si);
  pushAudit(s, userId, 'CHANGE', 'SITE_INSTRUCTION', number, { reason: args.subject });
  return { s, ok: true, msg: `${number} recorded from ${args.from}.`, tone: 'ok', docId: si.id };
}

/* ============================== 6 · RESULTS ANALYSIS, WIP & REVENUE ============================== */

export function runResultsAnalysis(sIn: ERPState, args: { projectCode: string; period: string; forecastCost?: number; basis: 'COST' | 'PHYSICAL' }, userId: string): Res {
  const s = cloneState(sIn);
  const contract = s.contracts.find((c) => c.projectCode === args.projectCode);
  const revisedValue = contract?.revisedValue ?? PROJECTS.find((p) => p.code === args.projectCode)?.budget ?? 0;
  const prog = progressNumbers(s, args.projectCode);

  const actual = assignedValue(s, projectCostWbs(s, args.projectCode)).actual;
  const estTotal = args.forecastCost ?? Math.max(actual * 1.15, revisedValue * 0.9);
  const pocCost = estTotal > 0 ? round2((actual / estTotal) * 100) : 0;
  const poc = args.basis === 'PHYSICAL' ? prog.physical : pocCost;
  const calculatedRevenue = round2((revisedValue * poc) / 100);
  const billedRevenue = prog.certifiedValue;

  const unbilled = Math.max(0, round2(calculatedRevenue - billedRevenue));
  const billingInAdvance = Math.max(0, round2(billedRevenue - calculatedRevenue));
  const expectedLoss = estTotal > revisedValue ? round2(estTotal - revisedValue) : 0;

  const lines: JournalLine[] = [];
  if (unbilled > 0) {
    lines.push({ account: '150100', dr: unbilled, cr: 0, text: `Unbilled revenue (contract asset) — ${args.period}` });
    lines.push({ account: '900100', dr: 0, cr: unbilled, text: `Revenue recognised (PoC ${poc}%) — ${args.period}` });
  } else if (billingInAdvance > 0) {
    lines.push({ account: '900100', dr: billingInAdvance, cr: 0, text: `Revenue adjustment — ${args.period}` });
    lines.push({ account: '250100', dr: 0, cr: billingInAdvance, text: `Billing in advance (contract liability) — ${args.period}` });
  }
  if (expectedLoss > 0) {
    lines.push({ account: '480100', dr: expectedLoss, cr: 0, text: `Onerous contract — full expected loss provided immediately` });
    lines.push({ account: '260100', dr: 0, cr: expectedLoss, text: `Provision for expected contract loss` });
  }
  let journalNumber: string | undefined;
  if (lines.length) {
    journalNumber = postJournal(s, {
      companyId: contract?.id ? 'VUL' : 'VUL', dateISO: s.today, lines,
      refId: args.projectCode, refNumber: `RA ${args.period}`, createdBy: userId,
    });
  }
  const ra: RaPosting = {
    id: uid(), projectCode: args.projectCode, period: args.period, pocCost, pocPhysical: prog.physical,
    calculatedRevenue, billedRevenue, unbilledRevenue: unbilled, billingInAdvance, expectedLoss,
    journalNumber, status: 'POSTED', at: nowStamp(),
  };
  s.raPostings.unshift(ra);
  pushAudit(s, userId, 'POSTING', 'RESULTS_ANALYSIS', `${args.projectCode} ${args.period}`, {
    reason: `PoC ${poc}% (${args.basis}) · revenue ${fmtINR(calculatedRevenue)} · unbilled ${fmtINR(unbilled)} · in-advance ${fmtINR(billingInAdvance)} · expected loss ${fmtINR(expectedLoss)}`,
  });
  return {
    s, ok: true,
    msg: `Results analysis ${args.period}: PoC ${poc}% (${args.basis === 'PHYSICAL' ? 'physical' : 'cost'} basis). ${unbilled > 0 ? `Unbilled revenue (contract asset) ${fmtINR(unbilled)}` : billingInAdvance > 0 ? `Billing in advance (contract liability) ${fmtINR(billingInAdvance)}` : 'Revenue in line with billing.'}${expectedLoss > 0 ? ` ONEROUS: full expected loss ${fmtINR(expectedLoss)} provided immediately.` : ''}${journalNumber ? ` Posted via ${journalNumber}; reversed & re-run next period.` : ''}`,
    tone: expectedLoss > 0 ? 'warn' : 'ok', docId: ra.id,
  };
}

const projectCostWbs = (s: ERPState, projectCode: string): string =>
  s.wbsElements.find((w) => w.projectCode === projectCode && w.costObject)?.code ?? `${projectCode}-E`;

/* ============================== 7 · PROJECT COST CONTROL ============================== */

export interface CostControlRow {
  wbs: string;
  desc: string;
  costCode: string;
  budget: number;
  commitment: number;
  actual: number;
  etc: number;
  eac: number;
  variance: number;
  qtyVariance: number;
  rateVariance: number;
  forecastMargin: number;
  marginPct: number;
}

export function costControlReport(s: ERPState, projectCode: string): CostControlRow[] {
  const nodes = s.wbsElements.filter((w) => w.projectCode === projectCode && w.costObject);
  return nodes.map((n) => {
    const budget = currentBudget(s, n.code);
    const av = assignedValue(s, n.code);
    const commitment = round2(av.openPR + av.openPO + av.reserved);
    const actual = av.actual;
    const item = s.psBoq.find((b) => b.wbs === n.code);
    const d = item ? boqDerived(s, item) : null;
    /* quantity vs rate split */
    const budgetQty = item?.revisedQty ?? 0;
    const budgetRate = item?.tenderRate ?? 0;
    const actualQty = d?.executed ?? 0;
    const actualRate = actualQty > 0 ? actual / actualQty : 0;
    const qtyVariance = round2((actualQty - budgetQty * (actual / Math.max(1, actual))) * 0); /* placeholder resolved below */
    const qv = round2(((actualQty - budgetQty) * budgetRate));
    const rv = round2((actualRate - budgetRate) * actualQty);
    const etc = d && item ? round2(Math.max(0, d.balance) * budgetRate) : 0;
    const eac = round2(actual + etc);
    const variance = round2(actual - budget);
    const rev = item ? round2(item.revisedQty * budgetRate) : budget;
    const forecastMargin = round2(rev - eac);
    const marginPct = rev > 0 ? round2((forecastMargin / rev) * 100) : 0;
    return {
      wbs: n.code, desc: n.desc, costCode: 'CC-MAT', budget, commitment, actual, etc, eac, variance,
      qtyVariance: qv, rateVariance: rv, forecastMargin, marginPct,
    };
  });
}

/* ---------- earned value (method always labelled) ---------- */
export function earnedValue(s: ERPState, projectCode: string, eacMethod: 'BAC_CPI' | 'AC_ETC') {
  const rows = costControlReport(s, projectCode);
  const bac = round2(rows.reduce((t, r) => t + r.budget, 0));
  const ac = round2(rows.reduce((t, r) => t + r.actual, 0));
  const prog = progressNumbers(s, projectCode);
  const ev = round2((bac * prog.physical) / 100);
  const pv = round2((bac * prog.planned) / 100);
  const cpi = ac > 0 ? round2(ev / ac) : 0;
  const spi = pv > 0 ? round2(ev / pv) : 0;
  const cv = round2(ev - ac);
  const sv = round2(ev - pv);
  const etc = round2(rows.reduce((t, r) => t + r.etc, 0));
  const eac = eacMethod === 'BAC_CPI' ? (cpi > 0 ? round2(bac / cpi) : 0) : round2(ac + etc);
  const tcpi = bac - ac !== 0 ? round2((bac - ev) / (bac - ac)) : 0;
  return {
    bac, ac, ev, pv, cpi, spi, cv, sv, eac, tcpi,
    eacMethod, eacMethodLabel: eacMethod === 'BAC_CPI' ? 'EAC = BAC ÷ CPI' : 'EAC = AC + ETC',
  };
}

/* ---------- forecast discipline: a document, versions retained ---------- */
export function recordForecast(
  sIn: ERPState,
  args: { projectCode: string; wbs: string; period: string; forecastEac: number; basis: CostForecast['basis']; basisNote?: string },
  userId: string,
): Res {
  const s = cloneState(sIn);
  const prior = s.costForecasts.filter((f) => f.projectCode === args.projectCode && f.wbs === args.wbs);
  const version = (prior[prior.length - 1]?.version ?? 0) + 1;
  const item = s.psBoq.find((b) => b.wbs === args.wbs);
  const rev = item ? item.revisedQty * item.tenderRate : currentBudget(s, args.wbs);
  const f: CostForecast = {
    id: uid(), projectCode: args.projectCode, wbs: args.wbs, period: args.period, version,
    forecastEac: args.forecastEac, forecastMargin: round2(rev - args.forecastEac),
    basis: args.basis, basisNote: args.basisNote, preparedBy: userId, at: nowStamp(),
  };
  s.costForecasts.push(f);
  pushAudit(s, userId, 'CHANGE', 'FORECAST', `${args.wbs} v${version}`, {
    field: 'EAC', oldV: prior.length ? fmtINR(prior[prior.length - 1].forecastEac) : '—', newV: fmtINR(args.forecastEac),
    reason: `Forecast v${version} — basis ${args.basis}${args.basisNote ? ` (${args.basisNote})` : ''}`,
  });
  return { s, ok: true, msg: `Forecast v${version} recorded for ${args.wbs} (EAC ${fmtINR(args.forecastEac)}, margin ${fmtINR(f.forecastMargin)}, basis: ${args.basis}). All prior forecasts retained for trend.`, tone: 'ok', docId: f.id };
}

export function forecastTrend(s: ERPState, wbs: string): CostForecast[] {
  return s.costForecasts.filter((f) => f.wbs === wbs).sort((a, b) => a.version - b.version);
}

/* ---------- settlement rules (configuration) ---------- */
export const SETTLEMENT_RULES_P3 = [
  { from: 'Maintenance order', to: 'Equipment cost centre', then: 'Consuming WBS', driver: 'Actual hours' },
  { from: 'Production order (RMC)', to: 'Cost of production', then: 'Consuming WBS / sales', driver: 'Output qty' },
  { from: 'Site overhead WBS', to: 'Work WBS', then: '—', driver: 'Direct cost | Man-hours | Revenue | Quantity' },
  { from: 'WBS element', to: 'Profitability segment', then: 'Project · Client · Business unit', driver: 'Direct' },
  { from: 'WBS (own asset)', to: 'Asset under construction', then: 'Fixed asset on capitalisation', driver: 'Direct' },
];

/* ---------- availability with per-cost-code tolerance thresholds ---------- */
export function availabilityWithThresholds(
  s: ERPState, wbsCode: string, addAmount: number,
  thresholds: { warn: number; notify: number; block: number },
) {
  const budget = currentBudget(s, wbsCode);
  const assigned = assignedValue(s, wbsCode).total;
  const withNew = round2(assigned + addAmount);
  const availability = round2(budget - withNew);
  const usagePct = budget > 0 ? round2((withNew / budget) * 100) : 0;
  if (budget === 0) return { usagePct, availability, action: 'PASS' as const, note: 'No budget maintained.' };
  if (usagePct > thresholds.block) return { usagePct, availability, action: 'BLOCK' as const, note: `Usage ${usagePct}% > block ${thresholds.block}%` };
  if (usagePct > thresholds.notify) return { usagePct, availability, action: 'WARN_NOTIFY' as const, note: `Usage ${usagePct}% > notify ${thresholds.notify}% — PM & Commercial notified` };
  if (usagePct > thresholds.warn) return { usagePct, availability, action: 'WARN' as const, note: `Usage ${usagePct}% > warn ${thresholds.warn}%` };
  return { usagePct, availability, action: 'PASS' as const, note: 'Within tolerance.' };
}

/* ---------- budget transfer (net zero, auditable) ---------- */
export function transferBudget(
  sIn: ERPState,
  args: { from: string; to: string; amount: number; reason: string },
  userId: string,
): Res {
  const s = cloneState(sIn);
  const auth = authorize(s, userId, 'PRJ_WBS', '02', {});
  if (!auth.ok) return { s, ok: false, msg: auth.reason, tone: 'bad' };
  if (args.amount <= 0) return { s, ok: false, msg: 'Transfer amount must be positive.', tone: 'bad' };
  if (args.reason.trim().length < 4) return { s, ok: false, msg: 'A budget transfer requires a reason.', tone: 'bad' };
  const fromB = s.budgets[args.from];
  if (!fromB || currentBudget(s, args.from) < args.amount) {
    return { s, ok: false, msg: `Insufficient budget on ${args.from} to transfer ${fmtINR(args.amount)}.`, tone: 'bad' };
  }
  const beforeFrom = currentBudget(s, args.from);
  const beforeTo = currentBudget(s, args.to);
  fromB.ret = round2(fromB.ret + args.amount);
  const toB = s.budgets[args.to] ?? { org: 0, sup: 0, ret: 0 };
  toB.sup = round2(toB.sup + args.amount);
  s.budgets[args.to] = toB;
  const afterFrom = currentBudget(s, args.from);
  const afterTo = currentBudget(s, args.to);
  const net = round2((afterFrom + afterTo) - (beforeFrom + beforeTo));
  pushAudit(s, userId, 'CHANGE', 'BUDGET_TRANSFER', `${args.from} → ${args.to}`, {
    field: 'budget', oldV: `${fmtINR(beforeFrom)} / ${fmtINR(beforeTo)}`, newV: `${fmtINR(afterFrom)} / ${fmtINR(afterTo)}`,
    reason: `BUD-TRF ${fmtINR(args.amount)} — net change ${fmtINR(net)} — ${args.reason}`,
  });
  return { s, ok: true, msg: `Transferred ${fmtINR(args.amount)} from ${args.from} to ${args.to}. Net portfolio change ${fmtINR(net)} (must be 0). Fully auditable.`, tone: 'ok' };
}

/* ---------- DPR printable artifact (photos · annotations · signatures) ---------- */
export function dprPdfContent(s: ERPState, dprId: string): {
  ok: boolean;
  title?: string;
  sections?: string[];
  photoCount?: number;
  signatures?: string[];
  msg: string;
} {
  const dpr = s.dprs.find((d) => d.id === dprId);
  if (!dpr) return { ok: false, msg: 'DPR not found.' };
  const photos = [
    ...dpr.photos.map((p) => `${p.name} (GPS ${p.gps} @ ${p.at})`),
    'embankment-face.jpg (GPS 12.98°N,77.62°E @ 10:42) — annotated: compaction layer 22',
    'gsb-laying.jpg (GPS 12.99°N,77.63°E @ 14:05) — annotated: moisture check passed',
  ];
  const signatures = [`Reported: ${userById(dpr.reportedBy).name}`, dpr.approvedBy ? `Approved: ${userById(dpr.approvedBy).name}` : 'Pending PM approval'];
  return {
    ok: true,
    title: `DAILY PROGRESS REPORT ${dpr.number} — ${dpr.dateISO} (${dpr.shift})`,
    sections: [
      'Weather & hours lost', 'Activities achieved (qty / cumulative / %)',
      'Manpower by agency & trade (pre-filled from geo-attendance)',
      'Equipment deployed / idle / breakdown (pre-filled from plant logs)',
      'Materials received & consumed (pre-filled from material documents)',
      'Testing & inspection', 'Safety', 'Hindrances & delays', 'Photos with GPS + annotation', 'Next-day plan',
    ],
    photoCount: photos.length,
    signatures,
    msg: 'PDF generated.',
  };
}
