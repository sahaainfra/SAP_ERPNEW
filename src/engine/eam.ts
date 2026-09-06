/* ==================================================================== */
/*  PART 2 — EAM services. Spares issue posts via movement 210; internal  */
/*  hire posts via postJournal + account determination; maintenance       */
/*  orders are cost objects. No bespoke posting logic.                    */
/* ==================================================================== */

import type { ERPState, Res, Equipment, EquipmentLog, MaintOrder, JournalLine } from './types';
import {
  postMovement, postJournal, authorize, nextNumber, uid, round2, fmtNum, fmtINR,
  materialByCode, siteById, docById, pushAudit, nowStamp, cloneState,
} from './engine';
import { OPERATORS, FUEL_TOLERANCE_FACTOR } from './config';
import { raiseException } from './logistics';

export const operatorById = (id: string) => OPERATORS.find((o) => o.id === id);
export const equipmentByCode = (s: ERPState, code: string) => s.equipment.find((e) => e.code === code);

/* ---- EAM.4 blocking interlock: expired insurance/fitness/permit or operator licence ---- */

export function allocationBlock(s: ERPState, equipmentCode: string, toWbs?: string): { ok: boolean; msg: string } {
  const eq = equipmentByCode(s, equipmentCode);
  if (!eq) return { ok: false, msg: 'Unknown equipment' };
  const expiredDocs = eq.docs.filter((d) => s.today > d.validTo);
  if (expiredDocs.length) {
    return { ok: false, msg: `${eq.code} cannot be allocated: ${expiredDocs.map((d) => `${d.kind} expired ${d.validTo}`).join('; ')}. The interlock blocks deployment until renewed.` };
  }
  if (toWbs) {
    const op = operatorById(eq.operatorId);
    if (op && s.today > op.licenceValidTo) {
      return { ok: false, msg: `Operator ${op.name}'s licence expired ${op.licenceValidTo} — cannot be assigned to ${eq.code}.` };
    }
  }
  return { ok: true, msg: '' };
}

/* ---- EAM.2 daily log with validations + auto PM ---- */

export function postEquipmentLog(sIn: ERPState, args: Omit<EquipmentLog, 'id' | 'docId'>, userId: string): Res {
  const s = cloneState(sIn);
  const eq = equipmentByCode(s, args.equipmentCode);
  if (!eq) return { s, ok: false, msg: 'Unknown equipment', tone: 'bad' };

  /* monotonically increasing hour meter */
  const last = s.eqLogs.filter((l) => l.equipmentCode === eq.code).sort((a, b) => b.date.localeCompare(a.date))[0];
  const prevHm = last ? last.closingHm : eq.hourMeter;
  if (args.closingHm < prevHm) {
    pushAudit(s, userId, 'SECURITY', 'EQ_LOG', eq.code, { reason: `Hour meter ${args.closingHm} < previous ${prevHm} — refused` });
    return { s, ok: false, msg: `Refused: closing hour meter ${fmtNum(args.closingHm, 1)} is lower than the previous reading ${fmtNum(prevHm, 1)}. A meter-replacement document is required to set a new baseline.`, tone: 'bad' };
  }
  if (Math.abs(args.closingHm - args.openingHm) > 24 + 1e-9) {
    return { s, ok: false, msg: 'Hour meter delta cannot exceed 24 hours in a day.', tone: 'bad' };
  }
  const total = args.workHrs + args.idleHrs + args.brkdnHrs + args.standbyHrs;
  if (total > 24 + 1e-9) {
    return { s, ok: false, msg: `Refused: working+idle+breakdown+standby = ${fmtNum(total, 1)} h exceeds 24 h.`, tone: 'bad' };
  }

  /* fuel efficiency exception */
  if (args.workHrs > 0 && args.fuelL > args.workHrs * eq.fuelNormLph * FUEL_TOLERANCE_FACTOR) {
    const op = operatorById(args.operatorId);
    raiseException(s, 'FUEL', `Fuel exception — ${eq.code} (${eq.desc}) on ${args.date}: ${fmtNum(args.fuelL, 1)} L vs norm ${fmtNum(args.workHrs * eq.fuelNormLph, 1)} L. Operator: ${op?.name ?? args.operatorId}.`, 'warn', eq.code);
  }

  const site = siteById(eq.siteId)!;
  const number = nextNumber(s, 'EL', site.companyId);
  const log: EquipmentLog = { ...args, id: uid(), docId: '' };
  const doc = {
    id: uid(), number, type: 'EQ-LOG', module: 'EAM' as const, companyId: site.companyId, siteId: eq.siteId,
    dateISO: args.date, status: 'POSTED' as const, createdBy: userId,
    items: [{ line: 1, category: 'TXT' as const, materialCode: eq.code, desc: `${eq.desc} — ${fmtNum(args.workHrs, 1)} h work · ${fmtNum(args.fuelL, 1)} L fuel`, qty: args.workHrs, uom: 'HR', rate: 0, siteId: eq.siteId, locId: '—', received: 0, invoiced: 0, taxCode: '—', itc: 'ELIGIBLE' as const, wbs: args.wbs }],
    total: 0, movementCode: undefined, note: `Hour meter ${fmtNum(args.openingHm, 1)} → ${fmtNum(args.closingHm, 1)}`,
  };
  log.docId = doc.id;
  s.docs.unshift(doc);
  s.eqLogs.unshift(log);
  eq.hourMeter = args.closingHm;
  if (args.brkdnHrs > 0) eq.status = 'BREAKDOWN';
  else if (args.workHrs > 0) eq.status = 'RUNNING';
  else eq.status = 'IDLE';
  pushAudit(s, userId, 'POSTING', 'EQ_LOG', number, { docId: doc.id, reason: `${eq.code} · ${fmtNum(args.workHrs, 1)} h · ${fmtNum(args.fuelL, 1)} L` });

  /* auto preventive-maintenance order when hours are reached */
  if (eq.hourMeter - eq.lastPmHm >= eq.pmEveryHrs) {
    const pm = createMaintOrder(s, { equipmentCode: eq.code, type: 'PRV' }, userId);
    eq.lastPmHm = eq.hourMeter;
    return { ...pm, msg: `${pm.msg} (auto-generated — ${eq.code} crossed ${eq.pmEveryHrs} h since last PM).`, tone: 'warn' };
  }
  return { s, ok: true, msg: `Log ${number} posted for ${eq.code} — hour meter now ${fmtNum(eq.hourMeter, 1)}.`, tone: 'ok', docId: doc.id };
}

/* ---- maintenance orders (cost objects) ---- */

export function createMaintOrder(sIn: ERPState, args: { equipmentCode: string; type: 'PRV' | 'BRK' }, userId: string): Res {
  const s = cloneState(sIn);
  const eq = equipmentByCode(s, args.equipmentCode);
  if (!eq) return { s, ok: false, msg: 'Unknown equipment', tone: 'bad' };
  const site = siteById(eq.siteId)!;
  const number = nextNumber(s, 'MO', site.companyId);
  const mo: MaintOrder = { id: uid(), number, equipmentCode: eq.code, type: args.type, status: 'OPEN', sparesCost: 0, laborCost: 0, extCost: 0, downtimeHrs: 0, at: nowStamp() };
  s.maintOrders.unshift(mo);
  eq.status = 'MAINTENANCE';
  pushAudit(s, userId, 'POSTING', 'MAINT_ORDER', number, { reason: `${args.type === 'PRV' ? 'Preventive' : 'Breakdown'} maintenance order for ${eq.code}` });
  return { s, ok: true, msg: `Maintenance order ${number} opened for ${eq.code} (${args.type}).`, tone: 'ok', docId: mo.id };
}

/* spares issued to the order via movement 210 — settles into equipment cost */
export function issueSparesToOrder(sIn: ERPState, orderId: string, materialCode: string, qty: number, userId: string): Res {
  const s0 = cloneState(sIn);
  const mo = s0.maintOrders.find((m) => m.id === orderId);
  if (!mo) return { s: s0, ok: false, msg: 'Maintenance order not found', tone: 'bad' };
  const eq = equipmentByCode(s0, mo.equipmentCode)!;
  const res = postMovement(s0, { movementCode: '210', materialCode, qty, siteId: eq.siteId, locId: 'UNR', cc: 'CC-WSH', reason: `Spares for ${mo.number} · ${eq.code}` }, userId);
  if (!res.ok) return res;
  const value = round2(qty * (materialByCode(materialCode)?.price ?? 0));
  mo.sparesCost = round2(mo.sparesCost + value);
  mo.status = 'IN_PROGRESS';
  return { ...res, msg: `${res.msg} · collected on ${mo.number} (spares ${fmtINR(mo.sparesCost)}).` };
}

export function completeMaintOrder(sIn: ERPState, orderId: string, args: { laborCost: number; extCost: number; downtimeHrs: number; rootCause?: string }, userId: string): Res {
  const s = cloneState(sIn);
  const mo = s.maintOrders.find((m) => m.id === orderId);
  if (!mo) return { s, ok: false, msg: 'Maintenance order not found', tone: 'bad' };
  mo.laborCost = args.laborCost; mo.extCost = args.extCost; mo.downtimeHrs = args.downtimeHrs; mo.rootCause = args.rootCause;
  mo.status = 'COMPLETED';
  const eq = equipmentByCode(s, mo.equipmentCode);
  if (eq) eq.status = 'AVAILABLE';
  const total = round2(mo.sparesCost + mo.laborCost + mo.extCost);
  pushAudit(s, userId, 'POSTING', 'MAINT_ORDER', mo.number, { reason: `Completed — total cost ${fmtINR(total)}, downtime ${fmtNum(args.downtimeHrs, 1)} h${args.rootCause ? ', root cause: ' + args.rootCause : ''}` });
  return { s, ok: true, msg: `${mo.number} completed — total ${fmtINR(total)} settled to the equipment cost centre.`, tone: 'ok' };
}

/* ---- EAM.4 internal hire posting ---- */

export function postInternalHire(sIn: ERPState, logId: string, userId: string): Res {
  const s = cloneState(sIn);
  const log = s.eqLogs.find((l) => l.id === logId);
  if (!log) return { s, ok: false, msg: 'Equipment log not found', tone: 'bad' };
  const eq = equipmentByCode(s, log.equipmentCode)!;
  if (log.workHrs <= 0) return { s, ok: false, msg: 'No productive hours on this log — nothing to charge.', tone: 'warn' };
  const auth = authorize(s, userId, 'FIN_DOC', '01', { company: siteById(eq.siteId)!.companyId });
  if (!auth.ok) return { s, ok: false, msg: auth.reason, tone: 'bad' };
  const amount = round2(log.workHrs * eq.internalRate);
  const wbs = log.wbs ?? eq.wbs;
  const lines: JournalLine[] = [
    { account: '410100', dr: amount, cr: 0, text: `Internal hire — ${eq.desc} ${fmtNum(log.workHrs, 1)} h × ${fmtINR(eq.internalRate)}`, wbs },
    { account: '410200', dr: 0, cr: amount, text: `Equipment cost centre recovery — ${eq.code}`, cc: 'CC-WSH' },
  ];
  const refNumber = docById(s, log.docId)?.number ?? log.docId;
  const number = postJournal(s, { companyId: siteById(eq.siteId)!.companyId, dateISO: log.date, lines, refId: log.docId, refNumber, createdBy: userId });
  pushAudit(s, userId, 'POSTING', 'INTERNAL_HIRE', number, { reason: `${eq.code} · ${fmtNum(log.workHrs, 1)} h → ${wbs} (${fmtINR(amount)}) / Cr CC-WSH` });
  return { s, ok: true, msg: `Internal hire ${fmtINR(amount)} posted — Dr project plant cost (${wbs}) / Cr equipment cost centre. Journal ${number}.`, tone: 'ok' };
}

/* ---- EAM.6 fleet analytics ---- */

export function fleetUtilisation(s: ERPState) {
  return s.equipment.map((eq) => {
    const logs = s.eqLogs.filter((l) => l.equipmentCode === eq.code);
    const work = logs.reduce((t, l) => t + l.workHrs, 0);
    const idle = logs.reduce((t, l) => t + l.idleHrs + l.standbyHrs, 0);
    const total = work + idle + logs.reduce((t, l) => t + l.brkdnHrs, 0);
    return { code: eq.code, desc: eq.desc, status: eq.status, util: total ? Math.round((work / total) * 100) : 0, work, costPerHr: work ? Math.round((eq.acqValue / 5000)) : 0 };
  });
}

export function pmDueList(s: ERPState) {
  return s.equipment.filter((e) => e.hourMeter - e.lastPmHm >= e.pmEveryHrs * 0.9)
    .map((e) => ({ ...e, dueIn: Math.max(0, e.pmEveryHrs - (e.hourMeter - e.lastPmHm)) }));
}

export function docExpiryCalendar(s: ERPState) {
  const out: { eq: string; kind: string; no: string; validTo: string; days: number }[] = [];
  for (const eq of s.equipment) for (const d of eq.docs) {
    out.push({ eq: eq.code, kind: d.kind, no: d.no, validTo: d.validTo, days: Math.round((Date.parse(d.validTo) - Date.parse(s.today)) / 86400000) });
  }
  return out.sort((a, b) => a.days - b.days);
}

export { materialByCode, fmtINR };
