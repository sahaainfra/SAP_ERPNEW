import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, ArrowRight, CheckCircle2, AlertTriangle, Info, XCircle } from 'lucide-react';
import { useStore, useNav } from '../store';
import type { DocStatus, MasterStatus, PriceResult, JournalLine, PeriodStatus } from '../engine/types';
import { docById, flowChain, fmtINR, userById } from '../engine/engine';
import { approveDoc } from '../engine/platform';
import type { PageId } from '../store';

/* ---------------- chips ---------------- */

const DOC_TONE: Record<DocStatus, { c: string; t: string }> = {
  DRAFT: { c: 'bg-paper text-mute border-line-2', t: 'Draft' },
  SUBMITTED: { c: 'bg-pet-soft text-pet border-pet/30', t: 'Submitted' },
  PENDING_RELEASE: { c: 'bg-warn-soft text-warn border-warn/30', t: 'Pending release' },
  PARTIALLY_RELEASED: { c: 'bg-warn-soft text-warn border-warn/30', t: 'Partially released' },
  RELEASED: { c: 'bg-ok-soft text-ok border-ok/30', t: 'Released' },
  POSTED: { c: 'bg-ok-soft text-ok border-ok/30', t: 'Posted' },
  REJECTED: { c: 'bg-bad-soft text-bad border-bad/30', t: 'Rejected' },
  CANCELLED: { c: 'bg-bad-soft text-bad border-bad/30', t: 'Cancelled' },
  REVERSED: { c: 'bg-bad-soft text-bad border-bad/30', t: 'Reversed' },
  CONVERTED: { c: 'bg-pet-soft text-pet border-pet/30', t: 'Converted' },
};

export function StatusChip({ s }: { s: DocStatus }) {
  const t = DOC_TONE[s] ?? DOC_TONE.DRAFT;
  return <span className={`chip ${t.c}`}>{t.t}</span>;
}

export function MasterChip({ s }: { s: MasterStatus }) {
  const map: Record<MasterStatus, string> = {
    DRAFT: 'bg-paper text-mute', PENDING: 'bg-warn-soft text-warn',
    ACTIVE: 'bg-ok-soft text-ok', BLOCKED: 'bg-bad-soft text-bad',
  };
  return <span className={`chip ${map[s]}`}>{s}</span>;
}

export function PeriodChip({ s }: { s: PeriodStatus }) {
  const map: Record<PeriodStatus, [string, string]> = {
    OPEN: ['bg-ok-soft text-ok border-ok/30', 'Open'],
    SOFT_CLOSED: ['bg-warn-soft text-warn border-warn/30', 'Soft closed'],
    HARD_CLOSED: ['bg-bad-soft text-bad border-bad/30', 'Hard closed'],
  };
  const [c, t] = map[s];
  return <span className={`chip ${c}`}>{t}</span>;
}

export function RelChip({ ind }: { ind: string }) {
  const map: Record<string, string> = {
    BLOCKED: 'bg-warn-soft text-warn border-warn/30',
    PARTIALLY_RELEASED: 'bg-warn-soft text-warn border-warn/30',
    RELEASED: 'bg-ok-soft text-ok border-ok/30',
    REJECTED: 'bg-bad-soft text-bad border-bad/30',
  };
  return <span className={`chip ${map[ind] ?? ''}`}>{ind.replace(/_/g, ' ')}</span>;
}

/* ---------------- money / numbers ---------------- */

export function Money({ v, className = '' }: { v: number; className?: string }) {
  return <span className={`mono ${className}`}>{fmtINR(v)}</span>;
}

export function useCountUp(target: number, dur = 650): number {
  const [v, setV] = useState(target);
  const prev = useRef(target);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      prev.current = target;
      setV(target);
      return;
    }
    const from = prev.current;
    prev.current = target;
    if (from === target) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      setV(from + (target - from) * e);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, dur]);
  return v;
}

/* ---------------- layout atoms ---------------- */

export function SectionHead({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3">
      <div>
        <h2 className="font-disp font-bold text-[17px] tracking-tight leading-none">{title}</h2>
        {sub && <p className="text-[12px] text-mute mt-1">{sub}</p>}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}

export function KV({ k, v, mono = true }: { k: string; v: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="lbl">{k}</div>
      <div className={`text-[13px] font-medium truncate ${mono ? 'mono' : ''}`}>{v}</div>
    </div>
  );
}

export function InfoNote({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'ok' | 'bad'; children: ReactNode }) {
  const map = {
    info: 'bg-pet-soft border-pet/25 text-pet',
    warn: 'bg-warn-soft border-warn/25 text-warn',
    ok: 'bg-ok-soft border-ok/25 text-ok',
    bad: 'bg-bad-soft border-bad/25 text-bad',
  };
  const icons = { info: Info, warn: AlertTriangle, ok: CheckCircle2, bad: XCircle };
  const I = icons[tone];
  return (
    <div className={`flex items-start gap-2 border rounded-lg px-3 py-2 text-[12px] font-medium ${map[tone]}`}>
      <I size={14} className="mt-[1px] shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function Tabs({ tabs, val, onChange }: { tabs: { id: string; label: string; n?: number }[]; val: string; onChange: (id: string) => void }) {
  return (
    <div className="flex items-center gap-1 border-b border-line-2 mb-4 overflow-x-auto">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`px-3.5 py-2 text-[12.5px] font-semibold whitespace-nowrap border-b-2 -mb-px transition-all ${
            val === t.id ? 'border-acc text-ink' : 'border-transparent text-mute hover:text-ink'
          }`}
        >
          {t.label}
          {t.n !== undefined && <span className={`ml-1.5 chip ${val === t.id ? 'bg-acc-soft text-acc-deep border-acc/30' : ''}`}>{t.n}</span>}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children, req, hint }: { label: string; children: ReactNode; req?: boolean; hint?: string }) {
  return (
    <label className="block">
      <div className="lbl mb-1">
        {label} {req && <span className="text-acc">*</span>}
      </div>
      {children}
      {hint && <div className="text-[11px] text-mute mt-1">{hint}</div>}
    </label>
  );
}

/* ---------------- modal / drawer ---------------- */

export function Modal({ open, onClose, title, sub, children, footer, wide }: {
  open: boolean; onClose: () => void; title: string; sub?: string; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-side/55 backdrop-blur-[2px] p-4 pt-[7vh]"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            className={`card w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} shadow-2xl`}
            initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b border-line">
              <div>
                <h3 className="font-disp font-bold text-[15.5px] leading-tight">{title}</h3>
                {sub && <p className="text-[11.5px] text-mute mt-0.5">{sub}</p>}
              </div>
              <button onClick={onClose} className="text-mute hover:text-ink transition-colors"><X size={17} /></button>
            </div>
            <div className="px-5 py-4 max-h-[65vh] overflow-y-auto">{children}</div>
            {footer && <div className="px-5 py-3 border-t border-line flex justify-end gap-2 bg-paper/60 rounded-b-[10px]">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------------- document flow ---------------- */

function pageForDoc(type: string): PageId {
  if (['GR-PO', 'GR-RTN', 'GI-PRJ', 'GI-CC', 'GI-EAM', 'ST-PLT', 'ST-LOC', 'PI-ADJ', 'SC-WOF'].includes(type)) return 'inventory';
  return 'procurement';
}

export function FlowViz({ docId }: { docId: string }) {
  const { state } = useStore();
  const { focusDoc } = useNav();
  const chain = flowChain(state, docId);
  return (
    <div className="flex items-stretch gap-0 overflow-x-auto py-2">
      {chain.map((id, i) => {
        const d = docById(state, id);
        if (!d) return null;
        const isCur = id === docId;
        return (
          <div key={id} className="flex items-center shrink-0">
            {i > 0 && <ArrowRight size={15} className="text-line-2 mx-1.5 shrink-0" />}
            <button
              onClick={() => focusDoc(id, pageForDoc(d.type))}
              className={`text-left border rounded-lg px-3 py-2 min-w-[128px] transition-all hover:-translate-y-0.5 hover:shadow-md ${
                isCur ? 'border-acc bg-acc-soft shadow-sm' : 'border-line bg-panel'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="chip !py-0 !px-1.5 bg-side text-side-tx border-side">{d.type}</span>
              </div>
              <div className="mono text-[11px] font-semibold mt-1 truncate">{d.number ?? '(no number)'}</div>
              <div className="flex items-center gap-1.5 mt-1">
                <StatusChip s={d.status} />
              </div>
              <div className="mono text-[10.5px] text-mute mt-0.5">{fmtINR(d.total)}</div>
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- journal ---------------- */

export function JournalView({ lines, number }: { lines: JournalLine[]; number?: string }) {
  const dr = lines.reduce((t, l) => t + l.dr, 0);
  return (
    <div>
      {number && <div className="lbl mb-1.5">Accounting document · <span className="text-ink">{number}</span></div>}
      <table className="tbl">
        <thead>
          <tr><th>G/L account</th><th>Text</th><th>Object</th><th className="text-right">Debit</th><th className="text-right">Credit</th></tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td className="mono font-semibold text-pet">{l.account}</td>
              <td className="text-[12px]">{l.text}</td>
              <td className="mono text-[11px] text-mute">{l.wbs ?? l.cc ?? '—'}</td>
              <td className="num">{l.dr ? fmtINR(l.dr) : ''}</td>
              <td className="num">{l.cr ? fmtINR(l.cr) : ''}</td>
            </tr>
          ))}
          <tr className="font-bold bg-paper/70">
            <td colSpan={3} className="text-right text-[11px] uppercase tracking-wider">Balanced</td>
            <td className="num">{fmtINR(dr)}</td>
            <td className="num">{fmtINR(lines.reduce((t, l) => t + l.cr, 0))}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- pricing breakdown ---------------- */

export function PriceBreakdown({ price }: { price: PriceResult }) {
  return (
    <table className="tbl">
      <thead>
        <tr><th>Step</th><th>Condition</th><th>Rate</th><th>Source (access)</th><th className="text-right">Value</th></tr>
      </thead>
      <tbody>
        {price.steps.map((st) => (
          <tr key={st.step} className={st.kind === 'SUBTOTAL' ? 'bg-paper/70 font-bold' : st.stat ? 'opacity-70' : ''}>
            <td className="mono text-[11px] text-mute">{st.step}</td>
            <td>
              <span className={`chip !py-0 mr-1.5 ${st.code === 'BASE' ? 'bg-side text-side-tx border-side' : st.stat ? 'bg-warn-soft text-warn' : 'bg-pet-soft text-pet border-pet/30'}`}>{st.code}</span>
              <span className="text-[12.5px]">{st.desc}</span>
              {st.stat && <span className="ml-1.5 text-[10px] font-bold text-warn uppercase tracking-wider">statistical</span>}
            </td>
            <td className="mono text-[12px]">{st.rate !== undefined ? `${st.rate}${st.per === '%' ? '%' : ' ' + (st.per ?? '')}` : '—'}</td>
            <td className="text-[11.5px] text-mute max-w-[220px]">{st.source ?? ''}</td>
            <td className={`num ${st.value < 0 ? 'text-bad' : ''} ${st.kind === 'SUBTOTAL' ? '' : ''}`}>{fmtINR(st.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ---------------- release timeline ---------------- */

export function ReleaseTimeline({ docId }: { docId: string }) {
  const { state, run } = useStore();
  const [comment, setComment] = useState('');
  const doc = docById(state, docId);
  if (!doc?.release) return null;
  const rel = doc.release;
  const me = state.userId;
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5 flex-wrap">
        <RelChip ind={rel.indicator} />
        <span className="text-[12px] text-mute">Strategy <b className="mono text-ink">{rel.strategyId}</b> · {rel.strategyName}</span>
        {rel.resets > 0 && <span className="chip bg-bad-soft text-bad border-bad/30">resets: {rel.resets}</span>}
      </div>
      <div className="flex items-center gap-0 flex-wrap">
        {rel.steps.map((st, i) => (
          <div key={st.code} className="flex items-center">
            {i > 0 && <div className="w-6 h-px bg-line-2" />}
            <div className={`border rounded-lg px-3 py-2 min-w-[150px] ${
              st.status === 'APPROVED' ? 'border-ok/40 bg-ok-soft' :
              st.status === 'REJECTED' ? 'border-bad/40 bg-bad-soft' :
              st.status === 'PENDING' && i === rel.steps.findIndex((x) => x.status === 'PENDING') ? 'border-acc bg-acc-soft' : 'border-line bg-panel opacity-70'
            }`}>
              <div className="mono text-[10px] font-bold tracking-wider text-mute">{st.code} · {st.title}</div>
              <div className="text-[12px] font-semibold mt-0.5">
                {st.status === 'APPROVED' && `✓ ${st.by ? userById(st.by).name : ''}`}
                {st.status === 'REJECTED' && `✕ ${st.by ? userById(st.by).name : ''}`}
                {st.status === 'PENDING' && 'Awaiting release'}
              </div>
              {st.snapshot && <div className="mono text-[10.5px] text-mute mt-0.5">snapshot {fmtINR(st.snapshot.total)}</div>}
              {st.comment && <div className="text-[10.5px] text-mute italic mt-0.5">"{st.comment}"</div>}
              {st.at && <div className="mono text-[10px] text-mute">{st.at}</div>}
            </div>
          </div>
        ))}
      </div>
      {rel.indicator !== 'RELEASED' && rel.indicator !== 'REJECTED' && (
        <div className="mt-3 flex items-start gap-2">
          <input className="inp !py-1.5 text-[12px] flex-1" placeholder="Release comment (mandatory on rejection)…" value={comment} onChange={(e) => setComment(e.target.value)} />
          <button className="btn btn-ok btn-sm" onClick={() => { run((s) => approveDoc(s, docId, 'APPROVE', comment, me)); setComment(''); }}>Approve step</button>
          <button className="btn btn-bad btn-sm" onClick={() => { run((s) => approveDoc(s, docId, 'REJECT', comment, me)); setComment(''); }}>Reject</button>
        </div>
      )}
    </div>
  );
}

/* ---------------- toasts ---------------- */

export function Toasts() {
  const { toasts, dismiss } = useStore();
  const icon = { ok: CheckCircle2, bad: XCircle, warn: AlertTriangle, info: Info };
  const bar = { ok: 'border-l-ok', bad: 'border-l-bad', warn: 'border-l-warn', info: 'border-l-pet' };
  const tx = { ok: 'text-ok', bad: 'text-bad', warn: 'text-warn', info: 'text-pet' };
  return (
    <div className="fixed bottom-4 right-4 z-[80] flex flex-col gap-2 w-[400px] max-w-[92vw]">
      <AnimatePresence>
        {toasts.map((t) => {
          const I = icon[t.tone];
          return (
            <motion.div
              key={t.id} layout
              initial={{ opacity: 0, x: 60, scale: 0.96 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 60, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              className={`card border-l-4 ${bar[t.tone]} px-3.5 py-3 shadow-xl flex items-start gap-2.5`}
            >
              <I size={16} className={`mt-[1px] shrink-0 ${tx[t.tone]}`} />
              <div className="text-[12.5px] leading-snug flex-1">{t.msg}</div>
              <button onClick={() => dismiss(t.id)} className="text-mute hover:text-ink shrink-0"><X size={13} /></button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return <div className="text-center text-mute text-[12.5px] py-8 border border-dashed border-line-2 rounded-lg">{text}</div>;
}
