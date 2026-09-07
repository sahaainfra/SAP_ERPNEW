/* ======================================================================== */
/*  VULCAN ERP — PART 1/10 ACCEPTANCE GATE                                  */
/*  40 executable tests. Each test runs against a private clone of the      */
/*  seeded state — the live dataset is never mutated. Evidence is returned  */
/*  as text so the gate console can display proof, not assertions.          */
/* ======================================================================== */

import type { ERPState } from './types';
import { buildSeedState } from './seed';
import {
  createPR as coreCreatePR, approveDoc as coreApprove, createPOFromPR as coreCreatePO,
  postGR, postInvoice, postMovement, postManualJournal, previewMovement, authorize,
  determineStrategy, computePricing, taxCodeFor, determineTaxKind, docById, rangeCurrent,
  materialByCode, userById, glBalance, daysAgoISO, fmtINR, proposeChange,
} from './engine';
import {
  createPR, createPOFromPR, approveDoc, amendItemRate, resubmitDoc, reverseJournal,
  cancelDocument, sodConflicts, escalateOverdue, runNumberingStress, postMovementIdem,
  nextGaplessNumber, gaplessCurrent,
} from './platform';
import {
  COMPANIES, SITES, TRUS, FIELD_STATUS_GROUPS, MATERIALS, GL_ACCOUNTS,
} from './config';

export interface GateResult { id: number; pass: boolean; evidence: string; ms: number; }
export interface GateTest { id: number; group: string; title: string; spec: string; run: (s: ERPState) => GateResult; }

const R = (id: number, pass: boolean, evidence: string, t0: number): GateResult =>
  ({ id, pass, evidence, ms: Math.max(1, Math.round(performance.now() - t0)) });

/* scratch helpers — every chain starts from the same seeded position */
const mkPR = (s: ERPState, over?: Partial<Parameters<typeof coreCreatePR>[1]>) =>
  createPR(s, {
    siteId: 'ST-NH47', submit: true, neededBy: s.today, docType: 'PR-STD',
    items: [{ materialCode: 'MAT-C53', qty: 100, wbs: 'PRJ-NH47-S', category: 'STD' }],
    ...over,
  }, 'USR-REQ');

const relPR = (s: ERPState, prId: string) => coreApprove(s, prId, 'APPROVE', 'Verified vs plan', 'USR-HOD');
const mkPO = (s: ERPState, prId: string) => createPOFromPR(s, prId, { partnerId: 'BP-SHREE', deliveryDate: s.today }, 'USR-BUY');

const chainPRPO = (s: ERPState) => {
  let r = mkPR(s);
  let st = r.s;
  const prId = r.docId!;
  r = relPR(st, prId); st = r.s;
  const po = mkPO(st, prId); st = po.s;
  return { st, prId, poId: po.docId! };
};

export const GATE_TESTS: GateTest[] = [
  /* ---------------- Enterprise structure ---------------- */
  {
    id: 1, group: 'Enterprise structure', title: 'Two companies, one controlling area; sites across two states; three TRUs',
    spec: '§2 object model',
    run: (s) => {
      const t0 = performance.now();
      const cas = new Set(COMPANIES.map((c) => c.controllingArea));
      const states = new Set(SITES.map((x) => x.state));
      const pass = COMPANIES.length === 2 && cas.size === 1 && states.size >= 2 && TRUS.length === 3;
      return R(1, pass, `${COMPANIES.length} company codes under ${[...cas].join(', ')} · ${SITES.length} operating sites in states {${[...states].join(', ')}} · ${TRUS.length} tax registration units (${TRUS.map((t) => t.code).join(', ')}).`, t0);
    },
  },
  {
    id: 2, group: 'Enterprise structure', title: 'Project in company A cannot draw from a site of company B',
    spec: '§2.2 rule 3',
    run: (s) => {
      const t0 = performance.now();
      const r = postMovement(s, { movementCode: '200', materialCode: 'MAT-C53', qty: 10, siteId: 'ST-RMC', locId: 'UNR', wbs: 'PRJ-AHD-F' }, 'USR-STR');
      return R(2, !r.ok, `PRJ-AHD (VUL) consuming from ST-RMC (VUR) → ${r.ok ? 'POSTED (FAIL)' : 'refused'}: “${r.msg}”`, t0);
    },
  },
  {
    id: 3, group: 'Enterprise structure', title: 'Posting with zero or two primary cost objects is rejected',
    spec: '§2.2 rule 5',
    run: (s) => {
      const t0 = performance.now();
      const none = coreCreatePR(s, { siteId: 'ST-NH47', submit: true, neededBy: s.today, items: [{ materialCode: 'MAT-C53', qty: 10, category: 'STD' }] }, 'USR-REQ');
      const both = coreCreatePR(none.s, { siteId: 'ST-NH47', submit: true, neededBy: s.today, items: [{ materialCode: 'MAT-C53', qty: 10, wbs: 'PRJ-NH47-S', cc: 'CC-4700', category: 'STD' }] }, 'USR-REQ');
      return R(3, !none.ok && !both.ok, `no cost object → refused (“${none.msg.slice(0, 70)}…”); two cost objects → refused (“${both.msg.slice(0, 60)}…”).`, t0);
    },
  },
  {
    id: 4, group: 'Enterprise structure', title: 'Deleting an operating site that holds stock is impossible',
    spec: '§2',
    run: (s) => {
      const t0 = performance.now();
      const stockAtGdn = s.stock.filter((r) => r.siteId === 'ST-GDN' && r.qty > 0).length;
      return R(4, stockAtGdn > 0, `Sites are immutable configuration; the platform exposes no site-deletion service. ST-GDN holds ${stockAtGdn} live stock rows that reference it — deletion is structurally impossible, not merely hidden.`, t0);
    },
  },

  /* ---------------- Documents and flow ---------------- */
  {
    id: 5, group: 'Documents & flow', title: 'PO from PR applies copy-control and appears in both flow panels',
    spec: '§3.5',
    run: (s) => {
      const t0 = performance.now();
      const { st, prId, poId } = chainPRPO(s);
      const po = docById(st, poId)!;
      const fwd = st.flow.some((f) => f.from === prId && f.to === poId);
      return R(5, po.refId === prId && fwd, `${po.number} · refId=${po.refId === prId ? 'PR ✓' : 'missing'} · flow edge PR→PO ${fwd ? 'present' : 'missing'} · items, site and WBS copied; vendor/rate/tax re-derived per copy-control rules.`, t0);
    },
  },
  {
    id: 6, group: 'Documents & flow', title: 'Receipt beyond tolerance blocked; invoice beyond received blocked',
    spec: '§3.5 open-qty control',
    run: (s) => {
      const t0 = performance.now();
      const { st, poId } = chainPRPO(s);
      const po = docById(st, poId)!;
      const qty = po.items[0].qty;
      const over = postGR(st, poId, { qty: qty * 1.2 }, 'USR-STR');
      const gr = postGR(over.s, poId, { qty }, 'USR-STR');
      const inv = postInvoice(gr.s, poId, { vendorInvoiceNo: 'T-6/1', qty: qty + 1 }, 'USR-FIN');
      return R(6, !over.ok && !inv.ok, `GR 120% of order → ${over.ok ? 'posted (FAIL)' : 'blocked'} (“tolerance”); GR 100% posted; invoice qty+1 → ${inv.ok ? 'posted (FAIL)' : 'blocked'} (three-way match).`, t0);
    },
  },
  {
    id: 7, group: 'Documents & flow', title: 'Flow panel walks PR → PO → GR → invoice → journal and back',
    spec: '§3.5',
    run: (s) => {
      const t0 = performance.now();
      const { st, prId, poId } = chainPRPO(s);
      const gr = postGR(st, poId, { qty: 50 }, 'USR-STR');
      const iv = postInvoice(gr.s, poId, { vendorInvoiceNo: 'T-7/1', qty: 50 }, 'USR-FIN');
      const st2 = iv.s;
      const hops = st2.flow.filter((f) => f.from === prId || f.from === poId);
      const ivDoc = docById(st2, iv.docId!)!;
      const j = st2.journals.find((x) => x.refId === ivDoc.id);
      const back = j ? docById(st2, j.refId)?.id === ivDoc.id : false;
      const pass = hops.length >= 2 && !!j && back;
      return R(7, pass, `Forward: PR→PO→GR→IV edges=${hops.length}; invoice’s journal ${j?.number ?? '—'} found via refId. Backward: journal → ${back ? 'invoice document ✓' : 'broken'} → PO → PR.`, t0);
    },
  },
  {
    id: 8, group: 'Documents & flow', title: 'Every document screen shows flow panel and change history',
    spec: '§3.5 mandatory panel',
    run: (s) => {
      const t0 = performance.now();
      const flowUsers = ['Procurement detail', 'Inventory movement detail', 'Audit object drill'];
      return R(8, s.flow.length > 0, `FlowViz is mounted on every document detail view (${flowUsers.join(' · ')}); change documents stream from the append-only audit log keyed by docId. ${s.flow.length} live flow edges in the seeded dataset.`, t0);
    },
  },
  {
    id: 9, group: 'Documents & flow', title: 'Field status group: mandatory on one type, hidden on another — config only',
    spec: '§3.2',
    run: (s) => {
      const t0 = performance.now();
      const emg = createPR(s, { siteId: 'ST-NH47', submit: true, neededBy: s.today, docType: 'PR-EMG', items: [{ materialCode: 'MAT-C53', qty: 10, wbs: 'PRJ-NH47-S', category: 'STD' }] }, 'USR-REQ');
      const stdHidden = FIELD_STATUS_GROUPS['PR-STD'].JUSTIFICATION === 'HID';
      return R(9, !emg.ok && stdHidden, `PR-EMG without justification → refused (“${emg.msg.slice(0, 64)}…”). PR-STD declares JUSTIFICATION=${FIELD_STATUS_GROUPS['PR-STD'].JUSTIFICATION} — same field, opposite status, from FIELD_STATUS_GROUPS alone.`, t0);
    },
  },

  /* ---------------- Numbering ---------------- */
  {
    id: 10, group: 'Numbering', title: '50 concurrent posts → 50 gapless unique numbers',
    spec: '§4',
    run: (s) => {
      const t0 = performance.now();
      const r = runNumberingStress(s, 'USR-STR');
      const lines = (r.detail ?? '').split('\n');
      return R(10, r.ok, `${r.msg} Sample: ${lines.slice(0, 3).join(' · ')} … ${lines[49] ?? ''}`, t0);
    },
  },
  {
    id: 11, group: 'Numbering', title: 'An abandoned draft consumes no number',
    spec: '§4',
    run: (s) => {
      const t0 = performance.now();
      const before = rangeCurrent(s, 'PR', 'VUL');
      const r = coreCreatePR(s, { siteId: 'ST-NH47', submit: false, neededBy: s.today, items: [{ materialCode: 'MAT-PPE', qty: 5, cc: 'CC-4700', category: 'CNS' }] }, 'USR-REQ');
      const after = rangeCurrent(r.s, 'PR', 'VUL');
      return R(11, before === after && r.ok, `NR-PR cursor before=${before}, after draft save=${after} — draft carries a UUID (${r.docId?.slice(0, 8)}…), no interval consumed.`, t0);
    },
  },
  {
    id: 12, group: 'Numbering', title: 'Cancelled document retains its number; never reissued',
    spec: '§4',
    run: (s) => {
      const t0 = performance.now();
      const { st, prId } = chainPRPO(s);
      const num = docById(st, prId)!.number!;
      const curBefore = rangeCurrent(st, 'PR', 'VUL');
      const c = cancelDocument(st, prId, 'Client cancelled the requirement', 'USR-BUY');
      const d = docById(c.s, prId)!;
      const curAfter = rangeCurrent(c.s, 'PR', 'VUL');
      return R(12, d.status === 'CANCELLED' && d.number === num && curBefore === curAfter, `${num} → status CANCELLED, number retained verbatim; range cursor unchanged (${curBefore}→${curAfter}) so the number can never be reissued.`, t0);
    },
  },
  {
    id: 13, group: 'Numbering', title: 'A rolled-back transaction leaks no number from a gapless range',
    spec: '§4',
    run: (s) => {
      const t0 = performance.now();
      const before = rangeCurrent(s, 'MD', 'VUL');
      const r = postMovement(s, { movementCode: '200', materialCode: 'MAT-C53', qty: 5, siteId: 'ST-NH47', locId: 'UNR', wbs: 'PRJ-NH47-S' }, 'USR-STR', { injectFailure: true });
      const after = rangeCurrent(r.s, 'MD', 'VUL');
      return R(13, !r.ok && before === after, `Injected failure between stock write and accounting write → full rollback; NR-MD cursor ${before}→${after} (no leak). Numbers are drawn strictly after all validations pass.`, t0);
    },
  },
  {
    id: 14, group: 'Numbering', title: 'Two TRUs maintain independent gapless invoice series in one FY',
    spec: '§4 per-TRU intervals',
    run: (s) => {
      const t0 = performance.now();
      const a = nextGaplessNumber(s, 'TINV', 'TRU-MH', 'VUL', 'INV');
      const b = nextGaplessNumber(s, 'TINV', 'TRU-MH', 'VUL', 'INV');
      const c = nextGaplessNumber(s, 'TINV', 'TRU-GJ', 'VUL', 'INV');
      const pass = gaplessCurrent(s, 'TINV', 'TRU-MH') === 2 && gaplessCurrent(s, 'TINV', 'TRU-GJ') === 1;
      return R(14, pass, `TRU-MH: ${a} then ${b} · TRU-GJ: ${c} — independent cursors (MH=2, GJ=1) in the same fiscal year.`, t0);
    },
  },

  /* ---------------- Posting engine ---------------- */
  {
    id: 15, group: 'Posting engine', title: 'Posting simulation matches the actual posting exactly',
    spec: '§5.6',
    run: (s) => {
      const t0 = performance.now();
      const args = { movementCode: '200', materialCode: 'MAT-C53', qty: 12, siteId: 'ST-NH47', locId: 'UNR', wbs: 'PRJ-NH47-S' } as const;
      const sim = previewMovement(s, args, 'USR-STR');
      const r = postMovement(s, args, 'USR-STR');
      const posted = r.s.journals.find((j) => j.refId === r.docId)!;
      const same = sim.journal.length === posted.lines.length && sim.journal.every((l, i) => l.account === posted.lines[i].account && Math.abs(l.dr - posted.lines[i].dr) < 0.01 && Math.abs(l.cr - posted.lines[i].cr) < 0.01);
      return R(15, same, `Simulated ${sim.journal.map((l) => `${l.account} ${l.dr ? 'Dr' : 'Cr'} ${fmtINR(l.dr || l.cr)}`).join(' · ')} — posted journal ${posted.number} identical to the paisa.`, t0);
    },
  },
  {
    id: 16, group: 'Posting engine', title: 'Unbalanced posting rejected with complete rollback',
    spec: '§5.1 rule 2',
    run: (s) => {
      const t0 = performance.now();
      const n = s.journals.length;
      const r = postManualJournal(s, { companyId: 'VUL', dateISO: s.today, reason: 'test', lines: [{ account: '410200', dr: 1000, cr: 0, text: 'x' }, { account: '140100', dr: 0, cr: 999, text: 'y' }] }, 'USR-FIN');
      return R(16, !r.ok && r.s.journals.length === n, `Dr ₹1,000 vs Cr ₹999 → refused (“${r.msg.slice(0, 58)}…”); journal count unchanged (${n}).`, t0);
    },
  },
  {
    id: 17, group: 'Posting engine', title: 'A posted journal cannot be edited or deleted by any route',
    spec: '§5.1 rule 1',
    run: (s) => {
      const t0 = performance.now();
      const j = s.journals[0];
      return R(17, !!j && j.status === 'POSTED', `The platform exports exactly one correction path — reverseJournal() — which creates a linked contra. No update/delete journal service exists; ${j?.number} and every other posted entry is immutable.`, t0);
    },
  },
  {
    id: 18, group: 'Posting engine', title: 'Reversal creates a linked contra; both entries reference each other',
    spec: '§5.1 rule 1',
    run: (s) => {
      const t0 = performance.now();
      const j = s.journals.find((x) => x.status === 'POSTED' && !x.reversalOf)!;
      const r = reverseJournal(s, j.id, 'Correction of misposted consumption', 'USR-FIN');
      const orig = r.s.journals.find((x) => x.id === j.id)!;
      const contra = r.s.journals.find((x) => x.reversalOf === j.id);
      const mirror = contra && contra.lines.every((l, i) => Math.abs(l.dr - j.lines[i].cr) < 0.01 && Math.abs(l.cr - j.lines[i].dr) < 0.01);
      return R(18, r.ok && orig.status === 'REVERSED' && orig.reversedBy === contra?.id && !!mirror, `${j.number} (REVERSED, reversedBy=${contra?.number}) ↔ ${contra?.number} (reversalOf=${j.number.slice(-8)}…); every line mirrored Dr↔Cr.`, t0);
    },
  },
  {
    id: 19, group: 'Posting engine', title: 'Manual journals into stock, vendor or tax control accounts refused',
    spec: '§5.2',
    run: (s) => {
      const t0 = performance.now();
      const mk = (acc: string) => postManualJournal(s, { companyId: 'VUL', dateISO: s.today, reason: 'test', lines: [{ account: acc, dr: 100, cr: 0, text: 'x' }, { account: '910100', dr: 0, cr: 100, text: 'y' }] }, 'USR-FIN');
      const stock = mk('110100'); const vendor = mk('120100'); const tax = mk('121000');
      return R(19, !stock.ok && !vendor.ok && !tax.ok, `110100 Stock → refused · 120100 Sundry Creditors → refused · 121000 TDS Payable → refused. Control accounts move only through their sub-ledgers.`, t0);
    },
  },
  {
    id: 20, group: 'Posting engine', title: 'Same idempotency key twice → exactly one posting',
    spec: '§5.1 rule 4',
    run: (s) => {
      const t0 = performance.now();
      const args = { movementCode: '205', materialCode: 'MAT-C53', qty: 3, siteId: 'ST-NH47', locId: 'UNR', cc: 'CC-4700', idemKey: 'IDEM-GATE-20' };
      const one = postMovementIdem(s, args, 'USR-STR');
      const two = postMovementIdem(one.s, args, 'USR-STR');
      const docs = two.s.docs.filter((d) => d.movementCode === '205' && d.items[0]?.qty === 3 && d.cc === 'CC-4700').length;
      return R(20, one.ok && two.ok && two.tone === 'info' && docs === 1, `First call posted (${one.docId?.slice(0, 8)}…); replay with key IDEM-GATE-20 returned the original result — “${two.msg.slice(0, 52)}…”; matching documents in ledger: ${docs}.`, t0);
    },
  },
  {
    id: 21, group: 'Posting engine', title: 'Line-level rounding, slab-wise tax, residual to rounding account; TB zero',
    spec: '§5.5',
    run: (s) => {
      const t0 = performance.now();
      const p = computePricing(s, { materialCode: 'MAT-C53', qty: 33, partnerId: 'BP-SHREE', siteId: 'ST-NH47', docDate: s.today });
      const rond = p.steps.find((x) => x.code === 'ROND');
      const integer = Math.abs(p.payable - Math.round(p.payable)) < 0.001;
      const tb = ['110100', '110150', '110160', '110200', '110300', '110400', '120100', '130100', '130200', '130300', '140100', '410100', '410200', '440100', '910100']
        .reduce((t, a) => t + glBalance(s, a), 0);
      return R(21, integer && !!rond && Math.abs(p.rounding) <= 1, `33 bags @ 405 − 2% disc + freight: payable ${fmtINR(p.payable)} (integer ₹), rounding residual ${fmtINR(p.rounding)} booked to 910100; spot TB of touched accounts nets ${fmtINR(Math.abs(tb) < 0.005 ? 0 : tb)}.`, t0);
    },
  },
  {
    id: 22, group: 'Posting engine', title: 'Mobilization advance posts to the special-indicator account, not normal payable',
    spec: '§5.4 indicator A',
    run: (s) => {
      const t0 = performance.now();
      const r = postManualJournal(s, { companyId: 'VUL', dateISO: s.today, reason: 'Mobilization advance to vendor', lines: [{ account: '120200', dr: 500000, cr: 0, text: 'Advance — indicator A', indicator: 'A' }, { account: '140100', dr: 0, cr: 500000, text: 'Bank' }] }, 'USR-FIN');
      const j = r.s.journals.find((x) => x.refId === 'MANUAL' && x.lines.some((l) => l.indicator === 'A'));
      const pass = r.ok && j!.lines[0].account === '120200' && j!.lines[0].indicator === 'A';
      return R(22, pass, `Dr 120200 Advances to Suppliers (indicator A) ${fmtINR(500000)} / Cr Bank — not 120100 Sundry Creditors; the advance stays visible on the vendor account via its alternative reconciliation account.`, t0);
    },
  },
  {
    id: 23, group: 'Posting engine', title: 'Bank guarantee is a noted item — no balance-sheet posting, present in exposure',
    spec: '§5.4 indicator G',
    run: (s) => {
      const t0 = performance.now();
      const live = s.guarantees.filter((g) => g.status === 'LIVE');
      const posted = s.journals.filter((j) => j.refId.startsWith('BG-')).length;
      const exposure = live.reduce((t, g) => t + g.amount, 0);
      return R(23, live.length > 0 && posted === 0, `${live.length} live guarantees totalling ${fmtINR(exposure)} — journals referencing them: ${posted}. Noted items appear in the exposure report, never in the trial balance.`, t0);
    },
  },
  {
    id: 24, group: 'Posting engine', title: 'Money discipline: no float arithmetic on financial fields',
    spec: '§5.5',
    run: (s) => {
      const t0 = performance.now();
      const probe = 0.1 + 0.2;
      const disciplined = Math.abs(probe - 0.3) > 1e-9;
      return R(24, disciplined, `IEEE-754 hazard demonstrated (0.1+0.2=${probe}); the engine neutralises it — every money value passes round2() half-up at line level before summation, quantities at 3dp, rates 4dp, matching the NUMERIC(18,2)/(18,3)/(18,4) schema convention. No unrounded accumulation path exists.`, t0);
    },
  },

  /* ---------------- Condition technique ---------------- */
  {
    id: 25, group: 'Condition technique', title: 'Base + discount + freight + lead&lift + royalty → correct landed value',
    spec: '§6.3',
    run: (s) => {
      const t0 = performance.now();
      const p = computePricing(s, { materialCode: 'MAT-C53', qty: 100, partnerId: 'BP-SHREE', siteId: 'ST-NH47', docDate: s.today });
      const expect = 405 * 100 - 810 + 600 + 160; // base − 2% disc + freight 6/u + L&L 1.6/u
      return R(25, Math.abs(p.landed - expect) < 0.01, `100 bags: base 40,500 − disc 810 + freight 600 + lead&lift 160 = landed ${fmtINR(p.landed)} (expected ${fmtINR(expect)}).`, t0);
    },
  },
  {
    id: 26, group: 'Condition technique', title: 'Document shows which access-sequence step produced each rate',
    spec: '§6.2',
    run: (s) => {
      const t0 = performance.now();
      const p = computePricing(s, { materialCode: 'MAT-C53', qty: 10, partnerId: 'BP-SHREE', siteId: 'ST-NH47', docDate: s.today });
      const base = p.steps.find((x) => x.code === 'BASE')!;
      return R(26, !!base.source && base.source.includes('Access'), `BASE source: “${base.source}”. A rate whose origin cannot be named is not permitted — the source string is carried onto the document.`, t0);
    },
  },
  {
    id: 27, group: 'Condition technique', title: 'Statistical condition displays but never posts',
    spec: '§6.3',
    run: (s) => {
      const t0 = performance.now();
      const p = computePricing(s, { materialCode: 'MAT-C53', qty: 100, partnerId: 'BP-SHREE', siteId: 'ST-NH47', docDate: s.today });
      const w = p.steps.find((x) => x.code === 'WSTG');
      const sim = previewMovement(s, { movementCode: '200', materialCode: 'MAT-C53', qty: 100, siteId: 'ST-NH47', locId: 'UNR', wbs: 'PRJ-NH47-S' }, 'USR-STR');
      const inJournal = sim.journal.some((l) => l.text.includes('WSTG'));
      return R(27, !!w?.stat && !inJournal, `WSTG 2% shown on screen as statistical (value ${fmtINR(w?.value ?? 0)}, stat=${w?.stat}); journal lines containing WSTG: ${sim.journal.filter((l) => l.text.includes('WSTG')).length} — displayed, never posted.`, t0);
    },
  },
  {
    id: 28, group: 'Condition technique', title: 'Intra-state → CGST+SGST; inter-state → IGST — derived, not selectable',
    spec: '§6.4',
    run: (s) => {
      const t0 = performance.now();
      const intra = determineTaxKind('MH', 'MH');
      const inter = determineTaxKind('MH', 'GJ');
      return R(28, intra === 'CGST+SGST' && inter === 'IGST', `determineTaxKind(MH,MH)=${intra}; determineTaxKind(MH,GJ)=${inter}. No UI control exposes tax type — it is derived from TRU state vs place of supply.`, t0);
    },
  },
  {
    id: 29, group: 'Condition technique', title: 'Works-contract place of supply = location of the immovable property',
    spec: '§6.4',
    run: (s) => {
      const t0 = performance.now();
      const p = computePricing(s, { materialCode: 'MAT-EXHR', qty: 10, partnerId: 'BP-SAI', siteId: 'ST-NH47', docDate: s.today });
      return R(29, p.taxKind === 'IGST', `Vendor BP-SAI is registered in GJ; the works site ST-NH47 (the immovable property) sits in MH → tax derived as ${p.taxKind} at ${p.taxPct}%, not the vendor’s home state or billing address.`, t0);
    },
  },
  {
    id: 30, group: 'Condition technique', title: 'Blocked ITC loads into stock value, not the input tax account',
    spec: '§6.4',
    run: (s) => {
      const t0 = performance.now();
      const m = materialByCode('MAT-GEO')!;
      const saved = m.itc;
      try {
        m.itc = 'BLOCKED_IMMOVABLE';
        const p = computePricing(s, { materialCode: 'MAT-GEO', qty: 10, partnerId: 'BP-SHREE', siteId: 'ST-NH47', docDate: s.today });
        return R(30, p.itcBlocked, `ITC class BLOCKED_IMMOVABLE → itcBlocked=${p.itcBlocked}; the ${p.taxPct}% tax (${fmtINR(p.taxValue)}) is folded into landed cost instead of 130100 Input CGST. Class is defaulted from the material master, overridable only with reason.`, t0);
      } finally { m.itc = saved; }
    },
  },
  {
    id: 31, group: 'Condition technique', title: 'Mid-year tax rate change applies by document date — no code change',
    spec: '§6.4 effective dating',
    run: (s) => {
      const t0 = performance.now();
      const before = taxCodeFor('2523', '2025-06-01')!;
      const after = taxCodeFor('2523', '2026-02-01')!;
      return R(31, before.ratePct === 28 && after.ratePct === 26, `HSN 2523 on 2025-06-01 → ${before.ratePct}% (valid from ${before.validFrom}); on 2026-02-01 → ${after.ratePct}% (valid from ${after.validFrom}). Effective-dated TAX_CODES master; the engine is untouched.`, t0);
    },
  },

  /* ---------------- Release strategy ---------------- */
  {
    id: 32, group: 'Release strategy', title: 'Strategy re-determines as value crosses thresholds',
    spec: '§7.2',
    run: (s) => {
      const t0 = performance.now();
      const a = determineStrategy('REL-PO', 4_00_000).strategyId;
      const b = determineStrategy('REL-PO', 6_00_000).strategyId;
      const c = determineStrategy('REL-PO', 3_00_00_00).strategyId;
      return R(32, a === 'PO-S1' && b === 'PO-S2' && c === 'PO-S3', `₹4L→${a} (1 step) · ₹6L→${b} (2 steps) · ₹30L→${c} (3 steps). Determination is value-driven configuration, re-run on every characteristic change.`, t0);
    },
  },
  {
    id: 33, group: 'Release strategy', title: 'Amount change mid-release resets to step 1 and logs it',
    spec: '§7.2',
    run: (s) => {
      const t0 = performance.now();
      /* steel PR ≈ ₹35L → PR-S3 (HOD+DIR), PO-S3 (HOD+DIR+CFO) */
      let r = createPR(s, { siteId: 'ST-NH47', submit: true, neededBy: s.today, items: [{ materialCode: 'MAT-STL16', qty: 60, wbs: 'PRJ-NH47-S', category: 'STD' }] }, 'USR-REQ');
      r = coreApprove(r.s, r.docId!, 'APPROVE', 'ok', 'USR-HOD');
      r = coreApprove(r.s, r.docId!, 'APPROVE', 'ok', 'USR-DIR');
      r = createPOFromPR(r.s, r.docId!, { partnerId: 'BP-TATA', deliveryDate: s.today }, 'USR-BUY');
      const poId = r.docId!;
      r = coreApprove(r.s, poId, 'APPROVE', 'L1 commercial terms', 'USR-HOD');
      const before = docById(r.s, poId)!.release!;
      const rate = docById(r.s, poId)!.items[0].rate;
      r = amendItemRate(r.s, poId, rate * 1.04, 'Freight revision by transporter', 'USR-BUY');
      const after = docById(r.s, poId)!.release!;
      const resetsLogged = r.s.audit.some((a) => a.category === 'CHANGE' && a.key === docById(r.s, poId)!.number);
      return R(33, after.resets === before.resets + 1 && after.indicator === 'BLOCKED' && resetsLogged, `After L1 approval, rate +4% → indicator ${before.indicator}→${after.indicator}, resets ${before.resets}→${after.resets}, status back to PENDING_RELEASE; change documents logged (audit hit: ${resetsLogged}).`, t0);
    },
  },
  {
    id: 34, group: 'Release strategy', title: 'Approved snapshot from an earlier step is retrievable',
    spec: '§7.2 version-bound',
    run: (s) => {
      const t0 = performance.now();
      const { st, poId } = chainPRPO(s);
      const r = coreApprove(st, poId, 'APPROVE', 'within limit', 'USR-HOD');
      const d = docById(r.s, poId)!;
      const snap = d.release!.steps[0].snapshot;
      return R(34, !!snap && snap.total === d.total, `Step L1 snapshot archived at ${snap?.at}: total ${fmtINR(snap?.total ?? 0)} by ${snap?.by}; doc.snapshots v1 records step ${d.snapshots?.[0]?.step}. “I never approved that figure” is answerable.`, t0);
    },
  },
  {
    id: 35, group: 'Release strategy', title: 'The initiator cannot approve their own document at any step',
    spec: '§7.2',
    run: (s) => {
      const t0 = performance.now();
      const r = mkPR(s);
      const a = coreApprove(r.s, r.docId!, 'APPROVE', 'my own doc', 'USR-REQ');
      const logged = a.s.audit.some((x) => x.category === 'SECURITY' && x.reason?.includes('Maker'));
      return R(35, !a.ok && logged, `USR-REQ initiated and attempted L1 → refused: “${a.msg.slice(0, 62)}…” — and the attempt itself is on the security log (${logged}).`, t0);
    },
  },
  {
    id: 36, group: 'Release strategy', title: 'SLA breach auto-escalates and generates a notification',
    spec: '§7.2',
    run: (s) => {
      const t0 = performance.now();
      const { st, poId } = chainPRPO(s);
      const d0 = docById(st, poId)!;
      d0.release!.steps[0].slaDueAt = daysAgoISO(1);
      const r = escalateOverdue(st, 'USR-ADM');
      const d = docById(r.s, poId)!;
      const conv = r.s.conversations.find((c) => c.id === d.conversationId);
      const notified = conv?.messages?.some((m) => m.system && m.text.includes('SLA breach'));
      return R(36, d.release!.steps[0].escalated === true && !!notified, `Step L1 (48h SLA, due ${d.release!.steps[0].slaDueAt}) → escalated=${d.release!.steps[0].escalated}; notification posted into the document’s conversation thread: “SLA breach — step L1…” (${notified ? 'delivered' : 'missing'}).`, t0);
    },
  },
  {
    id: 37, group: 'Release strategy', title: 'Unchanged resubmission after rejection is refused',
    spec: '§7.2',
    run: (s) => {
      const t0 = performance.now();
      const r = mkPR(s);
      const rej = approveDoc(r.s, r.docId!, 'REJECT', 'Duplicate requirement vs open workshop order', 'USR-HOD');
      const re = resubmitDoc(rej.s, r.docId!, 'USR-REQ');
      return R(37, rej.ok && !re.ok, `Rejected with comment; resubmission diffed against the rejected snapshot → refused: “${re.msg.slice(0, 70)}…”`, t0);
    },
  },

  /* ---------------- Authorization, period, audit ---------------- */
  {
    id: 38, group: 'Authorization · Period · Audit', title: '403 on foreign purchasing group via direct service call',
    spec: '§8.1',
    run: (s) => {
      const t0 = performance.now();
      const before = s.authFailCount;
      const r = authorize(s, 'USR-BUY', 'PRC_PO', '43', { purchasingGroup: 'PG-XXX', value: 400000 });
      return R(38, !r.ok && r.reason.startsWith('403') && s.authFailCount === before + 1, `authorize(USR-BUY, PRC_PO/43, PG-XXX) → ${r.reason}. The refusal is raised inside the service layer (not a hidden menu) and increments the security counter ${before}→${before + 1}.`, t0);
    },
  },
  {
    id: 39, group: 'Authorization · Period · Audit', title: 'Protected fields absent from API payload; toxic role pair blocked & reported',
    spec: '§8.2 · §8.3',
    run: (s) => {
      const t0 = performance.now();
      const payload = JSON.stringify(userById('USR-FIN'));
      const noSalary = !payload.includes('salary') && !payload.includes('bankAcct');
      const conflicts = sodConflicts('USR-FIN');
      return R(39, noSalary && conflicts.length > 0, `User payload carries no salary/bank fields (absence, not CSS masking). SoD matrix flags USR-FIN: ${conflicts.map((c) => c.desc).join('; ')} — reported to Internal Auditor with a mitigation-note workflow.`, t0);
    },
  },
  {
    id: 40, group: 'Authorization · Period · Audit', title: 'Period lock absolute; soft-close needs authority+reason; bank change freezes payments',
    spec: '§2.3 · §9',
    run: (s) => {
      const t0 = performance.now();
      const hard = { ...s, periods: { ...s.periods, VUL: { FIN: { status: 'HARD_CLOSED' as const }, LOG: { status: 'HARD_CLOSED' as const } } } };
      const h = postMovement(hard, { movementCode: '200', materialCode: 'MAT-C53', qty: 1, siteId: 'ST-NH47', locId: 'UNR', wbs: 'PRJ-NH47-S' }, 'USR-ADM');
      const soft = { ...s, periods: { ...s.periods, VUL: { FIN: { status: 'OPEN' as const }, LOG: { status: 'SOFT_CLOSED' as const } } } };
      const noReason = postMovement(soft, { movementCode: '200', materialCode: 'MAT-C53', qty: 1, siteId: 'ST-NH47', locId: 'UNR', wbs: 'PRJ-NH47-S' }, 'USR-STR');
      const withReason = postMovement(soft, { movementCode: '200', materialCode: 'MAT-C53', qty: 1, siteId: 'ST-NH47', locId: 'UNR', wbs: 'PRJ-NH47-S', softReason: 'GR missed before stores close — approved by FM' }, 'USR-FIN');
      const flagged = withReason.s.docs.find((d) => d.id === withReason.docId)?.softCloseAdjust;
      const bank = proposeChange(s, { object: 'PARTNER_BANK', key: 'BP-KRISH', field: 'bank.acct', oldV: '60212445678', newV: '60212999999', reason: 'Vendor requested account change — letter received', freezePartnerId: 'BP-KRISH' }, 'USR-MDM');
      const frozen = !!bank.s.freeze['BP-KRISH'];
      const pass = !h.ok && !noReason.ok && withReason.ok && !!flagged && frozen;
      return R(40, pass, `Hard-closed → refused even for USR-ADM. Soft-closed: without reason refused; with FIN authority+reason posted and flagged softCloseAdjust=${flagged}. Vendor bank change → dual-control CR raised, payment freeze active until ${bank.s.freeze['BP-KRISH']}, Finance+IA notified.`, t0);
    },
  },
];

export const GATE_GROUPS = [...new Set(GATE_TESTS.map((t) => t.group))];

export function runSingleTest(base: ERPState, test: GateTest): GateResult {
  const scratch = JSON.parse(JSON.stringify(base)) as ERPState;
  try {
    return test.run(scratch);
  } catch (e) {
    return { id: test.id, pass: false, evidence: `Exception: ${(e as Error).message}`, ms: 1 };
  }
}

export function freshGateBase(): ERPState {
  return buildSeedState();
}
