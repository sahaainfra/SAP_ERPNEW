import { useMemo, useState } from 'react';
import { CheckCircle2, XCircle, Zap, FlaskConical, GitCompareArrows } from 'lucide-react';
import { useStore } from '../store';
import { Field, InfoNote, JournalView } from './ui';
import { previewMovement, postMovement, fmtNum, fmtINR } from '../engine/engine';
import type { MovementArgs, MovementPreview } from '../engine/engine';
import { MOVEMENT_TYPES, SITES, PROJECTS, COST_CENTRES, PARTNERS, MATERIALS, STOCK_TYPE_NAMES } from '../engine/config';

export function MovementForm({ defaultCode = '200', inline = false }: { defaultCode?: string; inline?: boolean }) {
  const { state, run } = useStore();
  const [a, setA] = useState<MovementArgs>({ movementCode: defaultCode, materialCode: 'MAT-C53', qty: 50, siteId: 'ST-NH47', locId: 'UNR' });
  const [fail, setFail] = useState(false);
  const mvt = MOVEMENT_TYPES.find((m) => m.code === a.movementCode);
  const site = SITES.find((s) => s.code === a.siteId);
  const locs = site?.storageLocs ?? [];
  const wbsOpts = PROJECTS.filter((p) => p.companyId === site?.companyId).flatMap((p) => p.wbs.map((w) => w.code));
  const ccOpts = COST_CENTRES.filter((c) => c.companyId === site?.companyId).map((c) => c.code);
  const poOpts = state.docs.filter((d) => d.type.startsWith('PO') && d.status !== 'REJECTED' && d.siteId === a.siteId);

  /* the UI pre-selects sensible cost objects — feed those into the simulation */
  const eff: MovementArgs = useMemo(() => ({
    ...a,
    wbs: mvt?.required.includes('WBS') ? a.wbs ?? wbsOpts[0] : a.wbs,
    cc: mvt?.required.includes('CC') ? a.cc ?? ccOpts[0] : a.cc,
  }), [a, mvt, wbsOpts.join(','), ccOpts.join(',')]);

  const preview: MovementPreview | null = useMemo(
    () => (mvt && a.qty > 0 ? previewMovement(state, eff, state.userId) : null),
    [state, eff, mvt, a.qty],
  );

  const set = (patch: Partial<MovementArgs>) => setA((x) => ({ ...x, ...patch }));
  const groups = [
    { g: 'Receipts', codes: ['100', '101', '120', '130'] },
    { g: 'Issues & consumption', codes: ['200', '205', '210', '215', '220', '225'] },
    { g: 'Quality & returns', codes: ['102', '103', '105', '110'] },
    { g: 'Returnables', codes: ['230', '235', '240'] },
    { g: 'Transfers', codes: ['300', '301', '310', '400', '410', '420'] },
    { g: 'Inventory & valuation', codes: ['500', '510', '520', '530'] },
    { g: 'Sales', codes: ['600', '610'] },
  ];

  const form = (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <Field label="Movement type" req>
          <select className="inp mono !text-[12px]" value={a.movementCode} onChange={(e) => set({ movementCode: e.target.value })}>
            {groups.map((g) => (
              <optgroup key={g.g} label={g.g}>
                {g.codes.map((c) => {
                  const m = MOVEMENT_TYPES.find((x) => x.code === c)!;
                  return <option key={c} value={c}>{c} — {m.desc}</option>;
                })}
              </optgroup>
            ))}
          </select>
        </Field>
        {mvt && <div className="text-[11px] text-mute mt-1">sign {mvt.sign > 0 ? '+' : '−'} · {mvt.from ? STOCK_TYPE_NAMES[mvt.from] : '∅'} → {mvt.to ? STOCK_TYPE_NAMES[mvt.to] : '∅'} · {mvt.valRel ? 'valuation-relevant (posts to GL)' : 'no accounting document'} · reversal by {mvt.reversal}</div>}
      </div>
      <Field label="Material" req>
        <select className="inp mono !text-[11.5px]" value={a.materialCode} onChange={(e) => set({ materialCode: e.target.value })}>
          {MATERIALS.map((m) => <option key={m.code} value={m.code}>{m.code} · {m.desc}{m.status !== 'ACTIVE' ? ` (${m.status})` : ''}</option>)}
        </select>
      </Field>
      <Field label="Quantity" req><input type="number" className="inp mono" value={a.qty} onChange={(e) => set({ qty: +e.target.value })} /></Field>
      <Field label="Operating site" req>
        <select className="inp mono !text-[11.5px]" value={a.siteId} onChange={(e) => set({ siteId: e.target.value, locId: 'UNR' })}>
          {SITES.map((s) => <option key={s.code} value={s.code}>{s.code} · {s.name} ({s.companyId})</option>)}
        </select>
      </Field>
      <Field label="Storage location">
        <select className="inp mono" value={a.locId} onChange={(e) => set({ locId: e.target.value })}>
          {locs.map((l) => <option key={l.code} value={l.code}>{l.code} · {l.name}</option>)}
        </select>
      </Field>
      {mvt?.required.includes('WBS') && (
        <Field label="WBS element (exactly one cost object)" req>
          <select className="inp mono !text-[11.5px]" value={a.wbs ?? wbsOpts[0]} onChange={(e) => set({ wbs: e.target.value, cc: undefined })}>
            {wbsOpts.map((w) => <option key={w}>{w}</option>)}
          </select>
        </Field>
      )}
      {mvt?.required.includes('CC') && (
        <Field label="Cost centre (exactly one cost object)" req>
          <select className="inp mono" value={a.cc ?? ccOpts[0]} onChange={(e) => set({ cc: e.target.value, wbs: undefined })}>
            {ccOpts.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
      )}
      {mvt?.required.includes('PO') && (
        <Field label="Purchase order reference" req>
          <select className="inp mono !text-[11px]" value={a.refDocId ?? ''} onChange={(e) => set({ refDocId: e.target.value || undefined })}>
            <option value="">— select PO —</option>
            {poOpts.map((p) => <option key={p.id} value={p.id}>{p.number} · {p.items[0]?.materialCode} open {fmtNum((p.items[0]?.qty ?? 0) - (p.items[0]?.received ?? 0), 0)}</option>)}
          </select>
        </Field>
      )}
      {mvt?.required.includes('RATE') && (
        <Field label={a.movementCode === '530' ? 'Value delta ₹ (±)' : 'Rate ₹/unit'} req>
          <input type="number" className="inp mono" value={a.rate ?? ''} onChange={(e) => set({ rate: +e.target.value })} />
        </Field>
      )}
      {mvt?.required.includes('SITE_TO') && (
        <Field label="Receiving site" req>
          <select className="inp mono" value={a.siteToId ?? ''} onChange={(e) => set({ siteToId: e.target.value || undefined })}>
            <option value="">— select —</option>
            {SITES.filter((s) => s.code !== a.siteId && s.companyId === site?.companyId).map((s) => <option key={s.code} value={s.code}>{s.code} · {s.name}</option>)}
          </select>
        </Field>
      )}
      {(mvt?.required.includes('PARTNER')) && (
        <Field label="Business partner" req>
          <select className="inp mono" value={a.partnerId ?? ''} onChange={(e) => set({ partnerId: e.target.value || undefined })}>
            <option value="">— select —</option>
            {PARTNERS.map((p) => <option key={p.id} value={p.id}>{p.id} · {p.name}</option>)}
          </select>
        </Field>
      )}
      {mvt?.required.includes('REASON') && (
        <div className="col-span-2"><Field label="Reason (mandatory, min 4 chars)" req><input className="inp" value={a.reason ?? ''} onChange={(e) => set({ reason: e.target.value })} placeholder="e.g. cycle count variance — bin audit 12-B" /></Field></div>
      )}
      {a.movementCode === '301' && (
        <Field label="Receive into location">
          <select className="inp mono" value={a.locToId ?? 'UNR'} onChange={(e) => set({ locToId: e.target.value })}>
            {locs.map((l) => <option key={l.code} value={l.code}>{l.code}</option>)}
          </select>
        </Field>
      )}
      <Field label="Posting date" hint="Tax & price effectiveness follow this date">
        <input type="date" className="inp mono" value={a.dateISO ?? state.today} onChange={(e) => set({ dateISO: e.target.value })} />
      </Field>
    </div>
  );

  const actions = (
    <div className="flex items-center gap-2 flex-wrap">
      <button className="btn btn-acc" disabled={!preview || preview.blocked} onClick={() => run((s) => postMovement(s, eff, s.userId))}>
        <GitCompareArrows size={14} /> Post movement
      </button>
      {inline && (
        <button className="btn btn-bad" disabled={!preview || preview.blocked} onClick={() => run((s) => postMovement(s, eff, s.userId, { injectFailure: true }))}>
          <Zap size={14} /> Inject failure mid-post
        </button>
      )}
      {!inline && (
        <label className="flex items-center gap-1.5 text-[11.5px] text-mute">
          <input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} /> chaos: inject failure
        </label>
      )}
      {preview?.blocked && <span className="text-[11.5px] text-bad font-semibold">Posting blocked — see checks</span>}
    </div>
  );

  const previewPanel = preview && (
    <div className="space-y-3">
      <div>
        <div className="lbl mb-1.5">Validation gate</div>
        <div className="grid sm:grid-cols-2 gap-1.5">
          {preview.checks.map((c, i) => (
            <div key={i} className={`flex items-start gap-2 border rounded-md px-2.5 py-1.5 text-[11.5px] ${c.ok ? 'border-ok/30 bg-ok-soft/40' : 'border-bad/40 bg-bad-soft'}`}>
              {c.ok ? <CheckCircle2 size={13} className="text-ok shrink-0 mt-[1px]" /> : <XCircle size={13} className="text-bad shrink-0 mt-[1px]" />}
              <span><b>{c.label}.</b> <span className="text-mute">{c.note}</span></span>
            </div>
          ))}
        </div>
      </div>
      {preview.deltas.length > 0 && (
        <div>
          <div className="lbl mb-1.5">Stock effect</div>
          <div className="flex gap-2 flex-wrap">
            {preview.deltas.map((d, i) => (
              <span key={i} className={`chip !text-[11px] !py-1 ${d.dq < 0 || d.dvalue < 0 ? 'bg-bad-soft text-bad border-bad/30' : 'bg-ok-soft text-ok border-ok/30'}`}>
                {d.siteId}/{d.locId} · {STOCK_TYPE_NAMES[d.stockType]} · qty {d.dq > 0 ? '+' : ''}{fmtNum(d.dq, 1)}{d.dvalue !== 0 ? ` · ₹${fmtNum(Math.abs(d.dvalue), 0)} ${d.dvalue < 0 ? 'out' : 'in'}` : ''}
              </span>
            ))}
          </div>
        </div>
      )}
      {preview.journal.length > 0 ? (
        <div>
          <div className="lbl mb-1.5">Journal that WILL post (account determination)</div>
          <JournalView lines={preview.journal} />
        </div>
      ) : (
        <InfoNote tone="info">This movement is not valuation-relevant — material document only, no accounting document (memo movement).</InfoNote>
      )}
    </div>
  );

  if (inline) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3"><FlaskConical size={15} className="text-acc" /><span className="font-disp font-bold text-[14px]">Movement parameters</span></div>
          {form}
          <div className="mt-4">{actions}</div>
        </div>
        <div className="card p-4">
          <div className="font-disp font-bold text-[14px] mb-3">Simulation result — nothing written yet</div>
          {previewPanel}
        </div>
      </div>
    );
  }

  return (
    <div>
      {form}
      <div className="mt-4">{actions}</div>
      <div className="mt-4">{previewPanel}</div>
    </div>
  );
}

/* used by simulator explainer */
export function valueFmt(n: number): string {
  return fmtINR(n);
}
