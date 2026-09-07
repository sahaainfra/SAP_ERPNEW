/* ==================================================================== */
/*  PART 8 — EHS services. Permit to work, incident reporting, safety    */
/*  statistics computed from attendance. Interlocks with HCM             */
/*  certifications.                                                      */
/* ==================================================================== */

import type { ERPState, Res, PermitToWork, Incident, PermitType, IncidentSeverity } from './types';
import {
  authorize, uid, round2, fmtNum, pushAudit, nowStamp, cloneState, nextNumber,
} from './engine';
import { checkCertification } from './hcm';

/* ---- EHS.20 Permit to work ---- */

export function issuePermit(sIn: ERPState, args: { type: PermitType; issuerId: string; receiverId: string; validFrom: string; validTo: string; preconditions: { check: string; met: boolean }[]; gasTest?: { result: string; safe: boolean }; riskAssessment: string }, userId: string): Res {
  const s = cloneState(sIn);
  const auth = authorize(s, userId, 'EHS_PERMIT', '01', {});
  if (!auth.ok) return { s, ok: false, msg: auth.reason, tone: 'bad' };

  /* Interlock: receiver must have valid safety certification for the permit type */
  const certType = `SAFETY_${args.type}`;
  const certCheck = checkCertification(s, args.receiverId, certType);
  if (!certCheck.ok) {
    pushAudit(s, userId, 'SECURITY', 'PERMIT', args.type, { reason: `Permit blocked — receiver certification: ${certCheck.msg}` });
    return { s, ok: false, msg: `Permit blocked: ${certCheck.msg}. A permit cannot be issued to a person with expired certification.`, tone: 'bad' };
  }

  /* Check all preconditions met */
  const unmet = args.preconditions.filter((p) => !p.met);
  if (unmet.length > 0) {
    return { s, ok: false, msg: `Permit blocked: ${unmet.length} precondition(s) not met — ${unmet.map((p) => p.check).join(', ')}.`, tone: 'bad' };
  }

  /* Gas test required for confined space */
  if (args.type === 'CONFINED_SPACE' && (!args.gasTest || !args.gasTest.safe)) {
    return { s, ok: false, msg: 'Permit blocked: gas test required for confined space and must be safe.', tone: 'bad' };
  }

  const number = nextNumber(s, 'PTW', 'VUL');
  const permit: PermitToWork = {
    id: uid(), number, type: args.type, issuerId: args.issuerId, receiverId: args.receiverId,
    receiverCertValid: true, validFrom: args.validFrom, validTo: args.validTo,
    preconditions: args.preconditions, gasTest: args.gasTest, riskAssessment: args.riskAssessment,
    status: 'ISSUED',
  };
  s.permits.unshift(permit);
  pushAudit(s, userId, 'POSTING', 'PERMIT', number, { reason: `${args.type} · receiver ${args.receiverId} · valid ${args.validFrom} to ${args.validTo}` });
  return { s, ok: true, msg: `Permit ${number} issued — ${args.type} to receiver ${args.receiverId}. All preconditions met, certification valid.`, tone: 'ok', docId: permit.id };
}

export function closePermit(sIn: ERPState, permitId: string, userId: string): Res {
  const s = cloneState(sIn);
  const permit = s.permits.find((p) => p.id === permitId);
  if (!permit) return { s, ok: false, msg: 'Permit not found', tone: 'bad' };
  if (permit.status !== 'ACTIVE' && permit.status !== 'ISSUED') {
    return { s, ok: false, msg: `Permit cannot be closed (status: ${permit.status}).`, tone: 'warn' };
  }

  permit.status = 'CLOSED';
  permit.closedAt = nowStamp();
  pushAudit(s, userId, 'CHANGE', 'PERMIT', permit.number, { field: 'status', oldV: permit.status, newV: 'CLOSED' });
  return { s, ok: true, msg: `Permit ${permit.number} closed.`, tone: 'ok' };
}

/* ---- EHS.20 Incident reporting ---- */

export function reportIncident(sIn: ERPState, args: { severity: IncidentSeverity; dateISO: string; location: string; description: string; personsInvolved: string[]; daysLost: number }, userId: string): Res {
  const s = cloneState(sIn);
  const number = nextNumber(s, 'INC', 'VUL');
  const incident: Incident = {
    id: uid(), number, severity: args.severity, dateISO: args.dateISO,
    location: args.location, description: args.description,
    personsInvolved: args.personsInvolved, daysLost: args.daysLost,
    status: 'REPORTED', escalated: false,
  };
  s.incidents.unshift(incident);

  /* Fatality escalates to management immediately */
  if (args.severity === 'FATATLITY') {
    incident.escalated = true;
    pushAudit(s, userId, 'SECURITY', 'INCIDENT', number, { reason: `FATALITY — escalated to management immediately` });
  }

  pushAudit(s, userId, 'POSTING', 'INCIDENT', number, { reason: `${args.severity} · ${args.location} · ${args.daysLost} days lost` });
  return { s, ok: true, msg: `Incident ${number} reported — ${args.severity} at ${args.location}. ${args.severity === 'FATATLITY' ? 'ESCALATED TO MANAGEMENT.' : ''}`, tone: args.severity === 'FATATLITY' ? 'bad' : 'warn', docId: incident.id };
}

export function investigateIncident(sIn: ERPState, incidentId: string, rootCause: string, correctiveAction: string, userId: string): Res {
  const s = cloneState(sIn);
  const incident = s.incidents.find((i) => i.id === incidentId);
  if (!incident) return { s, ok: false, msg: 'Incident not found', tone: 'bad' };

  incident.rootCause = rootCause;
  incident.correctiveAction = correctiveAction;
  incident.status = 'CLOSED';
  pushAudit(s, userId, 'CHANGE', 'INCIDENT', incident.number, { field: 'status', oldV: incident.status, newV: 'CLOSED', reason: `Root cause: ${rootCause}` });
  return { s, ok: true, msg: `Incident ${incident.number} investigated and closed — root cause: ${rootCause}.`, tone: 'ok' };
}

/* ---- EHS.21 Safety statistics (computed, never typed) ---- */

export interface SafetyStats {
  manHours: number;
  ltiCount: number;
  ltiFrequency: number; // per million hours
  severityRate: number; // days lost per million hours
  safeManHoursSinceLastLti: number;
  nearMissCount: number;
}

export function computeSafetyStats(s: ERPState, period: string): SafetyStats {
  /* Man-hours from attendance */
  const punches = s.attendancePunches.filter((p) => p.serverTime.startsWith(period) && p.punchType === 'IN');
  const manHours = punches.length * 8; // Simplified: 8 hours per punch

  /* Incidents in period */
  const incidents = s.incidents.filter((i) => i.dateISO.startsWith(period));
  const ltiCount = incidents.filter((i) => i.severity === 'LOST_TIME' || i.severity === 'FATATLITY').length;
  const daysLost = incidents.reduce((t, i) => t + i.daysLost, 0);
  const nearMissCount = incidents.filter((i) => i.severity === 'NEAR_MISS').length;

  /* Compute rates */
  const ltiFrequency = manHours > 0 ? round2((ltiCount * 1000000) / manHours) : 0;
  const severityRate = manHours > 0 ? round2((daysLost * 1000000) / manHours) : 0;

  /* Safe man-hours since last LTI */
  const lastLti = incidents.filter((i) => i.severity === 'LOST_TIME' || i.severity === 'FATATLITY').sort((a, b) => b.dateISO.localeCompare(a.dateISO))[0];
  const safeManHoursSinceLastLti = lastLti ? manHours : manHours; // Simplified

  return { manHours, ltiCount, ltiFrequency, severityRate, safeManHoursSinceLastLti, nearMissCount };
}

/* ---- EHS queries ---- */

export function permitAlerts(s: ERPState): { permit: PermitToWork; daysToExpiry: number }[] {
  const today = new Date(s.today).getTime();
  return s.permits
    .filter((p) => p.status === 'ACTIVE' || p.status === 'ISSUED')
    .map((p) => ({ permit: p, daysToExpiry: Math.round((new Date(p.validTo).getTime() - today) / 86400000) }))
    .filter((x) => x.daysToExpiry <= 7 && x.daysToExpiry >= 0)
    .sort((a, b) => a.daysToExpiry - b.daysToExpiry);
}

export function incidentAgeing(s: ERPState): { incident: Incident; age: number }[] {
  return s.incidents
    .filter((i) => i.status !== 'CLOSED')
    .map((i) => ({ incident: i, age: Math.max(0, Math.round((Date.now() - Date.parse(i.dateISO)) / 86400000)) }))
    .sort((a, b) => b.age - a.age);
}
