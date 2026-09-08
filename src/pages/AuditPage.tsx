import { useMemo, useState } from 'react';
import { Download, ShieldAlert, FileCheck2, SlidersHorizontal, History, Radio } from 'lucide-react';
import { useStore } from '../store';
import { SectionHead, Empty, InfoNote } from '../components/ui';
import { userById } from '../engine/engine';
import type { AuditCategory } from '../engine/types';

export function AuditPage() {
  const { state } = useStore();
  const [cat, setCat] = useState<'ALL' | AuditCategory>('ALL');
  const [q, setQ] = useState('');

  const rows = useMemo(() => state.audit.filter((a) =>
    (cat === 'ALL' || a.category === cat) &&
    (!q || `${a.object} ${a.key} ${a.field ?? ''} ${a.oldV ?? ''} ${a.newV ?? ''} ${a.reason ?? ''} ${a.user}`.toLowerCase().includes(q.toLowerCase())),
  ), [state.audit, cat, q]);

  const sec = state.audit.filter((a) => a.category === 'SECURITY');

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const el = document.createElement('a');
    el.href = url;
    el.download = `vulcan-audit-export-${state.today}.json`;
    el.click();
    URL.revokeObjectURL(url);
  };

  const icon = (c: AuditCategory) =>
    c === 'SECURITY' ? <ShieldAlert size={13} /> : c === 'POSTING' ? <FileCheck2 size={13} /> : c === 'CONFIG' ? <SlidersHorizontal size={13} /> : c === 'CHANGE' ? <History size={13} /> : <Radio size={13} />;
  const tone = (c: AuditCategory) =>
    c === 'SECURITY' ? 'bg-bad-soft text-bad' : c === 'POSTING' ? 'bg-ok-soft text-ok' : c === 'CONFIG' ? 'bg-pet-soft text-pet' : 'bg-warn-soft text-warn';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Change documents', n: state.audit.filter((a) => a.category === 'CHANGE').length, t: 'Field-level before/after with reason' },
          { label: 'Security events', n: sec.length, t: '403s, SoD blocks, period breaches' },
          { label: 'Postings', n: state.audit.filter((a) => a.category === 'POSTING').length, t: 'Every document and journal' },
          { label: 'Config & closing', n: state.audit.filter((a) => a.category === 'CONFIG').length, t: 'Periods, roles, sign-offs' },
        ].map((s, i) => (
          <div key={s.label} className="card p-3.5 fade-up" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="lbl">{s.label}</div>
            <div className="font-disp font-extrabold text-[22px] mono mt-1">{s.n}</div>
            <div className="text-[10.5px] text-mute mt-0.5">{s.t}</div>
          </div>
        ))}
      </div>

      {sec.length > 0 && (
        <div className="card p-4 border-l-4 !border-l-bad">
          <SectionHead title="Security events — attempted breaches" sub="Every refusal is logged with user, object, activity and reason" />
          <div className="grid md:grid-cols-2 gap-2">
            {sec.slice(0, 6).map((a) => (
              <div key={a.id} className="border border-bad/25 bg-bad-soft/50 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={13} className="text-bad" />
                  <span className="mono font-bold text-[11.5px]">{a.object} · {a.key}</span>
                  <span className="mono text-[9.5px] text-mute ml-auto">{a.at}</span>
                </div>
                <div className="text-[11.5px] text-mute mt-1">{a.reason}</div>
                <div className="text-[10.5px] text-mute">by {userById(a.user)?.name ?? a.user}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card p-4">
        <SectionHead
          title="Complete audit trail"
          sub="Append-only · searchable · exportable for auditors"
          right={
            <div className="flex gap-2 items-center">
              <input className="inp !w-[220px] !py-1.5 !text-[12px]" placeholder="Search object, field, reason…" value={q} onChange={(e) => setQ(e.target.value)} />
              <select className="inp !w-[130px] !py-1.5 !text-[12px]" value={cat} onChange={(e) => setCat(e.target.value as 'ALL' | AuditCategory)}>
                <option value="ALL">All categories</option>
                {['CHANGE', 'SECURITY', 'POSTING', 'CONFIG', 'SYSTEM'].map((c) => <option key={c}>{c}</option>)}
              </select>
              <button className="btn btn-sm" onClick={exportJson}><Download size={13} /> Export</button>
            </div>
          }
        />
        {rows.length === 0 && <Empty text="No entries match the filter." />}
        <div className="max-h-[560px] overflow-y-auto pr-1">
          <table className="tbl">
            <thead className="sticky top-0 z-10">
              <tr><th></th><th>Time</th><th>User</th><th>Object / key</th><th>Field</th><th>Old → New</th><th>Reason</th></tr>
            </thead>
            <tbody>
              {rows.slice(0, 120).map((a) => (
                <tr key={a.id}>
                  <td><span className={`w-6 h-6 rounded-md grid place-items-center ${tone(a.category)}`}>{icon(a.category)}</span></td>
                  <td className="mono text-[10.5px] text-mute whitespace-nowrap">{a.at}</td>
                  <td className="text-[12px] font-semibold whitespace-nowrap">{userById(a.user)?.name ?? a.user}</td>
                  <td><span className="chip !py-0 mr-1">{a.category}</span><span className="mono text-[11px] font-bold">{a.object}</span> <span className="mono text-[11px] text-mute">{a.key}</span></td>
                  <td className="mono text-[11px]">{a.field ?? '—'}</td>
                  <td className="mono text-[11px]">{a.oldV !== undefined || a.newV !== undefined ? <><span className="text-bad line-through opacity-70">{a.oldV ?? '∅'}</span> → <span className="text-ok font-bold">{a.newV ?? '∅'}</span></> : '—'}</td>
                  <td className="text-[11px] text-mute max-w-[280px]">{a.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3"><InfoNote tone="warn">Reason is mandatory on: bank details · valuation class · price control · tax registration · BOQ rate · PO amendment · measurement correction · payment release · journal voucher · attendance correction · budget revision · geofence · permissions · period reopen.</InfoNote></div>
      </div>
    </div>
  );
}
