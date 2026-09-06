import type { ERPState } from './types';
import { MATERIALS, PARTNERS } from './config';
import {
  freshState, createPR, approveDoc, createPOFromPR, postGR, postInvoice, postMovement,
  daysAgoISO, todayISO,
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
import { backfillConversations } from './platform';

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

  /* Record-bound conversation threads attach to every submitted document */
  backfillConversations(st);

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
