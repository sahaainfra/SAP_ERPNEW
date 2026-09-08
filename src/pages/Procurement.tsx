import { useEffect, useMemo, useState } from 'react';
import { Plus, FilePlus2, Truck, Receipt, PencilLine, GitBranch, ArrowLeftRight, Banknote, Send } from 'lucide-react';
import { useStore, useNav } from '../store';
import {
  SectionHead, Tabs, StatusChip, Modal, Field, InfoNote, KV, Empty, FlowViz,
  PriceBreakdown, ReleaseTimeline, Money, JournalView,
} from '../components/ui';
import {
  postGR, postInvoice, postPayment,
  computePricing, determineTaxKind, docById, userById, fmtINR, fmtNum, daysAheadISO,
  taxCodeFor, materialByCode,
} from '../engine/engine';
import { createPR, createPOFromPR, amendItemRate } from '../engine/platform';
import { SITES, PROJECTS, COST_CENTRES, PARTNERS, COPY_RULES_PR_PO, MATERIALS, STATE_NAMES } from '../engine/config';
import type { ItemCategory, Doc } from '../engine/types';

export function Procurement() {
  const { state } = useStore();
  const { focusDocId } = useNav();
  const [tab, setTab] = useState<'pr' | 'po'>('pr');
  const [selId, setSelId] = useState<string | null>(null);
  const [showNewPR, setShowNewPR] = useState(false);
  const [showNewPO, setShowNewPO] = useState(false);
  const [showGR, setShowGR] = useState(false);
  const [showIV, setShowIV] = useState(false);
  const [showAmend, setShowAmend] = useState(false);

  useEffect(() => {
    if (!focusDocId) return;
    const d = docById(state, focusDocId);
    if (!d) return;
    setSelId(focusDocId);
    setTab(d.type.startsWith('PR') ? 'pr' : 'po');
  }, [focusDocId, state]);

  const cf = state.companyFilter;
  const prs = state.docs.filter((d) => d.type.startsWith('PR') && (cf === 'ALL' || d.companyId === cf));
  const pos = state.docs.filter((d) => (d.type.startsWith('PO') || d.type === 'IV-VEN') && (cf === 'ALL' || d.companyId === cf));
  const list = tab === 'pr' ? prs : pos;
  const sel = selId ? docById(state, selId) ?? null : null;

  return (
    <div>
      <Tabs
        tabs={[{ id: 'pr', label: 'Requisitions', n: prs.length }, { id: 'po', label: 'Purchase Orders & Invoices', n: pos.length }]}
        val={tab} onChange={(t) => setTab(t as 'pr' | 'po')}
      />
      <div className="grid grid-cols-1 xl:grid-cols-[400px_1fr] gap-4">
        {/* list */}
        <div className="card p-4 self-start">
          <SectionHead
            title={tab === 'pr' ? 'Purchase requisitions' : 'Orders & vendor invoices'}
            sub={tab === 'pr' ? 'Demand enters the system here' : 'Committed spend and three-way match'}
            right={tab === 'pr'
              ? <button className="btn btn-acc btn-sm" onClick={() => setShowNewPR(true)}><Plus size={13} /> New PR</button>
              : <button className="btn btn-acc btn-sm" onClick={() => setShowNewPO(true)}><FilePlus2 size={13} /> PO from PR</button>}
          />
          <div className="space-y-1.5 max-h-[640px] overflow-y-auto pr-1">
            {list.length === 0 && <Empty text="Nothing here yet." />}
            {list.map((d) => (
              <button key={d.id} onClick={() => setSelId(d.id)} className={`w-full text-left border rounded-lg px-3 py-2.5 transition-all hover:-translate-y-px hover:shadow ${selId === d.id ? 'border-acc bg-acc-soft' : 'border-line bg-panel'}`}>
                <div className="flex items-center gap-2">
                  <span className="chip bg-side text-side-tx border-side">{d.type}</span>
                  <span className="mono text-[12px] font-bold truncate flex-1">{d.number ?? '(draft — no number)'}</span>
                  <StatusChip s={d.status} />
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[11px] text-mute truncate">{d.items[0]?.desc ?? d.note ?? '—'}{d.items.length > 1 ? ` +${d.items.length - 1}` : ''}</span>
                  <Money v={d.total} className="text-[12px] font-bold" />
                </div>
                <div className="mono text-[10px] text-mute mt-1">{d.dateISO} · {d.siteId ?? ''} · by {userById(d.createdBy)?.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* detail */}
        <div className="space-y-4 min-w-0">
          {!sel && <Empty text="Select a document — or create a requisition to start the chain." />}
          {sel && <DocDetail doc={sel} onGR={() => setShowGR(true)} onIV={() => setShowIV(true)} onAmend={() => setShowAmend(true)} onConvert={() => setShowNewPO(true)} />}
        </div>
      </div>

      <NewPRModal open={showNewPR} onClose={() => setShowNewPR(false)} />
      <NewPOModal open={showNewPO} onClose={() => setShowNewPO(false)} preselect={tab === 'pr' && sel?.status === 'RELEASED' ? sel.id : null} />
      {sel && <GRModal open={showGR} onClose={() => setShowGR(false)} po={sel} />}
      {sel && <IVModal open={showIV} onClose={() => setShowIV(false)} po={sel} />}
      {sel && <AmendModal open={showAmend} onClose={() => setShowAmend(false)} po={sel} />}
    </div>
  );
}

/* ============================ detail ============================ */

function DocDetail({ doc, onGR, onIV, onAmend, onConvert }: { doc: Doc; onGR: () => void; onIV: () => void; onAmend: () => void; onConvert: () => void }) {
  const { state, run } = useStore();
  const isPO = doc.type.startsWith('PO');
  const isPR = doc.type.startsWith('PR');
  const isIV = doc.type === 'IV-VEN';
  const invoices = state.docs.filter((d) => d.type === 'IV-VEN' && d.refId === doc.id);
  const payments = state.docs.filter((d) => d.type === 'PV-VEN' && invoices.some((iv) => iv.id === d.refId));
  const canGR = isPO && (doc.status === 'RELEASED' || doc.status === 'POSTED') && doc.items[0]?.category !== 'SVC';
  const openRec = doc.items[0] ? doc.items[0].qty - doc.items[0].received : 0;

  return (
    <>
      <div className="card p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="chip bg-side text-side-tx border-side">{doc.type}</span>
              <h3 className="font-disp font-extrabold text-[18px] tracking-tight">{doc.number ?? 'Draft — number assigned on submit'}</h3>
              <StatusChip s={doc.status} />
              {doc.release && doc.release.resets > 0 && <span className="chip bg-bad-soft text-bad border-bad/30">strategy reset ×{doc.release.resets}</span>}
            </div>
            <div className="text-[12px] text-mute mt-1">
              {doc.dateISO} · company {doc.companyId} · site {doc.siteId ?? '—'} {doc.partnerId ? `· partner ${doc.partnerId}` : ''} · created by {userById(doc.createdBy)?.name}
              {doc.refNumber ? <> · with reference to <b className="mono text-ink">{doc.refNumber}</b></> : null}
            </div>
            {doc.note && <div className="text-[11.5px] text-pet mt-1 italic">{doc.note}</div>}
          </div>
          <div className="text-right">
            <div className="lbl">Document value</div>
            <div className="font-disp font-extrabold text-[22px] mono">{fmtINR(doc.total)}</div>
          </div>
        </div>

        {/* items */}
        <div className="mt-4 overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Line</th><th>Category</th><th>Material</th><th className="text-right">Qty</th><th>UOM</th><th className="text-right">Rate</th><th>Cost object</th>{isPO && <><th className="text-right">Received</th><th className="text-right">Invoiced</th></>}</tr></thead>
            <tbody>
              {doc.items.map((i) => (
                <tr key={i.line}>
                  <td className="mono">{i.line}</td>
                  <td><span className="chip !py-0">{i.category}</span></td>
                  <td className="text-[12.5px]"><b className="mono text-[11.5px]">{i.materialCode}</b> · {i.desc}</td>
                  <td className="num">{fmtNum(i.qty, i.qty % 1 ? 2 : 0)}</td>
                  <td className="mono text-[11px]">{i.uom}</td>
                  <td className="num">{fmtINR(i.rate)}</td>
                  <td className="mono text-[11.5px]">{i.wbs ?? i.cc ?? '—'}</td>
                  {isPO && <>
                    <td className={`num ${i.received > 0 ? 'text-ok font-bold' : ''}`}>{fmtNum(i.received, 0)}</td>
                    <td className={`num ${i.invoiced > 0 ? 'text-pet font-bold' : ''}`}>{fmtNum(i.invoiced, 0)}</td>
                  </>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* actions */}
        <div className="flex gap-2 mt-4 flex-wrap">
          {isPR && doc.status === 'RELEASED' && <button className="btn btn-acc btn-sm" onClick={onConvert}><GitBranch size={13} /> Convert to PO (with reference)</button>}
          {isPR && doc.status === 'DRAFT' && <button className="btn btn-acc btn-sm" onClick={() => run((s) => submitDraft(s, doc.id))}><Send size={13} /> Submit draft</button>}
          {canGR && <button className="btn btn-sm" onClick={onGR} disabled={openRec <= 0}><Truck size={13} /> Goods receipt {openRec > 0 ? `(${fmtNum(openRec, 0)} open)` : ''}</button>}
          {isPO && (doc.status === 'RELEASED' || doc.status === 'POSTED') && doc.items[0] && doc.items[0].received - doc.items[0].invoiced > 0 && <button className="btn btn-sm" onClick={onIV}><Receipt size={13} /> Vendor invoice (3-way match)</button>}
          {isPO && doc.items[0]?.received === 0 && doc.status !== 'REJECTED' && <button className="btn btn-sm" onClick={onAmend}><PencilLine size={13} /> Amend rate</button>}
          {isIV && payments.length === 0 && <button className="btn btn-sm" onClick={() => run((s) => postPayment(s, doc.id, s.userId))}><Banknote size={13} /> Post outgoing payment</button>}
          {isIV && payments.length > 0 && <span className="chip bg-ok-soft text-ok border-ok/30">Paid via {payments[0].number}</span>}
        </div>
      </div>

      {/* tax determination */}
      {isPO && doc.price && doc.partnerId && (
        <div className="card p-4">
          <SectionHead title="Pricing — condition technique" sub="Every rate names its source access; statistical conditions never post" />
          <PriceBreakdown price={doc.price} />
          <div className="grid md:grid-cols-3 gap-2 mt-3">
            <div className="border border-line rounded-lg px-3 py-2">
              <div className="lbl">Place of supply</div>
              <div className="text-[12.5px] font-semibold">Site of immovable property · {STATE_NAMES[site(doc.siteId!)?.state ?? ''] ?? doc.siteId}</div>
            </div>
            <div className="border border-line rounded-lg px-3 py-2">
              <div className="lbl">Tax determination (automatic)</div>
              <div className="text-[12.5px] font-semibold">
                {determineTaxKind(partner(doc.partnerId)?.state ?? '', site(doc.siteId!)?.state ?? '')} @ {doc.price.taxPct}%
                <span className="text-mute font-normal"> · vendor {partner(doc.partnerId)?.state} vs site {site(doc.siteId!)?.state}</span>
              </div>
            </div>
            <div className="border border-line rounded-lg px-3 py-2">
              <div className="lbl">ITC eligibility</div>
              <div className="text-[12.5px] font-semibold">{doc.price.itcBlocked ? 'BLOCKED — loaded into cost' : 'ELIGIBLE — input tax account'}</div>
            </div>
          </div>
        </div>
      )}

      {/* invoice journal */}
      {isIV && doc.price && (
        <div className="card p-4">
          <SectionHead title="Invoice pricing & journal" sub="Three-way match: order qty ↔ received qty ↔ invoice qty" />
          <PriceBreakdown price={doc.price} />
          <div className="mt-3"><InvoiceJournal docId={doc.id} /></div>
        </div>
      )}

      {/* release */}
      {doc.release && (
        <div className="card p-4">
          <SectionHead title="Release strategy" sub="Determined at submission · value snapshots archived at every step" right={doc.snapshots && doc.snapshots.length > 0 ? <span className="chip"><ArrowLeftRight size={11} /> {doc.snapshots.length} snapshot{doc.snapshots.length > 1 ? 's' : ''}</span> : undefined} />
          <ReleaseTimeline docId={doc.id} />
          {doc.snapshots && doc.snapshots.length > 0 && (
            <div className="mt-3 flex gap-2 flex-wrap">
              {doc.snapshots.map((sn, i) => (
                <span key={i} className="chip bg-pet-soft text-pet border-pet/30">v{i + 1} · {fmtINR(sn.total)} · {sn.step} · {userById(sn.by)?.name}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* flow */}
      <div className="card p-4">
        <SectionHead title="Document flow" sub="Walk the chain in both directions — from requisition to journal and back" />
        <FlowViz docId={doc.id} />
        {invoices.length > 0 && !isIV && (
          <div className="mt-2">
            <div className="lbl mb-1.5">Invoices against this order</div>
            <div className="flex gap-2 flex-wrap">
              {invoices.map((iv) => <span key={iv.id} className="chip bg-ok-soft text-ok border-ok/30">{iv.number} · {fmtINR(iv.total)}</span>)}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function site(code: string) { return SITES.find((s) => s.code === code); }
function partner(id: string) { return PARTNERS.find((p) => p.id === id); }

function InvoiceJournal({ docId }: { docId: string }) {
  const { state } = useStore();
  const j = state.journals.find((x) => x.refId === docId);
  if (!j) return <Empty text="No accounting document linked." />;
  return <JournalView lines={j.lines} number={j.number} />;
}

function submitDraft(s: import('../engine/types').ERPState, id: string) {
  const d = s.docs.find((x) => x.id === id);
  if (!d) return { s, ok: false, msg: 'Draft not found', tone: 'bad' as const };
  return createPR(s, {
    siteId: d.siteId!, submit: true, neededBy: daysAheadISO(7),
    items: d.items.map((i) => ({ materialCode: i.materialCode, qty: i.qty, wbs: i.wbs, cc: i.cc, category: i.category })),
    note: d.note, docType: d.type,
  }, s.userId);
}

/* ============================ modals ============================ */

interface PRRow { materialCode: string; qty: number; assign: 'WBS' | 'CC'; assignVal: string; category: ItemCategory; }

function NewPRModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, run } = useStore();
  const [siteId, setSiteId] = useState('ST-NH47');
  const [rows, setRows] = useState<PRRow[]>([{ materialCode: 'MAT-C53', qty: 250, assign: 'WBS', assignVal: 'PRJ-NH47-S', category: 'STD' }]);
  const [neededBy, setNeededBy] = useState(daysAheadISO(7));
  const siteC = site(siteId)?.companyId ?? 'VUL';
  const wbsOpts = PROJECTS.filter((p) => p.companyId === siteC).flatMap((p) => p.wbs.map((w) => w.code));
  const ccOpts = COST_CENTRES.filter((c) => c.companyId === siteC).map((c) => c.code);
  const est = rows.reduce((t, r) => t + (materialByCode(r.materialCode)?.price ?? 0) * r.qty, 0);

  return (
    <Modal open={open} onClose={onClose} title="New purchase requisition" sub="Account assignment: exactly one primary cost object per line" wide
      footer={<>
        <button className="btn" onClick={() => { run((s) => createPR(s, { siteId, neededBy, submit: false, items: rows.map((r) => ({ materialCode: r.materialCode, qty: r.qty, wbs: r.assign === 'WBS' ? r.assignVal : undefined, cc: r.assign === 'CC' ? r.assignVal : undefined, category: r.category })) }, s.userId)); onClose(); }}>Save draft (no number)</button>
        <button className="btn btn-acc" onClick={() => { run((s) => createPR(s, { siteId, neededBy, submit: true, items: rows.map((r) => ({ materialCode: r.materialCode, qty: r.qty, wbs: r.assign === 'WBS' ? r.assignVal : undefined, cc: r.assign === 'CC' ? r.assignVal : undefined, category: r.category })) }, s.userId)); onClose(); }}>Submit → release strategy</button>
      </>}>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <Field label="Operating site" req>
          <select className="inp" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            {SITES.map((s) => <option key={s.code} value={s.code}>{s.code} · {s.name} ({s.companyId})</option>)}
          </select>
        </Field>
        <Field label="Required by"><input type="date" className="inp mono" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} /></Field>
        <div><div className="lbl mb-1">Estimated value</div><div className="mono font-bold text-[16px] pt-1.5">{fmtINR(est)}</div></div>
      </div>
      <div className="space-y-2">
        {rows.map((r, i) => {
          const m = materialByCode(r.materialCode);
          const gated = m && (!m.views.includes('Purchasing') || !m.views.includes('Valuation'));
          return (
            <div key={i} className={`border rounded-lg p-2.5 grid grid-cols-12 gap-2 items-end ${gated ? 'border-warn/40 bg-warn-soft/40' : 'border-line'}`}>
              <div className="col-span-4">
                <Field label={`Material · line ${i + 1}`}>
                  <select className="inp mono !text-[11.5px]" value={r.materialCode} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, materialCode: e.target.value } : x))}>
                    {MATERIALS.map((mm) => <option key={mm.code} value={mm.code}>{mm.code} · {mm.desc}</option>)}
                  </select>
                </Field>
              </div>
              <div className="col-span-2"><Field label={`Qty ${m?.baseUom ?? ''}`}><input type="number" className="inp mono" value={r.qty} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, qty: +e.target.value } : x))} /></Field></div>
              <div className="col-span-2">
                <Field label="Category">
                  <select className="inp mono" value={r.category} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, category: e.target.value as ItemCategory } : x))}>
                    {['STD', 'CNS', 'SVC'].map((c) => <option key={c}>{c}</option>)}
                  </select>
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="Cost object">
                  <select className="inp mono" value={r.assign} onChange={(e) => {
                    const a = e.target.value as 'WBS' | 'CC';
                    setRows(rows.map((x, j) => j === i ? { ...x, assign: a, assignVal: a === 'WBS' ? wbsOpts[0] : ccOpts[0] } : x));
                  }}>
                    <option value="WBS">WBS</option><option value="CC">Cost centre</option>
                  </select>
                </Field>
              </div>
              <div className="col-span-2">
                <Field label={r.assign === 'WBS' ? 'WBS element' : 'Cost centre'}>
                  <select className="inp mono !text-[11px]" value={r.assignVal} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, assignVal: e.target.value } : x))}>
                    {(r.assign === 'WBS' ? wbsOpts : ccOpts).map((o) => <option key={o}>{o}</option>)}
                  </select>
                </Field>
              </div>
              <div className="col-span-12">
                {gated && <InfoNote tone="warn"><b>{r.materialCode}</b> has views [{m!.views.join(', ')}] only — submission will be refused until Purchasing + Valuation exist.</InfoNote>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 mt-2">
        <button className="btn btn-sm" onClick={() => setRows([...rows, { materialCode: 'MAT-AGG20', qty: 100, assign: 'WBS', assignVal: wbsOpts[0], category: 'STD' }])}><Plus size={12} /> Add line</button>
        {rows.length > 1 && <button className="btn btn-sm" onClick={() => setRows(rows.slice(0, -1))}>Remove last</button>}
        <span className="text-[11px] text-mute self-center ml-auto">Strategy thresholds: ≤ ₹2 L one step · ≤ ₹10 L two · above two + director</span>
      </div>
    </Modal>
  );
}

function NewPOModal({ open, onClose, preselect }: { open: boolean; onClose: () => void; preselect: string | null }) {
  const { state, run } = useStore();
  const released = state.docs.filter((d) => d.type.startsWith('PR') && d.status === 'RELEASED' && !state.flow.some((f) => f.from === d.id));
  const [prId, setPrId] = useState<string>(preselect ?? released[0]?.id ?? '');
  useEffect(() => { if (preselect) setPrId(preselect); }, [preselect, open]);
  const pr = prId ? docById(state, prId) : null;
  const vendors = PARTNERS.filter((p) => p.roles.includes('VENDOR') && p.status === 'ACTIVE');
  const [vendorId, setVendorId] = useState('BP-SHREE');
  const [delivery, setDelivery] = useState(daysAheadISO(7));
  const preview = useMemo(() => {
    if (!pr || !pr.items[0]) return null;
    return computePricing(state, { materialCode: pr.items[0].materialCode, qty: pr.items.reduce((t, i) => t + i.qty, 0), partnerId: vendorId, siteId: pr.siteId!, docDate: state.today });
  }, [pr, vendorId, state]);
  const tax = pr ? taxCodeFor(materialByCode(pr.items[0].materialCode)?.hsn ?? '', state.today) : null;

  return (
    <Modal open={open} onClose={onClose} title="Create PO with reference to PR" sub="Copy rules decide what copies, re-derives or re-enters" wide
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-acc" disabled={!pr} onClick={() => { run((s) => createPOFromPR(s, prId, { partnerId: vendorId, deliveryDate: delivery }, s.userId)); onClose(); }}>Create order → release strategy</button>
      </>}>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Released requisition" req>
          <select className="inp mono !text-[11.5px]" value={prId} onChange={(e) => setPrId(e.target.value)}>
            {released.length === 0 && <option value="">— none available —</option>}
            {released.map((d) => <option key={d.id} value={d.id}>{d.number} · {fmtINR(d.total)}</option>)}
          </select>
        </Field>
        <Field label="Vendor (re-enter)" req>
          <select className="inp" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.id} · {v.name} ({v.state})</option>)}
          </select>
        </Field>
        <Field label="Delivery date"><input type="date" className="inp mono" value={delivery} onChange={(e) => setDelivery(e.target.value)} /></Field>
      </div>
      <div className="grid md:grid-cols-2 gap-3 mt-4">
        <div>
          <div className="lbl mb-1.5">Copy rules PR → PO</div>
          <div className="border border-line rounded-lg divide-y divide-line">
            {COPY_RULES_PR_PO.map((c) => (
              <div key={c.field} className="flex items-center justify-between px-3 py-1.5 text-[12px]">
                <span>{c.field}</span>
                <span className={`chip !py-0 !text-[9.5px] ${c.rule === 'Copy' ? 'bg-pet-soft text-pet border-pet/30' : c.rule.startsWith('Re-derive') ? 'bg-acc-soft text-acc-deep border-acc/30' : 'bg-warn-soft text-warn border-warn/30'}`}>{c.rule}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="lbl mb-1.5">Conditions re-derived now (access sequence)</div>
          {preview ? (
            <>
              <PriceBreakdown price={preview} />
              {tax && <div className="mt-2"><InfoNote tone="info">Tax code <b className="mono">{tax.code}</b> @ <b>{tax.ratePct}%</b> — effective {tax.validFrom}{tax.validTo ? ` → ${tax.validTo}` : ' onwards'}. Rate is picked by <b>document date</b>, never hard-coded.</InfoNote></div>}
            </>
          ) : <Empty text="Select a released PR first." />}
        </div>
      </div>
    </Modal>
  );
}

function GRModal({ open, onClose, po }: { open: boolean; onClose: () => void; po: Doc }) {
  const { run } = useStore();
  const it = po.items[0];
  const [qty, setQty] = useState(Math.max(0, (it?.qty ?? 0) - (it?.received ?? 0)));
  const [qh, setQh] = useState(false);
  if (!it) return null;
  const tolMax = it.qty * 1.05;
  return (
    <Modal open={open} onClose={onClose} title={`Goods receipt — ${po.number}`} sub={`Movement ${qh ? '101 → quality hold' : '100 → unrestricted'} · Dr Stock / Cr GR-IR in one transaction`}
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-acc" onClick={() => { run((s) => postGR(s, po.id, { qty, toQuality: qh }, s.userId)); onClose(); }}>Post goods receipt</button>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Quantity ${it.uom}`} req hint={`Ordered ${fmtNum(it.qty, 0)} · received ${fmtNum(it.received, 0)} · tolerance ceiling ${fmtNum(tolMax, 0)} (+5%)`}>
          <input type="number" className="inp mono" value={qty} onChange={(e) => setQty(+e.target.value)} />
        </Field>
        <div className="pt-1">
          <label className="flex items-center gap-2 text-[12.5px] mt-6"><input type="checkbox" checked={qh} onChange={(e) => setQh(e.target.checked)} /> Into quality hold (movement 101)</label>
        </div>
      </div>
      <div className="mt-3"><InfoNote tone={it.received + qty > tolMax ? 'bad' : 'info'}>{it.received + qty > tolMax ? `This receipt exceeds the over-delivery tolerance — the engine will block it.` : `Stock will be valued at PO base rate ${fmtINR(it.rate)}/${it.uom}; condition loads are tracked in the pricing procedure.`}</InfoNote></div>
    </Modal>
  );
}

function IVModal({ open, onClose, po }: { open: boolean; onClose: () => void; po: Doc }) {
  const { state, run } = useStore();
  const it = po.items[0];
  const [qty, setQty] = useState(Math.max(0, (it?.received ?? 0) - (it?.invoiced ?? 0)));
  const [ref, setRef] = useState('INV/' + Math.floor(Math.random() * 9000 + 1000));
  const preview = useMemo(() => it ? computePricing(state, { materialCode: it.materialCode, qty, partnerId: po.partnerId, siteId: po.siteId!, docDate: state.today, rateOverride: it.rate }) : null, [it, qty, po, state]);
  if (!it) return null;
  return (
    <Modal open={open} onClose={onClose} title={`Vendor invoice — ${po.number}`} sub="Three-way match · invoice beyond received quantity is blocked" wide
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-acc" onClick={() => { run((s) => postInvoice(s, po.id, { vendorInvoiceNo: ref, qty }, s.userId)); onClose(); }}>Post invoice receipt</button>
      </>}>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Vendor invoice no." req><input className="inp mono" value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
        <Field label={`Invoice qty ${it.uom}`} req hint={`Received ${fmtNum(it.received, 0)} · already invoiced ${fmtNum(it.invoiced, 0)}`}>
          <input type="number" className="inp mono" value={qty} onChange={(e) => setQty(+e.target.value)} />
        </Field>
        <div><div className="lbl mb-1">Net payable</div><div className="mono font-bold text-[16px] pt-1.5">{preview ? fmtINR(preview.payable) : '—'}</div></div>
      </div>
      {preview && (
        <div className="mt-3">
          <PriceBreakdown price={preview} />
          <div className="mt-2"><InfoNote tone="info">Journal preview: <b>Dr GR/IR {fmtINR(preview.net)}</b> + input tax <b>{fmtINR(preview.itcBlocked ? 0 : preview.taxValue)}</b> {preview.itcBlocked ? '(ITC blocked → stays in cost)' : ''} · <b>Cr Vendor {fmtINR(preview.gross - preview.tds)}</b> · Cr TDS {fmtINR(preview.tds)}.</InfoNote></div>
        </div>
      )}
    </Modal>
  );
}

function AmendModal({ open, onClose, po }: { open: boolean; onClose: () => void; po: Doc }) {
  const { run } = useStore();
  const it = po.items[0];
  const [rate, setRate] = useState(it?.rate ?? 0);
  const [reason, setReason] = useState('');
  if (!it) return null;
  const midRelease = po.release && po.release.steps.some((s) => s.status !== 'PENDING') && po.release.indicator !== 'REJECTED';
  return (
    <Modal open={open} onClose={onClose} title={`Amend rate — ${po.number}`} sub="Value-relevant change after release begins resets the strategy"
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-acc" onClick={() => { run((s) => amendItemRate(s, po.id, rate, reason, s.userId)); onClose(); }}>Amend & log</button>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`New rate ₹/${it.uom}`} req hint={`Current ${fmtINR(it.rate)}`}><input type="number" className="inp mono" value={rate} onChange={(e) => setRate(+e.target.value)} /></Field>
        <Field label="Reason (mandatory)" req><input className="inp" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. renegotiated freight inclusion" /></Field>
      </div>
      <div className="mt-3">
        <InfoNote tone={midRelease ? 'warn' : 'info'}>
          {midRelease
            ? `Release in progress — approval will reset to step 1, the reset is logged, and earlier snapshots stay retrievable ("I never approved that figure" is answerable).`
            : 'Field-level change documents capture old value, new value, user, time and reason.'}
        </InfoNote>
      </div>
    </Modal>
  );
}


