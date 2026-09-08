import { useState } from 'react';
import { CheckCheck, Lock, Unlock, ShieldAlert, KeyRound } from 'lucide-react';
import { useStore } from '../store';
import { SectionHead, Tabs, PeriodChip, InfoNote, Modal, Field, Empty, RelChip } from '../components/ui';
import {
  DOC_TYPES, MOVEMENT_TYPES, CONDITION_TYPES, PRICE_PROCEDURE, RELEASE_GROUPS,
  ACCOUNT_DETERMINATION, EVENT_KEY_DESC, GL_ACCOUNTS, ROLES, USERS, AUTH_OBJECTS, SOD_RULES, COMPANIES,
} from '../engine/config';
import { rangeCurrent, signOffClosing, setPeriodStatus, reopenPeriod, assignRole, authorize, userById, fmtInt } from '../engine/engine';
import type { Res, ERPState } from '../engine/types';

export function Configuration() {
  const { state, run } = useStore();
  const [tab, setTab] = useState('dt');
  const [closeFor, setCloseFor] = useState<{ company: string; area: 'FIN' | 'LOG'; to: 'SOFT_CLOSED' | 'HARD_CLOSED' | 'OPEN' } | null>(null);
  const [closeReason, setCloseReason] = useState('');
  const [roleUser, setRoleUser] = useState('USR-REQ');
  const [roleId, setRoleId] = useState('ROLE-STR');
  const [probe, setProbe] = useState({ user: 'USR-BUY', pg: 'PG-CIV', value: 400000 });
  const doProbe = () =>
    run((s: ERPState): Res => {
      const r = authorize(s, probe.user, 'PRC_PO', '43', { purchasingGroup: probe.pg, value: probe.value });
      return {
        s, ok: r.ok, tone: r.ok ? 'ok' : 'bad',
        msg: r.ok
          ? `200 OK · POST /api/prc/po/release — ${userById(probe.user).name} may release POs to ${fmtInt(probe.value)} for ${probe.pg}.`
          : `${r.reason} — the refusal is returned by the service layer and written to the security log.`,
      };
    });

  const tabs = [
    { id: 'dt', label: 'Document Types', n: DOC_TYPES.length },
    { id: 'mv', label: 'Movement Types', n: MOVEMENT_TYPES.length },
    { id: 'pr', label: 'Pricing' },
    { id: 'rel', label: 'Release Strategies' },
    { id: 'nr', label: 'Number Ranges' },
    { id: 'per', label: 'Periods & Closing' },
    { id: 'auth', label: 'Authorization' },
    { id: 'ctl', label: 'Control Accounts' },
  ];

  return (
    <div>
      <Tabs tabs={tabs} val={tab} onChange={setTab} />

      {tab === 'dt' && (
        <div className="card p-4">
          <SectionHead title="Document types — the master control object" sub="Adding a document type is configuration, never a deployment" />
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Code</th><th>Module</th><th>Description</th><th>Number range</th><th>Item categories</th><th>Pricing</th><th>Release</th><th>Posting</th><th>Follow-on</th></tr></thead>
              <tbody>
                {DOC_TYPES.map((d) => (
                  <tr key={d.code}>
                    <td className="mono font-bold text-[11.5px]">{d.code}</td>
                    <td><span className="chip !py-0 bg-pet-soft text-pet border-pet/30">{d.module}</span></td>
                    <td className="text-[12px]">{d.desc}</td>
                    <td className="mono text-[11px]">{d.numberRange}</td>
                    <td className="mono text-[10.5px] text-mute">{d.itemCategories.join(' ')}</td>
                    <td className="mono text-[11px]">{d.pricingProcedure}</td>
                    <td className="mono text-[11px]">{d.releaseGroup ?? '—'}</td>
                    <td><span className={`chip !py-0 !text-[9.5px] ${d.postingBehaviour === 'STOCK' ? 'bg-acc-soft text-acc-deep border-acc/30' : d.postingBehaviour === 'VALUE' ? 'bg-ok-soft text-ok border-ok/30' : ''}`}>{d.postingBehaviour}</span></td>
                    <td className="mono text-[10.5px] text-mute">{d.followOn?.join(' · ') ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'mv' && (
        <div className="card p-4">
          <SectionHead title="Movement type framework" sub="No module writes a stock row directly — every stock change is one of these" />
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Code</th><th>Movement</th><th>Sign</th><th>From → To</th><th>Val.rel</th><th>Modifier</th><th>Debit event</th><th>Credit event</th><th>Required fields</th><th>Reversal</th></tr></thead>
              <tbody>
                {MOVEMENT_TYPES.map((m) => (
                  <tr key={m.code}>
                    <td className="mono font-bold">{m.code}</td>
                    <td className="text-[12px]">{m.desc}</td>
                    <td className={`mono font-bold ${m.sign > 0 ? 'text-ok' : 'text-bad'}`}>{m.sign > 0 ? '+' : '−'}</td>
                    <td className="mono text-[11px]">{m.from ?? '∅'} → {m.to ?? '∅'}</td>
                    <td>{m.valRel ? <span className="chip !py-0 !text-[9.5px] bg-ok-soft text-ok border-ok/30">YES</span> : <span className="chip !py-0 !text-[9.5px]">memo</span>}</td>
                    <td className="mono text-[11px]">{m.modifier}</td>
                    <td className="mono text-[11px] text-pet">{m.drEvent ?? '—'}</td>
                    <td className="mono text-[11px] text-pet">{m.crEvent ?? '—'}</td>
                    <td className="mono text-[10.5px] text-mute">{m.required.join(' · ') || '—'}</td>
                    <td className="mono text-[11px]">{m.reversal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'pr' && (
        <div className="grid xl:grid-cols-2 gap-4">
          <div className="card p-4">
            <SectionHead title="Condition types" sub="A single price element — base, discount, freight, tax, royalty…" />
            <table className="tbl">
              <thead><tr><th>Code</th><th>Description</th><th>Calculation</th><th>Accounting</th></tr></thead>
              <tbody>
                {CONDITION_TYPES.map((c) => (
                  <tr key={c.code}>
                    <td className="mono font-bold text-[11.5px]">{c.code}</td>
                    <td className="text-[12px]">{c.desc}</td>
                    <td className="text-[11.5px] text-mute">{c.calc}</td>
                    <td className="text-[11.5px]">{c.acct}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card p-4">
            <SectionHead title={`Pricing procedure ${PRICE_PROCEDURE.code}`} sub={PRICE_PROCEDURE.desc + ' — ordered schema, bases chain step to step'} />
            <div className="space-y-1">
              {PRICE_PROCEDURE.steps.map((s) => (
                <div key={s.step} className={`flex items-center gap-3 border rounded-md px-3 py-1.5 ${s.code.match(/^(NET0|LND0|GRS0|PAY0)$/) ? 'bg-paper font-bold border-line-2' : 'border-line'}`}>
                  <span className="mono text-[10.5px] text-mute w-7">{s.step}</span>
                  <span className={`chip !py-0 !text-[9.5px] ${s.code.match(/^(CGST|SGST|IGST)$/) ? 'bg-pet-soft text-pet border-pet/30' : s.code === 'TDSI' ? 'bg-warn-soft text-warn border-warn/30' : 'bg-side text-side-tx border-side'}`}>{s.code}</span>
                  <span className="text-[12px]">{s.desc}</span>
                  {'loads' in s && (s as { loads?: boolean }).loads && <span className="ml-auto text-[9.5px] font-bold text-acc-deep uppercase tracking-wider">loads to stock</span>}
                </div>
              ))}
            </div>
            <div className="mt-3"><InfoNote tone="info">Access sequence order: contract item → info record (vendor+material) → vendor+group → group+region → material last price (flagged). The document shows <b>which access produced each rate</b>.</InfoNote></div>
          </div>
        </div>
      )}

      {tab === 'rel' && (
        <div className="grid md:grid-cols-3 gap-4">
          {RELEASE_GROUPS.map((g) => (
            <div key={g.id} className="card p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-disp font-bold text-[14.5px]">{g.id}</h3>
                <span className="chip">{g.desc}</span>
              </div>
              <div className="text-[11px] text-mute mt-1">Characteristic: {g.characteristic}</div>
              <div className="space-y-2.5 mt-3">
                {g.strategies.map((s) => (
                  <div key={s.id} className="border border-line rounded-lg p-2.5 hover:border-acc/40 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="mono font-bold text-[12px]">{s.id}</span>
                      <span className="text-[11px] text-mute">≤ {fmtInt(s.max)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {s.steps.map((st, i) => (
                        <span key={st.code} className="flex items-center gap-1.5">
                          {i > 0 && <span className="text-line-2">→</span>}
                          <span className="chip !py-0.5 bg-pet-soft text-pet border-pet/30">{st.code} {st.title}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="md:col-span-3"><InfoNote tone="warn">Behaviour: determination at submission · value-relevant change resets to step 1 (logged) · approval is version-bound with snapshots · rejection needs a comment and an unchanged resubmission is refused · <b>maker ≠ checker is absolute</b>.</InfoNote></div>
        </div>
      )}

      {tab === 'nr' && (
        <div className="card p-4">
          <SectionHead title="Number ranges" sub="Drawn on successful post — abandoned drafts consume nothing · gapless where statute demands" />
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Object</th><th>Company</th><th>Interval</th><th className="text-right">Current</th><th>Buffer</th><th>Gapless</th><th>External</th></tr></thead>
              <tbody>
                {['PR', 'PO', 'MD', 'IV', 'AC', 'PV', 'PRD'].flatMap((obj) =>
                  COMPANIES.map((c) => {
                    const cur = rangeCurrent(state, obj, c.code);
                    const gapless = ['IV', 'PRD'].includes(obj);
                    return (
                      <tr key={obj + c.code}>
                        <td className="mono font-bold">NR-{obj}</td>
                        <td className="mono text-[11.5px]">{c.code}</td>
                        <td className="mono text-[11px] text-mute">00001 – 99999 · FY running</td>
                        <td className={`num font-bold ${cur > 0 ? 'text-acc-deep' : ''}`}>{cur > 0 ? `${c.code}-${obj}/…/${String(cur).padStart(5, '0')}` : 'untouched'}</td>
                        <td className="mono text-[11px]">25</td>
                        <td>{gapless ? <span className="chip !py-0 !text-[9.5px] bg-bad-soft text-bad border-bad/30">STATUTORY</span> : <span className="chip !py-0 !text-[9.5px]">no</span>}</td>
                        <td className="mono text-[11px] text-mute">no</td>
                      </tr>
                    );
                  }),
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-3"><InfoNote tone="ok">Post a few documents and watch <b>Current</b> advance — sequences are row-locked, never MAX(id)+1. A cancelled statutory invoice keeps its number forever; it is never reissued.</InfoNote></div>
        </div>
      )}

      {tab === 'per' && (
        <div className="grid xl:grid-cols-[1fr_430px] gap-4">
          <div className="card p-4">
            <SectionHead title="Closing cockpit" sub="Ordered checklist — soft close is blocked until every step is signed off" />
            <div className="space-y-1.5">
              {state.closing.map((c) => (
                <div key={c.id} className={`flex items-center gap-3 border rounded-lg px-3 py-2 ${c.done ? 'border-ok/30 bg-ok-soft/50' : 'border-line'}`}>
                  <span className={`w-6 h-6 rounded-full grid place-items-center text-[10px] font-bold ${c.done ? 'bg-ok text-white' : 'bg-line text-mute'}`}>{c.done ? '✓' : c.id.split('-')[1]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-semibold">{c.title}</div>
                    <div className="mono text-[10.5px] text-mute">{c.module} · owner {ROLES.find((r) => r.id === c.ownerRole)?.name}{c.at ? ` · signed ${c.at} by ${userById(c.by!)?.name}` : ''}</div>
                  </div>
                  {!c.done && <button className="btn btn-ok btn-sm" onClick={() => run((s) => signOffClosing(s, c.id, s.userId))}><CheckCheck size={12} /> Sign off</button>}
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3 self-start">
            {COMPANIES.map((c) => (
              <div key={c.code} className="card p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-disp font-bold text-[14px]">{c.code} · {c.name}</h3>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2.5">
                  {(['FIN', 'LOG'] as const).map((area) => {
                    const p = state.periods[c.code][area];
                    return (
                      <div key={area} className="border border-line rounded-lg p-2.5">
                        <div className="flex items-center justify-between"><span className="lbl">{area === 'FIN' ? 'Finance' : 'Logistics'}</span><PeriodChip s={p.status} /></div>
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                          {p.status === 'OPEN' && <button className="btn btn-sm" onClick={() => { setCloseFor({ company: c.code, area, to: 'SOFT_CLOSED' }); setCloseReason(''); }}><Lock size={12} /> Soft close</button>}
                          {p.status === 'SOFT_CLOSED' && <>
                            <button className="btn btn-bad btn-sm" onClick={() => { setCloseFor({ company: c.code, area, to: 'HARD_CLOSED' }); setCloseReason(''); }}><Lock size={12} /> Hard close</button>
                            <button className="btn btn-sm" onClick={() => { setCloseFor({ company: c.code, area, to: 'OPEN' }); setCloseReason(''); }}><Unlock size={12} /> Reopen</button>
                          </>}
                          {p.status === 'HARD_CLOSED' && <button className="btn btn-sm" onClick={() => { setCloseFor({ company: c.code, area, to: 'OPEN' }); setCloseReason(''); }}><Unlock size={12} /> Reopen (audited)</button>}
                        </div>
                        {p.reason && <div className="text-[10.5px] text-mute mt-1.5 italic">"{p.reason}" — {p.by}</div>}
                      </div>
                    );
                  })}
                </div>
                <div className="text-[10.5px] text-mute mt-2">Soft-closed: only FIN_PERIOD_ADJUST holders post, with mandatory reason, flagged on the post-close adjustments report. Hard-closed: nobody posts — not even the top administrator.</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'auth' && (
        <div className="grid xl:grid-cols-2 gap-4">
          <div className="card p-4">
            <SectionHead title="Authorization objects" sub="Structured fields make 'approves POs to ₹10 L for Bhopal only' expressible without code" />
            <div className="space-y-2">
              {AUTH_OBJECTS.map((o) => (
                <div key={o.obj} className="border border-line rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2"><KeyRound size={13} className="text-acc" /><span className="mono font-bold text-[12.5px]">{o.obj}</span></div>
                  <div className="text-[11px] text-mute mt-0.5">Fields: {o.fields.join(' · ')}</div>
                  <div className="text-[10.5px] text-mute">Activities: {o.acts.join(' · ')}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="card p-4">
              <SectionHead title="Grant a role" sub="Segregation-of-duty matrix screens every assignment" />
              <div className="flex gap-2 flex-wrap items-end">
                <Field label="User"><select className="inp !w-[180px]" value={roleUser} onChange={(e) => setRoleUser(e.target.value)}>{USERS.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
                <Field label="Role"><select className="inp !w-[200px]" value={roleId} onChange={(e) => setRoleId(e.target.value)}>{ROLES.filter((r) => r.id !== 'ROLE-ADM').map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
                <button className="btn btn-acc" onClick={() => run((s) => assignRole(s, roleUser, roleId, s.userId))}>Assign</button>
              </div>
              <div className="mt-3">
                <div className="lbl mb-1.5">Conflict matrix</div>
                {SOD_RULES.map((r) => (
                  <div key={r.desc} className="flex items-center gap-2 border border-bad/25 bg-bad-soft/50 rounded-md px-3 py-1.5 text-[11.5px] mb-1.5">
                    <ShieldAlert size={13} className="text-bad shrink-0" />
                    <span><b className="mono">{r.a}</b> ⊗ <b className="mono">{r.b}</b> — {r.desc}</span>
                  </div>
                ))}
                <InfoNote tone="info">Try granting <b>Finance Manager</b> to <b>M. Shaikh (Store Keeper)</b> — goods receipt + invoice posting is toxic and the assignment is refused and reported.</InfoNote>
              </div>
            </div>
            <div className="card p-4">
              <SectionHead title="Direct API probe — PRC_PO / activity 43" sub="The same check the REST layer runs, with field values and a value limit" />
              <div className="flex gap-2 flex-wrap items-end">
                <Field label="User"><select className="inp !w-[150px]" value={probe.user} onChange={(e) => setProbe({ ...probe, user: e.target.value })}>{USERS.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
                <Field label="Purchasing group">
                  <select className="inp !w-[150px]" value={probe.pg} onChange={(e) => setProbe({ ...probe, pg: e.target.value })}>
                    {['PG-CIV', 'PG-MEC', 'PG-GEN', 'PG-XXX'].map((p) => <option key={p}>{p}</option>)}
                  </select>
                </Field>
                <Field label="PO value ₹"><input type="number" className="inp !w-[130px] mono" value={probe.value} onChange={(e) => setProbe({ ...probe, value: +e.target.value })} /></Field>
                <button className="btn btn-dark" onClick={doProbe}>Call authorize()</button>
              </div>
              <div className="text-[10.5px] text-mute mt-2">PG-XXX is outside every grant · Buyer's limit is ₹10 L · refusals increment the security badge in the sidebar and land in the audit trail.</div>
            </div>
            <div className="card p-4">
              <SectionHead title="Roles in this installation" />
              <div className="grid sm:grid-cols-2 gap-2">
                {ROLES.map((r) => (
                  <div key={r.id} className="border border-line rounded-lg px-3 py-2">
                    <div className="mono font-bold text-[12px]">{r.id}</div>
                    <div className="text-[11.5px] text-mute">{r.name}</div>
                    <div className="flex gap-1 flex-wrap mt-1">{r.objects.slice(0, 3).map((o) => <span key={o.obj + o.activities.join('')} className="chip !py-0 !text-[9px]">{o.obj}: {o.activities.join('/')}</span>)}</div>
                    <div className="text-[10px] text-mute mt-1">Held by {USERS.filter((u) => u.roles.includes(r.id)).map((u) => u.name).join(', ') || '—'}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'ctl' && (
        <div className="grid xl:grid-cols-2 gap-4">
          <div className="card p-4">
            <SectionHead title="Reconciliation (control) accounts" sub="Manual journals refused — movement only via sub-ledger" />
            <table className="tbl">
              <thead><tr><th>Account</th><th>Name</th><th>Control type</th></tr></thead>
              <tbody>
                {GL_ACCOUNTS.filter((a) => a.control).map((a) => (
                  <tr key={a.code}>
                    <td className="mono font-bold text-pet">{a.code}</td>
                    <td className="text-[12.5px]">{a.name}</td>
                    <td><span className="chip !py-0 bg-side text-side-tx border-side">{a.control}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card p-4">
            <SectionHead title="Special G/L indicators" sub="Alternative reconciliation accounts and noted items" />
            <table className="tbl">
              <thead><tr><th>Ind.</th><th>Use</th><th>Alternative account</th><th>B/S</th></tr></thead>
              <tbody>
                {[
                  ['A', 'Advance to vendor / mobilisation paid', '120200 Advances to Suppliers', 'posted'],
                  ['M', 'Mobilisation advance received', '210200 Advance from Customers', 'posted'],
                  ['R', 'Retention held / retained', '120300 · 210300 Retention', 'posted'],
                  ['S', 'Security deposit', '120500 Deposits & Security', 'posted'],
                  ['E', 'Earnest money / EMD', '120500 Deposits & Security', 'posted'],
                  ['G', 'Bank guarantee', '— noted item, memo only', 'NOT in B/S'],
                  ['D', 'Down-payment request', '— noted item', 'NOT in B/S'],
                ].map(([i, u, a, b]) => (
                  <tr key={i}>
                    <td><span className="chip bg-acc-soft text-acc-deep border-acc/30 font-bold">{i}</span></td>
                    <td className="text-[12px]">{u}</td>
                    <td className="mono text-[11px]">{a}</td>
                    <td className="text-[11px]">{b === 'posted' ? <span className="text-ok font-semibold">trial balance</span> : <span className="text-warn font-semibold">exposure only</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3"><InfoNote tone="info">Noted items (G, D) appear in ageing and exposure reports but never in the trial balance — both behaviours are built.</InfoNote></div>
          </div>
        </div>
      )}

      {closeFor && (
        <Modal
          open onClose={() => setCloseFor(null)}
          title={`${closeFor.to === 'OPEN' ? 'Reopen' : closeFor.to === 'SOFT_CLOSED' ? 'Soft close' : 'Hard close'} — ${closeFor.company} ${closeFor.area}`}
          sub={closeFor.to === 'OPEN' ? 'Reopening is itself an approved, audited document' : 'Reason is mandatory and lands in the audit trail'}
          footer={<>
            <button className="btn" onClick={() => setCloseFor(null)}>Cancel</button>
            <button className="btn btn-acc" onClick={() => {
              run((s) => closeFor.to === 'OPEN'
                ? reopenPeriod(s, closeFor.company, closeFor.area, closeReason, s.userId)
                : setPeriodStatus(s, closeFor.company, closeFor.area, closeFor.to, closeReason, s.userId));
              setCloseFor(null);
            }}>{closeFor.to === 'OPEN' ? 'Reopen with audit doc' : 'Close period'}</button>
          </>}
        >
          <Field label="Reason (mandatory)" req>
            <input className="inp" value={closeReason} onChange={(e) => setCloseReason(e.target.value)} placeholder={closeFor.to === 'OPEN' ? 'e.g. statutory audit adjustment directed by auditor ref…' : 'e.g. month-end close — all checklist steps signed'} />
          </Field>
          {closeFor.to === 'HARD_CLOSED' && <div className="mt-2"><InfoNote tone="bad">After hard close, <b>no posting by any user including the system administrator</b>. Try it: close, then attempt a movement in the simulator.</InfoNote></div>}
        </Modal>
      )}
    </div>
  );
}
