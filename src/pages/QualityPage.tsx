import { useMemo, useState } from 'react';
import { ShieldCheck, FlaskConical, FileWarning, ListChecks, CheckCircle2, XCircle, RefreshCw, Timer } from 'lucide-react';
import { useStore } from '../store';
import { SectionHead, Field, Modal, Empty, Tabs, useCountUp } from '../components/ui';
import { fmtNum } from '../engine/engine';
import { QUALITY_CONFIG, ITP_SEED, TEST_EQUIPMENT, WELDERS } from '../engine/config';
import { usageDecision, recordTest, advanceNcr, raiseNcr, firstPassYield, cubePassRate, ncrAgeing } from '../engine/qms';
import type { InspectionLot } from '../engine/types';

function Num({ label, value, suffix = '%', tone = 'ink' }: { label: string; value: number; suffix?: string; tone?: string }) {
  const v = useCountUp(value);
  const c = tone === 'ok' ? 'text-ok' : tone === 'warn' ? 'text-warn' : tone === 'acc' ? 'text-acc-deep' : 'text-ink';
  return (
    <div className="card p-4 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-pet to-transparent opacity-70" />
      <div className="lbl">{label}</div>
      <div className={`font-disp font-extrabold text-[22px] tracking-tight mt-1.5 mono ${c}`}>{Math.round(v)}{suffix}</div>
    </div>
  );
}

const LOT_CHIP: Record<string, string> = {
  OPEN: 'text-warn bg-warn-soft border-warn/30',
  ACCEPTED: 'text-ok bg-ok-soft border-ok/30',
  REJECTED: 'text-bad bg-bad-soft border-bad/30',
  REWORK: 'text-acc-deep bg-acc-soft border-acc/40',
};

export function QualityPage() {
  const { state, run } = useStore();
  const [tab, setTab] = useState('lots');
  const [decide, setDecide] = useState<InspectionLot | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const [ncrOpen, setNcrOpen] = useState(false);

  const fpy = useMemo(() => firstPassYield(state), [state]);
  const cube = useMemo(() => cubePassRate(state), [state]);
  const ageing = useMemo(() => ncrAgeing(state), [state]);
  const openLots = state.inspLots.filter((l) => l.status === 'OPEN');

  return (
    <div className="space-y-4 fade-up">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-lg bg-pet text-white grid place-items-center"><ShieldCheck size={18} /></span>
            <h1 className="font-disp font-extrabold text-[24px] tracking-tight">Quality Management</h1>
            <span className="chip">QMS</span>
          </div>
          <p className="text-[12.5px] text-mute mt-1.5 max-w-2xl">
            Inspection lots raised automatically at goods receipt; stock leaves quality hold <em>only</em> via a usage decision
            (movement 102 / 103). Test entry is interlocked on calibration and welder qualification; a failed 28-day cube
            auto-raises a linked non-conformance.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-acc" onClick={() => setTestOpen(true)}><FlaskConical size={14} /> Record test</button>
          <button className="btn" onClick={() => setNcrOpen(true)}><FileWarning size={14} /> Raise NCR</button>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Num label="First-pass yield" value={fpy} tone="ok" />
        <Num label="28-day cube pass rate" value={cube} tone={cube >= 90 ? 'ok' : 'warn'} />
        <Num label="Open inspection lots" value={openLots.length} suffix="" tone="acc" />
        <Num label="Open NCRs" value={ageing.length} suffix="" tone={ageing.length ? 'warn' : 'ink'} />
      </div>

      <Tabs val={tab} onChange={setTab} tabs={[
        { id: 'lots', label: 'Inspection Lots', n: openLots.length },
        { id: 'tests', label: 'Test Results', n: state.tests.length },
        { id: 'ncr', label: 'Non-Conformance', n: ageing.length },
        { id: 'itp', label: 'ITP & Interlocks' },
      ]} />

      {tab === 'lots' && (
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Lot</th><th>Type</th><th>Material</th><th className="num">Qty</th><th>Site</th><th>GR / Source</th><th>Status</th><th /></tr></thead>
            <tbody>
              {state.inspLots.map((l) => (
                <tr key={l.id}>
                  <td className="mono text-[11.5px] font-semibold">{l.number}</td>
                  <td><span className="chip">{l.type}</span></td>
                  <td>{l.materialCode}</td>
                  <td className="num">{fmtNum(l.qty, 1)}</td>
                  <td className="text-[12px]">{l.siteId}</td>
                  <td className="mono text-[11px] text-mute">{state.docs.find((d) => d.id === l.grDocId)?.number ?? '—'}</td>
                  <td><span className={`chip ${LOT_CHIP[l.status]}`}>{l.status}</span></td>
                  <td>{l.status === 'OPEN' && <button className="btn btn-sm btn-acc" onClick={() => setDecide(l)}>Usage decision</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {state.inspLots.length === 0 && <Empty text="No inspection lots — receipt of an inspection-flagged material creates one." />}
        </div>
      )}

      {tab === 'tests' && (
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Kind</th><th>Material / Grade</th><th className="num">Age</th><th className="num">Result</th><th>Spec</th><th>Batch / Pour</th><th>Instrument</th><th>Outcome</th></tr></thead>
            <tbody>
              {state.tests.map((t) => (
                <tr key={t.id}>
                  <td><span className="chip">{t.kind}</span></td>
                  <td>{t.material} · {t.grade}</td>
                  <td className="num">{t.ageDays ? `${t.ageDays} d` : '—'}</td>
                  <td className="num font-semibold">{t.value}</td>
                  <td className="text-[12px]">{t.spec}</td>
                  <td className="mono text-[11px] text-mute">{[t.batch, t.pourLoc].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="text-[12px]">{t.equipId ?? '—'}</td>
                  <td>{t.pass ? <span className="chip text-ok bg-ok-soft border-ok/30"><CheckCircle2 size={12} /> PASS</span> : <span className="chip text-bad bg-bad-soft border-bad/30"><XCircle size={12} /> FAIL</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {state.tests.length === 0 && <Empty text="No test results recorded." />}
        </div>
      )}

      {tab === 'ncr' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="card overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>NCR</th><th>Severity</th><th>Status</th><th className="num">Age</th><th className="num">Cost</th><th /></tr></thead>
              <tbody>
                {ageing.map((n) => (
                  <tr key={n.id}>
                    <td><div className="mono text-[11.5px] font-semibold">{n.number}</div><div className="text-[10.5px] text-mute max-w-[220px] truncate">{n.title}</div></td>
                    <td><span className={`chip ${n.severity === 'CRITICAL' ? 'text-bad bg-bad-soft border-bad/30' : n.severity === 'MAJOR' ? 'text-warn bg-warn-soft border-warn/30' : ''}`}>{n.severity}</span></td>
                    <td className="text-[11.5px]">{n.status}</td>
                    <td className={`num ${n.overdue ? 'text-bad font-bold' : ''}`}>{n.age} d{n.overdue && ' ⚠'}</td>
                    <td className="num">{fmtNum(n.cost, 0)}</td>
                    <td>{n.status !== 'CLOSED' && <button className="btn btn-sm" onClick={() => run((s) => advanceNcr(s, n.id, s.userId))}>Advance</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ageing.length === 0 && <Empty text="No open non-conformances." />}
          </div>
          <div className="card p-4">
            <SectionHead title="NCR workflow" sub="RAISED → ASSIGNED → ROOT CAUSE → CORRECTIVE → PREVENTIVE → VERIFICATION → CLOSED" />
            <div className="flex flex-wrap gap-1.5 mt-3">
              {['RAISED', 'ASSIGNED', 'ROOT_CAUSE', 'CORRECTIVE', 'PREVENTIVE', 'VERIFICATION', 'CLOSED'].map((s, i) => (
                <span key={s} className="chip">{i + 1}. {s}</span>
              ))}
            </div>
            <div className="mt-4 text-[12px] text-mute leading-relaxed">
              Ageing and SLA breach escalate automatically. Where the cause is supplied material, the NCR links to the vendor
              rating; a failed 28-day cube is linked to the pour, batch, delivery challan and the measurement entry.
            </div>
          </div>
        </div>
      )}

      {tab === 'itp' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="card p-4">
            <SectionHead title="Inspection & Test Plan" sub="Characteristics, frequency and hold / witness points per activity" />
            <div className="space-y-3 mt-3">
              {ITP_SEED.map((p) => (
                <div key={p.activity} className="rounded-lg border border-line p-3">
                  <div className="flex items-center gap-2"><ListChecks size={15} className="text-pet" /><span className="font-semibold text-[13px]">{p.activity}</span><span className="chip ml-auto">{p.spec}</span></div>
                  <div className="text-[11.5px] text-mute mt-1.5">{p.characteristics.join(' · ')}</div>
                  <div className="text-[11px] mt-1"><span className="text-pet font-semibold">{p.frequency}</span> — {p.points}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="card p-4">
              <SectionHead title="Calibration interlock" sub="Expired instruments cannot record results" />
              <div className="space-y-1.5 mt-2">
                {TEST_EQUIPMENT.map((e) => {
                  const exp = state.today > e.validTo;
                  return <div key={e.id} className={`flex items-center justify-between text-[12px] rounded-md border px-2.5 py-1.5 ${exp ? 'border-bad/40 bg-bad-soft' : 'border-line'}`}><span>{e.name}</span><span className={`mono text-[11px] ${exp ? 'text-bad font-bold' : 'text-mute'}`}>{exp ? 'EXPIRED' : e.validTo}</span></div>;
                })}
              </div>
            </div>
            <div className="card p-4">
              <SectionHead title="Welder qualification" sub="Lapsed welders cannot be assigned to NDT-critical joints" />
              <div className="space-y-1.5 mt-2">
                {WELDERS.map((w) => {
                  const exp = state.today > w.qualValidTo;
                  return <div key={w.id} className={`flex items-center justify-between text-[12px] rounded-md border px-2.5 py-1.5 ${exp ? 'border-bad/40 bg-bad-soft' : 'border-line'}`}><span>{w.name}</span><span className={`mono text-[11px] ${exp ? 'text-bad font-bold' : 'text-mute'}`}>{exp ? 'LAPSED' : w.qualValidTo}</span></div>;
                })}
              </div>
            </div>
            <div className="card p-4">
              <SectionHead title="Materials under inspection" sub="From the material master Quality view" />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {Object.entries(QUALITY_CONFIG).filter(([, v]) => v.insp).map(([m, v]) => <span key={m} className="chip">{m} · {v.type}</span>)}
              </div>
            </div>
          </div>
        </div>
      )}

      <DecisionModal lot={decide} onClose={() => setDecide(null)} />
      <TestModal open={testOpen} onClose={() => setTestOpen(false)} />
      <NcrModal open={ncrOpen} onClose={() => setNcrOpen(false)} />
    </div>
  );
}

function DecisionModal({ lot, onClose }: { lot: InspectionLot | null; onClose: () => void }) {
  const { run } = useStore();
  const [comment, setComment] = useState('');
  if (!lot) return null;
  return (
    <Modal open onClose={onClose} title={`Usage decision — ${lot.number}`} sub="The only route out of quality hold. Accept posts 102 (→ unrestricted); reject posts 103 (→ blocked)."
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-bad" onClick={() => { run((s) => usageDecision(s, lot.id, 'REJECT', s.userId, comment || 'Non-conforming')); onClose(); }}><XCircle size={14} /> Reject (103)</button>
        <button className="btn btn-ok" onClick={() => { run((s) => usageDecision(s, lot.id, 'ACCEPT', s.userId, comment)); onClose(); }}><CheckCircle2 size={14} /> Accept (102)</button>
      </>}>
      <div className="text-[12.5px] mb-3">Lot <b>{lot.number}</b> · {lot.materialCode} · {fmtNum(lot.qty, 1)} at {lot.siteId}, held since {lot.atCreated.slice(0, 10)}.</div>
      <Field label="Decision comment" hint="Mandatory for rejection / deviation"><textarea className="inp" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} /></Field>
      <div className="mt-2"><button className="btn btn-sm" onClick={() => { run((s) => usageDecision(s, lot.id, 'REWORK', s.userId, comment)); onClose(); }}><RefreshCw size={13} /> Mark for rework (stays in hold)</button></div>
    </Modal>
  );
}

function TestModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, run } = useStore();
  const [kind, setKind] = useState<'CUBE' | 'STEEL' | 'AGG' | 'SOIL' | 'BITUMEN'>('CUBE');
  const [value, setValue] = useState(26.8); const [age, setAge] = useState(28);
  const [pass, setPass] = useState(true); const [equip, setEquip] = useState('TE-CTM'); const [welder, setWelder] = useState('');
  const [batch, setBatch] = useState('B-1201'); const [pour, setPour] = useState('Deck slab D2');
  return (
    <Modal open={open} onClose={onClose} title="Record test result" sub="Blocked if the instrument calibration or welder qualification has lapsed" wide
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-acc" onClick={() => { run((s) => recordTest(s, { kind, material: kind === 'CUBE' ? 'MAT-RMC25' : kind === 'STEEL' ? 'MAT-STL16' : 'MAT-AGG20', grade: kind === 'CUBE' ? 'M25' : kind === 'STEEL' ? 'Fe500D' : '20 mm', ageDays: kind === 'CUBE' ? age : undefined, value, spec: kind === 'CUBE' ? '≥ 25 MPa' : kind === 'STEEL' ? '≥ 500 MPa yield' : 'gradation Zone II', pass, batch: kind === 'CUBE' ? batch : undefined, pourLoc: kind === 'CUBE' ? pour : undefined, challan: kind === 'CUBE' ? 'DC-3340' : undefined, equipId: equip || undefined, welderId: welder || undefined }, s.userId)); onClose(); }}>Record result</button>
      </>}>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Test kind"><select className="inp" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}><option value="CUBE">Concrete cube</option><option value="STEEL">Steel tensile</option><option value="AGG">Aggregate</option><option value="SOIL">Soil (CBR)</option><option value="BITUMEN">Bitumen / mix</option></select></Field>
        <Field label="Result value"><input type="number" className="inp mono" value={value} onChange={(e) => setValue(+e.target.value)} /></Field>
        {kind === 'CUBE' && <Field label="Age (days)"><select className="inp" value={age} onChange={(e) => setAge(+e.target.value)}><option value={7}>7</option><option value={14}>14</option><option value={28}>28</option></select></Field>}
        <Field label="Outcome"><select className="inp" value={pass ? '1' : '0'} onChange={(e) => setPass(e.target.value === '1')}><option value="1">PASS</option><option value="0">FAIL</option></select></Field>
        <Field label="Test instrument"><select className="inp" value={equip} onChange={(e) => setEquip(e.target.value)}>{TEST_EQUIPMENT.map((e) => <option key={e.id} value={e.id}>{e.name}{state.today > e.validTo ? ' — EXPIRED' : ''}</option>)}</select></Field>
        <Field label="Welder (NDT joints)"><select className="inp" value={welder} onChange={(e) => setWelder(e.target.value)}><option value="">— none —</option>{WELDERS.map((w) => <option key={w.id} value={w.id}>{w.name}{state.today > w.qualValidTo ? ' — LAPSED' : ''}</option>)}</select></Field>
        {kind === 'CUBE' && <Field label="Batch"><input className="inp mono" value={batch} onChange={(e) => setBatch(e.target.value)} /></Field>}
        {kind === 'CUBE' && <Field label="Pour location"><input className="inp" value={pour} onChange={(e) => setPour(e.target.value)} /></Field>}
      </div>
      {kind === 'CUBE' && age === 28 && !pass && (
        <div className="mt-3 text-[12px] text-bad font-semibold flex items-center gap-1.5"><Timer size={14} /> A failed 28-day cube automatically raises a non-conformance linked to the pour, batch, challan and measurement.</div>
      )}
    </Modal>
  );
}

function NcrModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { run } = useStore();
  const [title, setTitle] = useState('Honeycombing on pier P2 face');
  const [sev, setSev] = useState<'MINOR' | 'MAJOR' | 'CRITICAL'>('MAJOR'); const [cost, setCost] = useState(25000);
  return (
    <Modal open={open} onClose={onClose} title="Raise non-conformance (NC-STD)" sub="SLA by severity — MINOR 14 d · MAJOR 7 d · CRITICAL 3 d"
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-acc" onClick={() => { run((s) => raiseNcr(s, { title, severity: sev, cost }, s.userId)); onClose(); }}>Raise NCR</button>
      </>}>
      <div className="space-y-3">
        <Field label="Title" req><input className="inp" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Severity"><select className="inp" value={sev} onChange={(e) => setSev(e.target.value as typeof sev)}><option>MINOR</option><option>MAJOR</option><option>CRITICAL</option></select></Field>
          <Field label="Est. rectification cost ₹"><input type="number" className="inp mono" value={cost} onChange={(e) => setCost(+e.target.value)} /></Field>
        </div>
      </div>
    </Modal>
  );
}
