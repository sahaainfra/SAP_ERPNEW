import type { ERPState } from './types';
import { MATERIALS, PARTNERS } from './config';
import {
  freshState, createPR, approveDoc, createPOFromPR, postGR, postInvoice, postMovement,
  daysAgoISO, todayISO,
} from './engine';
import { postEquipmentLog, postInternalHire } from './eam';
import { createInspectionLot, recordTest } from './qms';
import { createGateEntry, weighIn, reserveStock, issueReturnable, startCount, submitCount, createRfq, submitQuotation } from './logistics';

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
