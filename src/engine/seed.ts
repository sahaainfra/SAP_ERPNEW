import type { ERPState } from './types';
import { MATERIALS, PARTNERS } from './config';
import {
  freshState, createPR, approveDoc, createPOFromPR, postGR, postInvoice, postMovement,
  daysAgoISO, todayISO,
} from './engine';

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

  st.today = todayISO();
  return st;
}
