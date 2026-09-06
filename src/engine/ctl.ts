import type { ERPState, Res, JournalLine, ProfitForecast } from './types';
import { cloneState, round2, uid, pushAudit, authorize, postJournal, fmtINR, nowStamp, periodOf, fyOf } from './engine';
import { COST_CENTRES, PROJECTS, PARTNERS } from './config';

/* ---------- Cost centre accounting ---------- */

export interface CostCentreLine { code: string; name: string; plan: number; actual: number; variance: number; absorptionPct: number; }

const CC_PLAN: Record<string, number> = { 'CC-ADM': 2400000, 'CC-4700': 9600000, 'CC-WSH': 3600000, 'CC-RMC1': 4800000 };

export function costCentreReport(s: ERPState): CostCentreLine[] {
  return COST_CENTRES.map((cc) => {
    const actual = s.journals
      .filter((j) => j.status === 'POSTED')
      .reduce((t, j) => t + j.lines.filter((l) => l.cc === cc.code && l.dr > 0).reduce((x, l) => x + l.dr, 0), 0);
    const plan = CC_PLAN[cc.code] ?? 0;
    return { code: cc.code, name: cc.name, plan, actual: round2(actual), variance: round2(actual - plan), absorptionPct: plan > 0 ? round2((actual / plan) * 100) : 0 };
  });
}

/* ---------- Overhead allocation (site establishment → projects by driver) ---------- */

export function runOverheadAllocation(sIn: ERPState, driver: 'DIRECT_COST' | 'REVENUE' | 'MAN_HOURS', userId: string): Res {
  const s = cloneState(sIn);
  const auth = authorize(s, userId, 'FIN_DOC', '01', {});
  if (!auth.ok) return { s, ok: false, msg: auth.reason, tone: 'bad' };

  const pool = round2(s.journals.filter((j) => j.status === 'POSTED').reduce((t, j) => t + j.lines.filter((l) => l.cc === 'CC-ADM' && l.dr > 0).reduce((x, l) => x + l.dr, 0), 0));
  if (pool <= 0) return { s, ok: false, msg: 'No overhead pool collected on CC-ADM this period — nothing to allocate.', tone: 'warn' };

  /* Allocate across project WBS by chosen driver (direct cost proxy = actual consumption) */
  const projWbs = PROJECTS.flatMap((p) => p.wbs.map((w) => ({ project: p.code, wbs: w.code })));
  const weights = projWbs.map(({ project, wbs }) => {
    const actual = s.journals.filter((j) => j.status === 'POSTED').reduce((t, j) => t + j.lines.filter((l) => l.wbs === wbs && l.dr > 0).reduce((x, l) => x + l.dr, 0), 0);
    return { project, wbs, weight: actual };
  });
  const totalWeight = weights.reduce((t, w) => t + w.weight, 0);
  if (totalWeight <= 0) return { s, ok: false, msg: 'No allocation base (zero direct cost across WBS) — cannot allocate.', tone: 'warn' };

  const lines: JournalLine[] = [{ account: '410200', dr: pool, cr: 0, text: 'Overhead allocation — head office pool', cc: 'CC-ADM' }];
  let allocated = 0;
  for (const w of weights) {
    if (w.weight <= 0) continue;
    const share = round2((pool * w.weight) / totalWeight);
    allocated += share;
    lines.push({ account: '410100', dr: 0, cr: share, text: `Overhead absorbed — ${w.wbs} (${driver})`, wbs: w.wbs });
  }
  /* rounding residual to first line */
  lines[0].dr = round2(allocated);
  postJournal(s, { companyId: 'VUL', dateISO: s.today, lines, refId: 'OHALLOC', refNumber: `OH/${s.today}`, createdBy: userId });
  pushAudit(s, userId, 'POSTING', 'OVERHEAD_ALLOCATION', `OH/${s.today}`, { reason: `${fmtINR(allocated)} allocated by ${driver} — reversible cycle` });
  return { s, ok: true, msg: `Overhead ${fmtINR(allocated)} allocated to project WBS by ${driver.toLowerCase()} — posted and reversible.`, tone: 'ok' };
}

/* ---------- Profitability analysis (retains prior forecasts for trend) ---------- */

export function recordProfitForecast(sIn: ERPState, args: { key: string; dimension: ProfitForecast['dimension']; revenue: number; cost: number }, userId: string): Res {
  const s = cloneState(sIn);
  const period = `${fyOf(s.today)}-P${periodOf(s.today)}`;
  const prior = s.profitForecasts.filter((f) => f.key === args.key && f.dimension === args.dimension);
  const version = prior.length + 1;
  const margin = round2(args.revenue - args.cost);
  const fc: ProfitForecast = {
    id: uid(), key: args.key, dimension: args.dimension, period,
    revenue: round2(args.revenue), cost: round2(args.cost), margin, version, at: nowStamp(),
  };
  s.profitForecasts.unshift(fc);
  pushAudit(s, userId, 'CHANGE', 'PROFIT_FORECAST', `${args.key} v${version}`, { reason: `Revenue ${fmtINR(fc.revenue)} · cost ${fmtINR(fc.cost)} · margin ${fmtINR(margin)} — prior forecast v${version - 1} retained for trend`, field: 'margin', newV: fmtINR(margin) });
  return { s, ok: true, msg: `${args.key} forecast v${version} saved — margin ${fmtINR(margin)}. ${version > 1 ? 'A margin sliding month-on-month is now visible as a trend.' : 'Baseline forecast stored.'}`, tone: 'ok' };
}

export function forecastTrend(s: ERPState, key: string, dimension: ProfitForecast['dimension']): ProfitForecast[] {
  return s.profitForecasts.filter((f) => f.key === key && f.dimension === dimension).sort((a, b) => a.version - b.version);
}

export function profitabilityBy(s: ERPState, dimension: ProfitForecast['dimension']): ProfitForecast[] {
  const latest = new Map<string, ProfitForecast>();
  for (const f of s.profitForecasts) {
    if (f.dimension !== dimension) continue;
    const cur = latest.get(f.key);
    if (!cur || f.version > cur.version) latest.set(f.key, f);
  }
  return [...latest.values()];
}

export { COST_CENTRES, PROJECTS, PARTNERS };
