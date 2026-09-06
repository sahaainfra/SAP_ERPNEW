import type { ERPState, Res, MeasurementEntry, RaBill, RaBillStep, JournalLine } from './types';
import { cloneState, round2, uid, pushAudit, authorize, nextNumber, postJournal, fmtNum, fmtINR, nowStamp, periodOf, fyOf } from './engine';
import { boqById, boqByContract, contractById, canMeasure } from './ctr';
import { ESCALATION_COMPONENTS, ESCALATION_NON_ADJUSTABLE, STATUTORY_RATES, PROJECTS } from './config';

export const measurementsByContract = (s: ERPState, contractId: string): MeasurementEntry[] =>
  s.measurements.filter((m) => m.contractId === contractId);

/* ---------- Measurement book ---------- */

export function addMeasurement(
  sIn: ERPState,
  args: { contractId: string; boqItemId: string; location: string; drawingNo: string; drawingRev: string; drawingStatus: 'IFC' | 'SUPERSEDED' | 'DRAFT'; nos: number; length: number; breadth: number; depth: number; formula: string; isDeduction?: boolean; isDeviation?: boolean; correctsId?: string; period: string },
  userId: string,
): Res {
  const s = cloneState(sIn);
  const c = contractById(s, args.contractId);
  const b = boqById(s, args.boqItemId);
  if (!c || !b) return { s, ok: false, msg: 'Unknown contract / BOQ item', tone: 'bad' };

  /* Drawing currency interlock: only IFC + current revision */
  if (args.drawingStatus !== 'IFC') {
    pushAudit(s, userId, 'SECURITY', 'MEASUREMENT', b.itemCode, { reason: `Drawing ${args.drawingNo} rev ${args.drawingRev} is ${args.drawingStatus} — measurement refused` });
    return { s, ok: false, msg: `Measurement refused: drawing ${args.drawingNo} (rev ${args.drawingRev}) is ${args.drawingStatus}. Only drawings at Issued-for-Construction status with the current revision may be measured.`, tone: 'bad' };
  }
  /* A certified entry is immutable — correction only via a linked deviation entry */
  if (args.isDeviation && args.correctsId) {
    const orig = s.measurements.find((m) => m.id === args.correctsId);
    if (orig && orig.status !== 'CERTIFIED') return { s, ok: false, msg: 'Deviation entries correct certified measurements only.', tone: 'warn' };
  }

  const qty = round2(args.nos * args.length * args.breadth * args.depth);
  const signedQty = args.isDeduction ? -Math.abs(qty) : qty;

  /* Over-execution guard (block, not warn) */
  const guard = canMeasure(s, args.boqItemId, signedQty, false);
  if (!guard.ok && !args.isDeviation) {
    pushAudit(s, userId, 'SECURITY', 'MEASUREMENT', b.itemCode, { reason: guard.msg });
    return { s, ok: false, msg: guard.msg, tone: 'bad' };
  }

  const mbNo = `MB/${c.projectCode}/${String(s.measurements.length + 1).padStart(3, '0')}`;
  const entry: MeasurementEntry = {
    id: uid(), contractId: args.contractId, boqItemId: args.boqItemId, mbNo, period: args.period,
    location: args.location, drawingNo: args.drawingNo, drawingRev: args.drawingRev, drawingStatus: args.drawingStatus,
    nos: args.nos, length: args.length, breadth: args.breadth, depth: args.depth, formula: args.formula,
    qty: signedQty, isDeduction: !!args.isDeduction, isDeviation: !!args.isDeviation, correctsId: args.correctsId,
    measuredBy: userId, checkedBy: userId, status: 'DRAFT', at: nowStamp(),
  };
  s.measurements.unshift(entry);
  b.executedCum = round2(b.executedCum + signedQty);
  pushAudit(s, userId, 'CHANGE', 'MEASUREMENT', mbNo, { reason: `${b.itemCode} ${args.location} · ${fmtNum(signedQty, 2)} ${b.unit} · drawing ${args.drawingNo} rev ${args.drawingRev}` });
  return { s, ok: true, msg: `${mbNo} recorded — ${fmtNum(signedQty, 2)} ${b.unit} for ${b.itemCode} (cumulative logic applied).`, tone: 'ok', docId: entry.id };
}

/* Certify a measurement — locks it; correction thereafter only via a linked deviation entry */
export function certifyMeasurement(sIn: ERPState, measurementId: string, userId: string): Res {
  const s = cloneState(sIn);
  const m = s.measurements.find((x) => x.id === measurementId);
  if (!m) return { s, ok: false, msg: 'Measurement not found', tone: 'bad' };
  if (m.status === 'CERTIFIED') return { s, ok: false, msg: 'Already certified — immutable. Correct via a deviation entry.', tone: 'warn' };
  m.status = 'CERTIFIED';
  m.certifiedIn = m.certifiedIn ?? 'MB-CERT';
  pushAudit(s, userId, 'CHANGE', 'MEASUREMENT', m.mbNo, { field: 'status', oldV: 'DRAFT', newV: 'CERTIFIED', reason: 'Certified into measurement book — locked against edit' });
  return { s, ok: true, msg: `${m.mbNo} certified and locked — further correction only as a linked deviation entry.`, tone: 'ok' };
}

/* Cumulative logic: current = cumulative measured − cumulative previously certified */
export function currentBillableQty(s: ERPState, boqItemId: string): number {
  const b = boqById(s, boqItemId);
  if (!b) return 0;
  return round2(b.executedCum - b.previouslyBilled);
}

/* ---------- RA bill computation (exact prescribed sequence) ---------- */

export interface RaInput {
  contractId: string;
  period: string;
  materialAtSiteValue: number;   // eligible materials for secured advance
  advanceOutstanding: number;    // mobilisation advance balance
  cumulativeProgressPct: number; // for recovery start threshold
  prevRetentionCum: number;      // retention already held
  eotPending: boolean;           // blocks LD
}

export function computeRaBill(sIn: ERPState, args: RaInput, userId: string, post = true): Res {
  const s = cloneState(sIn);
  const c = contractById(s, args.contractId);
  if (!c) return { s, ok: false, msg: 'Unknown contract', tone: 'bad' };
  const auth = authorize(s, userId, 'FIN_DOC', '01', {});
  if (!auth.ok) return { s, ok: false, msg: auth.reason, tone: 'bad' };

  const steps: RaBillStep[] = [];
  const items = boqByContract(s, args.contractId);

  /* STEP 1 — Gross value to date (A: work executed at applicable rates, incl. approved VO/EI + unapproved EI at provisional flagged) */
  let workToDate = 0;
  let unapprovedEI = 0;
  for (const b of items) {
    const amt = round2(b.executedCum * b.tenderRate);
    workToDate += amt;
    if (!b.approved && b.provisional) unapprovedEI += amt;
  }
  workToDate = round2(workToDate);
  steps.push({ label: 'A · Value of work executed (cum × rate)', value: workToDate, detail: unapprovedEI > 0 ? `includes ${fmtINR(unapprovedEI)} unapproved extra items at provisional rate [flagged]` : undefined, flagged: unapprovedEI > 0 });

  /* STEP 2 — Price adjustment / escalation (component-wise from index master) */
  const escalationDetail = ESCALATION_COMPONENTS.map((comp) => {
    const amount = round2((workToDate * comp.weight * (comp.current - comp.base)) / comp.base);
    return { component: comp.name, weight: comp.weight, indexBase: comp.base, indexCur: comp.current, amount };
  });
  const escalation = c.priceAdjustment ? round2(escalationDetail.reduce((t, x) => t + x.amount, 0)) : 0;
  steps.push({ label: 'B · Price adjustment (escalation)', value: escalation, detail: c.priceAdjustment ? `ΣW + non-adjustable ${ESCALATION_NON_ADJUSTABLE} = 1.0000` : 'Not applicable (lump sum / no PA clause)' });

  /* STEP 3 — Secured advance on materials at site */
  const securedAdvance = round2((args.materialAtSiteValue * STATUTORY_RATES.securedAdvanceRatePct) / 100);
  steps.push({ label: 'C · Secured advance — materials at site (75%)', value: securedAdvance, detail: `eligible value ${fmtINR(args.materialAtSiteValue)}` });

  const grossToDate = round2(workToDate + escalation + securedAdvance);
  const grossPrev = round2(items.reduce((t, b) => t + b.previouslyBilled * b.tenderRate, 0));
  const grossThisBill = round2(grossToDate - grossPrev);
  steps.push({ label: 'GROSS TO DATE (A+B+C)', value: grossToDate });
  steps.push({ label: 'Less: gross certified in previous bills', value: -grossPrev });
  steps.push({ label: 'GROSS THIS BILL', value: grossThisBill });

  /* STEP 4 — Recoveries, in prescribed order */
  const recoveries: { head: string; amount: number; note?: string }[] = [];
  /* 1. Mobilisation advance recovery (starts at threshold, + interest, never > outstanding) */
  const maTotal = round2((c.revisedValue * c.mobilisationAdvancePct) / 100);
  let maRecovery = 0;
  if (args.cumulativeProgressPct >= c.recoveryStartPct && args.advanceOutstanding > 0) {
    const interest = round2((args.advanceOutstanding * c.advanceInterestPct) / 100 / 12);
    maRecovery = Math.min(args.advanceOutstanding, round2((grossThisBill * c.recoveryRatePct) / 100) + interest);
    recoveries.push({ head: 'Mobilisation advance recovery (+ interest)', amount: round2(maRecovery), note: `of ${fmtINR(maTotal)} · starts at ${c.recoveryStartPct}% progress · capped at outstanding ${fmtINR(args.advanceOutstanding)}` });
  } else {
    recoveries.push({ head: 'Mobilisation advance recovery', amount: 0, note: args.cumulativeProgressPct < c.recoveryStartPct ? `not started (progress ${args.cumulativeProgressPct}% < ${c.recoveryStartPct}% threshold)` : 'no outstanding' });
  }
  /* 3. Secured advance recovery (proportionate to consumption) */
  const saRecovery = round2(securedAdvance * 0.4);
  if (saRecovery > 0) recoveries.push({ head: 'Secured advance recovery (proportionate)', amount: saRecovery });
  /* 5. Retention — capped so cumulative <= contract value × ceiling % */
  const retentionCeiling = round2((c.revisedValue * c.retentionCeilingPct) / 100);
  const retentionRoom = Math.max(0, round2(retentionCeiling - args.prevRetentionCum));
  const retention = Math.min(round2((grossThisBill * c.retentionPct) / 100), retentionRoom);
  recoveries.push({ head: 'Retention', amount: retention, note: `${c.retentionPct}% · ceiling ${fmtINR(retentionCeiling)} (${c.retentionCeilingPct}% of contract) · room left ${fmtINR(retentionRoom)}` });
  /* 7. Liquidated damages — never while EOT pending */
  let ld = 0;
  if (args.eotPending) {
    recoveries.push({ head: 'Liquidated damages', amount: 0, note: 'NOT levied — EOT claim pending for this period' });
  }
  const totalRecoveries = round2(recoveries.reduce((t, r) => t + r.amount, 0));
  steps.push({ label: 'Recoveries (prescribed order)', value: -totalRecoveries, detail: recoveries.map((r) => `${r.head}: ${fmtINR(r.amount)}`).join(' · ') });

  /* STEP 5 — Statutory deductions */
  const statutory = [
    { head: `Labour cess (BOCW) ${STATUTORY_RATES.labourCessPct}%`, amount: round2((grossThisBill * STATUTORY_RATES.labourCessPct) / 100) },
    { head: `TDS u/s 194C ${STATUTORY_RATES.tdsPct194C}%`, amount: round2((grossThisBill * STATUTORY_RATES.tdsPct194C) / 100) },
  ];
  const totalStatutory = round2(statutory.reduce((t, x) => t + x.amount, 0));
  steps.push({ label: 'Statutory deductions', value: -totalStatutory, detail: statutory.map((x) => `${x.head}: ${fmtINR(x.amount)}`).join(' · ') });

  /* STEP 6 — Tax on taxable value BEFORE retention, then net payable */
  const taxableValue = grossThisBill;
  const gst = round2((taxableValue * 18) / 100);
  steps.push({ label: 'Taxable value (gross this bill)', value: taxableValue, detail: 'GST is payable on the FULL value of supply — BEFORE retention deduction' });
  steps.push({ label: 'GST @ 18% (place of supply = immovable property)', value: gst });
  const netPayable = round2(taxableValue + gst - totalRecoveries - totalStatutory);
  steps.push({ label: 'NET PAYABLE', value: netPayable });

  const companyId = PROJECTS.find((p) => p.code === c.projectCode)?.companyId ?? 'VUL';
  const number = nextNumber(s, 'RA', companyId);
  const bill: RaBill = {
    id: uid(), number, contractId: args.contractId, period: args.period,
    grossToDate, grossPrev, grossThisBill, escalation, escalationDetail, securedAdvance,
    recoveries, statutory, taxableValue, gst, netPayable,
    submitted: grossThisBill, certified: 0, paid: 0, status: 'DRAFT', certShortfalls: [], steps, at: nowStamp(),
  };
  s.raBills.unshift(bill);

  if (post) {
    /* Revenue on gross this bill; recoveries/deductions posted as debit-side clearing so the entry balances. */
    const lines: JournalLine[] = [
      { account: '210100', dr: netPayable, cr: 0, text: `RA bill ${number} — receivable (net payable)` },
      { account: '150200', dr: retention, cr: 0, text: `Retention receivable (${c.retentionPct}%, ceiling-checked)` },
      { account: '121000', dr: totalStatutory, cr: 0, text: 'Statutory deductions (BOCW cess + TDS 194C)' },
      { account: '220400', dr: round2(totalRecoveries - retention), cr: 0, text: 'Advance / secured-advance recovery clearing' },
      { account: '310300', dr: 0, cr: taxableValue, text: `Revenue — gross this bill ${number} (taxable value)` },
      { account: '121100', dr: 0, cr: gst, text: 'Output GST @ 18% (place of supply = site)' },
    ];
    postJournal(s, { companyId, dateISO: s.today, lines, refId: bill.id, refNumber: number, createdBy: userId });
  }

  pushAudit(s, userId, 'POSTING', 'RA_BILL', number, { docId: bill.id, reason: `Gross ${fmtINR(grossThisBill)} · escalation ${fmtINR(escalation)} · recoveries ${fmtINR(totalRecoveries)} · GST ${fmtINR(gst)} · net ${fmtINR(netPayable)}` });
  return { s, ok: true, msg: `${number} computed — gross ${fmtINR(grossThisBill)} · GST ${fmtINR(gst)} on taxable value before retention · net payable ${fmtINR(netPayable)}. Every step drillable.`, tone: 'ok', docId: bill.id };
}

/* ---------- Bill lifecycle transitions ---------- */

export function advanceBill(sIn: ERPState, billId: string, to: RaBill['status'], certified?: number, userId = 'USR-FIN'): Res {
  const s = cloneState(sIn);
  const bill = s.raBills.find((b) => b.id === billId);
  if (!bill) return { s, ok: false, msg: 'Bill not found', tone: 'bad' };
  bill.status = to;
  if (to === 'CERTIFIED' && certified !== undefined) {
    bill.certified = round2(certified);
    const shortfall = round2(bill.submitted - certified);
    if (shortfall > 0) bill.certShortfalls.push({ reason: 'Quantity disallowed / rate disputed', amount: shortfall });
  }
  pushAudit(s, userId, 'CHANGE', 'RA_BILL', bill.number, { field: 'status', oldV: '—', newV: to, reason: `Lifecycle → ${to}${to === 'CERTIFIED' ? ` · certified ${fmtINR(bill.certified)}` : ''}` });
  return { s, ok: true, msg: `${bill.number} → ${to}${to === 'CERTIFIED' ? ` (certified ${fmtINR(bill.certified)}, shortfall ${fmtINR(round2(bill.submitted - bill.certified))} categorised)` : ''}.`, tone: 'ok' };
}

/* ---------- Receivables ageing ---------- */

export interface ArAgeing { bucket: string; amount: number; }

export function receivablesAgeing(s: ERPState): ArAgeing[] {
  const buckets = ['0–30', '31–60', '61–90', '91–180', '180+'];
  const today = new Date(s.today).getTime();
  const out: ArAgeing[] = buckets.map((b) => ({ bucket: b, amount: 0 }));
  for (const bill of s.raBills) {
    if (bill.paid >= bill.netPayable) continue;
    const open = round2(bill.netPayable - bill.paid);
    const age = Math.max(0, Math.round((today - new Date(bill.at).getTime()) / 86400000));
    const idx = age <= 30 ? 0 : age <= 60 ? 1 : age <= 90 ? 2 : age <= 180 ? 3 : 4;
    out[idx].amount = round2(out[idx].amount + open);
  }
  return out;
}

export { ESCALATION_COMPONENTS };
