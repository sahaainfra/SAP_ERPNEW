/* ==================================================================== */
/*  PART 2 — QMS services. Stock release from quality hold goes ONLY     */
/*  through a usage decision, which posts movement 102/103 via the        */
/*  Part 1 movement framework. No direct stock writes.                    */
/* ==================================================================== */

import type { ERPState, Res, InspectionLot, TestResult, Ncr } from './types';
import {
  postMovement, authorize, nextNumber, uid, round2, fmtNum, materialByCode, siteById,
  docById, pushAudit, nowStamp, cloneState,
} from './engine';
import { QUALITY_CONFIG, TEST_EQUIPMENT, WELDERS, NCR_SLA_DAYS } from './config';
import { raiseException } from './logistics';

export function createInspectionLot(sIn: ERPState, args: { type: InspectionLot['type']; materialCode: string; qty: number; siteId: string; grDocId?: string; vendorId?: string }, userId: string): Res {
  const s = cloneState(sIn);
  const site = siteById(args.siteId);
  if (!site) return { s, ok: false, msg: 'Unknown site', tone: 'bad' };
  const number = nextNumber(s, 'IL', site.companyId);
  const lot: InspectionLot = {
    id: uid(), number, type: args.type, materialCode: args.materialCode, qty: args.qty,
    siteId: args.siteId, grDocId: args.grDocId, vendorId: args.vendorId, status: 'OPEN', atCreated: nowStamp(),
  };
  s.inspLots.unshift(lot);
  pushAudit(s, userId, 'POSTING', 'INSPECTION_LOT', number, { reason: `Auto-created on ${args.type} · ${fmtNum(args.qty, 1)} ${materialByCode(args.materialCode)?.baseUom} in quality hold` });
  return { s, ok: true, msg: `Inspection lot ${number} created — stock held in quality.`, tone: 'ok', docId: lot.id };
}

/* The ONLY route out of quality hold. Accept → 102 (QH→UNR), Reject → 103 (QH→BLK). */
export function usageDecision(sIn: ERPState, lotId: string, decision: 'ACCEPT' | 'ACCEPT_DEV' | 'REJECT' | 'REWORK', userId: string, comment: string): Res {
  const s0 = cloneState(sIn);
  const lot = s0.inspLots.find((l) => l.id === lotId);
  if (!lot) return { s: s0, ok: false, msg: 'Inspection lot not found', tone: 'bad' };
  if (lot.status !== 'OPEN') return { s: s0, ok: false, msg: `Lot already decided (${lot.status}).`, tone: 'warn' };
  const auth = authorize(s0, userId, 'INV_MVT', '01');
  if (!auth.ok) return { s: s0, ok: false, msg: auth.reason, tone: 'bad' };

  if (decision === 'ACCEPT' || decision === 'ACCEPT_DEV') {
    const res = postMovement(s0, { movementCode: '102', materialCode: lot.materialCode, qty: lot.qty, siteId: lot.siteId, locId: 'QH', locToId: 'UNR', reason: `Usage decision ${lot.number}${decision === 'ACCEPT_DEV' ? ' — accepted with deviation: ' + comment : ''}` }, userId);
    if (!res.ok) return res;
    lot.status = 'ACCEPTED'; lot.decisionBy = userId; lot.at = nowStamp();
    return { ...res, msg: `Lot ${lot.number} accepted — movement 102 released stock to unrestricted.` };
  }
  if (decision === 'REJECT') {
    const res = postMovement(s0, { movementCode: '103', materialCode: lot.materialCode, qty: lot.qty, siteId: lot.siteId, locId: 'QH', locToId: 'BLK', reason: `Usage decision ${lot.number} — rejected: ${comment}` }, userId);
    if (!res.ok) return res;
    lot.status = 'REJECTED'; lot.decisionBy = userId; lot.at = nowStamp();
    raiseException(s0, 'NCR_SLA', `Lot ${lot.number} rejected — return-to-vendor (110) or debit note to be raised.`, 'warn', lot.number);
    return { ...res, msg: `Lot ${lot.number} rejected — stock moved to blocked (103). Return/debit-note process opened.` };
  }
  /* REWORK keeps stock in hold */
  lot.status = 'REWORK'; lot.decisionBy = userId; lot.at = nowStamp();
  return { s: s0, ok: true, msg: `Lot ${lot.number} marked for rework — stock remains in quality hold.`, tone: 'warn' };
}

/* ---- testing with interlocks ---- */

export function recordTest(sIn: ERPState, args: Omit<TestResult, 'id' | 'at'>, userId: string): Res {
  const s = cloneState(sIn);
  /* calibration interlock */
  if (args.equipId) {
    const eq = TEST_EQUIPMENT.find((e) => e.id === args.equipId);
    if (eq && s.today > eq.validTo) {
      pushAudit(s, userId, 'SECURITY', 'CALIBRATION', eq.name, { reason: `Test entry blocked — ${eq.name} calibration expired ${eq.validTo}` });
      return { s, ok: false, msg: `Blocked: ${eq.name} calibration expired on ${eq.validTo}. An out-of-calibration instrument cannot record results.`, tone: 'bad' };
    }
  }
  /* welder qualification interlock for NDT-critical joints */
  if (args.welderId) {
    const w = WELDERS.find((x) => x.id === args.welderId);
    if (w && s.today > w.qualValidTo) {
      pushAudit(s, userId, 'SECURITY', 'WELDER_QUAL', w.name, { reason: `Welder qualification lapsed ${w.qualValidTo}` });
      return { s, ok: false, msg: `Blocked: welder ${w.name}'s qualification lapsed on ${w.qualValidTo}. Cannot be assigned to an NDT-critical joint.`, tone: 'bad' };
    }
  }
  const t: TestResult = { ...args, id: uid(), at: nowStamp() };
  s.tests.unshift(t);
  pushAudit(s, userId, 'POSTING', 'TEST_RESULT', t.kind, { reason: `${t.material} ${t.grade} · ${t.value} vs ${t.spec} · ${t.pass ? 'PASS' : 'FAIL'}` });

  /* failed 28-day cube → automatic NCR linked to pour/batch/challan/measurement */
  if (t.kind === 'CUBE' && t.ageDays === 28 && !t.pass) {
    const ncr = autoNcr(s, {
      title: `28-day cube failure — ${t.grade} at ${t.pourLoc ?? 'pour location'}`,
      severity: 'MAJOR', cost: 45000,
      link: { lotId: t.lotId, batch: t.batch, pourLoc: t.pourLoc, challan: t.challan },
    }, userId);
    return { ...ncr, msg: `Test FAIL recorded. ${ncr.msg}`, tone: 'bad' };
  }
  return { s, ok: true, msg: `Test recorded — ${t.pass ? 'PASS' : 'FAIL'} (${t.value} vs ${t.spec}).`, tone: t.pass ? 'ok' : 'warn' };
}

function autoNcr(s: ERPState, args: { title: string; severity: Ncr['severity']; cost: number; link?: Ncr['link']; vendorId?: string }, userId: string): Res {
  const number = nextNumber(s, 'NC', 'VUL');
  const sla = NCR_SLA_DAYS[args.severity] ?? 7;
  const ncr: Ncr = {
    id: uid(), number, title: args.title, severity: args.severity, status: 'RAISED',
    raisedAt: nowStamp(), dueAt: new Date(Date.now() + sla * 86400000).toISOString().slice(0, 10),
    cost: args.cost, vendorId: args.vendorId, link: args.link,
  };
  s.ncrs.unshift(ncr);
  raiseException(s, 'NCR_SLA', `NCR ${number}: ${args.title} — due ${ncr.dueAt}.`, args.severity === 'CRITICAL' ? 'bad' : 'warn', number);
  pushAudit(s, userId, 'POSTING', 'NCR', number, { reason: `Auto-raised · linked to ${args.link?.batch ? 'batch ' + args.link.batch : ''} ${args.link?.challan ? '· challan ' + args.link.challan : ''} ${args.link?.pourLoc ? '· pour ' + args.link.pourLoc : ''}` });
  return { s, ok: true, msg: `NCR ${number} auto-raised and linked to the pour, batch, challan and measurement.`, tone: 'warn', docId: ncr.id };
}

export function raiseNcr(sIn: ERPState, args: { title: string; severity: Ncr['severity']; cost: number; vendorId?: string }, userId: string): Res {
  return autoNcr(cloneState(sIn), args, userId);
}

const FLOW: Ncr['status'][] = ['RAISED', 'ASSIGNED', 'ROOT_CAUSE', 'CORRECTIVE', 'PREVENTIVE', 'VERIFICATION', 'CLOSED'];

export function advanceNcr(sIn: ERPState, ncrId: string, userId: string): Res {
  const s = cloneState(sIn);
  const n = s.ncrs.find((x) => x.id === ncrId);
  if (!n) return { s, ok: false, msg: 'NCR not found', tone: 'bad' };
  const i = FLOW.indexOf(n.status);
  if (i >= FLOW.length - 1) return { s, ok: false, msg: 'NCR already closed.', tone: 'warn' };
  n.status = FLOW[i + 1];
  pushAudit(s, userId, 'CHANGE', 'NCR', n.number, { field: 'status', oldV: FLOW[i], newV: n.status });
  const overdue = s.today > n.dueAt && n.status !== 'CLOSED';
  if (overdue) raiseException(s, 'NCR_SLA', `NCR ${n.number} breached SLA (due ${n.dueAt}) — escalated.`, 'bad', n.number);
  return { s, ok: true, msg: `NCR ${n.number} → ${n.status}${overdue ? ' (SLA breached — escalated)' : ''}.`, tone: overdue ? 'warn' : 'ok' };
}

/* ---- QMS analytics ---- */

export function firstPassYield(s: ERPState): number {
  const lots = s.inspLots.filter((l) => l.status !== 'OPEN' && l.status !== 'REWORK');
  if (!lots.length) return 100;
  return Math.round((lots.filter((l) => l.status === 'ACCEPTED').length / lots.length) * 100);
}

export function cubePassRate(s: ERPState): number {
  const cubes = s.tests.filter((t) => t.kind === 'CUBE' && t.ageDays === 28);
  if (!cubes.length) return 100;
  return Math.round((cubes.filter((t) => t.pass).length / cubes.length) * 100);
}

export function ncrAgeing(s: ERPState) {
  return s.ncrs.filter((n) => n.status !== 'CLOSED').map((n) => ({
    ...n, age: Math.max(0, Math.round((Date.now() - Date.parse(n.raisedAt)) / 86400000)),
    overdue: s.today > n.dueAt,
  })).sort((a, b) => b.age - a.age);
}

/* keep docById referenced for potential drill-down */
export { docById, round2 };
