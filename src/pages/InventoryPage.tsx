import { useMemo, useState } from 'react';
import { Plus, RotateCcw, Scale, Boxes } from 'lucide-react';
import { useStore, useNav } from '../store';
import { SectionHead, Tabs, Modal, StatusChip, Empty, FlowViz, Money, JournalView } from '../components/ui';
import { MovementForm } from '../components/MovementForm';
import { stockValueTotal, glBalance, fmtINR, fmtNum, docById, reverseMovement, userById } from '../engine/engine';
import { SITES, MOVEMENT_TYPES, STOCK_TYPE_NAMES, MATERIALS } from '../engine/config';
import type { StockType } from '../engine/types';

export function InventoryPage() {
  const { state, run } = useStore();
  const { focusDocId } = useNav();
  const [tab, setTab] = useState('stock');
  const [showPost, setShowPost] = useState(false);
  const [siteFilter, setSiteFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | StockType>('ALL');
  const [selMd, setSelMd] = useState<string | null>(null);
  const [revReason, setRevReason] = useState('');
  const [revFor, setRevFor] = useState<string | null>(null);

  const stockVal = stockValueTotal(state);
  const glVal = ['110100', '110150', '110160', '110200', '110400'].reduce((t, a) => t + glBalance(state, a), 0);
  const brk = Math.round((stockVal - glVal) * 100) / 100;

  const rows = useMemo(() => state.stock
    .filter((r) => (siteFilter === 'ALL' || r.siteId === siteFilter) && (typeFilter === 'ALL' || r.stockType === typeFilter))
    .sort((a, b) => (a.siteId + a.locId + a.materialCode).localeCompare(b.siteId + b.locId + b.materialCode)), [state.stock, siteFilter, typeFilter]);

  const mds = state.docs.filter((d) => d.module === 'INV' && (state.companyFilter === 'ALL' || d.companyId === state.companyFilter));
  const sel = selMd ? docById(state, selMd) : undefined;
  const focused = focusDocId ? docById(state, focusDocId) : undefined;
  const view = (sel ?? (focused?.module === 'INV' ? focused : undefined));

  return (
    <div className="space-y-4">
      {/* reconciliation strip */}
      <div className="card p-4 flex flex-wrap items-center gap-x-6 gap-y-2">
        <span className="flex items-center gap-2 font-disp font-extrabold text-[15px]"><Scale size={16} className="text-acc" /> Real-time reconciliation</span>
        <div><div className="lbl">Stock ledger</div><div className="mono font-bold">{fmtINR(stockVal)}</div></div>
        <div><div className="lbl">GL stock accounts</div><div className="mono font-bold">{fmtINR(glVal)}</div></div>
        <span className={`chip !text-[11px] !py-1 ${brk === 0 ? 'bg-ok-soft text-ok border-ok/40' : 'bg-bad-soft text-bad border-bad/40'}`}>{brk === 0 ? 'ZERO BREAK ✓' : `BREAK ${fmtINR(brk)}`}</span>
        <span className="text-[11px] text-mute">Every valuation-relevant movement writes the material document and its accounting document in the same transaction.</span>
        <button className="btn btn-acc btn-sm ml-auto" onClick={() => setShowPost(true)}><Plus size={13} /> Post movement</button>
      </div>

      <Tabs tabs={[{ id: 'stock', label: 'Stock Ledger', n: rows.length }, { id: 'md', label: 'Material Documents', n: mds.length }]} val={tab} onChange={setTab} />

      {tab === 'stock' && (
        <div className="card p-4">
          <SectionHead
            title="Stock by site, location and type"
            sub="Negative stock is unreachable — there is no configuration switch to permit it"
            right={
              <div className="flex gap-2">
                <select className="inp !w-[170px] !py-1.5 !text-[12px]" value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}>
                  <option value="ALL">All operating sites</option>
                  {SITES.map((s) => <option key={s.code} value={s.code}>{s.code} · {s.name}</option>)}
                </select>
                <select className="inp !w-[150px] !py-1.5 !text-[12px]" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as 'ALL' | StockType)}>
                  <option value="ALL">All stock types</option>
                  {Object.entries(STOCK_TYPE_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            }
          />
          {rows.length === 0 && <Empty text="No stock lines match — post a goods receipt first." />}
          {rows.length > 0 && (
            <table className="tbl">
              <thead><tr><th>Operating site</th><th>Loc</th><th>Material</th><th>Stock type</th><th className="text-right">Qty</th><th className="text-right">MAP ₹</th><th className="text-right">Value</th></tr></thead>
              <tbody>
                {rows.filter((r) => r.qty !== 0 || r.value !== 0).map((r) => {
                  const m = MATERIALS.find((x) => x.code === r.materialCode);
                  const s = SITES.find((x) => x.code === r.siteId);
                  return (
                    <tr key={`${r.siteId}${r.locId}${r.materialCode}${r.stockType}`}>
                      <td><div className="text-[12.5px] font-semibold">{r.siteId}</div><div className="text-[10.5px] text-mute">{s?.name}</div></td>
                      <td className="mono text-[11.5px]">{r.locId}</td>
                      <td><span className="mono font-bold text-[11.5px]">{r.materialCode}</span> <span className="text-[12px] text-mute">{m?.desc}</span></td>
                      <td>
                        <span className={`chip !py-0 !text-[9.5px] ${r.stockType === 'UNR' ? 'bg-ok-soft text-ok border-ok/30' : r.stockType === 'TRN' ? 'bg-pet-soft text-pet border-pet/30' : r.stockType === 'BLK' ? 'bg-bad-soft text-bad border-bad/30' : 'bg-warn-soft text-warn border-warn/30'}`}>
                          {STOCK_TYPE_NAMES[r.stockType]}
                        </span>
                      </td>
                      <td className="num font-bold">{fmtNum(r.qty, r.qty % 1 ? 2 : 0)} <span className="text-mute font-normal text-[10.5px]">{m?.baseUom}</span></td>
                      <td className="num text-mute">{r.qty ? fmtNum(r.value / r.qty, 2) : '—'}</td>
                      <td className="num font-bold">{fmtINR(r.value)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'md' && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-4">
          <div className="card p-4">
            <SectionHead title="Material documents" sub="Immutable — reversal posts the paired mirror movement, never an edit" />
            <table className="tbl">
              <thead><tr><th>Number</th><th>Mvt</th><th>Material</th><th className="text-right">Qty</th><th className="text-right">Value</th><th>Reference</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {mds.map((d) => {
                  const mvt = MOVEMENT_TYPES.find((m) => m.code === d.movementCode);
                  return (
                    <tr key={d.id} onClick={() => setSelMd(d.id)} className={`cursor-pointer ${view?.id === d.id ? 'is-sel' : ''}`}>
                      <td className="mono font-bold text-[11.5px]">{d.number}</td>
                      <td><span className="chip !py-0 bg-side text-side-tx border-side">{d.movementCode}</span> <span className="text-[10.5px] text-mute hidden lg:inline">{mvt?.desc.slice(0, 26)}</span></td>
                      <td className="mono text-[11.5px]">{d.items[0]?.materialCode}</td>
                      <td className="num">{fmtNum(d.items[0]?.qty ?? 0, 0)}</td>
                      <td className="num">{fmtINR(d.mvtValue ?? 0)}</td>
                      <td className="mono text-[10.5px] text-mute">{d.refNumber ?? '—'}</td>
                      <td><StatusChip s={d.status} /></td>
                      <td>
                        {d.status === 'POSTED' && (
                          <button className="btn btn-bad btn-sm" onClick={(e) => { e.stopPropagation(); setRevFor(d.id); setRevReason(''); }}>
                            <RotateCcw size={12} /> Reverse
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {mds.length === 0 && <Empty text="No material documents yet." />}
          </div>
          <div className="space-y-3 self-start">
            {view ? (
              <>
                <div className="card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="mono text-[11px] text-mute">{view.type} · movement {view.movementCode}</div>
                      <h3 className="font-disp font-extrabold text-[16px]">{view.number}</h3>
                    </div>
                    <StatusChip s={view.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3 text-[12.5px]">
                    <div><div className="lbl">Movement</div>{MOVEMENT_TYPES.find((m) => m.code === view.movementCode)?.desc}</div>
                    <div><div className="lbl">Value</div><Money v={view.mvtValue ?? 0} className="font-bold" /></div>
                    <div><div className="lbl">Site / loc</div><span className="mono">{view.siteId} / {view.locId}{view.siteToId ? ` → ${view.siteToId}` : ''}</span></div>
                    <div><div className="lbl">Cost object</div><span className="mono">{view.wbs ?? view.cc ?? '—'}</span></div>
                    <div><div className="lbl">Posted by</div>{userById(view.createdBy)?.name} · {view.dateISO}</div>
                    {view.reason && <div><div className="lbl">Reason</div>{view.reason}</div>}
                  </div>
                  {view.status === 'REVERSED' && <div className="mt-2 text-[11.5px] text-bad font-semibold">Reversed — the mirror document carries the reference; this record remains visible.</div>}
                </div>
                {state.journals.some((j) => j.refId === view.id) && (
                  <div className="card p-4">
                    <div className="lbl mb-2">Integrated posting — the accounting leg of this movement</div>
                    <JournalView lines={state.journals.find((j) => j.refId === view.id)!.lines} number={state.journals.find((j) => j.refId === view.id)!.number} />
                  </div>
                )}
                <div className="card p-4">
                  <div className="lbl mb-2 flex items-center gap-1.5"><Boxes size={12} /> Document flow</div>
                  <FlowViz docId={view.id} />
                </div>
              </>
            ) : <Empty text="Select a material document." />}
          </div>
        </div>
      )}

      <Modal open={showPost} onClose={() => setShowPost(false)} title="Post goods movement" sub="Simulation first — the exact journal is computed before anything is written" wide>
        <MovementForm />
      </Modal>

      <Modal open={!!revFor} onClose={() => setRevFor(null)} title="Reverse material document" sub="Posts the paired reversal movement with reference to the original"
        footer={<>
          <button className="btn" onClick={() => setRevFor(null)}>Cancel</button>
          <button className="btn btn-acc" onClick={() => { if (revFor) run((s) => reverseMovement(s, revFor, revReason || 'Operational reversal', s.userId)); setRevFor(null); }}>Post reversal</button>
        </>}>
        <div className="text-[12.5px] mb-2">Reason (mandatory for the audit trail):</div>
        <input className="inp" value={revReason} onChange={(e) => setRevReason(e.target.value)} placeholder="e.g. short delivery discovered at unloading" />
      </Modal>
    </div>
  );
}
