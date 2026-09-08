import type { ERPState } from './types';
import { MATERIALS, PARTNERS } from './config';
import {
  freshState, createPR, approveDoc, createPOFromPR, postGR, postInvoice, postMovement,
  daysAgoISO, todayISO, uid,
} from './engine';
import { postEquipmentLog, postInternalHire } from './eam';
import { createInspectionLot, recordTest } from './qms';
import { createGateEntry, weighIn, reserveStock, issueReturnable, startCount, submitCount, createRfq, submitQuotation } from './logistics';
import { logHindrance, raiseClaim } from './ctr';
import { addMeasurement, certifyMeasurement, computeRaBill, advanceBill } from './bil';
import { createSuborder, issueFreeIssueMaterial } from './sub';
import { itcReconcile, computeCess } from './cmp';
import { runResultsAnalysis } from './prj';
import { recordProfitForecast } from './ctl';
import {
  createProjectFromTemplate, saveBaseline, createDpr, raiseRfi, raiseSiteInstruction, recordForecast,
  addMeasurement as psAddMeasurement, logHindrance as psLogHindrance,
} from './prjsys';
import { backfillConversations } from './platform';
import { seedLaunchpadData } from './launchpad';
import { createPutaway } from './stores';

/* module-level master snapshots so a demo reset is faithful */
const MATERIALS_ORIG = JSON.parse(JSON.stringify(MATERIALS)) as typeof MATERIALS;
const PARTNERS_ORIG = JSON.parse(JSON.stringify(PARTNERS)) as typeof PARTNERS;

export function resetMasters(): void {
  MATERIALS.splice(0, MATERIALS.length, ...JSON.parse(JSON.stringify(MATERIALS_ORIG)));
  PARTNERS.splice(0, PARTNERS.length, ...JSON.parse(JSON.stringify(PARTNERS_ORIG)));
}

/**
 * Opening position — every balance produced by running the real engine,
 * so the stock ledger and the stock GL account reconcile to zero break.
 */
export function buildSeedState(): ERPState {
  const st = freshState();
  const at = (n: number) => { st.today = daysAgoISO(n); };

  /* ── chain 1: cement PR → PO → GR (partial) → invoice ── */
  at(12);
  let r = createPR(st, {
    siteId: 'ST-NH47', submit: true, neededBy: daysAgoISO(5), docType: 'PR-STD',
    note: 'Structures concreting — March pour sequence',
    items: [{ materialCode: 'MAT-C53', qty: 400, wbs: 'PRJ-NH47-S', category: 'STD' }],
  }, 'USR-REQ');
  Object.assign(st, r.s);
  const pr1 = r.docId!;
  Object.assign(st, approveDoc(st, pr1, 'APPROVE', 'Requirement verified vs pour plan', 'USR-HOD').s);

  at(11);
  r = createPOFromPR(st, pr1, { partnerId: 'BP-SHREE', deliveryDate: daysAgoISO(4) }, 'USR-BUY');
  Object.assign(st, r.s);
  const po1 = r.docId!;
  Object.assign(st, approveDoc(st, po1, 'APPROVE', 'L1 release — within delegated limit', 'USR-HOD').s);
  at(10);
  Object.assign(st, approveDoc(st, po1, 'APPROVE', 'L2 release', 'USR-DIR').s);

  at(9);
  r = postGR(st, po1, { qty: 250, locId: 'UNR' }, 'USR-STR');
  Object.assign(st, r.s);

  at(8);
  r = postInvoice(st, po1, { vendorInvoiceNo: 'SD/2481', qty: 250, dateISO: daysAgoISO(8) }, 'USR-FIN');
  Object.assign(st, r.s);

  /* ── chain 2: diesel PR → PO, open commitment ── */
  at(7);
  r = createPR(st, {
    siteId: 'ST-WSH', submit: true, neededBy: daysAgoISO(1), docType: 'PR-EMG',
    note: 'Workshop genset + bowser top-up',
    items: [{ materialCode: 'MAT-HSD', qty: 2000, cc: 'CC-WSH', category: 'STD' }],
  }, 'USR-REQ');
  Object.assign(st, r.s);
  const pr2 = r.docId!;
  Object.assign(st, approveDoc(st, pr2, 'APPROVE', 'Emergency fuel — approved', 'USR-HOD').s);
  at(6);
  r = createPOFromPR(st, pr2, { partnerId: 'BP-IOCL', deliveryDate: daysAgoISO(2) }, 'USR-BUY');
  Object.assign(st, r.s);
  const po2 = r.docId!;
  Object.assign(st, approveDoc(st, po2, 'APPROVE', 'Released', 'USR-HOD').s);

  /* ── godown receipt without PO, then site transfer (in transit) ── */
  at(6);
  r = postMovement(st, {
    movementCode: '120', materialCode: 'MAT-C53', qty: 600, siteId: 'ST-GDN', locId: 'UNR',
    rate: 408, reason: 'Opening balance receipt — bulk procurement allocation',
  }, 'USR-STR');
  Object.assign(st, r.s);

  at(5);
  r = postMovement(st, {
    movementCode: '300', materialCode: 'MAT-C53', qty: 150, siteId: 'ST-GDN', locId: 'UNR', siteToId: 'ST-NH47',
  }, 'USR-STR');
  Object.assign(st, r.s);

  /* ── site consumption to WBS ── */
  at(4);
  r = postMovement(st, {
    movementCode: '200', materialCode: 'MAT-C53', qty: 80, siteId: 'ST-NH47', locId: 'UNR', wbs: 'PRJ-NH47-S',
  }, 'USR-STR');
  Object.assign(st, r.s);

  /* ── rejected PR (comment on record) ── */
  at(5);
  r = createPR(st, {
    siteId: 'ST-WSH', submit: true, neededBy: daysAgoISO(0), docType: 'PR-STD',
    items: [{ materialCode: 'MAT-WBR', qty: 500, cc: 'CC-WSH', category: 'CNS' }],
  }, 'USR-REQ');
  Object.assign(st, r.s);
  const pr3 = r.docId!;
  Object.assign(st, approveDoc(st, pr3, 'REJECT', 'Duplicate requirement — covered by open workshop order', 'USR-HOD').s);

  /* ── steel chain: big value → three-step strategy, mid-release ── */
  at(3);
  r = createPR(st, {
    siteId: 'ST-NH47', submit: true, neededBy: daysAgoISO(-6), docType: 'PR-STD',
    note: 'Pier cap + girder reinforcement package',
    items: [{ materialCode: 'MAT-STL16', qty: 60, wbs: 'PRJ-NH47-S', category: 'STD' }],
  }, 'USR-REQ');
  Object.assign(st, r.s);
  const pr4 = r.docId!;
  Object.assign(st, approveDoc(st, pr4, 'APPROVE', 'BBS verified', 'USR-HOD').s);
  at(2);
  Object.assign(st, approveDoc(st, pr4, 'APPROVE', 'Confirmed vs construction schedule', 'USR-DIR').s);
  r = createPOFromPR(st, pr4, { partnerId: 'BP-TATA', deliveryDate: daysAgoISO(-10) }, 'USR-BUY');
  Object.assign(st, r.s);
  const po3 = r.docId!;
  Object.assign(st, approveDoc(st, po3, 'APPROVE', 'L1 — commercial terms as negotiated', 'USR-HOD').s);
  /* DIR + CFO approvals intentionally left pending — live queue for the demo */

  /* ── abandoned draft: consumes no number ── */
  at(1);
  r = createPR(st, {
    siteId: 'ST-NH47', submit: false, neededBy: daysAgoISO(-8), docType: 'PR-STD',
    note: 'PPE replenishment — waiting for headcount confirmation',
    items: [{ materialCode: 'MAT-PPE', qty: 150, cc: 'CC-4700', category: 'CNS' }],
  }, 'USR-REQ');
  Object.assign(st, r.s);

  seedLogistics(st);
  seedCommercial(st);
  seedProjectSystem(st);
  seedStores(st);

  /* Record-bound conversation threads attach to every submitted document */
  backfillConversations(st);

  /* Part 10A: Launchpad & Design System */
  seedLaunchpadData(st);

  st.today = todayISO();
  return st;
}

/* ── Part 2 opening data: EAM logs, QMS lots/tests/NCRs, INV GR chain ── */
function seedLogistics(st: ERPState): void {
  let r: { s: ERPState; ok: boolean; docId?: string };

  /* ── EAM: equipment logs (one fuel exception, one auto-PM trigger) ── */
  st.today = daysAgoISO(1);
  r = postEquipmentLog(st, { equipmentCode: 'EQ-EX201', date: daysAgoISO(1), openingHm: 6420, closingHm: 6429, workHrs: 8, idleHrs: 1, brkdnHrs: 0, standbyHrs: 0, operatorId: 'OP-1', fuelL: 175, wbs: 'PRJ-NH47-E' }, 'USR-STR');
  Object.assign(st, r.s); /* fuel 175 L vs norm 144 L → exception */
  const log1 = st.eqLogs[0]?.id;

  r = postEquipmentLog(st, { equipmentCode: 'EQ-WA301', date: daysAgoISO(1), openingHm: 4040, closingHm: 4060, workHrs: 18, idleHrs: 2, brkdnHrs: 0, standbyHrs: 0, operatorId: 'OP-2', fuelL: 230, wbs: 'PRJ-NH47-E' }, 'USR-STR');
  Object.assign(st, r.s); /* 4060-3800=260 ≥ 250 → auto PM order */

  /* internal hire posting for the excavator log */
  if (log1) { r = postInternalHire(st, log1, 'USR-FIN'); Object.assign(st, r.s); }

  /* ── INV: gate entry → weighbridge → quality-hold GR → inspection lot ── */
  st.today = daysAgoISO(2);
  /* released cement PO to receive against */
  r = createPR(st, { siteId: 'ST-NH47', submit: true, neededBy: daysAgoISO(0), docType: 'PR-STD', note: 'Deck concreting — inspection-flagged cement', items: [{ materialCode: 'MAT-C53', qty: 120, wbs: 'PRJ-NH47-S', category: 'STD' }] }, 'USR-REQ');
  Object.assign(st, r.s);
  const prQ = r.docId!;
  Object.assign(st, approveDoc(st, prQ, 'APPROVE', 'Verified', 'USR-HOD').s);
  r = createPOFromPR(st, prQ, { partnerId: 'BP-SHREE', deliveryDate: daysAgoISO(1) }, 'USR-BUY');
  Object.assign(st, r.s);
  const poQ = r.docId!;
  Object.assign(st, approveDoc(st, poQ, 'APPROVE', 'Released', 'USR-HOD').s);

  st.today = daysAgoISO(1);
  r = createGateEntry(st, { siteId: 'ST-NH47', vehicleNo: 'MH-12-GT-7745', driver: 'H. Shaikh', transporter: 'Shree Logistics', ewb: 'EWB-221190345', poRef: poQ, materialCode: 'MAT-C53', declaredQty: 120, sealOk: true }, 'USR-STR');
  Object.assign(st, r.s);
  const gate1 = r.docId!;
  r = weighIn(st, gate1, { gross: 132, tare: 12, operator: 'WB-OP-1' }, 'USR-STR'); /* net 120 (in bags UOM) */
  Object.assign(st, r.s);
  /* quality-hold GR (cement is inspection-flagged) → open inspection lot */
  r = postGR(st, poQ, { qty: 120, toQuality: true }, 'USR-STR');
  Object.assign(st, r.s);
  const grQ = r.docId;
  r = createInspectionLot(st, { type: 'IL-GRN', materialCode: 'MAT-C53', qty: 120, siteId: 'ST-NH47', grDocId: grQ, vendorId: 'BP-SHREE' }, 'USR-STR');
  Object.assign(st, r.s);

  /* ── QMS: failed 28-day cube → auto NCR ── */
  st.today = todayISO();
  r = recordTest(st, { kind: 'CUBE', material: 'MAT-RMC25', grade: 'M25', ageDays: 28, value: 21.4, spec: '≥ 25 MPa', pass: false, batch: 'B-1187', pourLoc: 'Pier P4 cap', challan: 'DC-3321', equipId: 'TE-CTM' }, 'USR-STR');
  Object.assign(st, r.s);
  r = recordTest(st, { kind: 'STEEL', material: 'MAT-STL16', grade: 'Fe500D', value: 561, spec: '≥ 500 MPa yield', pass: true, equipId: 'TE-UT', welderId: 'WD-1' }, 'USR-STR');
  Object.assign(st, r.s);

  /* ── INV: reservation, returnable, blind count with variance, RFQ ── */
  r = reserveStock(st, { materialCode: 'MAT-C53', siteId: 'ST-NH47', wbs: 'PRJ-NH47-S', qty: 150 }, 'USR-STR');
  Object.assign(st, r.s);
  r = issueReturnable(st, { materialCode: 'MAT-PPE', siteId: 'ST-NH47', wbs: 'PRJ-NH47-S', qty: 40, issuedTo: 'R. Iyer — Structures', dueDate: daysAgoISO(-7) }, 'USR-STR');
  Object.assign(st, r.s);
  r = startCount(st, { siteId: 'ST-GDN', materialCode: 'MAT-C53', blind: true }, 'USR-STR');
  Object.assign(st, r.s);
  const count1 = st.counts[0]?.id;
  if (count1) { r = submitCount(st, count1, 588, 'USR-STR'); Object.assign(st, r.s); } /* book ~600 → variance */

  r = createRfq(st, { materialCode: 'MAT-AGG20', qty: 800, siteId: 'ST-NH47', wbs: 'PRJ-NH47-P', vendors: ['BP-KRISH', 'BP-SAI', 'BP-SUNR'], deadline: daysAgoISO(-3) }, 'USR-BUY');
  Object.assign(st, r.s);
  const rfq1 = st.rfqs[0]?.id;
  if (rfq1) {
    Object.assign(st, submitQuotation(st, rfq1, { vendorId: 'BP-KRISH', rate: 1285, discPct: 2, freightPerUnit: 180, leadDays: 2, paymentDays: 30, validUntil: daysAgoISO(-10), at: '' }, 'USR-BUY').s);
    Object.assign(st, submitQuotation(st, rfq1, { vendorId: 'BP-SAI', rate: 1180, discPct: 0, freightPerUnit: 310, leadDays: 4, paymentDays: 45, validUntil: daysAgoISO(-10), at: '' }, 'USR-BUY').s);
    Object.assign(st, submitQuotation(st, rfq1, { vendorId: 'BP-SUNR', rate: 1350, discPct: 5, freightPerUnit: 120, leadDays: 3, paymentDays: 15, validUntil: daysAgoISO(-10), at: '' }, 'USR-BUY').s);
  }
}

/* ── Part 3 opening : budgets, contracts, measurement/billing, subcontract, compliance ── */
function seedCommercial(st: ERPState): void {
  let r: { s: ERPState; ok: boolean; docId?: string };

  /* Budgets (original, as if approved BUD-ORG) */
  st.budgets = {
    'PRJ-NH47': { org: 7_20_00_000, sup: 0, ret: 0 },
    'PRJ-NH47-E': { org: 2_60_00_000, sup: 12_00_000, ret: 0 },
    'PRJ-NH47-S': { org: 3_00_00_000, sup: 0, ret: 0 },
    'PRJ-NH47-P': { org: 1_60_00_000, sup: 0, ret: 0 },
    'PRJ-AHD': { org: 10_80_00_000, sup: 0, ret: 0 },
    'PRJ-AHD-F': { org: 6_40_00_000, sup: 0, ret: 0 },
    'PRJ-AHD-D': { org: 4_40_00_000, sup: 0, ret: 0 },
  };

  /* Physical progress per WBS (distinct from financial progress) */
  st.physicalProgress = {
    'PRJ-NH47-E': 43, 'PRJ-NH47-S': 38, 'PRJ-NH47-P': 4,
    'PRJ-AHD-F': 42, 'PRJ-AHD-D': 41,
  };

  /* A hindrance event approaching its notice deadline + one EOT claim */
  st.today = daysAgoISO(6);
  r = logHindrance(st, { contractId: 'CN-001', type: 'LAND_ROW', desc: 'ROW not handed over at km 12+400 — structure front idle', eventDate: daysAgoISO(6), frontsAffected: 'PRJ-NH47-S pier P5', impactDays: 14, noticeServed: false, linkedActivity: 'Pile cap P5' }, 'USR-DIR');
  Object.assign(st, r.s);
  r = logHindrance(st, { contractId: 'CN-001', type: 'CLIENT_DRAWING', desc: 'IFC drawing for deck girder delayed', eventDate: daysAgoISO(40), endDate: daysAgoISO(20), frontsAffected: 'PRJ-NH47-S', impactDays: 20, noticeServed: true, noticeDate: daysAgoISO(38), noticeRef: 'VUL/N/2025/118', linkedActivity: 'Girder casting' }, 'USR-DIR');
  Object.assign(st, r.s);
  r = raiseClaim(st, { contractId: 'CN-001', clause: 'GCC 12.4 (EOT)', eventDate: daysAgoISO(40), noticeDate: daysAgoISO(38), desc: 'Prolongation due to delayed IFC drawings', heads: [{ head: 'Prolongation cost', amount: 38_00_000 }, { head: 'Idle plant', amount: 9_00_000 }], timeImpactDays: 20 }, 'USR-DIR');
  Object.assign(st, r.s);

  /* A certified measurement + RA bill for CN-001 (billed value) */
  st.today = daysAgoISO(12);
  r = addMeasurement(st, { contractId: 'CN-001', boqItemId: 'BQ-02', location: 'Pier P4 cap', drawingNo: 'ST-104', drawingRev: 'C', drawingStatus: 'IFC', nos: 4, length: 12.5, breadth: 6.2, depth: 2.0, formula: 'L×B×D', period: '2025-12' }, 'USR-DIR');
  Object.assign(st, r.s);
  const meas1 = st.measurements[0]?.id;
  if (meas1) { Object.assign(st, certifyMeasurement(st, meas1, 'USR-FIN').s); }

  st.today = daysAgoISO(10);
  r = computeRaBill(st, { contractId: 'CN-001', period: '2025-12', materialAtSiteValue: 32_00_000, advanceOutstanding: 68_00_000, cumulativeProgressPct: 41, prevRetentionCum: 8_00_000, eotPending: true }, 'USR-FIN');
  Object.assign(st, r.s);
  const ra1 = st.raBills[0]?.id;
  if (ra1) {
    Object.assign(st, advanceBill(st, ra1, 'CERTIFIED', 1_92_00_000, 'USR-FIN').s);
    Object.assign(st, advanceBill(st, ra1, 'PAID', undefined, 'USR-FIN').s);
    const paidBill = st.raBills.find((b) => b.id === ra1);
    if (paidBill) paidBill.paid = paidBill.netPayable;
  }

  /* A subcontract with back-to-back lines */
  st.today = daysAgoISO(20);
  r = createSuborder(st, { subconId: 'BP-PRAK', projectCode: 'PRJ-NH47', wbs: 'PRJ-NH47-S', clientBoqIds: ['BQ-02', 'BQ-03'], subRates: { 'BQ-02': 6900, 'BQ-03': 68000 }, ceilingValue: 2_40_00_000, labourLicenceValidTo: daysAgoISO(-120), pfCompliant: true, insuranceValidTo: daysAgoISO(-200), materialRecoveryRate: { 'MAT-STL16': 62000, 'MAT-C53': 445 } }, 'USR-BUY');
  Object.assign(st, r.s);
  const so1 = st.suborders[0]?.id;
  if (so1) {
    r = issueFreeIssueMaterial(st, so1, { materialCode: 'MAT-C53', qty: 200, siteId: 'ST-NH47' }, 'USR-STR');
    Object.assign(st, r.s);
  }

  /* Subcontractor with EXPIRED labour licence — for the payment-block demo */
  r = createSuborder(st, { subconId: 'BP-SAI', projectCode: 'PRJ-AHD', wbs: 'PRJ-AHD-F', clientBoqIds: ['BQ-07'], subRates: { 'BQ-07': 16200 }, ceilingValue: 3_00_00_000, labourLicenceValidTo: daysAgoISO(30), pfCompliant: false, insuranceValidTo: daysAgoISO(-90), materialRecoveryRate: {} }, 'USR-BUY');
  Object.assign(st, r.s);

  /* ITC reconciliation + cess + profit forecasts */
  st.today = daysAgoISO(3);
  r = itcReconcile(st, 'USR-FIN');
  Object.assign(st, r.s);
  r = computeCess(st, 'PRJ-NH47', 3_80_00_000, 'USR-FIN');
  Object.assign(st, r.s);
  r = recordProfitForecast(st, { key: 'PRJ-NH47', dimension: 'PROJECT', revenue: 8_65_00_000, cost: 7_92_00_000 }, 'USR-CFO');
  Object.assign(st, r.s);
  r = recordProfitForecast(st, { key: 'PRJ-NH47', dimension: 'PROJECT', revenue: 8_65_00_000, cost: 8_05_00_000 }, 'USR-CFO');
  Object.assign(st, r.s); /* margin sliding down — trend visible */

  /* A results-analysis run (unbilled revenue) */
  st.today = daysAgoISO(2);
  r = runResultsAnalysis(st, { projectCode: 'PRJ-NH47', period: '2025-12', actualCost: 3_05_00_000, estimatedTotalCost: 7_92_00_000, revisedContractValue: 8_65_00_000, billedToDate: 1_92_00_000, physicalPct: 41, basis: 'COST' }, 'USR-FIN');
  Object.assign(st, r.s);

  st.today = todayISO();
}

/* ── Part 3/10 opening: project system (WBS · BOQ · planning · DPR · registers · forecasts) ── */
function seedProjectSystem(st: ERPState): void {
  let r: { s: ERPState; ok: boolean; docId?: string };

  /* 0 · NH-47 WBS skeleton (summary + cost/billing leaves) */
  st.wbsElements.push(
    { code: 'PRJ-NH47', desc: 'NH-47 Package-3 — 4-Laning', level: 1, projectCode: 'PRJ-NH47', nodeType: 'SUMMARY', planningElement: true, budgetElement: true, costObject: false, billingElement: false, responsible: 'USR-DIR', profitCentre: 'PC-ROAD', status: 'RELEASED', version: 1 },
    { code: 'PRJ-NH47-E', desc: 'Earthworks', level: 2, parent: 'PRJ-NH47', projectCode: 'PRJ-NH47', nodeType: 'WORK', planningElement: true, budgetElement: true, costObject: true, billingElement: true, costCentre: 'CC-4700', profitCentre: 'PC-ROAD', uom: 'M3', status: 'RELEASED', version: 1 },
    { code: 'PRJ-NH47-S', desc: 'Structures', level: 2, parent: 'PRJ-NH47', projectCode: 'PRJ-NH47', nodeType: 'WORK', planningElement: true, budgetElement: true, costObject: true, billingElement: true, costCentre: 'CC-4700', profitCentre: 'PC-ROAD', uom: 'M3', status: 'RELEASED', version: 1 },
    { code: 'PRJ-NH47-P', desc: 'Pavement', level: 2, parent: 'PRJ-NH47', projectCode: 'PRJ-NH47', nodeType: 'WORK', planningElement: true, budgetElement: true, costObject: true, billingElement: true, costCentre: 'CC-4700', profitCentre: 'PC-ROAD', uom: 'M2', status: 'RELEASED', version: 1 },
  );

  /* 1 · A bridge project created from a template in one action (RELEASED so it accepts cost) */
  r = createProjectFromTemplate(st, { template: 'TPL-BRIDGE', projectCode: 'PRJ-BRG', projectName: 'River Crossing Bridge' }, 'USR-DIR');
  Object.assign(st, r.s);
  st.wbsElements.filter((w) => w.projectCode === 'PRJ-BRG').forEach((w) => { w.status = 'RELEASED'; });

  /* 2 · Schedule: activities + a locked baseline for NH-47 earthworks */
  const A = (id: string, wbs: string, desc: string, duration: number, deps: { activityId: string; type: 'FS' | 'SS' | 'FF' | 'SF'; lag: number }[], pct: number, method: 'UNITS' | 'MILESTONE' | 'SF' | 'DURATION' | 'LOE') =>
    ({ id, wbs, desc, duration, deps, pctComplete: pct, progressMethod: method });
  st.psActivities.push(
    A('ACT-01', 'PRJ-NH47-E', 'Clearing & grubbing', 10, [], 100, 'DURATION'),
    A('ACT-02', 'PRJ-NH47-E', 'Embankment — Reach R1', 30, [{ activityId: 'ACT-01', type: 'FS', lag: 0 }], 60, 'UNITS'),
    A('ACT-03', 'PRJ-NH47-E', 'GSB laying', 20, [{ activityId: 'ACT-02', type: 'SS', lag: 10 }], 20, 'UNITS'),
    A('ACT-04', 'PRJ-NH47-E', 'WMM laying', 15, [{ activityId: 'ACT-03', type: 'FS', lag: 0 }], 0, 'UNITS'),
    A('ACT-05', 'PRJ-NH47-S', 'Pile foundations', 25, [{ activityId: 'ACT-01', type: 'FS', lag: 0 }], 40, 'UNITS'),
    A('ACT-06', 'PRJ-NH47-S', 'Pier caps', 12, [{ activityId: 'ACT-05', type: 'FS', lag: 0 }], 0, 'MILESTONE'),
  );
  r = saveBaseline(st, { projectCode: 'PRJ-NH47', reason: 'Baseline locked at award — contractual schedule' }, 'USR-DIR');
  Object.assign(st, r.s);

  /* 3 · BOQ with part-rate billing stages + material coefficients */
  st.psBoq.push(
    { id: 'PSB-01', contractId: 'CN-001', projectCode: 'PRJ-NH47', itemCode: '2.1', level: 1, itemType: 'ITEM', desc: 'Embankment construction', spec: 'MoRTH Cl 300', unit: 'M3', tenderQty: 120000, tenderRate: 185, revisedQty: 120000, deviationPct: 15, wbs: 'PRJ-NH47-E', costCode: 'CC-MAT', rateVersion: 1, rateEffective: st.today, materialCoeff: [{ material: 'MAT-AGG20', coeff: 1.3 }] },
    { id: 'PSB-02', contractId: 'CN-001', projectCode: 'PRJ-NH47', itemCode: '4.3', level: 1, itemType: 'ITEM', desc: 'RCC M25 in structures', spec: 'IS 456', unit: 'M3', tenderQty: 9500, tenderRate: 7850, revisedQty: 9500, deviationPct: 10, wbs: 'PRJ-NH47-S', costCode: 'CC-MAT', rateVersion: 1, rateEffective: st.today, materialCoeff: [{ material: 'MAT-C53', coeff: 7.6 }, { material: 'MAT-STL16', coeff: 0.085 }], billingStages: [{ stage: 'SHUTTER', desc: 'Shuttering complete', pct: 30 }, { stage: 'REBAR', desc: 'Reinforcement placed', pct: 25 }, { stage: 'POUR', desc: 'Concrete poured', pct: 35 }, { stage: 'CURE', desc: 'Curing + finishing', pct: 10 }] },
    { id: 'PSB-03', contractId: 'CN-001', projectCode: 'PRJ-NH47', itemCode: '4.4', level: 1, itemType: 'ITEM', desc: 'Reinforcement steel Fe500D', spec: 'IS 1786', unit: 'MT', tenderQty: 780, tenderRate: 74500, revisedQty: 780, deviationPct: 10, wbs: 'PRJ-NH47-S', costCode: 'CC-MAT', rateVersion: 1, rateEffective: st.today },
  );

  /* 4 · Measurements — some certified (billed), some not */
  st.psMeasurements.push(
    { id: 'PSM-01', boqItemId: 'PSB-01', qty: 48000, dateISO: daysAgoISO(20), certified: true, certifiedBillId: 'RA-01' },
    { id: 'PSM-02', boqItemId: 'PSB-01', qty: 4000, dateISO: daysAgoISO(5), certified: true },
    { id: 'PSM-03', boqItemId: 'PSB-02', qty: 3000, stage: 'SHUTTER', dateISO: daysAgoISO(15), certified: true, certifiedBillId: 'RA-01' },
    { id: 'PSM-04', boqItemId: 'PSB-02', qty: 1100, stage: 'REBAR', dateISO: daysAgoISO(3), certified: false },
    { id: 'PSM-05', boqItemId: 'PSB-03', qty: 300, dateISO: daysAgoISO(10), certified: true, certifiedBillId: 'RA-01' },
  );

  /* 5 · Budgets per cost-object WBS */
  st.budgets['PRJ-NH47-E'] = { org: 2_40_00_000, sup: 0, ret: 0 };
  st.budgets['PRJ-NH47-S'] = { org: 3_10_00_000, sup: 15_00_000, ret: 0 };
  st.budgets['PRJ-NH47-P'] = { org: 1_60_00_000, sup: 0, ret: 0 };

  /* 6 · Actual cost posted to earthworks (marks the node as posted-to) */
  r = postMovement(st, { movementCode: '200', materialCode: 'MAT-AGG20', qty: 900, siteId: 'ST-NH47', locId: 'UNR', wbs: 'PRJ-NH47-E' }, 'USR-STR');
  Object.assign(st, r.s);
  st.wbsElements.forEach((w) => { if (w.code === 'PRJ-NH47-E') w.postedTo = true; });

  /* 7 · A DPR pre-filled from attendance / plant logs / material documents */
  st.today = daysAgoISO(1);
  r = createDpr(st, { projectCode: 'PRJ-NH47', dateISO: daysAgoISO(1), shift: 'DAY', submit: true }, 'USR-STR');
  Object.assign(st, r.s);
  st.today = todayISO();

  /* 8 · Site registers: a hindrance with a notice deadline approaching, an RFI, a site instruction */
  r = psLogHindrance(st, { projectCode: 'PRJ-NH47', type: 'Client drawing delay', desc: 'GAD for minor bridge at Ch 3+200 not issued', dateFrom: daysAgoISO(6), fronts: 'Reach R2 — minor bridge', activityIds: ['ACT-03'], noticeServed: false, noticeDeadline: daysAgoISO(-5), manpowerIdle: 18, equipmentIdle: 2 }, 'USR-STR');
  Object.assign(st, r.s);
  r = psLogHindrance(st, { projectCode: 'PRJ-NH47', type: 'Utility shifting', desc: 'HT line at Ch 1+800 pending DISCOM clearance', dateFrom: daysAgoISO(24), fronts: 'Reach R1', activityIds: ['ACT-02'], noticeServed: true, noticeRef: 'VUL/NH47/NTC/014', noticeDeadline: daysAgoISO(14) }, 'USR-STR');
  Object.assign(st, r.s);
  r = raiseRfi(st, { projectCode: 'PRJ-NH47', toWhom: "Consultant (PMC)", query: 'Clarify bearing details at pier P4 — drawing contradicts spec', drawingRef: 'SB-104 Rev C', requiredBy: daysAgoISO(-10) }, 'USR-STR');
  Object.assign(st, r.s);
  r = raiseSiteInstruction(st, { projectCode: 'PRJ-NH47', from: "Client's Engineer", subject: 'Additional under-drain at Ch 2+100', clause: 'Clause 12.3', costImplication: 'YES', costAmount: 4_50_000 }, 'USR-STR');
  Object.assign(st, r.s);

  /* 9 · Forecast discipline — three retained versions showing a sliding margin */
  r = recordForecast(st, { projectCode: 'PRJ-NH47', wbs: 'PRJ-NH47-S', period: '2025-10', forecastEac: 2_85_00_000, basis: 'BUDGET_RATE' }, 'USR-COM');
  Object.assign(st, r.s);
  r = recordForecast(st, { projectCode: 'PRJ-NH47', wbs: 'PRJ-NH47-S', period: '2025-11', forecastEac: 2_97_00_000, basis: 'LATEST_ACTUAL', basisNote: 'Steel rate firmed up 6%' }, 'USR-COM');
  Object.assign(st, r.s);
  r = recordForecast(st, { projectCode: 'PRJ-NH47', wbs: 'PRJ-NH47-S', period: '2025-12', forecastEac: 3_09_00_000, basis: 'LATEST_PURCHASE', basisNote: 'Cement price revised; consumption 4% over norm' }, 'USR-COM');
  Object.assign(st, r.s);
}

/* ── Part 5 opening: storage bins, a client-issued (split valuation) receipt, put-away ── */
function seedStores(st: ERPState): void {
  let r: { s: ERPState; ok: boolean; docId?: string };
  /* storage bins at the project site store */
  st.bins.push(
    { id: uid(), siteId: 'ST-NH47', locId: 'UNR', code: 'A-01-1', capacity: 2000, uom: 'BAG', materialRestriction: ['MAT-C53'], currentQty: 0, currentMaterial: 'MAT-C53' },
    { id: uid(), siteId: 'ST-NH47', locId: 'UNR', code: 'A-02-3', capacity: 500, uom: 'MT', materialRestriction: ['MAT-STL16'], currentQty: 0, currentMaterial: 'MAT-STL16' },
    { id: uid(), siteId: 'ST-NH47', locId: 'UNR', code: 'B-01-2', capacity: 400, uom: 'M3', materialRestriction: [], currentQty: 0 },
  );

  /* client-issued steel received at the contractual issue rate — split valuation, never blended */
  st.today = daysAgoISO(6);
  r = postMovement(st, { movementCode: '130', materialCode: 'MAT-STL16', qty: 40, siteId: 'ST-NH47', locId: 'UNR', rate: 71500, partnerId: 'BP-NHAI' }, 'USR-STR');
  Object.assign(st, r.s);

  /* a receipt awaiting put-away */
  st.today = daysAgoISO(1);
  r = createPutaway(st, { siteId: 'ST-NH47', materialCode: 'MAT-C53', qty: 60, gateNo: 'GE-0007' }, 'USR-STR');
  Object.assign(st, r.s);

  st.today = todayISO();
}
