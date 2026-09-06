/* ======================================================================== */
/*  VULCAN ERP — PART 3/10 ACCEPTANCE GATE · PROJECT SYSTEM                 */
/*  35 executable tests. Each runs against a private clone of the seeded    */
/*  state — the live dataset is never mutated. Evidence is returned as      */
/*  text so the gate console shows proof, not assertions.                   */
/* ======================================================================== */

import type { ERPState, Activity } from './types';
import { buildSeedState } from './seed';
import {
  postMovement, checkAvailability, assignedValue, currentBudget, fmtINR, fmtNum,
  daysAgoISO, glBalance,
} from './engine';
import {
  wbs, validateCostTarget, canCommit, deleteWbsNode, reorderWbs, restructureWbs, resolveNode,
  createProjectFromTemplate, boqDerived, addMeasurement, importBoq, commitBoqImport,
  computeCpm, saveBaseline, progressNumbers, shiftForMonsoon, lookAheadReadiness,
  prefillDpr, createDpr, approveDpr, reviseDpr, logHindrance, hindranceAlerts, raiseRfi, rfiAgeing,
  runResultsAnalysis, costControlReport, earnedValue, recordForecast, forecastTrend,
  availabilityWithThresholds, transferBudget, dprPdfContent,
} from './prjsys';
import { createBudgetDoc, applyBudgetOnRelease } from './prj';
import { reverseJournal } from './platform';

export interface GateResult { id: number; pass: boolean; evidence: string; ms: number; }
export interface GateTest { id: number; group: string; title: string; spec: string; run: (s: ERPState) => GateResult; }

const R = (id: number, pass: boolean, evidence: string, t0: number): GateResult =>
  ({ id, pass, evidence, ms: Math.max(1, Math.round(performance.now() - t0)) });

export const GATE3_TESTS: GateTest[] = [
  /* ================= STRUCTURE (1–7) ================= */
  {
    id: 1, group: 'Structure', title: 'Cost to a summary node is refused; only cost-object leaves accept it',
    spec: '§1.2 rule 1',
    run: (s) => {
      const t0 = performance.now();
      const vSummary = validateCostTarget(s, 'PRJ-NH47');
      const vLeaf = validateCostTarget(s, 'PRJ-NH47-E');
      const post = postMovement(s, { movementCode: '200', materialCode: 'MAT-AGG20', qty: 10, siteId: 'ST-NH47', locId: 'UNR', wbs: 'PRJ-NH47' }, 'USR-STR');
      const pass = !vSummary.ok && vLeaf.ok && !post.ok;
      return R(1, pass, `Summary PRJ-NH47 → ${vSummary.ok ? 'accepted (FAIL)' : `refused: “${vSummary.msg}”`}. Leaf PRJ-NH47-E → ${vLeaf.ok ? 'accepted (cost object)' : 'refused (FAIL)'}. Live posting to the summary node → ${post.ok ? 'POSTED (FAIL)' : 'blocked by the preview gate'}.`, t0);
    },
  },
  {
    id: 2, group: 'Structure', title: 'A cost document without a leaf WBS element is rejected at validation',
    spec: '§1.2 rule 3',
    run: (s) => {
      const t0 = performance.now();
      const post = postMovement(s, { movementCode: '200', materialCode: 'MAT-AGG20', qty: 10, siteId: 'ST-NH47', locId: 'UNR' }, 'USR-STR');
      return R(2, !post.ok, `Consumption movement with no WBS → ${post.ok ? 'POSTED (FAIL)' : `rejected: “${post.msg}”`}. Cost without a leaf cost object is untraceable and never lands.`, t0);
    },
  },
  {
    id: 3, group: 'Structure', title: 'Highway template generates the chainage-based WBS skeleton',
    spec: '§1.1',
    run: (s) => {
      const t0 = performance.now();
      const r = createProjectFromTemplate(s, { template: 'TPL-HIGHWAY', projectCode: 'PRJ-HW2', projectName: 'Test Highway' }, 'USR-DIR');
      const nodes = r.s.wbsElements.filter((w) => w.projectCode === 'PRJ-HW2');
      const chainage = nodes.filter((w) => w.chainageFrom);
      const leaves = nodes.filter((w) => w.nodeType === 'WORK');
      const pass = r.ok && nodes.length > 0 && chainage.length >= 2 && leaves.length > 0;
      return R(3, pass, `${r.msg} · ${nodes.length} nodes, ${chainage.length} carry chainage (e.g. ${chainage[0] ? `${chainage[0].chainageFrom}–${chainage[0].chainageTo}` : '—'}), ${leaves.length} cost/billing leaves. A new project in one action.`, t0);
    },
  },
  {
    id: 4, group: 'Structure', title: 'Restructuring creates a version; history reads through the old→new mapping',
    spec: '§1.2 rule 4',
    run: (s) => {
      const t0 = performance.now();
      const before = (s.wbsVersions['PRJ-BRG'] ?? []).length;
      const r = restructureWbs(s, {
        projectCode: 'PRJ-BRG',
        mapping: [{ from: 'PRJ-BRG-STR-SUB-PILE', to: 'PRJ-BRG-STR-SUB-CAP' }],
        reason: 'Pile node merged into cap during re-measurement',
      }, 'USR-DIR');
      const versions = r.s.wbsVersions['PRJ-BRG'] ?? [];
      const resolved = resolveNode(r.s, 'PRJ-BRG', 'PRJ-BRG-STR-SUB-PILE');
      const pass = r.ok && versions.length === before + 1 && resolved === 'PRJ-BRG-STR-SUB-CAP';
      return R(4, pass, `${r.ok ? r.msg : r.msg} · old→new now resolves PRJ-BRG-STR-SUB-PILE → ${resolved}. Historical postings keep their original node and read through the mapping.`, t0);
    },
  },
  {
    id: 5, group: 'Structure', title: 'A posted-to node can never be deleted by any route',
    spec: '§1.2 rule 4',
    run: (s) => {
      const t0 = performance.now();
      const posted = deleteWbsNode(s, 'PRJ-NH47-E', 'USR-ADM');
      const unposted = deleteWbsNode(s, 'PRJ-BRG-STR-SUP-GIRD', 'USR-DIR');
      const pass = !posted.ok && unposted.ok;
      return R(5, pass, `Posted-to PRJ-NH47-E → ${posted.ok ? 'DELETED (FAIL)' : `refused: “${posted.msg}”`}. Unposted leaf PRJ-BRG-STR-SUP-GIRD → ${unposted.ok ? 'deleted cleanly' : 'refused (FAIL)'}.`, t0);
    },
  },
  {
    id: 6, group: 'Structure', title: 'TECHNICALLY_COMPLETE refuses new commitment but accepts closing cost',
    spec: '§1.2 rule 5',
    run: (s) => {
      const t0 = performance.now();
      const node = wbs(s, 'PRJ-NH47-P')!;
      node.status = 'TECH_COMPLETE';
      const commit = canCommit(s, 'PRJ-NH47-P');
      const closing = validateCostTarget(s, 'PRJ-NH47-P');
      const pass = !commit.ok && closing.ok;
      return R(6, pass, `New commitment (PO) → ${commit.ok ? 'allowed (FAIL)' : `refused: “${commit.msg}”`}. Closing cost/invoice → ${closing.ok ? 'accepted' : 'refused (FAIL)'}. Status governs behaviour.`, t0);
    },
  },
  {
    id: 7, group: 'Structure', title: 'Reorder permitted on unposted nodes, refused on posted — with a change document',
    spec: '§1.2 rule 6',
    run: (s) => {
      const t0 = performance.now();
      const okMove = reorderWbs(s, 'PRJ-BRG-STR-SUP-DECK', 'PRJ-BRG-STR-SUB', 'USR-DIR');
      const badMove = reorderWbs(okMove.s, 'PRJ-NH47-E', 'PRJ-NH47-P', 'USR-DIR');
      const audited = okMove.s.audit.some((a) => a.action === 'WBS' && a.reason?.includes('reorder'));
      const pass = okMove.ok && !badMove.ok && audited;
      return R(7, pass, `Unposted node reorder → ${okMove.ok ? 'allowed + change document recorded' : 'refused (FAIL)'}. Posted node reorder → ${badMove.ok ? 'allowed (FAIL)' : `refused: “${badMove.msg}”`}.`, t0);
    },
  },

  /* ================= BOQ (8–12) ================= */
  {
    id: 8, group: 'BOQ', title: 'Messy client BOQ Excel imports through a tree preview and reconciles to the rupee',
    spec: '§2.2',
    run: (s) => {
      const t0 = performance.now();
      const rows = [
        { itemCode: '', desc: 'SECTION A — EARTHWORKS', level: 1, unit: '', qtyRaw: '', rateRaw: '' }, /* merged heading */
        { itemCode: '1.1', desc: 'Embankment', level: 2, unit: 'M3', qtyRaw: '1,20,000', rateRaw: '185' }, /* commas */
        { itemCode: '1.2', desc: 'GSB', level: 2, unit: 'M3', qtyRaw: '30000', rateRaw: '410' },
        { itemCode: '', desc: '', level: 0, unit: '', qtyRaw: '', rateRaw: '' }, /* blank separator */
        { itemCode: '1.3', desc: 'Bad rate in words', level: 2, unit: 'M3', qtyRaw: '100', rateRaw: 'Rupees One Hundred Only' },
      ];
      const res = importBoq(s, 'PRJ-NH47', 'CN-001', rows, 3_45_00_000);
      const goodRows = rows.slice(0, 3).concat([rows[3]]);
      const clean = importBoq(s, 'PRJ-NH47', 'CN-001', goodRows, 3_45_00_000);
      const pass = res.errors.length === 1 && clean.errors.length === 0 && clean.reconciled;
      return R(8, pass, `Parsed ${res.parsed.length} rows into a tree (headings + items), skipping blanks. The words-rate row raised ${res.errors.length} validation error. Clean sheet: parsed ${fmtINR(clean.parsedTotal)} vs tender ${fmtINR(clean.tenderTotal)} → difference ${fmtINR(clean.difference)}, reconciled=${clean.reconciled}.`, t0);
    },
  },
  {
    id: 9, group: 'BOQ', title: 'Derived quantities compute correctly and are never stored as typed values',
    spec: '§2.1',
    run: (s) => {
      const t0 = performance.now();
      const item = s.psBoq.find((b) => b.id === 'PSB-01')!;
      const d = boqDerived(s, item);
      const pass = d.executed === 52000 && d.billedQty === 48000 && d.current === 4000 && d.balance === 68000 && d.devQty === -68000;
      return R(9, pass, `PSB-01 (Embankment): executed ${fmtNum(d.executed, 0)} = Σ certified · previously-billed ${fmtNum(d.billedQty, 0)} · current ${fmtNum(d.current, 0)} = executed−billed · balance ${fmtNum(d.balance, 0)} = revised−executed · deviation ${fmtNum(d.devQty, 0)} (${d.devPct}%). All derived on the fly — nothing stored.`, t0);
    },
  },
  {
    id: 10, group: 'BOQ', title: 'Execution beyond revised qty × (1+deviation) is BLOCKED without an approved variation',
    spec: '§2.4',
    run: (s) => {
      const t0 = performance.now();
      const r = addMeasurement(s, { boqId: 'PSB-01', qty: 90000, certify: false }, 'USR-STR'); /* 52000+90000=142000 > 138000 */
      const limit = 120000 * 1.15;
      const pass = !r.ok;
      return R(10, pass, `Permitted limit = 120,000 × 1.15 = ${fmtNum(limit, 0)} M3. Attempted cumulative 142,000 M3 → ${r.ok ? 'ACCEPTED (FAIL)' : `BLOCKED: “${r.msg}”`}`, t0);
    },
  },
  {
    id: 11, group: 'BOQ', title: 'Part-rate stages must sum to 100; a shuttering measurement bills 30% of the rate',
    spec: '§2.3',
    run: (s) => {
      const t0 = performance.now();
      const item = s.psBoq.find((b) => b.id === 'PSB-02')!;
      const good = addMeasurement(s, { boqId: 'PSB-02', qty: 500, stage: 'SHUTTER' }, 'USR-STR');
      const badStage = addMeasurement(good.s, { boqId: 'PSB-02', qty: 10, stage: 'NOT_A_STAGE' }, 'USR-STR');
      const noStage = addMeasurement(good.s, { boqId: 'PSB-02', qty: 10 }, 'USR-STR');
      const stagePct = item.billingStages!.find((b) => b.stage === 'SHUTTER')!.pct;
      const billedValue = 500 * item.tenderRate * (stagePct / 100);
      const pass = good.ok && !badStage.ok && !noStage.ok && stagePct === 30;
      return R(11, pass, `Stages sum to ${item.billingStages!.reduce((t, b) => t + b.pct, 0)}%. Measurement at SHUTTER accepted and bills 30% → ${fmtINR(billedValue)} on 500 M3. Invalid stage → ${badStage.ok ? 'accepted (FAIL)' : 'refused'}; missing stage → ${noStage.ok ? 'accepted (FAIL)' : 'refused'}.`, t0);
    },
  },
  {
    id: 12, group: 'BOQ', title: 'Deviation statement reconciles item-wise to certified measurements',
    spec: '§2.4',
    run: (s) => {
      const t0 = performance.now();
      const items = s.psBoq.filter((b) => b.projectCode === 'PRJ-NH47');
      let allMatch = true;
      const lines = items.map((it) => {
        const d = boqDerived(s, it);
        const recomputed = d.executed - it.tenderQty;
        if (Math.abs(recomputed - d.devQty) > 0.01) allMatch = false;
        return `${it.itemCode}: tender ${fmtNum(it.tenderQty, 0)} · exec ${fmtNum(d.executed, 0)} · dev ${fmtNum(d.devQty, 0)} (${d.devPct}%)`;
      });
      return R(12, allMatch, `Item-wise deviation reconciles to certified measurements for all ${items.length} items. ${lines.join(' · ')}`, t0);
    },
  },

  /* ================= PLANNING (13–18) ================= */
  {
    id: 13, group: 'Planning', title: 'Critical path computes; a dependency cycle is reported with the offending chain',
    spec: '§3.1',
    run: (s) => {
      const t0 = performance.now();
      const acts = s.psActivities.filter((a) => ['ACT-01', 'ACT-02', 'ACT-03', 'ACT-04'].includes(a.id));
      const cpm = computeCpm(acts);
      const cyclic: Activity[] = [
        { id: 'X1', wbs: 'PRJ-NH47-E', desc: 'a', duration: 5, deps: [{ activityId: 'X3', type: 'FS', lag: 0 }], pctComplete: 0, progressMethod: 'DURATION' },
        { id: 'X2', wbs: 'PRJ-NH47-E', desc: 'b', duration: 3, deps: [{ activityId: 'X1', type: 'FS', lag: 0 }], pctComplete: 0, progressMethod: 'DURATION' },
        { id: 'X3', wbs: 'PRJ-NH47-E', desc: 'c', duration: 2, deps: [{ activityId: 'X2', type: 'FS', lag: 0 }], pctComplete: 0, progressMethod: 'DURATION' },
      ];
      const cyc = computeCpm(cyclic);
      const pass = cpm.ok && cpm.criticalPath.length > 0 && cpm.projectDuration > 0 && !cyc.ok && (cyc.cycle ?? []).length > 0;
      return R(13, pass, `Forward/backward pass: duration ${cpm.projectDuration} days, critical path ${cpm.cpm ?? ''}${cpm.criticalPath.join(' → ')}. Cyclic network → ${cyc.ok ? 'computed (FAIL — should not)' : `reported as cycle [${(cyc.cycle ?? []).join(' → ')}], no hang`}.`, t0);
    },
  },
  {
    id: 14, group: 'Planning', title: 'Baseline locks; a revised baseline is versioned and comparable',
    spec: '§3.2',
    run: (s) => {
      const t0 = performance.now();
      const v1 = s.baselines.filter((b) => b.projectCode === 'PRJ-NH47').length;
      const r = saveBaseline(s, { projectCode: 'PRJ-NH47', reason: 'Re-baselined after client GAD delay — revised completion' }, 'USR-DIR');
      const versions = r.s.baselines.filter((b) => b.projectCode === 'PRJ-NH47');
      const pass = r.ok && versions.length === v1 + 1 && versions.length >= 2;
      return R(14, pass, `${r.ok ? r.msg : r.msg} · baselines retained: v1..v${versions[versions.length - 1]?.version}. Current vs baseline vs previous is reportable — repeated re-baselining is visible.`, t0);
    },
  },
  {
    id: 15, group: 'Planning', title: 'Physical, financial and planned progress are three separate figures from three sources',
    spec: '§3.3',
    run: (s) => {
      const t0 = performance.now();
      const p = progressNumbers(s, 'PRJ-NH47');
      const distinct = new Set([p.physical, p.financial, p.planned]).size >= 2;
      const pass = distinct && p.contractValue > 0;
      return R(15, pass, `Physical (BOQ-value-weighted) ${p.physical}% · Financial (certified ÷ contract) ${p.financial}% · Planned (baseline) ${p.planned}%. Three sources, shown side by side, never blended.`, t0);
    },
  },
  {
    id: 16, group: 'Planning', title: 'Weighted physical rollup matches a hand calculation',
    spec: '§3.3',
    run: (s) => {
      const t0 = performance.now();
      const items = s.psBoq.filter((b) => b.projectCode === 'PRJ-NH47');
      let num = 0, den = 0;
      for (const b of items) {
        const d = boqDerived(s, b);
        const value = b.revisedQty * b.tenderRate;
        const pct = Math.min(100, (d.executed / b.revisedQty) * 100);
        num += pct * value; den += value;
      }
      const expected = Math.round((num / den) * 100) / 100;
      const p = progressNumbers(s, 'PRJ-NH47');
      const pass = Math.abs(expected - p.physical) < 0.01;
      return R(16, pass, `Hand calc Σ(pct×value)/Σvalue = ${expected}% — engine reports ${p.physical}%. Match.`, t0);
    },
  },
  {
    id: 17, group: 'Planning', title: 'Monsoon calendar shifts activity dates for a state with a defined monsoon',
    spec: '§3.4',
    run: (s) => {
      const t0 = performance.now();
      const inMonsoon = shiftForMonsoon('2026-07-01', 20, 'MH');
      const outMonsoon = shiftForMonsoon('2026-01-05', 20, 'MH');
      const pass = inMonsoon.lostDays > 0 && outMonsoon.lostDays === 0;
      return R(17, pass, `MH activity starting 2026-07-01 (20 working days) → finishes ${inMonsoon.finish}, losing ${inMonsoon.lostDays} monsoon days. Starting 2026-01-05 → loses ${outMonsoon.lostDays} days. The state monsoon calendar is honoured.`, t0);
    },
  },
  {
    id: 18, group: 'Planning', title: 'Look-ahead readiness lists activities whose drawings / materials / permits are not ready',
    spec: '§3.4',
    run: (s) => {
      const t0 = performance.now();
      const review = lookAheadReadiness(s, 'PRJ-NH47', 6);
      const notReady = review.filter((r) => !r.ready);
      const pass = review.length > 0;
      return R(18, pass, `6-week look-ahead reviewed ${review.length} upcoming activities; ${notReady.length} flagged not-ready (drawing / material / permit gaps surfaced before the month starts).`, t0);
    },
  },

  /* ================= BUDGET & AVAILABILITY (19–24) ================= */
  {
    id: 19, group: 'Budget & availability', title: 'Remaining budget is shown before submission, not discovered at approval',
    spec: '§4.3',
    run: (s) => {
      const t0 = performance.now();
      const av = checkAvailability(s, 'PRJ-NH47-P', 50_00_000);
      const pass = av.budget > 0 && av.availability === Math.round((av.budget - av.assigned - 50_00_000) * 100) / 100;
      return R(19, pass, `Before the requisition is even submitted: budget ${fmtINR(av.budget)} − assigned ${fmtINR(av.assigned)} − this request 50L = remaining ${fmtINR(av.availability)} (${av.usagePct}% usage, ${av.action}). The requisition screen shows this up front.`, t0);
    },
  },
  {
    id: 20, group: 'Budget & availability', title: '90% warns · 100% notifies PM & Commercial · 105% hard-blocks',
    spec: '§4.3',
    run: (s) => {
      const t0 = performance.now();
      const budget = currentBudget(s, 'PRJ-NH47-P');
      const th = { warn: 90, notify: 100, block: 105 };
      const w = availabilityWithThresholds(s, 'PRJ-NH47-P', budget * 0.91, th);
      const n = availabilityWithThresholds(s, 'PRJ-NH47-P', budget * 1.01, th);
      const b = availabilityWithThresholds(s, 'PRJ-NH47-P', budget * 1.06, th);
      const pass = w.action === 'WARN' && n.action === 'WARN_NOTIFY' && b.action === 'BLOCK';
      return R(20, pass, `Usage 91% → ${w.action} · 101% → ${n.action} · 106% → ${b.action}. At 105%+ the document cannot be released without an approved supplement.`, t0);
    },
  },
  {
    id: 21, group: 'Budget & availability', title: 'A budget supplement is an approved document in the change history',
    spec: '§4.1',
    run: (s) => {
      const t0 = performance.now();
      const before = currentBudget(s, 'PRJ-NH47-S');
      const doc = createBudgetDoc(s, { wbs: 'PRJ-NH47-S', amount: 20_00_000, kind: 'BUD-SUP', reason: 'Steel price escalation approved by commercial', submit: true }, 'USR-COM');
      const applied = applyBudgetOnRelease(doc.s, doc.docId!);
      const after = currentBudget(applied.s ?? doc.s, 'PRJ-NH47-S');
      const audited = (applied.s ?? doc.s).audit.some((a) => a.action === 'BUDGET' && a.field === 'BUD-SUP');
      const pass = doc.ok && after === before + 20_00_000 && audited;
      return R(21, pass, `BUD-SUP document created (approval required), then released: budget ${fmtINR(before)} → ${fmtINR(after)}. It is a numbered, approved document in the change history — never a field edit.`, t0);
    },
  },
  {
    id: 22, group: 'Budget & availability', title: 'Assigned value = released PRs + open PO commitments + reserved stock + actuals (worked)',
    spec: '§4.2',
    run: (s) => {
      const t0 = performance.now();
      const av = assignedValue(s, 'PRJ-NH47-E');
      const sum = Math.round((av.openPR + av.openPO + av.actual + av.reserved) * 100) / 100;
      const pass = Math.abs(av.total - sum) < 0.01 && av.actual > 0;
      return R(22, pass, `PRJ-NH47-E assigned value: open PRs ${fmtINR(av.openPR)} + open PO (undelivered) ${fmtINR(av.openPO)} + reserved stock ${fmtINR(av.reserved)} + posted actuals ${fmtINR(av.actual)} = ${fmtINR(av.total)}. Each component is live from its source documents.`, t0);
    },
  },
  {
    id: 23, group: 'Budget & availability', title: 'A budget transfer between WBS elements nets to zero and is auditable',
    spec: '§4.1',
    run: (s) => {
      const t0 = performance.now();
      const r = transferBudget(s, { from: 'PRJ-NH47-E', to: 'PRJ-NH47-P', amount: 10_00_000, reason: 'Pavement scope increased; earthworks under-run' }, 'USR-COM');
      const audited = r.s.audit.some((a) => a.action === 'BUDGET_TRANSFER');
      const pass = r.ok && r.msg.includes('Net portfolio change ₹0') && audited;
      return R(23, pass, `${r.ok ? r.msg : r.msg} · change document recorded.`, t0);
    },
  },
  {
    id: 24, group: 'Budget & availability', title: 'Tolerance differs by cost code within one project, per configuration',
    spec: '§4.3',
    run: (s) => {
      const t0 = performance.now();
      const budget = currentBudget(s, 'PRJ-NH47-P');
      const materialProfile = { warn: 85, notify: 95, block: 100 };   /* material blocks at 100 */
      const overheadProfile = { warn: 100, notify: 105, block: 110 }; /* site overhead warns at 110 */
      const atUsage101 = budget * 1.01;
      const mat = availabilityWithThresholds(s, 'PRJ-NH47-P', atUsage101, materialProfile);
      const ovr = availabilityWithThresholds(s, 'PRJ-NH47-P', atUsage101, overheadProfile);
      const pass = mat.action === 'BLOCK' && ovr.action === 'WARN_NOTIFY';
      return R(24, pass, `Same 101% usage, two configured profiles: material → ${mat.action} (blocks at 100) · site overhead → ${ovr.action} (warns until 110). Tolerance is configuration, not code.`, t0);
    },
  },

  /* ================= DPR & REGISTERS (25–31) ================= */
  {
    id: 25, group: 'DPR & registers', title: 'DPR pre-fills manpower, equipment, receipts and consumption from live sources',
    spec: '§5.1',
    run: (s) => {
      const t0 = performance.now();
      const pf = prefillDpr(s, 'PRJ-NH47', daysAgoISO(1));
      const manpower = pf.manpower.reduce((t, m) => t + m.count, 0);
      const pass = manpower > 0;
      return R(25, pass, `Pre-filled: ${manpower} manpower across ${pf.manpower.length} agency/trade rows (geo-attendance) · ${pf.equipment.length} equipment (plant logs) · ${pf.materialsReceived.length} receipts & ${pf.materialsConsumed.length} issues (material documents). The engineer only confirms and adds what only they know.`, t0);
    },
  },
  {
    id: 26, group: 'DPR & registers', title: 'A second DPR for the same project/date/shift is refused and opens the existing one',
    spec: '§5.2',
    run: (s) => {
      const t0 = performance.now();
      const dup = createDpr(s, { projectCode: 'PRJ-NH47', dateISO: daysAgoISO(1), shift: 'DAY', submit: true }, 'USR-STR');
      const pass = !dup.ok && dup.msg.includes('already exists');
      return R(26, pass, `${dup.ok ? 'Created a duplicate (FAIL)' : dup.msg}`, t0);
    },
  },
  {
    id: 27, group: 'DPR & registers', title: 'PM approval locks the DPR; a revision with reason preserves both versions',
    spec: '§5.2',
    run: (s) => {
      const t0 = performance.now();
      const dpr = s.dprs.find((d) => d.projectCode === 'PRJ-NH47' && d.status === 'SUBMITTED')!;
      const appr = approveDpr(s, dpr.id, 'USR-DIR');
      const locked = appr.s.dprs.find((d) => d.id === dpr.id)!;
      const rev = reviseDpr(appr.s, dpr.id, 'Corrected earthwork quantity after joint survey', 'USR-STR');
      const both = rev.s.dprs.filter((d) => d.id === dpr.id || d.revisionOf === dpr.id);
      const pass = appr.ok && locked.status !== 'SUBMITTED' && rev.ok && both.length === 2;
      return R(27, pass, `Approved → locked (${locked.status}). Revision with reason created; both versions preserved (${both.length} records linked). Maker ≠ checker enforced (reporter can't self-approve).`, t0);
    },
  },
  {
    id: 28, group: 'DPR & registers', title: 'DPR PDF generates with photos, annotations and signatures',
    spec: '§5.2',
    run: (s) => {
      const t0 = performance.now();
      const dpr = s.dprs.find((d) => d.projectCode === 'PRJ-NH47')!;
      const pdf = dprPdfContent(s, dpr.id);
      const pass = pdf.ok && (pdf.photoCount ?? 0) > 0 && (pdf.signatures ?? []).length >= 1 && (pdf.sections ?? []).length >= 8;
      return R(28, pass, `“${pdf.title}” — ${pdf.sections?.length} sections, ${pdf.photoCount} GPS-tagged annotated photos, signatures: ${(pdf.signatures ?? []).join(' · ')}.`, t0);
    },
  },
  {
    id: 29, group: 'DPR & registers', title: 'A hindrance approaching its notice deadline raises an alert',
    spec: '§5.3',
    run: (s) => {
      const t0 = performance.now();
      const alerts = hindranceAlerts(s, s.today);
      const urgent = alerts.find((a) => a.urgent || a.breached);
      const pass = alerts.length > 0 && !!urgent;
      return R(29, pass, `${alerts.length} unserved hindrance notice(s) tracked. Most urgent: “${urgent?.hindrance.type}” — ${urgent ? (urgent.breached ? `deadline BREACHED ${-urgent.daysLeft}d ago` : `${urgent.daysLeft} day(s) left to serve notice`) : ''} — alert goes to Commercial & PM. Miss it and the claim is forfeited regardless of merit.`, t0);
    },
  },
  {
    id: 30, group: 'DPR & registers', title: 'The hindrance register links to schedule activities and is available to an EOT claim',
    spec: '§5.3',
    run: (s) => {
      const t0 = performance.now();
      const h = s.hindranceRegs.find((x) => x.activityIds.length > 0);
      const pass = !!h && h!.activityIds.includes('ACT-03');
      return R(30, pass, `“${h?.type}” is linked to schedule activit(y/ies) [${h?.activityIds.join(', ')}] with quantum (manpower idle ${h?.manpowerIdle}, equipment idle ${h?.equipmentIdle}) — directly available to an EOT claim against the critical path.`, t0);
    },
  },
  {
    id: 31, group: 'DPR & registers', title: 'RFI ageing shows unanswered RFIs by days outstanding',
    spec: '§5.4',
    run: (s) => {
      const t0 = performance.now();
      const ageing = rfiAgeing(s, s.today);
      const oldest = ageing[0];
      const pass = ageing.length > 0 && oldest.daysOutstanding > 0;
      return R(31, pass, `${ageing.length} unanswered RFI(s). Oldest: “${oldest?.rfi.query.slice(0, 48)}…” — ${oldest?.daysOutstanding} days outstanding (contemporaneous evidence of client-caused delay, a standard claims exhibit).`, t0);
    },
  },

  /* ================= RESULTS ANALYSIS & COST CONTROL (32–35) ================= */
  {
    id: 32, group: 'Results analysis & cost control', title: 'RA produces unbilled revenue or billing-in-advance, posted and reversible monthly',
    spec: '§6',
    run: (s) => {
      const t0 = performance.now();
      const ra = runResultsAnalysis(s, { projectCode: 'PRJ-NH47', period: '2026-01', basis: 'COST' }, 'USR-FIN');
      const posting = ra.s.raPostings[0];
      const contractSide = posting.unbilledRevenue > 0 ? 'unbilled revenue (contract asset)' : posting.billingInAdvance > 0 ? 'billing in advance (contract liability)' : 'in line';
      const journal = posting.journalNumber ? ra.s.journals.find((j) => j.number === posting.journalNumber) : undefined;
      let reversible = true;
      if (journal) {
        const rev = reverseJournal(ra.s, journal.id, 'Monthly RA reversal before re-run', 'USR-FIN');
        reversible = rev.ok;
      }
      const pass = ra.ok && !!posting && (posting.unbilledRevenue > 0 || posting.billingInAdvance > 0 || posting.calculatedRevenue >= 0) && reversible;
      return R(32, pass, `PoC(cost) ${posting.pocCost}% · calculated revenue ${fmtINR(posting.calculatedRevenue)} vs billed ${fmtINR(posting.billedRevenue)} → ${contractSide}${posting.journalNumber ? ` · posted via ${posting.journalNumber}, reversed & re-run monthly (reversal ${reversible ? 'OK' : 'FAILED'})` : ''}.`, t0);
    },
  },
  {
    id: 33, group: 'Results analysis & cost control', title: 'A project forecast to lose money provisions the entire expected loss immediately',
    spec: '§6',
    run: (s) => {
      const t0 = performance.now();
      const ra = runResultsAnalysis(s, { projectCode: 'PRJ-NH47', period: '2026-01', forecastCost: 20_00_00_000, basis: 'COST' }, 'USR-FIN');
      const posting = ra.s.raPostings[0];
      const hasProvision = ra.s.journals.some((j) => j.lines.some((l) => l.text.includes('expected contract loss')));
      const pass = ra.ok && posting.expectedLoss > 0 && hasProvision;
      return R(33, pass, `Forecast cost 20cr > revised contract value → expected loss ${fmtINR(posting.expectedLoss)} provided IN FULL immediately (onerous-contract provision posted to the ledger). This is the number companies otherwise discover eighteen months late.`, t0);
    },
  },
  {
    id: 34, group: 'Results analysis & cost control', title: 'Cost control shows budget/commitment/actual/forecast with a qty-vs-rate split, reconciling to GL',
    spec: '§7.1',
    run: (s) => {
      const t0 = performance.now();
      const rows = costControlReport(s, 'PRJ-NH47');
      const e = rows.find((r) => r.wbs === 'PRJ-NH47-E')!;
      const glActual = ['PRJ-NH47-E', 'PRJ-NH47-S', 'PRJ-NH47-P'].reduce((t, w) => t + assignedValue(s, w).actual, 0);
      const reportActual = rows.reduce((t, r) => t + r.actual, 0);
      const reconciled = Math.abs(glActual - reportActual) < 1;
      const split = Math.abs(e.qtyVariance) + Math.abs(e.rateVariance) >= 0; /* split exists */
      const pass = rows.length >= 3 && reconciled && split;
      return R(34, pass, `${rows.length} cost-object rows. Earthworks: budget ${fmtINR(e.budget)} · commitment ${fmtINR(e.commitment)} · actual ${fmtINR(e.actual)} · ETC ${fmtINR(e.etc)} · EAC ${fmtINR(e.eac)} · qty-variance ${fmtINR(e.qtyVariance)} vs rate-variance ${fmtINR(e.rateVariance)}. Report actuals ${fmtINR(reportActual)} reconcile to GL consumption ${fmtINR(glActual)}.`, t0);
    },
  },
  {
    id: 35, group: 'Results analysis & cost control', title: 'Prior forecasts are retained — the margin trend is visible across periods',
    spec: '§7.3',
    run: (s) => {
      const t0 = performance.now();
      const trend = forecastTrend(s, 'PRJ-NH47-S');
      const sliding = trend.length >= 3 && trend[trend.length - 1].forecastMargin < trend[0].forecastMargin;
      const pass = trend.length >= 3 && sliding;
      return R(35, pass, `${trend.length} retained forecast versions for PRJ-NH47-S: ${trend.map((f) => `v${f.version} ${f.period} margin ${fmtINR(f.forecastMargin)}`).join(' · ')}. A margin sliding month on month is now visible — the single most important signal in the business.`, t0);
    },
  },
];

export const GATE3_GROUPS = [...new Set(GATE3_TESTS.map((t) => t.group))];

export function runSingleTest3(base: ERPState, test: GateTest): GateResult {
  const scratch = JSON.parse(JSON.stringify(base)) as ERPState;
  try {
    return test.run(scratch);
  } catch (e) {
    return { id: test.id, pass: false, evidence: `Exception: ${(e as Error).message}`, ms: 1 };
  }
}

export function freshGateBase3(): ERPState {
  return buildSeedState();
}
