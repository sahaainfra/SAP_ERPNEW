import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Network, GitBranch, TrendingUp, Gauge, Layers, ArrowDownRight, ArrowUpRight, Lock, FilePlus2 } from 'lucide-react';
import { useStore } from '../store';
import { SectionHead, KV, InfoNote, Empty, Tabs, Field, Modal, Money } from '../components/ui';
import {
  assignedValue, currentBudget, checkAvailability, fmtINR, fmtNum, approveDoc,
} from '../engine/engine';
import {
  wbsNode, wbsChildren, acceptsCost, acceptsBilling, earnedValue, costControlLine,
  applyBudgetOnRelease, createBudgetDoc, runResultsAnalysis, settleMaintenanceOrder,
  restructureWbs, resolveWbs, physicalProgress, financialProgress, toleranceProfile,
} from '../engine/prj';
import { WBS_TREE, BUDGET_TOLERANCE, SETTLEMENT_RULES, PROJECTS } from '../engine/config';
import type { WbsNode } from '../engine/types';

const NODE_COLOR: Record<string, string> = { SUMMARY: 'bg-side text-white', ACCOUNT_ASSIGNMENT: 'bg-pet text-white', BILLING: 'bg-acc text-white', BOTH: 'bg-ink-2 text-white' };

function NodeChip({ n }: { n: WbsNode }) {
  return <span className={`chip !text-[9px] ${NODE_COLOR[n.nodeType]} !border-transparent`}>{n.nodeType === 'ACCOUNT_ASSIGNMENT' ? 'A/A' : n.nodeType === 'BILLING' ? 'BILL' : n.nodeType === 'BOTH' ? 'A/A+BILL' : 'SUMMARY'}</span>;
}
const STATUS_COLOR: Record<string, string> = { CREATED: 'text-mute', RELEASED: 'text-ok', TECH_COMPLETE: 'text-warn', CLOSED: 'text-bad' };

function WbsTree() {
  const { state } = useStore();
  const [sel, setSel] = useState<string>('PRJ-NH47');
  const roots = WBS_TREE.filter((w) => !w.parent);
  const renderNode = (n: WbsNode, depth: number) => {
    const kids = wbsChildren(n.code);
    const av = currentBudget(state, n.code) > 0 ? checkAvailability(state, n.code, 0) : null;
    return (
      <div key={n.code}>
        <button onClick={() => setSel(n.code)} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors ${sel === n.code ? 'bg-acc-soft border border-acc/40' : 'hover:bg-paper'}`} style={{ paddingLeft: `${depth * 18 + 8}px` }}>
          <Network size={13} className={n.nodeType === 'SUMMARY' ? 'text-side' : 'text-pet'} />
          <span className="mono text-[11px] text-mute">{n.code}</span>
          <span className="text-[12.5px] font-semibold flex-1 truncate">{n.name}</span>
          <NodeChip n={n} />
          <span className={`text-[10px] mono font-semibold ${STATUS_COLOR[n.status]}`}>{n.status.replace('_', ' ')}</span>
          {av && <span className={`mono text-[11px] font-bold ${av.usagePct > 100 ? 'text-bad' : av.usagePct > 90 ? 'text-warn' : 'text-ok'}`}>{av.usagePct}%</span>}
        </button>
        {kids.map((k) => renderNode(k, depth + 1))}
      </div>
    );
  };
  const selected = wbsNode(sel)!;
  const av = currentBudget(state, sel) > 0 ? checkAvailability(state, sel, 0) : null;
  const asg = assignedValue(state, sel);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[330px_1fr] gap-4">
      <div className="card p-2.5">
        <SectionHead title="WBS hierarchy" sub="Node type decides what may post here" />
        <div className="mt-2">{roots.map((r) => renderNode(r, 0))}</div>
      </div>
      <div className="space-y-4">
        <div className="card p-4">
          <SectionHead title={`${selected.code} — ${selected.name}`} right={<span className="flex gap-1.5"><NodeChip n={selected} /><span className={`chip ${STATUS_COLOR[selected.status]}`}>{selected.status.replace('_', ' ')}</span></span>} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            <KV k="Accepts cost" v={acceptsCost(selected) ? '✓ yes' : '✗ summary'} />
            <KV k="Accepts billing" v={acceptsBilling(selected) ? '✓ yes' : '✗ no'} />
            <KV k="Cost centre" v={selected.costCentre ?? '—'} />
            <KV k="Profit centre" v={selected.profitCentre ?? '—'} />
          </div>
          {!acceptsCost(selected) && (
            <InfoNote tone="warn">Summary node — aggregates children only. A cost posted directly here is refused: every cost-bearing document must resolve to exactly one leaf cost object.</InfoNote>
          )}
        </div>

        {av && (
          <div className="card p-4">
            <SectionHead title="Budget & availability control" sub={`Tolerance: ${BUDGET_TOLERANCE.map((t) => `${t.pct}%→${t.action}`).join(' · ')}`} />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              <KV k="Current budget" v={fmtINR(av.budget)} />
              <KV k="Assigned value" v={fmtINR(av.assigned)} />
              <KV k="Availability" v={<span className={av.availability < 0 ? 'text-bad font-bold' : ''}>{fmtINR(av.availability)}</span>} />
              <KV k="Usage" v={<span className={av.usagePct > 100 ? 'text-bad font-bold' : av.usagePct > 90 ? 'text-warn font-bold' : 'text-ok font-bold'}>{av.usagePct}%</span>} />
            </div>
            <div className="mt-3">
              <div className="h-2.5 rounded-full bg-paper overflow-hidden border border-line">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, av.usagePct)}%`, background: av.usagePct > 100 ? 'var(--color-bad)' : av.usagePct > 90 ? 'var(--color-warn)' : 'var(--color-ok)' }} />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-[11px]">
              <div className="rounded-lg border border-line p-2"><div className="lbl">Open PRs</div><div className="mono font-semibold mt-0.5">{fmtINR(asg.openPR)}</div></div>
              <div className="rounded-lg border border-line p-2"><div className="lbl">Open POs (commit)</div><div className="mono font-semibold mt-0.5">{fmtINR(asg.openPO)}</div></div>
              <div className="rounded-lg border border-line p-2"><div className="lbl">Actual cost</div><div className="mono font-semibold mt-0.5">{fmtINR(asg.actual)}</div></div>
              <div className="rounded-lg border border-line p-2"><div className="lbl">Reserved stock</div><div className="mono font-semibold mt-0.5">{fmtINR(asg.reserved)}</div></div>
            </div>
            <InfoNote tone={av.action === 'BLOCK' ? 'bad' : av.action === 'PASS' ? 'ok' : 'warn'}>{av.note}</InfoNote>
          </div>
        )}
      </div>
    </div>
  );
}

function BudgetSupplement() {
  const { state, run } = useStore();
  const [wbs, setWbs] = useState('PRJ-NH47-E');
  const [amount, setAmount] = useState(2500000);
  const [reason, setReason] = useState('Steel rate escalation — revised forecast');
  const [kind, setKind] = useState<'BUD-SUP' | 'BUD-RET'>('BUD-SUP');
  const budgetDocs = state.docs.filter((d) => d.type.startsWith('BUD-'));
  const pending = budgetDocs.filter((d) => d.status === 'PENDING_RELEASE');

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <div className="card p-4">
        <SectionHead title="Budget change — approved document" sub="A supplement/return is a document, never a field edit" />
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Field label="WBS element"><select className="inp" value={wbs} onChange={(e) => setWbs(e.target.value)}>{WBS_TREE.filter((w) => w.budgetElement).map((w) => <option key={w.code} value={w.code}>{w.code}</option>)}</select></Field>
          <Field label="Type"><select className="inp" value={kind} onChange={(e) => setKind(e.target.value as 'BUD-SUP' | 'BUD-RET')}><option value="BUD-SUP">BUD-SUP · Supplement</option><option value="BUD-RET">BUD-RET · Return</option></select></Field>
          <Field label="Amount ₹"><input type="number" className="inp mono" value={amount} onChange={(e) => setAmount(+e.target.value)} /></Field>
          <Field label="Reason (mandatory)" req><input className="inp" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        </div>
        <button className="btn btn-acc mt-3" onClick={() => run((s) => createBudgetDoc(s, { wbs, amount, kind, reason, submit: true }, s.userId))}><FilePlus2 size={14} /> Submit for approval</button>
        <div className="mt-3">
          <div className="lbl mb-1.5">Budget change history</div>
          {budgetDocs.length === 0 ? <Empty text="No budget documents yet." /> : (
            <table className="tbl"><thead><tr><th>Number</th><th>Type</th><th>WBS</th><th className="num">Amount</th><th>Status</th></tr></thead>
              <tbody>{budgetDocs.map((d) => (
                <tr key={d.id}><td className="mono text-[11px]">{d.number ?? 'draft'}</td><td className="mono text-[11px]">{d.type}</td><td className="mono text-[11px]">{d.wbs}</td><td className="num">{fmtINR(d.total)}</td><td><span className={`chip ${d.status === 'RELEASED' ? '!bg-ok-soft !text-ok' : '!bg-warn-soft !text-warn'}`}>{d.status}</span></td></tr>
              ))}</tbody></table>
          )}
        </div>
      </div>
      <div className="card p-4">
        <SectionHead title="Pending approvals" sub="Approving applies the change to the budget immediately" />
        <div className="mt-3 space-y-2">
          {pending.length === 0 ? <Empty text="No budget documents awaiting approval." /> : pending.map((d) => (
            <div key={d.id} className="flex items-center gap-3 rounded-lg border border-line p-3">
              <div className="flex-1"><div className="text-[12.5px] font-semibold">{d.type} · {d.wbs}</div><div className="text-[11px] text-mute">{d.reason}</div></div>
              <div className="mono font-bold">{fmtINR(d.total)}</div>
              <button className="btn btn-ok btn-sm" onClick={() => run((s) => { const r = approveBudget(s, d.id, s.userId); return r; })}>Approve</button>
            </div>
          ))}
        </div>
        <InfoNote tone="info">Approval is maker≠checker enforced. On release, the budget line updates and a field-level change document records old→new with reason.</InfoNote>
      </div>
    </div>
  );
}

function approveBudget(sIn: import('../engine/types').ERPState, docId: string, userId: string) {
  /* delegate to the generic release engine, then apply the budget effect */
  const { approveDoc } = require('../engine/engine');
  const s = approveDoc(sIn, docId, 'APPROVE', 'Budget change approved', userId);
  const doc = s.s.docs.find((d: { id: string }) => d.id === docId);
  if (doc && doc.status === 'RELEASED') applyBudgetOnRelease(s.s, docId);
  return s;
}

function ResultsAnalysis() {
  const { state, run } = useStore();
  const latest = state.raRunHistory[0];
  return (
    <div className="card p-4">
      <SectionHead title="Results analysis & work in progress" sub="Turns executed work into revenue; onerous contracts provisioned in full, immediately" right={
        <button className="btn btn-acc btn-sm" onClick={() => run((s) => runResultsAnalysis(s, { projectCode: 'PRJ-NH47', period: '2026-01', actualCost: 3_40_00_000, estimatedTotalCost: 8_05_00_000, revisedContractValue: 8_65_00_000, billedToDate: 1_92_00_000, physicalPct: 44, basis: 'COST' }, s.userId))}><TrendingUp size={13} /> Run RA (Jan)</button>
      } />
      {latest ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mt-3">
            <KV k="PoC (cost basis)" v={`${latest.pocCost}%`} />
            <KV k="PoC (physical)" v={`${latest.pocPhysical}%`} />
            <KV k="Calculated revenue" v={fmtINR(latest.calculatedRevenue)} />
            <KV k="Unbilled (asset)" v={<span className="text-pet font-bold">{fmtINR(latest.unbilled)}</span>} />
            <KV k="Billing in advance" v={fmtINR(latest.billingInAdvance)} />
            <KV k="Onerous provision" v={<span className={latest.expectedLoss > 0 ? 'text-bad font-bold' : ''}>{fmtINR(latest.expectedLoss)}</span>} />
          </div>
          <InfoNote tone={latest.expectedLoss > 0 ? 'bad' : 'ok'}>{latest.expectedLoss > 0 ? 'Forecast cost exceeds revised contract value — the entire expected loss is provided now, not discovered 18 months late.' : 'Calculated revenue vs billed: unbilled revenue posted as a contract asset (Dr 150100 / Cr 310300), reversed & re-run monthly.'}</InfoNote>
        </>
      ) : <Empty text="Run results analysis to post the period's revenue & WIP." />}
    </div>
  );
}

function EarnedValue() {
  const evm = earnedValue(7_20_00_000, 40, 41, 3_05_00_000, 4_60_00_000);
  return (
    <div className="card p-4">
      <SectionHead title="Earned value (PRJ-NH47)" sub="CPI = EV÷AC · SPI = EV÷PV · EAC method shown" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
        <KV k="PV (planned)" v={fmtINR(evm.pv)} />
        <KV k="EV (earned)" v={fmtINR(evm.ev)} />
        <KV k="AC (actual)" v={fmtINR(evm.ac)} />
        <KV k="CV / SV" v={<span className={evm.cv >= 0 ? 'text-ok' : 'text-bad'}>{fmtINR(evm.cv)} / {fmtINR(evm.sv)}</span>} />
        <KV k="CPI" v={<span className={evm.cpi >= 1 ? 'text-ok font-bold' : 'text-bad font-bold'}>{evm.cpi}</span>} />
        <KV k="SPI" v={<span className={evm.spi >= 1 ? 'text-ok font-bold' : 'text-warn font-bold'}>{evm.spi}</span>} />
        <KV k="EAC (BAC÷CPI)" v={fmtINR(evm.eacCpi)} />
        <KV k="EAC (AC+ETC)" v={fmtINR(evm.eacActualEtc)} />
      </div>
    </div>
  );
}

function ProgressSplit() {
  const { state } = useStore();
  const rows = ['PRJ-NH47-E', 'PRJ-NH47-S', 'PRJ-NH47-P', 'PRJ-AHD-F', 'PRJ-AHD-D'].map((w) => ({ w, physical: physicalProgress(state, w), financial: financialProgress(state, 8_65_00_000, 1_92_00_000) }));
  return (
    <div className="card p-4">
      <SectionHead title="Physical vs financial progress — never one number" sub="Physical = weighted units complete · Financial = certified ÷ contract value" />
      <table className="tbl mt-3"><thead><tr><th>WBS</th><th className="num">Physical %</th><th className="num">Financial %</th><th>Source</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.w}>
            <td className="mono text-[11px]">{r.w}</td>
            <td className="num text-pet font-bold">{r.physical}%</td>
            <td className="num text-acc-deep font-bold">{r.financial}%</td>
            <td className="text-[11px] text-mute">physical: measurement roll-up · financial: certified billing</td>
          </tr>
        ))}</tbody></table>
    </div>
  );
}

export function ProjectPage() {
  const [tab, setTab] = useState('wbs');
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 max-w-[1460px] mx-auto">
      <Tabs val={tab} onChange={setTab} tabs={[
        { id: 'wbs', label: 'WBS & Availability' }, { id: 'budget', label: 'Budget Control' },
        { id: 'ra', label: 'Results Analysis' }, { id: 'cost', label: 'Cost Control & EVM' },
      ]} />
      {tab === 'wbs' && <WbsTree />}
      {tab === 'budget' && <BudgetSupplement />}
      {tab === 'ra' && <div className="space-y-4"><ResultsAnalysis /><ProgressSplit /></div>}
      {tab === 'cost' && <CostControl />}
    </motion.div>
  );
}

function CostControl() {
  const { state, run } = useStore();
  const lines = [
    costControlLine(120000, 165, 124000, 171, 'CC-MAT · Earthworks', 18_00_000, 92_00_000),
    costControlLine(9500, 6900, 9800, 7250, 'CC-MAT · Structures', 26_00_000, 41_00_000),
  ];
  return (
    <div className="space-y-4">
      <div className="card p-4">
        <SectionHead title="Cost control — quantity vs rate variance split" sub="Turns 'over budget' into 'rate moved X%, consumption Y% above norm'" />
        <table className="tbl mt-3"><thead><tr><th>Cost object</th><th className="num">Budget</th><th className="num">Commit</th><th className="num">Actual</th><th className="num">Forecast (EAC)</th><th className="num">Variance</th><th className="num">Qty var</th><th className="num">Rate var</th></tr></thead>
          <tbody>{lines.map((l) => (
            <tr key={l.costCode}>
              <td className="text-[12px] font-semibold">{l.costCode}</td>
              <td className="num">{fmtINR(l.budget)}</td><td className="num">{fmtINR(l.commitment)}</td><td className="num">{fmtINR(l.actual)}</td><td className="num">{fmtINR(l.forecast)}</td>
              <td className={`num font-bold ${l.variance > 0 ? 'text-bad' : 'text-ok'}`}>{l.variance > 0 ? '+' : ''}{fmtINR(l.variance)}</td>
              <td className={`num ${l.qtyVariance > 0 ? 'text-bad' : 'text-ok'}`}>{fmtINR(l.qtyVariance)}</td>
              <td className={`num ${l.rateVariance > 0 ? 'text-bad' : 'text-ok'}`}>{fmtINR(l.rateVariance)}</td>
            </tr>
          ))}</tbody></table>
      </div>
      <EarnedValue />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card p-4">
          <SectionHead title="Settlement rules" sub="Cost collected below settles upward — configuration, not code" />
          <table className="tbl mt-3"><thead><tr><th>From</th><th>To</th><th>Then</th><th>Driver</th></tr></thead>
            <tbody>{SETTLEMENT_RULES.map((r) => <tr key={r.from}><td className="text-[12px]">{r.from}</td><td className="text-[12px]">{r.to}</td><td className="text-[12px]">{r.then}</td><td className="mono text-[11px]">{r.driver}</td></tr>)}</tbody></table>
          <button className="btn btn-sm mt-3" onClick={() => { const mo = state.maintOrders.find((o) => !o.settled && o.sparesCost + o.laborCost + o.extCost > 0); if (mo) run((s) => settleMaintenanceOrder(s, mo.id, s.userId)); }}><ArrowDownRight size={13} /> Settle open maintenance order</button>
        </div>
        <div className="card p-4">
          <SectionHead title="WBS versioning" sub="Restructure creates a version; history reads through the mapping" />
          <p className="text-[12px] text-mute mt-2">Renaming or re-parenting a live node never rewrites postings. A new version stores an old→new mapping; deletion of a posted-to node is impossible.</p>
          <div className="flex gap-2 mt-3">
            <button className="btn btn-sm" onClick={() => run((s) => restructureWbs(s, 'PRJ-NH47', [{ from: 'PRJ-NH47-P', to: 'PRJ-NH47-P' }], 'Chainage re-baselining', s.userId))}><GitBranch size={13} /> Record restructure v{(state.wbsVersions['PRJ-NH47']?.length ?? 0) + 1}</button>
          </div>
          {(state.wbsVersions['PRJ-NH47'] ?? []).map((v) => (
            <div key={v.version} className="mt-2 rounded-lg border border-line p-2.5 text-[11.5px]"><span className="mono font-bold">v{v.version}</span> · {v.at} · {v.reason}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
