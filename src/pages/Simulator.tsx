import { useState } from 'react';
import { FlaskConical, ShieldCheck, Landmark, AlertOctagon } from 'lucide-react';
import { useStore } from '../store';
import { SectionHead, InfoNote, Field } from '../components/ui';
import { MovementForm } from '../components/MovementForm';
import { postManualJournal, resolveAccount, fmtINR } from '../engine/engine';
import { ACCOUNT_DETERMINATION, EVENT_KEY_DESC, GL_ACCOUNTS, COMPANIES } from '../engine/config';

export function Simulator() {
  const { state, run } = useStore();
  const [jv, setJv] = useState({ dr: '410200', cr: '140200', amt: 12500, reason: 'Site imprest replenishment — petty cash count' });

  return (
    <div className="space-y-4">
      <div className="card p-4 flex items-start gap-3">
        <span className="w-9 h-9 rounded-lg bg-acc-soft grid place-items-center text-acc shrink-0"><FlaskConical size={18} /></span>
        <div>
          <h3 className="font-disp font-extrabold text-[16px]">Post anything — watch the machinery decide</h3>
          <p className="text-[12.5px] text-mute mt-0.5 max-w-3xl">
            The simulator runs the identical pipeline a live posting uses: authorization object → required fields & cost-object check →
            company integrity → period status → negative-stock guard → account determination → journal. Nothing is written until you post —
            and with <b className="text-bad">chaos injection</b> a failure lands between the stock write and the accounting write, proving the transaction rolls back whole.
          </p>
        </div>
      </div>

      <MovementForm inline defaultCode="200" />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* account determination */}
        <div className="card p-4">
          <SectionHead title="Automatic account determination" sub="No GL account appears in application code — key = event × valuation class / modifier" />
          <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
            {Object.entries(ACCOUNT_DETERMINATION).map(([ev, row]) => (
              <div key={ev} className="border border-line rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="chip bg-side text-side-tx border-side">{ev}</span>
                  <span className="text-[12px] font-semibold">{EVENT_KEY_DESC[ev]}</span>
                </div>
                <div className="flex gap-1.5 flex-wrap mt-1.5">
                  {Object.entries(row).map(([k, acc]) => (
                    <span key={k} className="chip !py-0 !text-[10px]">
                      <span className={k === '*' ? 'text-mute' : 'text-pet font-bold'}>{k}</span> → <b>{acc}</b>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3"><InfoNote tone="info">Example — movement <b className="mono">200</b> with modifier <b>PRJ</b>: debit {resolveAccount('CON', 'PRJ').account} {resolveAccount('CON', 'PRJ').name}, credit {resolveAccount('BSX', 'VC-RAW').account} {resolveAccount('BSX', 'VC-RAW').name} for a raw material.</InfoNote></div>
        </div>

        {/* manual journal guardrails */}
        <div className="card p-4">
          <SectionHead title="Manual journal guardrails" sub="Unbalanced entries and control-account postings are refused at the service layer" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Debit account">
              <select className="inp mono !text-[11px]" value={jv.dr} onChange={(e) => setJv({ ...jv, dr: e.target.value })}>
                {GL_ACCOUNTS.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name}{a.control ? ` [${a.control}]` : ''}</option>)}
              </select>
            </Field>
            <Field label="Credit account">
              <select className="inp mono !text-[11px]" value={jv.cr} onChange={(e) => setJv({ ...jv, cr: e.target.value })}>
                {GL_ACCOUNTS.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name}{a.control ? ` [${a.control}]` : ''}</option>)}
              </select>
            </Field>
            <Field label="Amount ₹"><input type="number" className="inp mono" value={jv.amt} onChange={(e) => setJv({ ...jv, amt: +e.target.value })} /></Field>
            <Field label="Reason"><input className="inp" value={jv.reason} onChange={(e) => setJv({ ...jv, reason: e.target.value })} /></Field>
          </div>
          <div className="flex gap-2 mt-3 flex-wrap">
            <button className="btn btn-acc btn-sm" onClick={() => run((s) => postManualJournal(s, { companyId: 'VUL', dateISO: s.today, reason: jv.reason, lines: [{ account: jv.dr, dr: jv.amt, cr: 0, text: jv.reason }, { account: jv.cr, dr: 0, cr: jv.amt, text: jv.reason }] }, s.userId))}>
              <Landmark size={13} /> Post balanced JV
            </button>
            <button className="btn btn-bad btn-sm" onClick={() => run((s) => postManualJournal(s, { companyId: 'VUL', dateISO: s.today, reason: jv.reason, lines: [{ account: jv.dr, dr: jv.amt, cr: 0, text: 'deliberately unbalanced' }, { account: jv.cr, dr: 0, cr: Math.round(jv.amt * 0.9 * 100) / 100, text: 'deliberately unbalanced' }] }, s.userId))}>
              <AlertOctagon size={13} /> Try unbalanced (−10%)
            </button>
            <button className="btn btn-bad btn-sm" onClick={() => run((s) => postManualJournal(s, { companyId: 'VUL', dateISO: s.today, reason: jv.reason, lines: [{ account: '110100', dr: jv.amt, cr: 0, text: 'hand-posted stock' }, { account: jv.cr, dr: 0, cr: jv.amt, text: 'hand-posted stock' }] }, s.userId))}>
              <AlertOctagon size={13} /> Try direct hit on stock control 110100
            </button>
          </div>
          <div className="mt-3 space-y-2">
            <InfoNote tone="warn">Reconciliation accounts (stock, GR/IR, vendor, customer, tax) move <b>only</b> through their sub-ledger — a manual line is refused and logged as a security event.</InfoNote>
            <InfoNote tone="ok">Recent journals: {state.journals.slice(0, 3).map((j) => `${j.number} (${fmtINR(j.lines.reduce((t, l) => t + l.dr, 0))})`).join(' · ') || 'none yet'}.</InfoNote>
          </div>
        </div>
      </div>

      <div className="card p-4 grid md:grid-cols-3 gap-4">
        {[
          { icon: ShieldCheck, t: 'Atomic by construction', d: 'Stock leg and accounting leg commit in one transaction. Chaos injection fails between them — the rollback leaves both ledgers untouched and writes a SYSTEM audit entry.' },
          { icon: FlaskConical, t: 'Effective-dated everything', d: 'Tax rates, condition records and info records carry validity dates. Post with a back-dated document date and watch the in-force rate apply — no code change.' },
          { icon: Landmark, t: 'Special G/L & noted items', d: 'Advances (A), retention (R), deposits (S/E) post to alternative reconciliation accounts; guarantees (G) are noted items — in exposure, not in the trial balance.' },
        ].map((c) => (
          <div key={c.t} className="border border-line rounded-lg p-3.5 hover:border-pet/40 transition-colors">
            <c.icon size={16} className="text-acc" />
            <div className="font-disp font-bold text-[13.5px] mt-1.5">{c.t}</div>
            <div className="text-[11.5px] text-mute mt-1 leading-relaxed">{c.d}</div>
          </div>
        ))}
      </div>
      <div className="text-[10.5px] text-mute mono">Company scope for manual JVs: {COMPANIES.map((c) => c.code).join(' · ')} — act as Finance Manager if your current user is refused.</div>
    </div>
  );
}
