import { useMemo } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { motion } from 'framer-motion';
import { ArrowRight, ClipboardList, ShoppingCart, Warehouse, FlaskConical, Scale, FileCheck2, Radio, CalendarClock } from 'lucide-react';
import { useStore, useNav } from '../store';
import { SectionHead, Money, StatusChip, useCountUp } from '../components/ui';
import {
  stockValueTotal, glBalance, openCommitment, pendingReleaseDocs, fmtINR, fmtInt,
  userById, daysAgoISO,
} from '../engine/engine';
import { SITES, MODULES } from '../engine/config';

function Stat({ label, value, sub, tone = 'ink', delay = 0 }: { label: string; value: number; sub: string; tone?: string; delay?: number }) {
  const v = useCountUp(value);
  const color = tone === 'acc' ? 'text-acc-deep' : tone === 'ok' ? 'text-ok' : tone === 'warn' ? 'text-warn' : 'text-ink';
  return (
    <motion.div
      className="card p-4 relative overflow-hidden"
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.35 }}
    >
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-acc to-transparent opacity-70" />
      <div className="lbl">{label}</div>
      <div className={`font-disp font-extrabold text-[22px] tracking-tight mt-1.5 mono ${color}`}>{fmtINR(v)}</div>
      <div className="text-[11px] text-mute mt-1">{sub}</div>
    </motion.div>
  );
}

const CAT_ICON: Record<string, typeof Radio> = { POSTING: FileCheck2, SECURITY: Radio, CHANGE: ClipboardList, CONFIG: CalendarClock, SYSTEM: Radio };

export function Cockpit() {
  const { state } = useStore();
  const { go, focusDoc } = useNav();
  const cf = state.companyFilter;
  const inScope = (companyId: string) => cf === 'ALL' || companyId === cf;

  const kpi = useMemo(() => {
    const stock = stockValueTotal({ ...state, stock: state.stock.filter((r) => inScope(SITES.find((s) => s.code === r.siteId)?.companyId ?? '')) });
    const gl = ['110100', '110150', '110200', '110400'].reduce((t, a) => {
      const lines = state.journals.filter((j) => j.status === 'POSTED' && inScope(j.companyId))
        .flatMap((j) => j.lines.filter((l) => l.account === a));
      return t + lines.reduce((x, l) => x + l.dr - l.cr, 0);
    }, 0);
    const commit = openCommitment({ ...state, docs: state.docs.filter((d) => inScope(d.companyId)) });
    const grir = glBalance({ ...state, journals: state.journals.filter((j) => inScope(j.companyId)) }, '110300');
    return { stock, gl, commit, grir, break: Math.round((stock - gl) * 100) / 100 };
  }, [state, cf]);

  const pending = pendingReleaseDocs(state).filter((d) => inScope(d.companyId));
  const openPRs = state.docs.filter((d) => d.type.startsWith('PR') && d.status === 'RELEASED' && inScope(d.companyId)).length;

  const pulse = useMemo(() => {
    const days: { d: string; label: string; posts: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = daysAgoISO(i);
      const posts = state.docs.filter((x) => x.dateISO === d && x.status !== 'DRAFT' && inScope(x.companyId)).length
        + state.journals.filter((j) => j.dateISO === d && inScope(j.companyId)).length;
      days.push({ d, label: d.slice(5), posts });
    }
    return days;
  }, [state, cf]);

  const bySite = useMemo(() =>
    SITES.filter((s) => inScope(s.companyId)).map((s) => ({
      site: s.code.replace('ST-', ''),
      value: Math.round(state.stock.filter((r) => r.siteId === s.code).reduce((t, r) => t + r.value, 0)),
    })), [state, cf]);

  const spine = useMemo(() => {
    const order: string[] = ['BID', 'CTR', 'PRJ', 'PRC', 'INV', 'BIL', 'FIN'];
    return order.map((m) => ({
      m,
      n: state.docs.filter((d) => d.module === m && d.status !== 'DRAFT' && inScope(d.companyId)).length,
      name: MODULES.find((x) => x.code === m)?.name ?? m,
    }));
  }, [state, cf]);

  const feed = state.audit.slice(0, 9);

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Stock value (all sites)" value={kpi.stock} sub="Real-time valuation — moving average" delay={0.02} />
        <Stat label="Open purchase commitment" value={kpi.commit} sub="Ordered, not yet received" tone="acc" delay={0.07} />
        <Stat label="GR/IR clearing balance" value={kpi.grir} sub="Receipts awaiting invoice" tone="warn" delay={0.12} />
        <Stat label="Stock ledger vs GL break" value={Math.abs(kpi.break)} sub={kpi.break === 0 ? 'Reconciled — zero break ✓' : 'Investigate!'} tone="ok" delay={0.17} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* posting pulse */}
        <div className="card p-4 xl:col-span-2">
          <SectionHead title="Posting pulse" sub="Documents and accounting entries per day — updates the moment anything posts" right={<button className="btn btn-sm" onClick={() => go('inventory')}>Inventory <ArrowRight size={13} /></button>} />
          <div className="h-[190px]">
            <ResponsiveContainer>
              <AreaChart data={pulse} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="gAcc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e8590c" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#e8590c" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#dfe3d9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fontFamily: 'IBM Plex Mono' }} tickLine={false} axisLine={{ stroke: '#cbd1c4' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fontFamily: 'IBM Plex Mono' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ fontFamily: 'IBM Plex Mono', fontSize: 11, borderRadius: 8, border: '1px solid #dfe3d9' }} />
                <Area type="monotone" dataKey="posts" stroke="#e8590c" strokeWidth={2.2} fill="url(#gAcc)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* stock by site */}
        <div className="card p-4">
          <SectionHead title="Stock by operating site" sub="Valuation area = operating site" />
          <div className="h-[190px]">
            <ResponsiveContainer>
              <BarChart data={bySite} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dfe3d9" vertical={false} />
                <XAxis dataKey="site" tick={{ fontSize: 10, fontFamily: 'IBM Plex Mono' }} tickLine={false} axisLine={{ stroke: '#cbd1c4' }} />
                <YAxis tick={{ fontSize: 9, fontFamily: 'IBM Plex Mono' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v) => fmtINR(Number(v))} contentStyle={{ fontFamily: 'IBM Plex Mono', fontSize: 11, borderRadius: 8, border: '1px solid #dfe3d9' }} />
                <Bar dataKey="value" fill="#135f7c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* document spine */}
        <div className="card p-4 xl:col-span-2">
          <SectionHead title="Document flow spine" sub="BID → CTR → PRJ → PRC → INV → BIL → FIN · every document knows its predecessors and successors" />
          <div className="flex items-center gap-1 flex-wrap">
            {spine.map((s, i) => (
              <div key={s.m} className="flex items-center">
                {i > 0 && <ArrowRight size={14} className="text-line-2 mx-1" />}
                <div className={`border rounded-lg px-3 py-2 text-center min-w-[86px] ${s.n > 0 ? 'border-pet/40 bg-pet-soft' : 'border-dashed border-line-2 bg-paper/50'}`}>
                  <div className="font-disp font-extrabold text-[15px] tracking-tight">{s.m}</div>
                  <div className="mono text-[10.5px] font-bold text-mute mt-0.5">{s.n} doc{s.n === 1 ? '' : 's'}</div>
                  <div className="text-[9px] text-mute truncate max-w-[90px]">{s.n > 0 ? 'live' : 'Parts 2–3'}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid sm:grid-cols-2 gap-2">
            {pending.slice(0, 4).map((d) => (
              <button key={d.id} onClick={() => focusDoc(d.id, 'procurement')} className="flex items-center justify-between gap-2 border border-warn/30 bg-warn-soft rounded-lg px-3 py-2 text-left hover:-translate-y-0.5 hover:shadow transition-all">
                <span className="min-w-0">
                  <span className="mono text-[11px] font-bold block truncate">{d.number}</span>
                  <span className="text-[11px] text-mute block truncate">next: {d.release?.steps.find((s) => s.status === 'PENDING')?.title}</span>
                </span>
                <span className="text-right shrink-0">
                  <Money v={d.total} className="text-[12px] font-bold block" />
                  <StatusChip s={d.status} />
                </span>
              </button>
            ))}
            {pending.length === 0 && <div className="text-[12px] text-mute sm:col-span-2">Release queue is clear.</div>}
          </div>
        </div>

        {/* live feed */}
        <div className="card p-4 flex flex-col">
          <SectionHead title="Live control feed" sub="Append-only audit stream" right={<span className="flex items-center gap-1.5 text-[10.5px] font-bold text-ok"><span className="w-2 h-2 rounded-full bg-ok pulse-dot" /> LIVE</span>} />
          <div className="space-y-1.5 flex-1 overflow-y-auto max-h-[290px] pr-1">
            {feed.map((a) => {
              const I = CAT_ICON[a.category] ?? Radio;
              const tone = a.category === 'SECURITY' ? 'text-bad bg-bad-soft' : a.category === 'POSTING' ? 'text-ok bg-ok-soft' : a.category === 'CONFIG' ? 'text-pet bg-pet-soft' : 'text-warn bg-warn-soft';
              return (
                <div key={a.id} className="flex items-start gap-2 border border-line rounded-lg px-2.5 py-2 hover:bg-paper transition-colors">
                  <span className={`w-6 h-6 shrink-0 rounded-md grid place-items-center ${tone}`}><I size={12.5} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="chip !py-0 !px-1.5 !text-[9px]">{a.category}</span>
                      <span className="mono text-[10.5px] font-bold truncate">{a.object} · {a.key}</span>
                    </div>
                    <div className="text-[11px] text-mute truncate">{a.reason ?? (a.field ? `${a.field}: ${a.oldV ?? '—'} → ${a.newV ?? '—'}` : '')}</div>
                    <div className="mono text-[9.5px] text-mute/80">{a.at} · {userById(a.user)?.name ?? a.user}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* quick actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'New requisition', sub: `${openPRs} PRs awaiting conversion`, icon: ClipboardList, page: 'procurement' as const },
          { label: 'Post a goods movement', sub: `${fmtInt(state.docs.filter((d) => d.module === 'INV').length)} material documents`, icon: Warehouse, page: 'inventory' as const },
          { label: 'Simulate a posting', sub: 'Exact journal, before the fact', icon: FlaskConical, page: 'simulator' as const },
          { label: 'Review release queue', sub: `${pending.length} awaiting approval`, icon: Scale, page: 'procurement' as const },
        ].map((q, i) => (
          <motion.button
            key={q.label} onClick={() => go(q.page)}
            className="card p-3.5 text-left group hover:-translate-y-0.5 hover:shadow-md transition-all"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.05 }}
          >
            <div className="flex items-center justify-between">
              <q.icon size={17} className="text-acc group-hover:scale-110 transition-transform" />
              <ArrowRight size={14} className="text-line-2 group-hover:text-acc group-hover:translate-x-0.5 transition-all" />
            </div>
            <div className="font-disp font-bold text-[13.5px] mt-2">{q.label}</div>
            <div className="text-[11px] text-mute mt-0.5">{q.sub}</div>
          </motion.button>
        ))}
      </div>

      {/* reconciliation strip */}
      <div className="card p-4 flex flex-wrap items-center gap-x-8 gap-y-2">
        <div>
          <div className="lbl">Stock ledger (material documents)</div>
          <div className="mono font-bold text-[15px]">{fmtINR(kpi.stock)}</div>
        </div>
        <ArrowRight size={16} className="text-mute" />
        <div>
          <div className="lbl">GL stock accounts 1101xx + 1102xx + 1104xx</div>
          <div className="mono font-bold text-[15px]">{fmtINR(kpi.gl)}</div>
        </div>
        <ArrowRight size={16} className="text-mute" />
        <div>
          <div className="lbl">Daily reconciliation job</div>
          <div className={`chip mt-1 ${kpi.break === 0 ? 'bg-ok-soft text-ok border-ok/40' : 'bg-bad-soft text-bad border-bad/40'} !text-[11px] !py-1`}>
            {kpi.break === 0 ? 'ZERO BREAK ✓' : `BREAK ${fmtINR(kpi.break)}`}
          </div>
        </div>
        <button className="btn btn-sm ml-auto" onClick={() => go('inventory')}><Warehouse size={13} /> Open stock ledger</button>
      </div>
    </div>
  );
}
