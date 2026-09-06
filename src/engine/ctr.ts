import type { ERPState, Res, ContractMaster, BoqItem, RateAnalysis, HindranceEvent, Claim, RateComponent } from './types';
import { cloneState, round2, uid, pushAudit, authorize, fmtNum, fmtINR, nowStamp, daysAheadISO } from './engine';
import { CONTRACTS_SEED, STATUTORY_RATES } from './config';

export const contractById = (s: ERPState, id: string): ContractMaster | undefined => s.contracts.find((c) => c.id === id);
export const boqByContract = (s: ERPState, contractId: string): BoqItem[] => s.boq.filter((b) => b.contractId === contractId);
export const boqById = (s: ERPState, id: string): BoqItem | undefined => s.boq.find((b) => b.id === id);

/* ---------- BOQ: deviation statement & over-execution guard ---------- */

export interface DeviationLine { item: BoqItem; deviationQty: number; deviationPct: number; permitted: number; beyond: boolean; valueImpact: number; }

export function deviationStatement(s: ERPState, contractId: string): DeviationLine[] {
  return boqByContract(s, contractId).filter((b) => b.tenderQty > 0).map((b) => {
    const deviationQty = round2(b.executedCum - b.revisedQty);
    const deviationPct = round2((deviationQty / b.revisedQty) * 100);
    const permitted = round2((b.revisedQty * b.deviationLimitPct) / 100);
    const beyond = deviationQty > permitted;
    return { item: b, deviationQty, deviationPct, permitted, beyond, valueImpact: round2(deviationQty * b.tenderRate) };
  });
}

/** Over-execution guard: cumulative executed cannot exceed BOQ qty × (1 + deviation %) without an approved VO. */
export function canMeasure(s: ERPState, boqItemId: string, addQty: number, hasApprovedVo: boolean): { ok: boolean; msg: string } {
  const b = boqById(s, boqItemId);
  if (!b) return { ok: false, msg: 'Unknown BOQ item' };
  if (b.tenderQty === 0 && !b.approved) return { ok: false, msg: `${b.itemCode} is an unapproved extra item — measurement allowed only at provisional rate (flagged).` };
  const limit = round2(b.revisedQty * (1 + b.deviationLimitPct / 100));
  if (b.tenderQty > 0 && b.executedCum + addQty > limit + 1e-9 && !hasApprovedVo) {
    return { ok: false, msg: `Over-execution blocked: ${fmtNum(b.executedCum + addQty, 1)} would exceed ${b.itemCode} limit ${fmtNum(limit, 1)} (qty ${fmtNum(b.revisedQty, 1)} + ${b.deviationLimitPct}%). Requires an approved variation order.` };
  }
  return { ok: true, msg: '' };
}

/* ---------- Rate analysis engine (with nested sub-analysis) ---------- */

export function computeRate(s: ERPState, analysisId: string, depth = 0): { rate: number; lines: { desc: string; amount: number; indent: number }[] } {
  const ra = s.rateLibrary.find((r) => r.id === analysisId);
  if (!ra || depth > 3) return { rate: 0, lines: [] };
  let direct = 0;
  const lines: { desc: string; amount: number; indent: number }[] = [];
  for (const c of ra.components) {
    if (c.kind === 'SUB_ANALYSIS' && c.subAnalysisId) {
      const sub = computeRate(s, c.subAnalysisId, depth + 1);
      direct += sub.rate;
      lines.push({ desc: `↳ ${c.desc} (nested)`, amount: round2(sub.rate), indent: depth + 1 });
      lines.push(...sub.lines.map((l) => ({ ...l, indent: l.indent + 1 })));
    } else {
      const w = 1 + (c.wastagePct ?? 0) / 100;
      const amt = round2(c.qty * c.rate * w);
      direct += amt;
      lines.push({ desc: `${c.desc} · ${fmtNum(c.qty, 2)} ${c.unit} × ${fmtNum(c.rate, 2)}${c.wastagePct ? ` +${c.wastagePct}% wastage` : ''}`, amount: amt, indent: depth });
    }
  }
  const siteOh = round2((direct * ra.siteOverheadPct) / 100);
  const hoOh = round2((direct * ra.hoOverheadPct) / 100);
  const profit = round2((direct * ra.profitPct) / 100);
  lines.push({ desc: `Site overhead ${ra.siteOverheadPct}%`, amount: siteOh, indent: depth });
  lines.push({ desc: `Head-office overhead ${ra.hoOverheadPct}%`, amount: hoOh, indent: depth });
  lines.push({ desc: `Contractor's profit ${ra.profitPct}%`, amount: profit, indent: depth });
  return { rate: round2(direct + siteOh + hoOh + profit), lines };
}

export function lockRateAnalysis(sIn: ERPState, analysisId: string, reason: string, userId: string): Res {
  const s = cloneState(sIn);
  const ra = s.rateLibrary.find((r) => r.id === analysisId);
  if (!ra) return { s, ok: false, msg: 'Rate analysis not found', tone: 'bad' };
  if (ra.locked) return { s, ok: false, msg: 'Already locked as a snapshot.', tone: 'warn' };
  ra.locked = true;
  ra.lockedReason = reason;
  ra.approver = userId;
  pushAudit(s, userId, 'CHANGE', 'RATE_ANALYSIS', ra.code, { field: 'locked', oldV: 'editable', newV: 'locked snapshot', reason });
  return { s, ok: true, msg: `${ra.code} locked as an immutable snapshot — ${reason}.`, tone: 'ok' };
}

/* ---------- Hindrance register & notice deadlines ---------- */

export function logHindrance(sIn: ERPState, args: Omit<HindranceEvent, 'id'>, userId: string): Res {
  const s = cloneState(sIn);
  const c = contractById(s, args.contractId);
  if (!c) return { s, ok: false, msg: 'Unknown contract', tone: 'bad' };
  const h: HindranceEvent = { ...args, id: uid() };
  s.hindrances.unshift(h);
  const noticeDue = daysFrom(args.eventDate, c.eotNoticeDays);
  pushAudit(s, userId, 'CHANGE', 'HINDRANCE', `${c.number} · ${h.type}`, { reason: `${h.desc} — notice due by ${noticeDue} (${c.eotNoticeDays} days)` });
  return { s, ok: true, msg: `Hindrance logged — contractual notice due by ${noticeDue}. Alert armed.`, tone: 'ok', docId: h.id };
}

const daysFrom = (iso: string, n: number): string => {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export interface HindranceAlert { h: HindranceEvent; noticeDue: string; daysLeft: number; served: boolean; timely: boolean | null; }

export function hindranceAlerts(s: ERPState, today: string): HindranceAlert[] {
  return s.hindrances.map((h) => {
    const c = contractById(s, h.contractId);
    const noticeDue = daysFrom(h.eventDate, c?.eotNoticeDays ?? 28);
    const daysLeft = Math.round((new Date(noticeDue).getTime() - new Date(today).getTime()) / 86400000);
    const timely = h.noticeServed && h.noticeDate ? h.noticeDate <= noticeDue : null;
    return { h, noticeDue, daysLeft, served: h.noticeServed, timely };
  }).filter((a) => !a.served || a.daysLeft <= 7);
}

/* ---------- EOT & claims ---------- */

export function raiseClaim(sIn: ERPState, args: { contractId: string; clause: string; eventDate: string; noticeDate: string; desc: string; heads: { head: string; amount: number }[]; timeImpactDays: number; hindranceId?: string }, userId: string): Res {
  const s = cloneState(sIn);
  const c = contractById(s, args.contractId);
  if (!c) return { s, ok: false, msg: 'Unknown contract', tone: 'bad' };
  const noticeDue = daysFrom(args.eventDate, c.claimNoticeDays);
  const timely = args.noticeDate <= noticeDue;
  const claim: Claim = {
    id: uid(), number: `CLM/${c.projectCode}/${String(s.claims.length + 1).padStart(2, '0')}`,
    contractId: args.contractId, clause: args.clause, eventDate: args.eventDate, noticeDate: args.noticeDate,
    noticeTimely: timely, desc: args.desc, heads: args.heads, timeImpactDays: args.timeImpactDays,
    status: 'NOTICE', awarded: 0, hindranceId: args.hindranceId,
  };
  s.claims.unshift(claim);
  if (args.hindranceId) {
    const h = s.hindrances.find((x) => x.id === args.hindranceId);
    if (h) { h.feedsEotId = claim.id; h.noticeServed = true; h.noticeDate = args.noticeDate; h.noticeRef = claim.number; }
  }
  pushAudit(s, userId, 'CHANGE', 'CLAIM', claim.number, { reason: `${timely ? 'Timely' : 'LATE'} notice (${timely ? 'within' : 'beyond'} ${c.claimNoticeDays} days) · ${fmtINR(args.heads.reduce((t, x) => t + x.amount, 0))} claimed` });
  return { s, ok: true, msg: `${claim.number} raised — notice ${timely ? 'TIMELY' : 'LATE'} (${timely ? 'within' : 'beyond'} ${c.claimNoticeDays}-day window). ${timely ? '' : 'Late notice needs a different strategy — flagged to management.'}`, tone: timely ? 'ok' : 'warn', docId: claim.id };
}

export { CONTRACTS_SEED, STATUTORY_RATES };
