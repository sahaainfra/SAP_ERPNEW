import { useState } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  Gauge, Network, Boxes, ShoppingCart, Warehouse, SlidersHorizontal,
  ScrollText, RotateCcw, ChevronDown, ShieldCheck, HardHat, MessageSquare,
  ShieldAlert, Wrench, FlaskConical, CheckCheck, LayoutDashboard,
} from 'lucide-react';
import { useStore, useNav } from '../store';
import type { PageId } from '../store';
import { Toasts, PeriodChip } from './ui';
import { ChatDrawer } from './ChatDrawer';
import { USERS, ROLES, COMPANIES } from '../engine/config';
import { userById, periodLabel, pendingReleaseDocs } from '../engine/engine';

const NAV: { group: string; items: { id: PageId; label: string; icon: typeof Gauge }[] }[] = [
  {
    group: 'Foundation',
    items: [
      { id: 'launchpad', label: 'Launchpad', icon: LayoutDashboard },
      { id: 'cockpit', label: 'Operations Cockpit', icon: Gauge },
      { id: 'gate', label: 'Part 1 Acceptance Gate', icon: ShieldAlert },
      { id: 'gate6', label: 'Part 6 Acceptance Gate', icon: ShieldCheck },
      { id: 'gate7', label: 'Part 7 Acceptance Gate', icon: ShieldCheck },
      { id: 'gate8', label: 'Part 8 Acceptance Gate', icon: ShieldCheck },
      { id: 'gate10a', label: 'Part 10A Acceptance Gate', icon: ShieldCheck },
      { id: 'gate10b', label: 'Part 10B Acceptance Gate', icon: ShieldCheck },
    ],
  },
  {
    group: 'Modules on the platform',
    items: [
      { id: 'procurement', label: 'Procurement · PRC', icon: ShoppingCart },
      { id: 'inventory', label: 'Inventory · INV', icon: Warehouse },
      { id: 'plant', label: 'Plant & Machinery · EAM', icon: Wrench },
      { id: 'quality', label: 'Quality · QMS', icon: CheckCheck },
    ],
  },
  {
    group: 'Masters & structure',
    items: [
      { id: 'structure', label: 'Enterprise Structure', icon: Network },
      { id: 'masters', label: 'Master Data', icon: Boxes },
    ],
  },
  {
    group: 'Platform core',
    items: [
      { id: 'config', label: 'Configuration', icon: SlidersHorizontal },
      { id: 'simulator', label: 'Posting Simulator', icon: FlaskConical },
      { id: 'audit', label: 'Audit & Control', icon: ScrollText },
    ],
  },
];

function UserSwitcher() {
  const { state, setUser } = useStore();
  const [open, setOpen] = useState(false);
  const me = userById(state.userId);
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2.5 pl-2 pr-2.5 py-1.5 rounded-lg border border-line bg-panel hover:border-ink-2 transition-colors">
        <span className="w-7 h-7 rounded-full grid place-items-center text-white text-[11px] font-bold font-disp" style={{ background: me.color }}>
          {me.name.split(' ').map((x) => x[0]).join('').slice(0, 2)}
        </span>
        <span className="text-left hidden sm:block">
          <span className="block text-[12px] font-bold leading-none">{me.name}</span>
          <span className="block text-[10.5px] text-mute mt-0.5">{me.title}</span>
        </span>
        <ChevronDown size={14} className="text-mute" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            className="absolute right-0 top-full mt-1.5 w-[300px] card shadow-2xl z-50 p-1.5 max-h-[70vh] overflow-y-auto"
          >
            <div className="lbl px-2.5 py-1.5">Act as — authorization context</div>
            {USERS.map((u) => (
              <button key={u.id} onClick={() => { setUser(u.id); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors ${u.id === state.userId ? 'bg-acc-soft' : 'hover:bg-paper'}`}>
                <span className="w-7 h-7 shrink-0 rounded-full grid place-items-center text-white text-[10px] font-bold" style={{ background: u.color }}>
                  {u.name.split(' ').map((x) => x[0]).join('').slice(0, 2)}
                </span>
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-bold leading-tight">{u.name} <span className="text-mute font-medium">· {u.title}</span></span>
                  <span className="flex flex-wrap gap-1 mt-1">
                    {u.roles.map((r) => <span key={r} className="chip !py-0 !px-1.5 !text-[9.5px]">{ROLES.find((x) => x.id === r)?.name}</span>)}
                  </span>
                </span>
              </button>
            ))}
            <div className="px-2.5 py-2 text-[10.5px] text-mute border-t border-line mt-1">
              Role bundles resolve to authorization objects checked at the API layer — switching users changes what the engine permits.
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { state, reset, setCompanyFilter } = useStore();
  const { page, go } = useNav();
  const [chatOpen, setChatOpen] = useState(false);
  const pending = pendingReleaseDocs(state).length;
  const secFails = state.authFailCount;
  const threads = state.conversations.length;
  const per = state.periods['VUL'];
  const titles: Record<PageId, [string, string]> = {
    cockpit: ['Operations Cockpit', 'Live position across logistics, finance and control'],
    launchpad: ['Launchpad', 'Your personalized dashboard with actionable work items and key metrics'],
    gate: ['Part 1 Acceptance Gate', '40 executable tests — the platform proves itself before Part 2'],
    gate6: ['Part 6 Acceptance Gate', '40 tests — contracts, measurement, billing, subcontract & receivables'],
    gate7: ['Part 7 Acceptance Gate', '45 tests — finance, controlling, taxation, statutory, legal & instruments'],
    gate8: ['Part 8 Acceptance Gate', '40 tests — people, plant, production, quality & safety'],
    gate9: ['Part 9 Acceptance Gate', '35 tests — communication suite & shared tool library'],
    gate10a: ['Part 10A Acceptance Gate', '22 tests — launchpad, dashboards & design system'],
    gate10b: ['Part 10B Acceptance Gate', '24 tests — mobile, offline sync & external portals'],
    gate10c: ['Part 10C Acceptance Gate', '26 tests — tender & bid, analytics, AI, extensibility'],
    structure: ['Enterprise Structure', 'The organisational skeleton every posting attaches to'],
    masters: ['Master Data', 'One record, many view segments — governed end to end'],
    procurement: ['Procurement', 'Requisition → order → receipt → invoice, on one document spine'],
    inventory: ['Inventory & Stock', 'Every stock change is a movement type — nothing touches stock directly'],
    plant: ['Plant & Machinery', 'Hour-meter discipline, fuel exceptions and internal hire posting'],
    quality: ['Quality Management', 'Inspection lots, usage decisions and non-conformance'],
    simulator: ['Posting Simulator', 'See the exact journal before anything is written'],
    config: ['Configuration Backbone', 'Document types · movements · pricing · accounts · release · periods'],
    audit: ['Audit & Control', 'Field-level change documents, security events and dual control'],
  };
  const [t, sub] = titles[page];

  return (
    <div className="h-full flex">
      {/* ---------- sidebar ---------- */}
      <aside className="w-[236px] shrink-0 bg-side text-side-tx flex flex-col border-r border-black/40">
        <div className="hazard h-[5px] shrink-0" />
        <div className="px-4 pt-4 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-side-2 border border-white/10 grid place-items-center text-acc">
              <HardHat size={17} />
            </span>
            <div>
              <div className="font-disp font-extrabold text-white text-[15px] tracking-tight leading-none">VULCAN<span className="text-acc"> ERP</span></div>
              <div className="text-[9px] font-mono tracking-[0.22em] text-side-tx/70 mt-1">PART 1/10 · FOUNDATION</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-2.5 pb-4 space-y-3.5">
          {NAV.map((g) => (
            <div key={g.group}>
              <div className="px-2.5 pb-1.5 text-[9.5px] font-mono tracking-[0.2em] text-side-tx/50 uppercase">{g.group}</div>
              <div className="space-y-0.5">
                {g.items.map((it) => (
                  <button key={it.id} className={`nav-item ${page === it.id ? 'on' : ''}`} onClick={() => go(it.id)}>
                    <it.icon size={15} className={page === it.id ? 'text-acc' : ''} />
                    <span className="flex-1">{it.label}</span>
                    {it.id === 'procurement' && pending > 0 && <span className="chip !py-0 !px-1.5 !text-[9.5px] bg-acc text-white border-acc">{pending}</span>}
                    {it.id === 'audit' && secFails > 0 && <span className="chip !py-0 !px-1.5 !text-[9.5px] bg-bad text-white border-bad">{secFails}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10 shrink-0">
          <div className="rounded-lg bg-side-2 border border-white/10 p-2.5">
            <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-white"><ShieldCheck size={13} className="text-ok" /> Integrated posting</div>
            <div className="text-[10px] leading-snug text-side-tx/80 mt-1">Logistics and finance commit in one transaction — or not at all.</div>
          </div>
        </div>
      </aside>

      {/* ---------- main ---------- */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-[58px] shrink-0 bg-panel/85 backdrop-blur border-b border-line flex items-center gap-3 px-5">
          <div className="min-w-0 flex-1">
            <h1 className="font-disp font-extrabold text-[16.5px] tracking-tight leading-none truncate">{t}</h1>
            <p className="text-[11px] text-mute mt-0.5 truncate">{sub}</p>
          </div>
          <div className="hidden md:flex items-center gap-1.5">
            <span className="lbl">FIN</span><PeriodChip s={per.FIN.status} />
            <span className="lbl ml-1">LOG</span><PeriodChip s={per.LOG.status} />
            <span className="chip ml-1">{periodLabel(state.today)}</span>
          </div>
          <button className="btn btn-sm relative" onClick={() => setChatOpen(true)} title="Record-bound conversation threads">
            <MessageSquare size={13} /> Threads
            {threads > 0 && <span className="chip !py-0 !px-1.5 !text-[9.5px] bg-pet text-white border-pet">{threads}</span>}
          </button>
          <select className="inp !w-[150px] !py-1.5 !text-[12px]" value={state.companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
            <option value="ALL">All companies</option>
            {COMPANIES.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name.split(' ')[0]}</option>)}
          </select>
          <UserSwitcher />
          <button className="btn btn-sm" onClick={reset} title="Rebuild the demo opening position"><RotateCcw size={13} /> Reset</button>
        </header>
        <main className="flex-1 overflow-y-auto">
          <motion.div key={page} className="fade-up p-5 max-w-[1460px] mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {children}
          </motion.div>
        </main>
      </div>
      <ChatDrawer open={chatOpen} onClose={() => setChatOpen(false)} />
      <Toasts />
    </div>
  );
}
