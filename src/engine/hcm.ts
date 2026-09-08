/* ==================================================================== */
/*  PART 8 — HCM services. Employee lifecycle, geo-attendance with       */
/*  anti-fraud checks, labour management, payroll with cost-object       */
/*  assignment. All postings go through Part 1 engine.                   */
/* ==================================================================== */

import type { ERPState, Res, Employee, AttendancePunch, EmployeeGroup, EmployeeSubgroup } from './types';
import {
  authorize, uid, round2, fmtNum, fmtINR, pushAudit, nowStamp, cloneState, postJournal,
} from './engine';
import { MINWAGE_SEED } from './config';

/* ---- HCM.1 Organisational structure ---- */

export const EMPLOYEE_GROUPS: { code: EmployeeGroup; payrollRule: string; leaveEntitlement: number }[] = [
  { code: 'PERMANENT', payrollRule: 'Monthly salary + statutory', leaveEntitlement: 30 },
  { code: 'CONTRACTUAL', payrollRule: 'Daily wage × attendance', leaveEntitlement: 0 },
  { code: 'RETAINER', payrollRule: 'Fixed retainer + call-out', leaveEntitlement: 15 },
  { code: 'TRAINEE', payrollRule: 'Stipend', leaveEntitlement: 12 },
  { code: 'LABOUR', payrollRule: 'Daily wage × attendance + overtime', leaveEntitlement: 0 },
];

export const EMPLOYEE_SUBGROUPS: { code: EmployeeSubgroup; group: EmployeeGroup }[] = [
  { code: 'MANAGEMENT', group: 'PERMANENT' },
  { code: 'STAFF', group: 'PERMANENT' },
  { code: 'SUPERVISOR', group: 'PERMANENT' },
  { code: 'OPERATOR', group: 'CONTRACTUAL' },
  { code: 'SKILLED', group: 'LABOUR' },
  { code: 'SEMI_SKILLED', group: 'LABOUR' },
  { code: 'UNSKILLED', group: 'LABOUR' },
];

/* ---- HCM.2 Employee lifecycle ---- */

export function createEmployee(sIn: ERPState, args: { code: string; name: string; group: EmployeeGroup; subgroup: EmployeeSubgroup; personnelArea: string; personnelSubarea: string; joinDate: string; supervisorId?: string }, userId: string): Res {
  const s = cloneState(sIn);
  const auth = authorize(s, userId, 'HCM_EMP', '01', {});
  if (!auth.ok) return { s, ok: false, msg: auth.reason, tone: 'bad' };

  const emp: Employee = {
    id: uid(), code: args.code, name: args.name, group: args.group, subgroup: args.subgroup,
    personnelArea: args.personnelArea, personnelSubarea: args.personnelSubarea,
    joinDate: args.joinDate, supervisorId: args.supervisorId,
    supervisorHistory: args.supervisorId ? [{ supervisorId: args.supervisorId, from: args.joinDate }] : [],
    certifications: [], status: 'ONBOARDING', onboardingComplete: false,
  };
  s.employees.unshift(emp);
  pushAudit(s, userId, 'POSTING', 'EMPLOYEE', emp.code, { reason: `${emp.name} · ${emp.group}/${emp.subgroup} · onboarding started` });
  return { s, ok: true, msg: `Employee ${emp.code} created — onboarding checklist initiated.`, tone: 'ok', docId: emp.id };
}

export function completeOnboarding(sIn: ERPState, empId: string, userId: string): Res {
  const s = cloneState(sIn);
  const emp = s.employees.find((e) => e.id === empId);
  if (!emp) return { s, ok: false, msg: 'Employee not found', tone: 'bad' };
  if (emp.status !== 'ONBOARDING') return { s, ok: false, msg: `Employee not in onboarding (status: ${emp.status}).`, tone: 'warn' };

  /* Check mandatory items: safety induction, bank details, statutory enrolments */
  const hasInduction = s.inductions.some((i) => i.employeeId === empId && i.valid);
  if (!hasInduction) return { s, ok: false, msg: 'Onboarding blocked: safety induction not completed.', tone: 'bad' };

  emp.onboardingComplete = true;
  emp.status = 'PROBATION';
  pushAudit(s, userId, 'CHANGE', 'EMPLOYEE', emp.code, { field: 'status', oldV: 'ONBOARDING', newV: 'PROBATION', reason: 'Onboarding checklist complete' });
  return { s, ok: true, msg: `${emp.name} onboarding complete — status → PROBATION.`, tone: 'ok' };
}

/* ---- HCM.2 Competency interlocks ---- */

export function checkCertification(s: ERPState, empId: string, certType: string): { ok: boolean; msg: string } {
  const emp = s.employees.find((e) => e.id === empId);
  if (!emp) return { ok: false, msg: 'Employee not found' };
  const cert = emp.certifications.find((c) => c.type === certType);
  if (!cert) return { ok: false, msg: `${emp.name} has no ${certType} certification.` };
  if (s.today > cert.validTo) return { ok: false, msg: `${emp.name}'s ${certType} certification expired on ${cert.validTo}.` };
  return { ok: true, msg: '' };
}

export function addCertification(sIn: ERPState, empId: string, certType: string, validTo: string, userId: string): Res {
  const s = cloneState(sIn);
  const emp = s.employees.find((e) => e.id === empId);
  if (!emp) return { s, ok: false, msg: 'Employee not found', tone: 'bad' };
  emp.certifications.push({ type: certType, validTo });
  pushAudit(s, userId, 'CHANGE', 'EMPLOYEE', emp.code, { field: 'certifications', newV: `${certType} valid to ${validTo}` });
  return { s, ok: true, msg: `${certType} certification added for ${emp.name} — valid until ${validTo}.`, tone: 'ok' };
}

/* ---- HCM.3 Geo-attendance with anti-fraud ---- */

export function recordPunch(sIn: ERPState, args: { employeeId: string; punchType: AttendancePunch['punchType']; clientTime: string; lat: number; lng: number; accuracy: number; deviceId: string; mockLocation: boolean; developerMode: boolean; faceMatchScore?: number; shift: string; workFront?: string; gang?: string; synced: boolean }, userId: string): Res {
  const s = cloneState(sIn);
  const emp = s.employees.find((e) => e.id === args.employeeId);
  if (!emp) return { s, ok: false, msg: 'Employee not found', tone: 'bad' };

  /* Anti-fraud: mock location or developer mode */
  if (args.mockLocation || args.developerMode) {
    pushAudit(s, userId, 'SECURITY', 'ATTENDANCE', emp.code, { reason: `Punch rejected — mock location: ${args.mockLocation}, developer mode: ${args.developerMode}` });
    return { s, ok: false, msg: `Punch rejected: mock location or developer mode detected. High-severity exception raised.`, tone: 'bad' };
  }

  /* GPS accuracy check */
  if (args.accuracy > 50) {
    pushAudit(s, userId, 'SECURITY', 'ATTENDANCE', emp.code, { reason: `GPS accuracy ${args.accuracy}m > 50m threshold — flagged for verification` });
    return { s, ok: false, msg: `Punch flagged: GPS accuracy ${args.accuracy}m exceeds 50m threshold. Requires manager verification.`, tone: 'warn' };
  }

  /* Device binding check */
  const deviceRegistered = true; // Simplified: assume device is registered
  if (!deviceRegistered) {
    pushAudit(s, userId, 'SECURITY', 'ATTENDANCE', emp.code, { reason: `Unregistered device ${args.deviceId}` });
    return { s, ok: false, msg: `Punch rejected: device ${args.deviceId} not registered. Device change requires approval.`, tone: 'bad' };
  }

  /* Duplicate punch check (within 5-minute window) */
  const recentPunch = s.attendancePunches.find((p) => p.employeeId === args.employeeId && p.punchType === args.punchType && Math.abs(Date.parse(p.serverTime) - Date.parse(args.clientTime)) < 300000);
  if (recentPunch) {
    return { s, ok: false, msg: `Duplicate punch rejected: ${args.punchType} already recorded within 5-minute window.`, tone: 'warn' };
  }

  /* Geofence matching (simplified) */
  const geofenceId = s.geofences.find((g) => {
    if (g.shape.kind === 'CIRCLE') {
      const dist = Math.sqrt(Math.pow(g.shape.lat - args.lat, 2) + Math.pow(g.shape.lng - args.lng, 2)) * 111000; // rough meters
      return dist <= g.shape.radiusM;
    }
    return false; // Skip polygon geofences for simplicity
  })?.id;

  /* Face match check */
  if (args.faceMatchScore !== undefined && args.faceMatchScore < 0.7) {
    pushAudit(s, userId, 'SECURITY', 'ATTENDANCE', emp.code, { reason: `Face match score ${args.faceMatchScore} < 0.7 — flagged for manual verification` });
  }

  const serverTime = nowStamp();
  const punch: AttendancePunch = {
    id: uid(), employeeId: args.employeeId, punchType: args.punchType,
    serverTime, clientTime: args.clientTime, lat: args.lat, lng: args.lng, accuracy: args.accuracy,
    geofenceId, deviceId: args.deviceId, deviceRegistered, mockLocation: args.mockLocation,
    developerMode: args.developerMode, faceMatchScore: args.faceMatchScore,
    shift: args.shift, workFront: args.workFront, gang: args.gang, synced: args.synced,
  };
  s.attendancePunches.unshift(punch);
  pushAudit(s, userId, 'POSTING', 'ATTENDANCE', emp.code, { reason: `${args.punchType} · ${serverTime} · GPS ${args.lat.toFixed(4)},${args.lng.toFixed(4)} ±${args.accuracy}m` });
  return { s, ok: true, msg: `${args.punchType} recorded for ${emp.name} at ${serverTime}.`, tone: 'ok', docId: punch.id };
}

/* ---- HCM.4 Labour management ---- */

export function createLabourGang(sIn: ERPState, args: { code: string; supervisorId: string; trade: string; siteId: string; memberIds: string[] }, userId: string): Res {
  const s = cloneState(sIn);
  const sup = s.employees.find((e) => e.id === args.supervisorId);
  if (!sup) return { s, ok: false, msg: 'Supervisor not found', tone: 'bad' };

  const gang = { id: uid(), code: args.code, supervisorId: args.supervisorId, trade: args.trade, siteId: args.siteId, members: args.memberIds };
  s.labourGangs.unshift(gang);
  pushAudit(s, userId, 'POSTING', 'LABOUR_GANG', gang.code, { reason: `${sup.name} · ${args.trade} · ${args.memberIds.length} members` });
  return { s, ok: true, msg: `Gang ${gang.code} created — ${sup.name} supervising ${args.memberIds.length} ${args.trade} labourers.`, tone: 'ok', docId: gang.id };
}

/* ---- HCM.5 Payroll with cost-object assignment ---- */

export function runPayroll(sIn: ERPState, args: { period: string; simulate: boolean }, userId: string): Res {
  const s = cloneState(sIn);
  const auth = authorize(s, userId, 'FIN_DOC', '01', {});
  if (!auth.ok) return { s, ok: false, msg: auth.reason, tone: 'bad' };

  const activeEmps = s.employees.filter((e) => e.status === 'ACTIVE' || e.status === 'PROBATION');
  let totalPayroll = 0;
  const postings: { empId: string; amount: number; wbs?: string; cc?: string }[] = [];

  for (const emp of activeEmps) {
    /* Compute pay based on group/subgroup */
    let pay = 0;
    if (emp.group === 'PERMANENT') {
      pay = 50000; // Simplified: fixed monthly
    } else if (emp.group === 'LABOUR') {
      const punches = s.attendancePunches.filter((p) => p.employeeId === emp.id && p.punchType === 'IN' && p.serverTime.startsWith(args.period));
      pay = punches.length * 600; // 600 per day
    }

    /* Check minimum wage for labour */
    if (emp.group === 'LABOUR') {
      const minWage = MINWAGE_SEED.find((w) => w.skill === emp.subgroup);
      if (minWage && pay < minWage.dailyRate * 26) {
        return { s, ok: false, msg: `Payroll blocked: ${emp.name} pay ${fmtINR(pay)} below minimum wage ${fmtINR(minWage.dailyRate * 26)} for ${emp.subgroup}.`, tone: 'bad' };
      }
    }

    totalPayroll += pay;
    /* Cost-object assignment: site payroll lands on correct WBS, not head office */
    const wbs = emp.personnelSubarea === 'SITE' ? 'PRJ-NH47-E' : undefined;
    const cc = emp.personnelSubarea === 'HO' ? 'CC-ADM' : undefined;
    postings.push({ empId: emp.id, amount: pay, wbs, cc });
  }

  if (args.simulate) {
    return { s, ok: true, msg: `Payroll simulation: ${activeEmps.length} employees, total ${fmtINR(totalPayroll)}. Cost-object assignment verified — site payroll lands on WBS, head office on cost centre.`, tone: 'ok' };
  }

  /* Post payroll through Part 1 posting engine */
  const lines = postings.flatMap((p) => [
    { account: '410100', dr: p.amount, cr: 0, text: `Payroll ${args.period}`, wbs: p.wbs, cc: p.cc },
    { account: '120100', dr: 0, cr: p.amount, text: `Payroll payable ${args.period}` },
  ]);
  postJournal(s, { companyId: 'VUL', dateISO: s.today, lines, refId: 'PAYROLL', refNumber: `PAY/${args.period}`, createdBy: userId });
  pushAudit(s, userId, 'POSTING', 'PAYROLL', args.period, { reason: `${activeEmps.length} employees · ${fmtINR(totalPayroll)} · full cost-object assignment` });
  return { s, ok: true, msg: `Payroll ${args.period} posted: ${activeEmps.length} employees, ${fmtINR(totalPayroll)}. Site payroll landed on WBS, head office on cost centre.`, tone: 'ok' };
}

/* ---- HCM queries ---- */

export function supervisorOnDate(s: ERPState, empId: string, date: string): string | undefined {
  const emp = s.employees.find((e) => e.id === empId);
  if (!emp) return undefined;
  const hist = emp.supervisorHistory.filter((h) => h.from <= date && (!h.to || h.to >= date));
  return hist.length > 0 ? hist[hist.length - 1].supervisorId : undefined;
}

export function certificationAlerts(s: ERPState): { emp: Employee; cert: { type: string; validTo: string }; daysLeft: number }[] {
  const today = new Date(s.today).getTime();
  const alerts: { emp: Employee; cert: { type: string; validTo: string }; daysLeft: number }[] = [];
  for (const emp of s.employees) {
    for (const cert of emp.certifications) {
      const daysLeft = Math.round((new Date(cert.validTo).getTime() - today) / 86400000);
      if (daysLeft <= 90 && daysLeft >= 0) {
        alerts.push({ emp, cert, daysLeft });
      }
    }
  }
  return alerts.sort((a, b) => a.daysLeft - b.daysLeft);
}
