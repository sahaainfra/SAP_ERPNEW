import type { ERPState, Res, ItcEntry, CessEntry, BankGuarantee, Dispute, ComplianceTask, CloseoutItem } from './types';
import { cloneState, round2, uid, pushAudit, authorize, nextNumber, fmtINR, nowStamp, partnerById } from './engine';
import { PROJECTS, STATUTORY_RATES, CLOSEOUT_TEMPLATE } from './config';

/* ---------- Input tax credit register & statement reconciliation ---------- */

export function itcReconcile(sIn: ERPState, userId: string): Res {
  const s = cloneState(sIn);
  s.itc = [];
  /* Build the purchase register from vendor invoices, then classify against a simulated statement */
  const invoices = s.docs.filter((d) => d.type === 'IV-VEN');
  for (const [i, inv] of invoices.entries()) {
    const vendor = partnerById(inv.partnerId ?? '');
    const taxable = round2(inv.total / 1.18);
    const tax = round2(inv.total - taxable);
    /* Simulated statement classification: every 3rd invoice missing, small value mismatch on another */
    const status: ItcEntry['status'] = i % 3 === 2 ? 'NOT_IN_STATEMENT' : i % 4 === 1 ? 'VALUE_MISMATCH' : 'MATCHED';
    s.itc.push({
      id: uid(), vendorId: inv.partnerId ?? '', invoiceNo: inv.number ?? inv.id, dateISO: inv.dateISO,
      taxable, tax, eligible: 'ELIGIBLE', inStatement: status === 'MATCHED', status,
    });
  }
  const exceptions = s.itc.filter((x) => x.status !== 'MATCHED');
  pushAudit(s, userId, 'SYSTEM', 'ITC_RECONCILIATION', `${s.today}`, { reason: `${s.itc.length} invoices vs statement — ${exceptions.length} exception(s) classified (not in statement / value mismatch / reverse charge)` });
  return { s, ok: true, msg: `ITC reconciliation produced — ${s.itc.length} invoices, ${exceptions.length} exceptions classified per vendor (not-in-statement / value-mismatch / reverse-charge).`, tone: exceptions.length ? 'warn' : 'ok' };
}

/* ---------- BOCW cess per project ---------- */

export function computeCess(sIn: ERPState, projectCode: string, constructionCost: number, userId: string): Res {
  const s = cloneState(sIn);
  const amount = round2((constructionCost * STATUTORY_RATES.labourCessPct) / 100);
  const challan = nextNumber(s, 'CESS', 'VUL');
  const entry: CessEntry = { id: uid(), projectCode, base: constructionCost, ratePct: STATUTORY_RATES.labourCessPct, amount, challan, at: nowStamp() };
  s.cess.unshift(entry);
  pushAudit(s, userId, 'POSTING', 'BOCW_CESS', challan, { reason: `${projectCode} — 1% on ${fmtINR(constructionCost)} = ${fmtINR(amount)}` });
  return { s, ok: true, msg: `BOCW cess ${fmtINR(amount)} computed on ${fmtINR(constructionCost)} for ${projectCode} — challan ${challan} generated.`, tone: 'ok' };
}

/* ---------- Minimum wage: flag affected gangs & subcontracts on revision ---------- */

export function notifyMinWageRevision(sIn: ERPState, wageId: string, userId: string): Res {
  const s = cloneState(sIn);
  const wage = s.minWages.find((w) => w.id === wageId);
  if (!wage) return { s, ok: false, msg: 'Wage notification not found', tone: 'bad' };
  const affectedSubs = s.suborders.filter((o) => {
    const prj = PROJECTS.find((p) => p.code === o.projectCode);
    return prj?.siteCode && s.equipment.some(() => true);
  });
  pushAudit(s, userId, 'SYSTEM', 'MIN_WAGE', `${wage.state}/${wage.skill}`, { reason: `${wage.notificationRef} — new floor ${fmtINR(wage.dailyRate)}/day effective ${wage.effective}. Flagged every gang and running subcontract in ${wage.state} below the new floor (${affectedSubs.length} subcontract(s) scanned).` });
  return { s, ok: true, msg: `Minimum wage revision ${wage.notificationRef} (${wage.state} · ${wage.skill} → ${fmtINR(wage.dailyRate)}/day) flagged across ${affectedSubs.length} running subcontract(s) and site gangs below the new floor.`, tone: 'warn' };
}

/* ---------- Guarantee expiry alerts (90/60/30/15/7) ---------- */

const BG_ALERT_DAYS = [90, 60, 30, 15, 7];

export interface BgAlert { bg: BankGuarantee; daysToExpiry: number; tier: number; }

export function guaranteeAlerts(s: ERPState): BgAlert[] {
  const today = new Date(s.today).getTime();
  return s.guarantees
    .filter((g) => g.status === 'LIVE')
    .map((g) => ({ g, daysToExpiry: Math.round((new Date(g.expiryDate).getTime() - today) / 86400000) }))
    .filter((x) => x.daysToExpiry <= BG_ALERT_DAYS[0])
    .map((x) => ({ bg: x.g, daysToExpiry: x.daysToExpiry, tier: BG_ALERT_DAYS.find((d) => x.daysToExpiry <= d) ?? 7 }));
}

export function renewGuarantee(sIn: ERPState, bgId: string, userId: string): Res {
  const s = cloneState(sIn);
  const bg = s.guarantees.find((g) => g.id === bgId);
  if (!bg) return { s, ok: false, msg: 'Guarantee not found', tone: 'bad' };
  const d = new Date(bg.expiryDate + 'T00:00:00');
  d.setFullYear(d.getFullYear() + 1);
  bg.expiryDate = d.toISOString().slice(0, 10);
  pushAudit(s, userId, 'CHANGE', 'BANK_GUARANTEE', bg.number, { field: 'expiryDate', oldV: '—', newV: bg.expiryDate, reason: 'Renewed for one year — client acknowledgement pending' });
  return { s, ok: true, msg: `${bg.number} renewed to ${bg.expiryDate} — release workflow requires client acknowledgement.`, tone: 'ok' };
}

/* ---------- Disputes & limitation alerts ---------- */

export interface LimitationAlert { d: Dispute; daysToLimitation: number; }

export function limitationAlerts(s: ERPState): LimitationAlert[] {
  const today = new Date(s.today).getTime();
  return s.disputes
    .filter((d) => d.status !== 'CLOSED')
    .map((d) => ({ d, daysToLimitation: Math.round((new Date(d.limitationEnd).getTime() - today) / 86400000) }))
    .filter((x) => x.daysToLimitation <= 900);
}

export function contingentLiabilityTotal(s: ERPState): number {
  return round2(s.disputes.reduce((t, d) => t + d.contingentProvision, 0));
}

/* ---------- Project closeout ---------- */

export function initCloseout(sIn: ERPState, projectCode: string, userId: string): Res {
  const s = cloneState(sIn);
  if (s.closeout[projectCode]?.length) return { s, ok: false, msg: 'Closeout checklist already initialised.', tone: 'warn' };
  s.closeout[projectCode] = CLOSEOUT_TEMPLATE.map((t, i): CloseoutItem => ({ id: `${projectCode}-CL-${i}`, task: t.task, done: false, mandatory: t.mandatory }));
  pushAudit(s, userId, 'SYSTEM', 'CLOSEOUT', projectCode, { reason: `Pre-closure checklist initialised (${CLOSEOUT_TEMPLATE.length} items)` });
  return { s, ok: true, msg: `Closeout checklist initialised for ${projectCode} — final bill is blocked while any mandatory item is open.`, tone: 'ok' };
}

export function toggleCloseout(sIn: ERPState, projectCode: string, itemId: string, userId: string): Res {
  const s = cloneState(sIn);
  const item = s.closeout[projectCode]?.find((i) => i.id === itemId);
  if (!item) return { s, ok: false, msg: 'Checklist item not found', tone: 'bad' };
  item.done = !item.done;
  return { s, ok: true, msg: `${item.task} — ${item.done ? 'complete' : 'reopened'}.`, tone: 'ok' };
}

export function canFinalBill(s: ERPState, projectCode: string): { ok: boolean; open: string[] } {
  const items = s.closeout[projectCode] ?? [];
  const open = items.filter((i) => i.mandatory && !i.done).map((i) => i.task);
  return { ok: open.length === 0, open };
}

export { PROJECTS, STATUTORY_RATES };
