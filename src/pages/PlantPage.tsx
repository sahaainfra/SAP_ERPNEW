import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Wrench, Gauge, Fuel, CalendarClock, AlertTriangle, HardHat, ClipboardCheck, TrendingUp, ShieldAlert } from 'lucide-react';
import { useStore } from '../store';
import { SectionHead, Field, Modal, Empty, Tabs, KV } from '../components/ui';
import { fmtNum, fmtINR } from '../engine/engine';
import { OPERATORS } from '../engine/config';
import {
  postEquipmentLog, postInternalHire, createMaintOrder, issueSparesToOrder, completeMaintOrder,
  allocationBlock, fleetUtilisation, pmDueList, docExpiryCalendar, operatorById,
} from '../engine/eam';

const ST_COLOR: Record<string, string> = {
  RUNNING: 'text-ok bg-ok-soft border-ok/30',
  AVAILABLE: 'text-pet bg-pet-soft border-pet/30',
  IDLE: 'text-warn bg-warn-soft border-warn/30',
  BREAKDOWN: 'text-bad bg-bad-soft border-bad/30',
  MAINTENANCE: 'text-acc-deep bg-acc-soft border-acc/40',
};

export function PlantPage() {
  const { state, run } = useStore();
  const [tab, setTab] = useState('fleet');
  const [logOpen, setLogOpen] = useState(false);
  const [moOpen, setMoOpen] = useState(false);
  const [spareFor, setSpareFor] = useState<string | null>(null);
  const [hireLog, setHireLog] = useState<string | null>(null);

  const util = useMemo(() => fleetUtilisation(state), [state]);
  const pmDue = useMemo(() => pmDueList(state), [state]);
  const expiry = useMemo(() => docExpiryCalendar(state), [state]);
  const fuelExceptions = state.exceptions.filter((e) => e.kind === 'FUEL' && !e.acknowledged);

  return (
    <div className="space-y-4 fade-up">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-lg bg-side text-white grid place-items-center"><Wrench size={18} /></span>
            <h1 className="font-disp font-extrabold text-[24px] tracking-tight">Plant, Machinery & Maintenance</h1>
            <span className="chip">EAM</span>
          </div>
          <p className="text-[12.5px] text-mute mt-1.5 max-w-2xl">
            Equipment master, monotonic hour-meter logs, fuel-variance exceptions, preventive & breakdown maintenance
            (cost objects), internal-hire posting and deployment interlocks — all settled through the movement & posting framework.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-acc" onClick={() => setLogOpen(true)}><Gauge size={14} /> Daily log (EQ-LOG)</button>
          <button className="btn" onClick={() => setMoOpen(true)}><Wrench size={14} /> Maintenance order</button>
        </div>
      </header>

      <Tabs
        val={tab} onChange={setTab}
        tabs={[
          { id: 'fleet', label: 'Fleet & Utilisation', n: state.equipment.length },
          { id: 'logs', label: 'Daily Logs', n: state.eqLogs.length },
          { id: 'maint', label: 'Maintenance', n: state.maintOrders.filter((m) => m.status !== 'COMPLETED').length },
          { id: 'interlocks', label: 'Interlocks & Exceptions', n: fuelExceptions.length + expiry.filter((e) => e.days < 0).length },
        ]}
      />

      {tab === 'fleet' && (
        <div className="grid xl:grid-cols-[1fr_320px] gap-4">
          <div className="card overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Equipment</th><th>Category</th><th>Ownership</th><th>Operator</th><th className="num">Hour meter</th><th className="num">Utilisation</th><th>Status</th><th /></tr></thead>
              <tbody>
                {state.equipment.map((eq) => {
                  const u = util.find((x) => x.code === eq.code);
                  const block = allocationBlock(state, eq.code, 'CHECK');
                  return (
                    <tr key={eq.code}>
                      <td><div className="font-semibold">{eq.code}</div><div className="text-[11px] text-mute">{eq.desc}</div></td>
                      <td className="text-[12px]">{eq.category}</td>
                      <td><span className="chip">{eq.ownership}</span></td>
                      <td className="text-[12px]">{operatorById(eq.operatorId)?.name ?? '—'}</td>
                      <td className="num">{fmtNum(eq.hourMeter, 1)} h</td>
                      <td className="num">
                        <div className="flex items-center gap-2 justify-end">
                          <div className="w-16 h-1.5 rounded-full bg-line overflow-hidden"><div className="h-full bg-pet" style={{ width: `${u?.util ?? 0}%` }} /></div>
                          <span>{u?.util ?? 0}%</span>
                        </div>
                      </td>
                      <td><span className={`chip ${ST_COLOR[eq.status]}`}>{eq.status}</span></td>
                      <td>
                        <button
                          className={`btn btn-sm ${block.ok ? '' : 'btn-bad'}`}
                          title={block.ok ? 'Allocate to project' : block.msg}
                          onClick={() => run((s) => {
                            const b = allocationBlock(s, eq.code, 'ALLOC');
                            return { s, ok: b.ok, msg: b.ok ? `${eq.code} allocated — deployment recorded.` : b.msg, tone: b.ok ? 'ok' : 'bad' };
                          })}
                        >
                          {block.ok ? <HardHat size={13} /> : <ShieldAlert size={13} />} Allocate
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="space-y-4">
            <div className="card p-4">
              <SectionHead title="PM due" sub="Preventive maintenance look-ahead (auto-generates MO-PRV)" />
              {pmDue.length === 0 ? <Empty text="No equipment approaching PM threshold." /> : (
                <div className="space-y-2 mt-2">
                  {pmDue.map((e) => (
                    <div key={e.code} className="flex items-center justify-between rounded-lg border border-line p-2.5">
                      <div><div className="font-semibold text-[12.5px]">{e.code}</div><div className="text-[10.5px] text-mute">{e.desc}</div></div>
                      <span className={`chip ${e.dueIn === 0 ? 'text-bad bg-bad-soft border-bad/30' : 'text-warn bg-warn-soft border-warn/30'}`}>{e.dueIn === 0 ? 'DUE' : `${fmtNum(e.dueIn, 0)} h left`}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="card p-4">
              <SectionHead title="Document expiry" sub="Insurance · fitness · permits · calibration" />
              <div className="space-y-1.5 mt-2 max-h-[290px] overflow-y-auto pr-1">
                {expiry.slice(0, 10).map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-[12px] rounded-md border border-line px-2.5 py-1.5">
                    <div><span className="font-semibold">{d.eq}</span> <span className="text-mute">· {d.kind}</span></div>
                    <span className={`mono text-[11px] ${d.days < 0 ? 'text-bad font-bold' : d.days < 45 ? 'text-warn font-semibold' : 'text-mute'}`}>{d.days < 0 ? `expired ${-d.days}d` : `${d.days}d`}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'logs' && (
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Log</th><th>Equipment</th><th>Date</th><th className="num">HM open → close</th><th className="num">Work / Idle / Brkdn</th><th className="num">Fuel (L)</th><th>Operator</th><th>Internal hire</th></tr></thead>
            <tbody>
              {state.eqLogs.map((l) => {
                const eq = state.equipment.find((e) => e.code === l.equipmentCode);
                const norm = l.workHrs * (eq?.fuelNormLph ?? 0);
                const over = l.fuelL > norm * 1.15;
                const hired = state.journals.some((j) => j.refId === l.docId && j.lines.some((x) => x.text.includes('Internal hire')));
                return (
                  <tr key={l.id}>
                    <td className="mono text-[11.5px]">{state.docs.find((d) => d.id === l.docId)?.number ?? '—'}</td>
                    <td className="font-semibold">{l.equipmentCode}</td>
                    <td className="mono text-[11.5px]">{l.date}</td>
                    <td className="num">{fmtNum(l.openingHm, 1)} → {fmtNum(l.closingHm, 1)}</td>
                    <td className="num">{fmtNum(l.workHrs, 1)} / {fmtNum(l.idleHrs, 1)} / {fmtNum(l.brkdnHrs, 1)}</td>
                    <td className={`num ${over ? 'text-bad font-bold' : ''}`}>{fmtNum(l.fuelL, 1)} {over && <Fuel size={12} className="inline text-bad" />}</td>
                    <td className="text-[12px]">{operatorById(l.operatorId)?.name ?? l.operatorId}</td>
                    <td>
                      {hired
                        ? <span className="chip text-ok bg-ok-soft border-ok/30">Posted</span>
                        : <button className="btn btn-sm" onClick={() => setHireLog(l.id)}><TrendingUp size={13} /> Post hire</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {state.eqLogs.length === 0 && <Empty text="No equipment logs yet — post a daily log." />}
        </div>
      )}

      {tab === 'maint' && (
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Order</th><th>Equipment</th><th>Type</th><th className="num">Spares</th><th className="num">Labour</th><th className="num">External</th><th className="num">Downtime</th><th>Status</th><th /></tr></thead>
            <tbody>
              {state.maintOrders.map((m) => (
                <tr key={m.id}>
                  <td className="mono text-[11.5px] font-semibold">{m.number}</td>
                  <td>{m.equipmentCode}</td>
                  <td><span className="chip">{m.type === 'PRV' ? 'Preventive' : 'Breakdown'}</span></td>
                  <td className="num">{fmtINR(m.sparesCost)}</td>
                  <td className="num">{fmtINR(m.laborCost)}</td>
                  <td className="num">{fmtINR(m.extCost)}</td>
                  <td className="num">{fmtNum(m.downtimeHrs, 1)} h</td>
                  <td><span className={`chip ${m.status === 'COMPLETED' ? 'text-ok bg-ok-soft border-ok/30' : m.status === 'IN_PROGRESS' ? 'text-warn bg-warn-soft border-warn/30' : 'text-pet bg-pet-soft border-pet/30'}`}>{m.status}</span></td>
                  <td>
                    {m.status !== 'COMPLETED' && (
                      <div className="flex gap-1.5">
                        <button className="btn btn-sm" onClick={() => setSpareFor(m.id)}>Issue spares (210)</button>
                        <button className="btn btn-sm btn-ok" onClick={() => run((s) => completeMaintOrder(s, m.id, { laborCost: 3500, extCost: 0, downtimeHrs: m.type === 'BRK' ? 6 : 2, rootCause: m.type === 'BRK' ? 'Hydraulic hose rupture' : undefined }, s.userId))}>Complete</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {state.maintOrders.length === 0 && <Empty text="No maintenance orders." />}
        </div>
      )}

      {tab === 'interlocks' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="card p-4">
            <SectionHead title="Fuel-variance exceptions" sub="Consumption beyond norm × tolerance — names machine, operator, date" />
            <div className="space-y-2 mt-2">
              {fuelExceptions.length === 0 && <Empty text="No open fuel exceptions." />}
              {fuelExceptions.map((e) => (
                <div key={e.id} className="flex items-start gap-2.5 rounded-lg border border-warn/40 bg-warn-soft p-3">
                  <Fuel size={16} className="text-warn mt-0.5 shrink-0" />
                  <div className="text-[12.5px] flex-1">{e.text}<div className="text-[10.5px] text-mute mt-0.5 mono">{e.at}</div></div>
                  <button className="btn btn-sm" onClick={() => run((s) => { const x = s.exceptions.find((z) => z.id === e.id); if (x) x.acknowledged = true; return { s, ok: true, msg: 'Fuel exception acknowledged.', tone: 'ok' }; })}>Ack</button>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-4">
            <SectionHead title="Deployment interlocks" sub="Expired insurance/fitness/permit or operator licence blocks allocation" />
            <div className="space-y-2 mt-2">
              {state.equipment.map((eq) => {
                const b = allocationBlock(state, eq.code, 'ALLOC');
                return (
                  <div key={eq.code} className={`flex items-center gap-2.5 rounded-lg border p-2.5 text-[12.5px] ${b.ok ? 'border-line' : 'border-bad/40 bg-bad-soft'}`}>
                    {b.ok ? <ClipboardCheck size={15} className="text-ok shrink-0" /> : <AlertTriangle size={15} className="text-bad shrink-0" />}
                    <div><span className="font-semibold">{eq.code}</span> — {b.ok ? 'clear to allocate' : b.msg}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <LogModal open={logOpen} onClose={() => setLogOpen(false)} />
      <MaintModal open={moOpen} onClose={() => setMoOpen(false)} />
      <SpareModal orderId={spareFor} onClose={() => setSpareFor(null)} />
      <HireModal logId={hireLog} onClose={() => setHireLog(null)} />
    </div>
  );
}

function LogModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, run } = useStore();
  const [eq, setEq] = useState('EQ-EX201');
  const [work, setWork] = useState(8); const [idle, setIdle] = useState(1); const [brkdn, setBrkdn] = useState(0); const [standby, setStandby] = useState(0);
  const [fuel, setFuel] = useState(150); const [op, setOp] = useState('OP-1');
  const machine = state.equipment.find((e) => e.code === eq);
  const delta = 24; /* demo: closing = opening + worked window */
  return (
    <Modal open={open} onClose={onClose} title="Equipment daily log (EQ-LOG)" sub="Hour meter is monotonic; hours ≤ 24/day; fuel beyond norm raises an exception" wide
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-acc" onClick={() => { run((s) => postEquipmentLog(s, { equipmentCode: eq, date: s.today, openingHm: machine?.hourMeter ?? 0, closingHm: (machine?.hourMeter ?? 0) + work + idle + brkdn + standby, workHrs: work, idleHrs: idle, brkdnHrs: brkdn, standbyHrs: standby, operatorId: op, fuelL: fuel, wbs: machine?.wbs }, s.userId)); onClose(); }}>Post log</button>
      </>}>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Equipment"><select className="inp" value={eq} onChange={(e) => setEq(e.target.value)}>{state.equipment.map((e) => <option key={e.code} value={e.code}>{e.code} — {e.desc}</option>)}</select></Field>
        <Field label="Operator"><select className="inp" value={op} onChange={(e) => setOp(e.target.value)}>{OPERATORS.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
        <Field label="Working hours"><input type="number" className="inp mono" value={work} onChange={(e) => setWork(+e.target.value)} /></Field>
        <Field label="Idle hours"><input type="number" className="inp mono" value={idle} onChange={(e) => setIdle(+e.target.value)} /></Field>
        <Field label="Breakdown hours"><input type="number" className="inp mono" value={brkdn} onChange={(e) => setBrkdn(+e.target.value)} /></Field>
        <Field label="Standby hours"><input type="number" className="inp mono" value={standby} onChange={(e) => setStandby(+e.target.value)} /></Field>
        <Field label="Fuel issued (L)"><input type="number" className="inp mono" value={fuel} onChange={(e) => setFuel(+e.target.value)} /></Field>
        <Field label="Hour-meter window"><div className="inp mono bg-paper">{fmtNum(machine?.hourMeter ?? 0, 1)} → {fmtNum((machine?.hourMeter ?? 0) + delta, 1)}</div></Field>
      </div>
      {machine && fuel > work * machine.fuelNormLph * 1.15 && (
        <div className="mt-3 text-[12px] text-warn font-semibold flex items-center gap-1.5"><AlertTriangle size={14} /> {fmtNum(fuel, 0)} L exceeds norm {fmtNum(work * machine.fuelNormLph, 0)} L × 1.15 — posting will raise a fuel exception.</div>
      )}
    </Modal>
  );
}

function MaintModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, run } = useStore();
  const [eq, setEq] = useState('EQ-EX201'); const [type, setType] = useState<'PRV' | 'BRK'>('BRK');
  return (
    <Modal open={open} onClose={onClose} title="Open maintenance order" sub="The order is a cost object — spares (210), labour and services collect on it"
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-acc" onClick={() => { run((s) => createMaintOrder(s, { equipmentCode: eq, type }, s.userId)); onClose(); }}>Create order</button>
      </>}>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Equipment"><select className="inp" value={eq} onChange={(e) => setEq(e.target.value)}>{state.equipment.map((e) => <option key={e.code} value={e.code}>{e.code} — {e.desc}</option>)}</select></Field>
        <Field label="Type"><select className="inp" value={type} onChange={(e) => setType(e.target.value as 'PRV' | 'BRK')}><option value="BRK">Breakdown (MO-BRK)</option><option value="PRV">Preventive (MO-PRV)</option></select></Field>
      </div>
    </Modal>
  );
}

function SpareModal({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const { state, run } = useStore();
  const [mat, setMat] = useState('MAT-WBR'); const [qty, setQty] = useState(10);
  const mo = state.maintOrders.find((m) => m.id === orderId);
  return (
    <Modal open={!!orderId} onClose={onClose} title={`Issue spares to ${mo?.number ?? ''}`} sub="Posts movement 210 — Dr maintenance order cost / Cr stock"
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-acc" onClick={() => { run((s) => issueSparesToOrder(s, orderId!, mat, qty, s.userId)); onClose(); }}>Issue via 210</button>
      </>}>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Spare material"><select className="inp" value={mat} onChange={(e) => setMat(e.target.value)}>{state.docs.length >= 0 && ['MAT-WBR', 'MAT-PPE', 'MAT-HSD'].map((m) => <option key={m} value={m}>{m}</option>)}</select></Field>
        <Field label="Quantity"><input type="number" className="inp mono" value={qty} onChange={(e) => setQty(+e.target.value)} /></Field>
      </div>
      <div className="mt-3"><KV k="Collects on" v={`${mo?.number ?? ''} · equipment cost centre → consuming project`} /></div>
    </Modal>
  );
}

function HireModal({ logId, onClose }: { logId: string | null; onClose: () => void }) {
  const { state, run } = useStore();
  const log = state.eqLogs.find((l) => l.id === logId);
  const eq = state.equipment.find((e) => e.code === log?.equipmentCode);
  const amount = (log?.workHrs ?? 0) * (eq?.internalRate ?? 0);
  return (
    <Modal open={!!logId} onClose={onClose} title="Post internal hire" sub="Productive hours × internal rate, charged to the consuming WBS"
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-acc" onClick={() => { run((s) => postInternalHire(s, logId!, s.userId)); onClose(); }}>Post {fmtINR(amount)}</button>
      </>}>
      <div className="grid sm:grid-cols-2 gap-3">
        <KV k="Equipment" v={`${log?.equipmentCode} — ${eq?.desc ?? ''}`} />
        <KV k="Productive hours" v={`${fmtNum(log?.workHrs ?? 0, 1)} h`} />
        <KV k="Internal rate" v={fmtINR(eq?.internalRate ?? 0)} />
        <KV k="Charge to WBS" v={log?.wbs ?? eq?.wbs ?? '—'} />
      </div>
      <div className="mt-3 text-[12px] text-mute">Dr Project plant cost (WBS) / Cr Equipment cost centre — both project cost and fleet profitability read correctly.</div>
    </Modal>
  );
}
