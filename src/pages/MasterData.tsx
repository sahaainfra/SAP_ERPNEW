import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Ban, CheckCheck, History, Lock, ShieldAlert, Building, UserRound } from 'lucide-react';
import { useStore } from '../store';
import { SectionHead, Tabs, MasterChip, Modal, Field, InfoNote, KV, Empty } from '../components/ui';
import { MATERIALS, PARTNERS, MATERIAL_GROUPS, STATE_NAMES } from '../engine/config';
import {
  createMaterial, approveMaster, blockMaster, createPartner, proposeChange, approveChange,
  userById, fmtINR,
} from '../engine/engine';

const ALL_VIEWS = ['Basic', 'Purchasing', 'Inventory', 'Valuation', 'Quality', 'Planning', 'Costing', 'Site'];

export function MasterData() {
  const { state, run } = useStore();
  const [tab, setTab] = useState('mat');
  const [selMat, setSelMat] = useState<string | null>('MAT-C53');
  const [selBp, setSelBp] = useState<string | null>('BP-SHREE');
  const [showNewMat, setShowNewMat] = useState(false);
  const [showNewBp, setShowNewBp] = useState(false);

  const mat = MATERIALS.find((m) => m.code === selMat) ?? null;
  const bp = PARTNERS.find((p) => p.id === selBp) ?? null;
  const pendingMasters = [...MATERIALS.filter((m) => m.status === 'PENDING').map((m) => ({ key: m.code, name: m.desc, kind: 'material' as const })),
    ...PARTNERS.filter((p) => p.status === 'PENDING').map((p) => ({ key: p.id, name: p.name, kind: 'partner' as const }))];
  const myChanges = state.changes.filter((c) => c.status === 'PENDING');

  return (
    <div>
      <Tabs
        tabs={[
          { id: 'mat', label: 'Materials', n: MATERIALS.length },
          { id: 'bp', label: 'Business Partners', n: PARTNERS.length },
          { id: 'gov', label: 'Governance Queue', n: pendingMasters.length + myChanges.length },
        ]}
        val={tab} onChange={setTab}
      />

      {tab === 'mat' && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_430px] gap-4">
          <div className="card p-4">
            <SectionHead title="Material master" sub="One record, many view segments — never a copy per module" right={<button className="btn btn-acc btn-sm" onClick={() => setShowNewMat(true)}><Plus size={13} /> Create</button>} />
            <table className="tbl">
              <thead><tr><th>Code</th><th>Description</th><th>Group</th><th>UOM</th><th className="text-right">MAP ₹</th><th>Views</th><th>Status</th></tr></thead>
              <tbody>
                {MATERIALS.map((m) => (
                  <tr key={m.code} onClick={() => setSelMat(m.code)} className={`cursor-pointer ${selMat === m.code ? 'is-sel' : ''}`}>
                    <td className="mono font-bold text-[12px]">{m.code}</td>
                    <td className="text-[12.5px]">{m.desc}</td>
                    <td className="mono text-[11px] text-mute">{m.group}</td>
                    <td className="mono text-[11px]">{m.baseUom}</td>
                    <td className="num">{fmtINR(m.price)}</td>
                    <td><span className={`chip !py-0 !text-[9.5px] ${m.views.length >= 6 ? 'bg-ok-soft text-ok border-ok/30' : 'bg-warn-soft text-warn border-warn/30'}`}>{m.views.length}/8</span></td>
                    <td><MasterChip s={m.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {mat && (
            <div className="space-y-3 self-start">
              <motion.div key={mat.code} className="card p-4 fade-up">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="mono text-[11px] text-mute">{mat.code} · account group {mat.accountGroup}</div>
                    <h3 className="font-disp font-bold text-[15.5px] leading-tight mt-0.5">{mat.desc}</h3>
                    <div className="text-[11.5px] text-mute">{mat.spec}</div>
                  </div>
                  <MasterChip s={mat.status} />
                </div>
                <div className="lbl mt-4 mb-1.5">View segments</div>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_VIEWS.map((v) => {
                    const has = mat.views.includes(v);
                    return <span key={v} className={`chip ${has ? 'bg-pet-soft text-pet border-pet/30' : 'border-dashed text-mute'}`}>{has ? '✓' : '○'} {v}</span>;
                  })}
                </div>
                {(!mat.views.includes('Purchasing') || !mat.views.includes('Valuation')) && (
                  <div className="mt-2.5"><InfoNote tone="warn">Cannot be purchased: <b>Purchasing</b> and <b>Valuation</b> views are mandatory before procurement. Try requisitioning it — the engine refuses.</InfoNote></div>
                )}
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <KV k="Material group" v={mat.group} />
                  <KV k="Base UOM" v={mat.baseUom + (mat.altUom ? ` (alt ${mat.altUom} ×${mat.conv})` : '')} />
                  <KV k="HSN" v={mat.hsn} />
                  <KV k="Price control" v={mat.priceControl === 'MAP' ? 'Moving average' : 'Standard'} />
                  <KV k="Valuation class" v={mat.valuationClass} />
                  <KV k="Current price" v={fmtINR(mat.price)} />
                  <KV k="ITC eligibility" v={mat.itc.replace(/_/g, ' ')} />
                  <KV k="Royalty bearing" v={mat.royalty ? 'Yes' : 'No'} />
                </div>
                <div className="flex gap-2 mt-4">
                  <button className="btn btn-sm" onClick={() => run((s) => blockMaster(s, mat.code, 'material', 'Blocked from stores terminal — pending review', s.userId))}>
                    <Ban size={13} /> {mat.status === 'BLOCKED' ? 'Unblock' : 'Block'}
                  </button>
                  {mat.status === 'PENDING' && (
                    <button className="btn btn-ok btn-sm" onClick={() => run((s) => approveMaster(s, mat.code, 'material', s.userId))}><CheckCheck size={13} /> Approve (MDG)</button>
                  )}
                  <button className="btn btn-sm" onClick={() => run((s) => proposeChange(s, { object: 'MATERIAL', key: mat.code, field: 'valuationClass', oldV: mat.valuationClass, newV: mat.valuationClass === 'VC-RAW' ? 'VC-CONS' : 'VC-RAW', reason: 'Reclassification after usage-pattern review in closing' }, s.userId))}>
                    <ShieldAlert size={13} /> Propose valuation-class change
                  </button>
                </div>
                <p className="text-[10.5px] text-mute mt-2">Valuation class and price control are dual-control fields — a change needs Finance + Internal Audit, proposer excluded, with a mandatory reason.</p>
              </motion.div>

              <div className="card p-4">
                <div className="lbl mb-2 flex items-center gap-1.5"><History size={12} /> Change documents — this material</div>
                {state.audit.filter((a) => (a.object === 'MATERIAL' || a.object === 'MATERIAL_BANK') && a.key === mat.code).length === 0 && <Empty text="No field-level changes on record." />}
                <div className="space-y-1.5">
                  {state.audit.filter((a) => a.object === 'MATERIAL' && a.key === mat.code).slice(0, 6).map((a) => (
                    <div key={a.id} className="border border-line rounded-md px-2.5 py-1.5 text-[11.5px]">
                      <span className="mono font-bold">{a.field ?? a.object}</span>{a.oldV !== undefined && <span className="text-mute"> · {a.oldV} → </span>}{a.newV && <b>{a.newV}</b>}
                      <div className="text-[10.5px] text-mute">{a.at} · {userById(a.user)?.name} {a.reason ? `· ${a.reason}` : ''}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'bp' && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_430px] gap-4">
          <div className="card p-4">
            <SectionHead title="Business partners" sub="One partner object, several roles — vendor and subcontractor and client at once" right={<button className="btn btn-acc btn-sm" onClick={() => setShowNewBp(true)}><Plus size={13} /> Create</button>} />
            <table className="tbl">
              <thead><tr><th>ID</th><th>Name</th><th>Roles</th><th>State</th><th>PAN</th><th>Rating</th><th>Status</th></tr></thead>
              <tbody>
                {PARTNERS.map((p) => (
                  <tr key={p.id} onClick={() => setSelBp(p.id)} className={`cursor-pointer ${selBp === p.id ? 'is-sel' : ''}`}>
                    <td className="mono font-bold text-[12px]">{p.id}</td>
                    <td className="text-[12.5px]">{p.name}</td>
                    <td><div className="flex gap-1 flex-wrap">{p.roles.map((r) => <span key={r} className="chip !py-0 !text-[9.5px] bg-pet-soft text-pet border-pet/30">{r}</span>)}</div></td>
                    <td className="mono text-[11px]">{p.state}</td>
                    <td className="mono text-[11px] text-mute">{p.pan}</td>
                    <td>
                      <div className="flex items-center gap-1.5"><div className="w-12 h-1.5 rounded bg-line overflow-hidden"><div className="h-full bg-pet" style={{ width: `${p.rating}%` }} /></div><span className="mono text-[10.5px] text-mute">{p.rating}</span></div>
                    </td>
                    <td><MasterChip s={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {bp && (
            <div className="space-y-3 self-start">
              <motion.div key={bp.id} className="card p-4 fade-up">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="mono text-[11px] text-mute">{bp.id} · {bp.accountGroup}</div>
                    <h3 className="font-disp font-bold text-[15.5px] leading-tight mt-0.5 flex items-center gap-2">{bp.roles.includes('CLIENT') ? <Building size={15} className="text-pet" /> : <UserRound size={15} className="text-acc" />}{bp.name}</h3>
                    <div className="text-[11.5px] text-mute">{bp.legalName}</div>
                  </div>
                  <MasterChip s={bp.status} />
                </div>
                {state.freeze[bp.id] && (
                  <div className="mt-3"><InfoNote tone="bad"><b>Payment freeze active until {state.freeze[bp.id]}.</b> Bank-detail change control: dual approval granted, 48 h cooling period armed, Finance & Internal Audit notified. Payments are refused meanwhile.</InfoNote></div>
                )}
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <KV k="PAN" v={bp.pan} />
                  <KV k="Registration" v={bp.regType} />
                  <KV k="Home state" v={`${bp.stateName} (${bp.state})`} />
                  <KV k="TDS section" v={`${bp.tdsSection} · ${bp.tdsPct}%`} />
                  <KV k="Recon account" v={bp.reconAccount} />
                  <KV k="MSME / Udyam" v={bp.msme ? 'Registered' : 'No'} />
                </div>
                <div className="lbl mt-4 mb-1.5">GSTIN by state</div>
                <div className="space-y-1">
                  {bp.gstin.map((g) => (
                    <div key={g.state} className="flex items-center justify-between border border-line rounded-md px-2.5 py-1.5">
                      <span className="text-[12px] font-semibold">{STATE_NAMES[g.state] ?? g.state}</span>
                      <span className="mono text-[11.5px]">{g.no}</span>
                    </div>
                  ))}
                </div>
                <div className="lbl mt-4 mb-1.5 flex items-center gap-1.5"><Lock size={11} /> Bank details — info-group protected</div>
                {canSeeBank(state.userId) ? (
                  <div className="border border-line rounded-lg p-3 bg-paper/50">
                    <div className="grid grid-cols-2 gap-3">
                      <KV k="Bank" v={bp.bank.bankName} mono={false} />
                      <KV k="Account" v={bp.bank.acct} />
                      <KV k="IFSC" v={bp.bank.ifsc} />
                    </div>
                    <button className="btn btn-bad btn-sm mt-3" onClick={() => run((s) => proposeChange(s, { object: 'PARTNER_BANK', key: bp.id, field: 'bank', oldV: `${bp.bank.bankName}|${bp.bank.acct}|${bp.bank.ifsc}`, newV: `${bp.bank.bankName}|${String(Math.floor(Math.random() * 9e9) + 1e9)}|${bp.bank.ifsc}`, reason: 'Vendor requested account migration — letter on file ref VD/' + Math.floor(Math.random() * 900 + 100), freezePartnerId: bp.id }, s.userId))}>
                      <ShieldAlert size={13} /> Propose bank change (dual control)
                    </button>
                    <p className="text-[10.5px] text-mute mt-1.5">Controlled event: dual approval → automatic payment freeze → notification. The primary payment-fraud vector in the industry.</p>
                  </div>
                ) : (
                  <InfoNote tone="warn">Absent from your API payload — bank fields are stripped server-side for your role, not hidden by CSS. Act as Finance Manager or Internal Auditor to view.</InfoNote>
                )}
                <div className="flex gap-2 mt-4">
                  <button className="btn btn-sm" onClick={() => run((s) => blockMaster(s, bp.id, 'partner', 'Compliance documents expired', s.userId))}>
                    <Ban size={13} /> {bp.status === 'BLOCKED' ? 'Unblock' : 'Block'}
                  </button>
                  {bp.status === 'PENDING' && <button className="btn btn-ok btn-sm" onClick={() => run((s) => approveMaster(s, bp.id, 'partner', s.userId))}><CheckCheck size={13} /> Approve</button>}
                </div>
              </motion.div>
            </div>
          )}
        </div>
      )}

      {tab === 'gov' && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="card p-4">
            <SectionHead title="Masters awaiting governance approval" sub="Create → Review → Approve → Active" />
            {pendingMasters.length === 0 && <Empty text="Queue clear — everything is approved and active." />}
            <div className="space-y-2">
              {pendingMasters.map((m) => (
                <div key={m.kind + m.key} className="flex items-center justify-between border border-warn/30 bg-warn-soft rounded-lg px-3 py-2.5">
                  <div>
                    <div className="mono font-bold text-[12.5px]">{m.key}</div>
                    <div className="text-[11.5px] text-mute">{m.name} · {m.kind}</div>
                  </div>
                  <button className="btn btn-ok btn-sm" onClick={() => run((s) => approveMaster(s, m.key, m.kind, s.userId))}><CheckCheck size={13} /> Approve</button>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-4">
            <SectionHead title="Dual-control change requests" sub="Two distinct approvers, proposer excluded" />
            {state.changes.length === 0 && <Empty text="No change requests raised yet. Try proposing a valuation-class or bank change." />}
            <div className="space-y-2">
              {state.changes.slice(0, 8).map((c) => (
                <div key={c.id} className={`border rounded-lg px-3 py-2.5 ${c.status === 'PENDING' ? 'border-acc/40 bg-acc-soft/50' : c.status === 'APPROVED' ? 'border-ok/30 bg-ok-soft/50' : 'border-bad/30 bg-bad-soft'}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="chip bg-side text-side-tx border-side">{c.object}</span>
                    <span className="mono font-bold text-[12px]">{c.key}</span>
                    <span className="chip">{c.field}</span>
                    <span className={`chip ml-auto ${c.status === 'PENDING' ? 'bg-warn-soft text-warn' : c.status === 'APPROVED' ? 'bg-ok-soft text-ok' : 'bg-bad-soft text-bad'}`}>{c.status}</span>
                  </div>
                  <div className="mono text-[11px] text-mute mt-1.5 truncate">{c.oldV} → <b className="text-ink">{c.newV}</b></div>
                  <div className="text-[11px] text-mute mt-0.5">Reason: {c.reason}</div>
                  <div className="text-[10.5px] text-mute">Proposer {userById(c.proposer)?.name} · approvals {c.approvals.map((a) => userById(a.user)?.name).join(', ') || '—'} ({c.approvals.length}/{c.needed})</div>
                  {c.status === 'PENDING' && (
                    <button className="btn btn-ok btn-sm mt-2" onClick={() => run((s) => approveChange(s, c.id, s.userId))}><CheckCheck size={13} /> Approve ({c.approvals.length + 1}/{c.needed})</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <NewMaterialModal open={showNewMat} onClose={() => setShowNewMat(false)} />
      <NewPartnerModal open={showNewBp} onClose={() => setShowNewBp(false)} />
    </div>
  );
}

function canSeeBank(userId: string): boolean {
  return ['USR-FIN', 'USR-IA', 'USR-ADM', 'USR-CFO'].includes(userId);
}

function NewMaterialModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { run } = useStore();
  const [f, setF] = useState({ code: 'MAT-GT2', desc: 'Geotextile Woven 200', group: 'MG-GEO', baseUom: 'SQM', hsn: '5603', valuationClass: 'VC-RAW', price: 118, withPurchasing: true, withValuation: true });
  return (
    <Modal open={open} onClose={onClose} title="Create material master" sub="Starts in PENDING — governance approval activates it"
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-acc" onClick={() => { run((s) => createMaterial(s, { ...f, priceControl: 'MAP' }, s.userId)); onClose(); }}>Create</button>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Code" req><input className="inp mono" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} /></Field>
        <Field label="Description" req><input className="inp" value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} /></Field>
        <Field label="Material group">
          <select className="inp" value={f.group} onChange={(e) => setF({ ...f, group: e.target.value })}>
            {MATERIAL_GROUPS.map((g) => <option key={g.code} value={g.code}>{g.code} · {g.name}</option>)}
          </select>
        </Field>
        <Field label="Base UOM"><input className="inp mono" value={f.baseUom} onChange={(e) => setF({ ...f, baseUom: e.target.value.toUpperCase() })} /></Field>
        <Field label="HSN"><input className="inp mono" value={f.hsn} onChange={(e) => setF({ ...f, hsn: e.target.value })} /></Field>
        <Field label="Valuation class">
          <select className="inp mono" value={f.valuationClass} onChange={(e) => setF({ ...f, valuationClass: e.target.value })}>
            {['VC-RAW', 'VC-CONS', 'VC-FUEL', 'VC-SEMI', 'VC-SERV'].map((v) => <option key={v}>{v}</option>)}
          </select>
        </Field>
        <Field label="Initial price ₹"><input type="number" className="inp mono" value={f.price} onChange={(e) => setF({ ...f, price: +e.target.value })} /></Field>
        <div className="space-y-2 pt-1">
          <label className="flex items-center gap-2 text-[12.5px]"><input type="checkbox" checked={f.withPurchasing} onChange={(e) => setF({ ...f, withPurchasing: e.target.checked })} /> Maintain Purchasing view</label>
          <label className="flex items-center gap-2 text-[12.5px]"><input type="checkbox" checked={f.withValuation} onChange={(e) => setF({ ...f, withValuation: e.target.checked })} /> Maintain Valuation view</label>
        </div>
      </div>
      <div className="mt-3"><InfoNote tone="info">Fuzzy duplicate check runs on description + material group. Uncheck both views to reproduce the "Basic-only material cannot be purchased" rule.</InfoNote></div>
    </Modal>
  );
}

function NewPartnerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { run } = useStore();
  const [f, setF] = useState({ id: 'BP-NEW1', name: 'Nova Traders', pan: 'AAJPN1123X', gstin: '27AAJPN1123X1ZB', state: 'MH', roles: 'VENDOR', overrideReason: '' });
  return (
    <Modal open={open} onClose={onClose} title="Create business partner" sub="Duplicate prevention on PAN + fuzzy name"
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-acc" onClick={() => { run((s) => createPartner(s, { ...f, roles: f.roles.split(',').map((x) => x.trim()) }, s.userId)); onClose(); }}>Create</button>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Partner ID" req><input className="inp mono" value={f.id} onChange={(e) => setF({ ...f, id: e.target.value.toUpperCase() })} /></Field>
        <Field label="Name" req><input className="inp" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="PAN" req hint="Try AABFS9921L to hit duplicate prevention"><input className="inp mono" value={f.pan} onChange={(e) => setF({ ...f, pan: e.target.value.toUpperCase() })} /></Field>
        <Field label="GSTIN"><input className="inp mono" value={f.gstin} onChange={(e) => setF({ ...f, gstin: e.target.value.toUpperCase() })} /></Field>
        <Field label="State">
          <select className="inp" value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })}>{Object.keys(STATE_NAMES).map((k) => <option key={k}>{k}</option>)}</select>
        </Field>
        <Field label="Roles (comma-sep)"><input className="inp mono" value={f.roles} onChange={(e) => setF({ ...f, roles: e.target.value.toUpperCase() })} /></Field>
        <div className="col-span-2"><Field label="Override reason (only needed when duplicates are flagged)"><input className="inp" value={f.overrideReason} onChange={(e) => setF({ ...f, overrideReason: e.target.value })} /></Field></div>
      </div>
      <div className="mt-3"><InfoNote tone="warn">A matching PAN blocks creation outright unless an override reason (min 8 chars) is given — every override is logged to the audit trail.</InfoNote></div>
    </Modal>
  );
}


