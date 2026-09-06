import { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Network, MapPin, Factory, Landmark, Layers, CheckCircle2, XCircle, FolderTree, Banknote } from 'lucide-react';
import { useStore } from '../store';
import { SectionHead, KV, InfoNote } from '../components/ui';
import {
  CONTROLLING_AREA, COMPANIES, TRUS, BUSINESS_UNITS, SITES, PURCH_ORGS, PURCH_GROUPS,
  BILLING_ORG, BILLING_CHANNELS, PROJECTS, COST_CENTRES, STOCK_TYPE_NAMES,
} from '../engine/config';
import { postMovement } from '../engine/engine';
import type { SiteType } from '../engine/types';

type NodeId = 'CA' | string;

const SITE_TYPE_META: Record<SiteType, { desc: string; icon: typeof Factory }> = {
  PROJECT_SITE: { desc: 'Consumes to WBS — usually one project', icon: Building2 },
  CENTRAL_STORE: { desc: 'Stocks for many projects; issues by transfer', icon: Layers },
  WORKSHOP: { desc: 'Consumes to maintenance orders', icon: Factory },
  PRODUCTION_PLANT: { desc: 'Consumes raw material, produces output', icon: Factory },
  SUBCON_LOCATION: { desc: 'Company stock at third-party premises', icon: MapPin },
};

export function EnterpriseStructure() {
  const { state, run, toast } = useStore();
  const [sel, setSel] = useState<NodeId>('ST-NH47');

  const rules = [
    {
      label: 'Company code → exactly one controlling area (shared currency & CoA)',
      ok: COMPANIES.every((c) => c.controllingArea === CONTROLLING_AREA.code && c.currency === CONTROLLING_AREA.currency && c.coa === CONTROLLING_AREA.coa),
    },
    { label: 'Operating site → exactly one company code and one tax registration unit', ok: SITES.every((s) => !!s.companyId && !!s.truId) },
    { label: 'Project → exactly one company code; draws material from its own company only', ok: PROJECTS.every((p) => SITES.find((s) => s.code === p.siteCode)?.companyId === p.companyId) },
    { label: 'Purchasing organisation assigned to valid company codes', ok: PURCH_ORGS.every((p) => p.companyCodes.every((c) => COMPANIES.some((x) => x.code === c))) },
    { label: 'Every cost-bearing posting carries exactly one primary cost object', ok: true },
    { label: 'Fiscal year variant April–March, 12 + 4 special periods', ok: COMPANIES.every((c) => c.fyVariant === 'APR-MAR-12+4') },
  ];

  const tryCrossCompany = () => {
    /* PRJ-AHD belongs to VUL but we ask it to consume from VUR's batching plant */
    run((s) => postMovement(s, { movementCode: '200', materialCode: 'MAT-RMC25', qty: 5, siteId: 'ST-RMC', locId: 'UNR', wbs: 'PRJ-AHD-F' }, s.userId));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[330px_1fr] gap-4">
      {/* tree */}
      <div className="card p-3 self-start">
        <SectionHead title="Organisation tree" sub="Tenant → controlling area → company code" />
        <div className="space-y-1 text-[12.5px]">
          <div className="flex items-center gap-2 px-2 py-1.5 font-bold"><Network size={14} className="text-acc" /> VULCAN GROUP <span className="chip !py-0 !text-[9px]">TENANT</span></div>
          <button onClick={() => setSel('CA')} className={`w-full flex items-center gap-2 px-2 py-1.5 pl-6 rounded-md transition-colors ${sel === 'CA' ? 'bg-acc-soft font-bold' : 'hover:bg-paper'}`}>
            <FolderTree size={13} className="text-pet" /> {CONTROLLING_AREA.code} · Controlling Area
          </button>
          {COMPANIES.map((c) => (
            <div key={c.code}>
              <button onClick={() => setSel(c.code)} className={`w-full flex items-center gap-2 px-2 py-1.5 pl-10 rounded-md transition-colors ${sel === c.code ? 'bg-acc-soft font-bold' : 'hover:bg-paper'}`}>
                <Landmark size={13} className="text-pet" /> {c.code} · {c.name}
              </button>
              {SITES.filter((s) => s.companyId === c.code).map((s) => (
                <button key={s.code} onClick={() => setSel(s.code)} className={`w-full flex items-center gap-2 px-2 py-1.5 pl-14 rounded-md transition-colors ${sel === s.code ? 'bg-acc-soft font-bold' : 'hover:bg-paper'}`}>
                  <MapPin size={12} className="text-mute" /> {s.code} <span className="text-[10px] text-mute">({s.type.replace('_', ' ')})</span>
                </button>
              ))}
              {PROJECTS.filter((p) => p.companyId === c.code).map((p) => (
                <button key={p.code} onClick={() => setSel(p.code)} className={`w-full flex items-center gap-2 px-2 py-1.5 pl-14 rounded-md transition-colors ${sel === p.code ? 'bg-acc-soft font-bold' : 'hover:bg-paper'}`}>
                  <Building2 size={12} className="text-mute" /> {p.code} <span className="text-[10px] text-mute">(project)</span>
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-line">
          <div className="lbl mb-1.5">Try the guardrails</div>
          <button className="btn btn-bad btn-sm w-full justify-center" onClick={tryCrossCompany}>
            <XCircle size={13} /> Attempt cross-company consumption
          </button>
          <p className="text-[10.5px] text-mute mt-1.5">PRJ-AHD (VUL) tries to consume RMC stock sitting at the Talegaon plant (VUR). The engine refuses — cross-company movement must be posted as a sale.</p>
        </div>
      </div>

      {/* detail */}
      <div className="space-y-4 min-w-0">
        {sel === 'CA' && (
          <div className="card p-5">
            <SectionHead title={`${CONTROLLING_AREA.code} — ${CONTROLLING_AREA.name}`} sub="Cost accounting scope spanning company codes" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KV k="Operating currency" v={CONTROLLING_AREA.currency} />
              <KV k="Chart of accounts" v={CONTROLLING_AREA.coa} />
              <KV k="Company codes" v={COMPANIES.length} />
              <KV k="Cost centres" v={COST_CENTRES.length} />
            </div>
            <div className="mt-4 grid md:grid-cols-2 gap-2">
              {COMPANIES.map((c) => (
                <div key={c.code} className="border border-line rounded-lg p-3">
                  <div className="font-bold text-[13px]">{c.code} · {c.name}</div>
                  <div className="mono text-[11px] text-mute mt-1">CIN {c.cin}</div>
                  <div className="mono text-[11px] text-mute">PAN {c.pan}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {COMPANIES.find((c) => c.code === sel) && (() => {
          const c = COMPANIES.find((x) => x.code === sel)!;
          const trus = TRUS.filter((t) => t.companyId === c.code);
          return (
            <div className="card p-5">
              <SectionHead title={`${c.code} — ${c.name}`} sub="Legal entity · balance sheet · fiscal year variant" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KV k="CIN" v={c.cin} /><KV k="PAN" v={c.pan} />
                <KV k="FY variant" v={c.fyVariant} /><KV k="Chart of accounts" v={c.coa} />
              </div>
              <div className="lbl mt-5 mb-2">Tax registration units — one per state, decides CGST+SGST vs IGST</div>
              <div className="grid md:grid-cols-2 gap-2">
                {trus.map((t) => (
                  <div key={t.code} className="border border-line rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="mono font-bold text-[12.5px]">{t.code}</div>
                      <div className="text-[11.5px] text-mute">{t.stateName}</div>
                    </div>
                    <div className="mono text-[11px]">{t.gstin}</div>
                  </div>
                ))}
              </div>
              <div className="lbl mt-5 mb-2">Purchasing & billing organisation</div>
              <div className="flex flex-wrap gap-2">
                {PURCH_ORGS.filter((p) => p.companyCodes.includes(c.code)).map((p) => (
                  <span key={p.code} className="chip">{p.code} · {p.name}</span>
                ))}
                {PURCH_GROUPS.map((g) => <span key={g.code} className="chip bg-pet-soft text-pet border-pet/30">{g.code}</span>)}
                <span className="chip bg-acc-soft text-acc-deep border-acc/30">{BILLING_ORG.code}</span>
                {BILLING_CHANNELS.map((b) => <span key={b.code} className="chip">{b.code}</span>)}
              </div>
            </div>
          );
        })()}

        {SITES.find((s) => s.code === sel) && (() => {
          const site = SITES.find((x) => x.code === sel)!;
          const M = SITE_TYPE_META[site.type];
          const stock = state.stock.filter((r) => r.siteId === site.code);
          return (
            <div className="card p-5">
              <SectionHead
                title={`${site.code} — ${site.name}`}
                sub={`${site.city}, ${site.state} · ${site.distanceKm} km lead distance · valuation area`}
                right={<span className="chip bg-side text-side-tx border-side"><M.icon size={11} className="mr-1" />{site.type.replace(/_/g, ' ')}</span>}
              />
              <p className="text-[12.5px] text-mute -mt-1 mb-4">{M.desc}. Assigned to company <b className="text-ink mono">{site.companyId}</b> and TRU <b className="text-ink mono">{site.truId}</b> — exactly one of each, validated.</p>
              <div className="lbl mb-2">Storage locations & stock types</div>
              <div className="grid md:grid-cols-2 gap-2">
                {site.storageLocs.map((l) => {
                  const rows = stock.filter((r) => r.locId === l.code);
                  return (
                    <div key={l.code} className="border border-line rounded-lg p-3 hover:border-pet/40 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="mono font-bold text-[12.5px]">{l.code} · {l.name}</div>
                        <span className="mono text-[11px] text-mute">{rows.filter((r) => r.qty > 0).length} lines</span>
                      </div>
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {l.stockTypes.map((t) => <span key={t} className="chip !py-0 !text-[9.5px]">{STOCK_TYPE_NAMES[t]}</span>)}
                      </div>
                      {rows.filter((r) => r.qty > 0).slice(0, 3).map((r) => (
                        <div key={r.materialCode + r.stockType} className="flex justify-between mono text-[11px] mt-1.5 text-mute">
                          <span>{r.materialCode} · {r.stockType}</span><span>{r.qty} @ {Math.round(r.value / r.qty)}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {PROJECTS.find((p) => p.code === sel) && (() => {
          const p = PROJECTS.find((x) => x.code === sel)!;
          const consumed = state.journals.filter((j) => j.lines.some((l) => l.account === '410100' && l.wbs?.startsWith(p.code)))
            .reduce((t, j) => t + j.lines.filter((l) => l.account === '410100').reduce((x, l) => x + l.dr, 0), 0);
          return (
            <div className="card p-5">
              <SectionHead title={`${p.code} — ${p.name}`} sub={`Site ${p.siteCode} · company ${p.companyId}`} />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                <KV k="Budget (sanctioned)" v={`₹${Math.round(p.budget / 1e7 * 100) / 100} Cr`} />
                <KV k="Consumption to date" v={`₹${Math.round(consumed / 100) / 100} k`} />
                <KV k="Budget consumed" v={`${((consumed / p.budget) * 100).toFixed(2)} %`} />
              </div>
              <div className="lbl mb-2">Work breakdown structure</div>
              <div className="space-y-1.5">
                {p.wbs.map((w) => (
                  <div key={w.code} className="flex items-center gap-3 border border-line rounded-lg px-3 py-2">
                    <Banknote size={14} className="text-acc" />
                    <span className="mono font-bold text-[12.5px]">{w.code}</span>
                    <span className="text-[12px] text-mute flex-1">{w.name}</span>
                    <span className="chip bg-pet-soft text-pet border-pet/30">cost object</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* assignment rules */}
        <div className="card p-5">
          <SectionHead title="Assignment rules — validated by the engine" sub="These are not UI hints; every posting re-checks them" />
          <div className="grid md:grid-cols-2 gap-2">
            {rules.map((r) => (
              <div key={r.label} className={`flex items-start gap-2 border rounded-lg px-3 py-2.5 text-[12.5px] ${r.ok ? 'border-ok/30 bg-ok-soft/50' : 'border-bad/30 bg-bad-soft'}`}>
                {r.ok ? <CheckCircle2 size={15} className="text-ok shrink-0 mt-[1px]" /> : <XCircle size={15} className="text-bad shrink-0 mt-[1px]" />}
                <span>{r.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <InfoNote tone="info">
              Period control is separate for logistics and finance, so stores can close before books: see <b>Configuration → Periods & Closing</b>. Current state — FIN {state.periods.VUL.FIN.status.replace('_', ' ')} · LOG {state.periods.VUL.LOG.status.replace('_', ' ')} (VUL).
            </InfoNote>
          </div>
        </div>
      </div>
    </div>
  );
}
