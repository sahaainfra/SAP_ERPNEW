import type { ERPState, Res, JournalLine, WbsNode, RaRunRecord } from './types';
import {
  cloneState, round2, uid, pushAudit, authorize, nextNumber, postJournal, docById,
  fmtNum, fmtINR, userById, nowStamp, assignedValue, currentBudget, checkAvailability,
} from './engine';
import { WBS_TREE, BUDGET_TOLERANCE, PROJECTS, ESCALATION_COMPONENTS } from './config';

export const wbsNode = (code: string): WbsNode | undefined => WBS_TREE.find((w) => w.code === code);
export const wbsChildren = (code: string): WbsNode[] => WBS_TREE.filter((w) => w.parent === code);
export const isSummary = (n: WbsNode): boolean => n.nodeType === 'SUMMARY';
export const acceptsCost = (n: WbsNode): boolean => n.nodeType === 'ACCOUNT_ASSIGNMENT' || n.nodeType === 'BOTH';
export const acceptsBilling = (n: WbsNode): boolean => n.nodeType === 'BILLING' || n.nodeType === 'BOTH';

/* ---------- Budget documents (BUD-ORG / BUD-SUP / BUD-RET) ---------- */

export function createBudgetDoc(
  sIn: ERPState,
  args: { wbs: string; amount: number; kind: 'BUD-ORG' | 'BUD-SUP' | 'BUD-RET'; reason: string; submit: boolean },
  userId: string,
): Res {
  const s = cloneState(sIn);
  const node = wbsNode(args.wbs);
  if (!node) return { s, ok: false, msg: 'Unknown WBS element', tone: 'bad' };
  if (!node.budgetElement) return { s, ok: false, msg: `${args.wbs} is not a budget element — budget can only be held on planning nodes.`, tone: 'bad' };
  const auth = authorize(s, userId, 'PRJ_WBS', '01', {});
  if (!auth.ok) return { s, ok: false, msg: auth.reason, tone: 'bad' };
  if (args.amount <= 0) return { s, ok: false, msg: 'Budget amount must be positive.', tone: 'bad' };
  if (args.reason.trim().length < 4) return { s, ok: false, msg: 'Budget change requires a reason (min 4 chars) — it is an approved-document event.', tone: 'bad' };

  const id = uid();
  const companyId = PROJECTS.find((p) => p.code === node.projectCode)?.companyId ?? 'VUL';
  if (!args.submit) {
    s.docs.unshift({ id, number: null, type: args.kind, module: 'PRJ', companyId, dateISO: s.today, status: 'DRAFT', createdBy: userId, items: [], total: args.amount, wbs: args.wbs, reason: args.reason });
    return { s, ok: true, msg: 'Budget draft saved — no number consumed.', tone: 'info', docId: id };
  }
  const number = nextNumber(s, 'BD', companyId);
  s.docs.unshift({ id, number, type: args.kind, module: 'PRJ', companyId, dateISO: s.today, status: 'PENDING_RELEASE', createdBy: userId, items: [], total: args.amount, wbs: args.wbs, reason: args.reason });
  pushAudit(s, userId, 'POSTING', 'BUDGET_DOC', number, { docId: id, reason: `${args.kind} ${fmtINR(args.amount)} on ${args.wbs} — ${args.reason}` });
  return { s, ok: true, msg: `${number} (${args.kind}) submitted — approval required before the budget changes.`, tone: 'ok', docId: id };
}

/** Called by the release engine when a BUD-* document is approved — applies the budget change. */
export function applyBudgetOnRelease(s: ERPState, docId: string): void {
  const doc = docById(s, docId);
  if (!doc || !doc.wbs || !doc.type.startsWith('BUD-')) return;
  const b = s.budgets[doc.wbs] ?? { org: 0, sup: 0, ret: 0 };
  if (doc.type === 'BUD-ORG') b.org = round2(b.org + doc.total);
  if (doc.type === 'BUD-SUP') b.sup = round2(b.sup + doc.total);
  if (doc.type === 'BUD-RET') b.ret = round2(b.ret + doc.total);
  s.budgets[doc.wbs] = b;
  pushAudit(s, doc.createdBy, 'CHANGE', 'BUDGET', doc.wbs, {
    field: doc.type, oldV: fmtNum(currentBudget(s, doc.wbs) - doc.total, 0), newV: fmtNum(currentBudget(s, doc.wbs), 0),
    reason: `Approved budget document ${doc.number} — ${doc.reason}`, docId: doc.id,
  });
}

export const toleranceProfile = () => BUDGET_TOLERANCE;

/* ---------- Results analysis (PoC, unbilled, onerous) ---------- */

export interface RaInput {
  projectCode: string;
  period: string; // YYYY-MM
  actualCost: number;
  estimatedTotalCost: number;
  revisedContractValue: number;
  billedToDate: number;
  physicalPct: number;
  basis: 'COST' | 'PHYSICAL';
}

export function runResultsAnalysis(sIn: ERPState, args: RaInput, userId: string, post = true): Res {
  const s = cloneState(sIn);
  const auth = authorize(s, userId, 'FIN_DOC', '01', {});
  if (!auth.ok) return { s, ok: false, msg: auth.reason, tone: 'bad' };

  const pocCost = args.estimatedTotalCost > 0 ? round2((args.actualCost / args.estimatedTotalCost) * 100) : 0;
  const poc = args.basis === 'COST' ? pocCost : round2(args.physicalPct);
  const calculatedRevenue = round2((args.revisedContractValue * poc) / 100);
  const unbilled = Math.max(0, round2(calculatedRevenue - args.billedToDate));
  const billingInAdvance = Math.max(0, round2(args.billedToDate - calculatedRevenue));
  const expectedLoss = Math.max(0, round2(args.estimatedTotalCost - args.revisedContractValue));

  const rec: RaRunRecord = {
    id: uid(), projectCode: args.projectCode, period: args.period,
    pocCost, pocPhysical: round2(args.physicalPct),
    calculatedRevenue, billedToDate: args.billedToDate, unbilled, billingInAdvance,
    expectedLoss, at: nowStamp(), by: userId,
  };

  if (post) {
    const companyId = PROJECTS.find((p) => p.code === args.projectCode)?.companyId ?? 'VUL';
    const lines: JournalLine[] = [];
    if (unbilled > 0) {
      lines.push({ account: '150100', dr: unbilled, cr: 0, text: `Unbilled revenue (contract asset) — ${args.period}` });
      lines.push({ account: '310300', dr: 0, cr: unbilled, text: `Revenue recognised (PoC ${poc}%) — ${args.period}` });
    }
    if (billingInAdvance > 0) {
      lines.push({ account: '310300', dr: billingInAdvance, cr: 0, text: `Revenue deferred (billing in advance) — ${args.period}` });
      lines.push({ account: '220100', dr: 0, cr: billingInAdvance, text: `Billing in advance (contract liability) — ${args.period}` });
    }
    if (expectedLoss > 0) {
      lines.push({ account: '440300', dr: expectedLoss, cr: 0, text: `Expected loss — onerous contract provision (full, immediate)` });
      lines.push({ account: '220200', dr: 0, cr: expectedLoss, text: `Provision — onerous contract ${args.projectCode}` });
    }
    if (lines.length) {
      const number = postJournal(s, { companyId, dateISO: s.today, lines, refId: rec.id, refNumber: `RA/${args.period}`, createdBy: userId });
      rec.journalNumber = number;
    }
    pushAudit(s, userId, 'POSTING', 'RESULTS_ANALYSIS', `${args.projectCode} ${args.period}`, {
      docId: rec.id, reason: `PoC ${poc}% (${args.basis}) · calculated ${fmtINR(calculatedRevenue)} · unbilled ${fmtINR(unbilled)} · onerous ${fmtINR(expectedLoss)}`,
    });
  }

  s.raRunHistory.unshift(rec);
  const tone = rec.expectedLoss > 0 ? 'warn' : 'ok';
  return {
    s, ok: true, tone,
    msg: rec.expectedLoss > 0
      ? `RA run: project forecast to lose — entire expected loss ${fmtINR(rec.expectedLoss)} provisioned immediately (onerous contract).`
      : `RA run posted — PoC ${poc}% · unbilled ${fmtINR(unbilled)} · billing in advance ${fmtINR(billingInAdvance)}.`,
  };
}

/* ---------- Earned value ---------- */

export interface EvmResult { pv: number; ev: number; ac: number; cv: number; sv: number; cpi: number; spi: number; eacCpi: number; eacActualEtc: number; bac: number; }

export function earnedValue(bac: number, plannedPct: number, earnedPct: number, actualCost: number, etc: number): EvmResult {
  const pv = round2((bac * plannedPct) / 100);
  const ev = round2((bac * earnedPct) / 100);
  const ac = round2(actualCost);
  const cpi = ac > 0 ? round2(ev / ac) : 0;
  const spi = pv > 0 ? round2(ev / pv) : 0;
  return { pv, ev, ac, cv: round2(ev - ac), sv: round2(ev - pv), cpi, spi, eacCpi: cpi > 0 ? round2(bac / cpi) : 0, eacActualEtc: round2(ac + etc), bac };
}

/* ---------- Cost control: quantity vs rate variance ---------- */

export interface CostVariance { costCode: string; budget: number; commitment: number; actual: number; forecast: number; variance: number; qtyVariance: number; rateVariance: number; }

export function costControlLine(budgetQty: number, budgetRate: number, actualQty: number, actualRate: number, costCode: string, commitment: number, etc: number): CostVariance {
  const budget = round2(budgetQty * budgetRate);
  const actual = round2(actualQty * actualRate);
  const qtyVariance = round2((actualQty - budgetQty) * budgetRate);
  const rateVariance = round2((actualRate - budgetRate) * actualQty);
  return { costCode, budget, commitment: round2(commitment), actual, forecast: round2(actual + etc), variance: round2(actual - budget), qtyVariance, rateVariance };
}

/* ---------- Settlement ---------- */

export function settleMaintenanceOrder(sIn: ERPState, orderId: string, userId: string): Res {
  const s = cloneState(sIn);
  const order = s.maintOrders.find((o) => o.id === orderId);
  if (!order) return { s, ok: false, msg: 'Maintenance order not found', tone: 'bad' };
  if (order.settled) return { s, ok: false, msg: 'Order already settled.', tone: 'warn' };
  const cost = round2(order.sparesCost + order.laborCost + order.extCost);
  if (cost <= 0) return { s, ok: false, msg: 'No cost collected on order yet — issue spares (210) first.', tone: 'warn' };
  const eq = s.equipment.find((e) => e.code === order.equipmentCode);
  const wbs = eq?.wbs ?? 'PRJ-NH47-E';
  const companyId = 'VUL';
  const lines: JournalLine[] = [
    { account: '410100', dr: cost, cr: 0, text: `Settlement — maintenance ${order.number} to consuming WBS ${wbs}`, wbs },
    { account: '420100', dr: 0, cr: cost, text: `Settlement — maintenance order cost cleared`, cc: 'CC-WSH' },
  ];
  postJournal(s, { companyId, dateISO: s.today, lines, refId: order.id, refNumber: order.number, createdBy: userId });
  order.settled = true;
  pushAudit(s, userId, 'POSTING', 'SETTLEMENT', order.number, { reason: `Maintenance order settled → equipment cost centre → WBS ${wbs} (${fmtINR(cost)})`, docId: order.id });
  return { s, ok: true, msg: `${order.number} settled ${fmtINR(cost)}: maintenance order → equipment cost centre → WBS ${wbs}.`, tone: 'ok' };
}

/* ---------- WBS versioning ---------- */

export function restructureWbs(sIn: ERPState, projectCode: string, mapping: { from: string; to: string }[], reason: string, userId: string): Res {
  const s = cloneState(sIn);
  if (reason.trim().length < 4) return { s, ok: false, msg: 'Restructuring requires a stated reason.', tone: 'bad' };
  const versions = s.wbsVersions[projectCode] ?? [];
  const version = versions.length + 1;
  versions.push({ version, at: nowStamp(), by: userId, reason, mapping });
  s.wbsVersions[projectCode] = versions;
  pushAudit(s, userId, 'CHANGE', 'WBS_STRUCTURE', `${projectCode} v${version}`, { reason, field: 'mapping', newV: mapping.map((m) => `${m.from}→${m.to}`).join('; ') });
  return { s, ok: true, msg: `WBS version ${version} created for ${projectCode} — historical postings read through the mapping.`, tone: 'ok' };
}

/** Resolve a historical WBS code through version mappings to its current node. */
export function resolveWbs(s: ERPState, projectCode: string, code: string): string {
  const versions = s.wbsVersions[projectCode] ?? [];
  let cur = code;
  for (const v of versions) {
    const m = v.mapping.find((x) => x.from === cur);
    if (m) cur = m.to;
  }
  return cur;
}

/* ---------- Physical vs financial progress ---------- */

export function physicalProgress(s: ERPState, wbs: string): number {
  return s.physicalProgress[wbs] ?? 0;
}

export function financialProgress(s: ERPState, contractValue: number, certifiedValue: number): number {
  return contractValue > 0 ? round2((certifiedValue / contractValue) * 100) : 0;
}

export { ESCALATION_COMPONENTS };
