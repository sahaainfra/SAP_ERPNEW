import { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Play, CheckCircle2, XCircle, ChevronRight, Timer, FlaskConical, FileCheck2 } from 'lucide-react';
import { GATE_TESTS, GATE_GROUPS, runSingleTest, freshGateBase } from '../engine/gate';
import type { GateResult } from '../engine/gate';
import type { ERPState } from '../engine/types';
import { fmtINR } from '../engine/engine';
import { useStore } from '../store';

type Status = 'IDLE' | 'RUNNING' | 'PASS' | 'FAIL';

export function GatePage() {
  const { state } = useStore();
  const [results, setResults] = useState<Record<number, GateResult>>({});
  const [status, setStatus] = useState<Status>('IDLE');
  const [openId, setOpenId] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const baseRef = useRef<ERPState | null>(null);
  const timerRef = useRef<number[]>([]);

  const done = Object.values(results);
  const passed = done.filter((r) => r.pass).length;
  const failed = done.length - passed;
  const totalMs = done.reduce((t, r) => t + r.ms, 0);
  const pct = Math.round((passed / GATE_TESTS.length) * 100);

  const runAll = () => {
    timerRef.current.forEach(clearTimeout);
    timerRef.current = [];
    baseRef.current = freshGateBase();
    setResults({});
    setStatus('RUNNING');
    setOpenId(null);
    GATE_TESTS.forEach((t, i) => {
      const id = window.setTimeout(() => {
        setActiveId(t.id);
        const base = baseRef.current!;
        window.setTimeout(() => {
          const r = runSingleTest(base, t);
          setResults((prev) => ({ ...prev, [t.id]: r }));
          setActiveId(null);
          if (i === GATE_TESTS.length - 1) {
            setStatus('IDLE');
          }
        }, 30);
      }, i * 150);
      timerRef.current.push(id);
    });
  };

  const running = status === 'RUNNING';
  const allDone = done.length === GATE_TESTS.length;

  return (
    <div className="space-y-4 fade-up">
      {/* ---- console header ---- */}
      <div className="relative overflow-hidden rounded-xl bg-side text-white border border-black/40">
        <div className="hazard h-[5px]" />
        <div className="absolute -right-24 -top-24 w-[420px] h-[420px] rounded-full opacity-[0.08]" style={{ background: 'radial-gradient(circle, #e8590c 0%, transparent 65%)' }} />
        <div className="p-5 sm:p-6 flex flex-col lg:flex-row gap-6 lg:items-center relative">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-mono tracking-[0.24em] text-side-tx/80">
              <ShieldCheck size={13} className="text-acc" /> PART 1 OF 10 · ACCEPTANCE GATE · 40 EXECUTABLE TESTS
            </div>
            <h1 className="font-disp font-extrabold text-[26px] sm:text-[32px] leading-none tracking-tight mt-2.5">
              The platform must <span className="text-acc">prove itself</span> before Part 2 begins.
            </h1>
            <p className="text-[12.5px] text-side-tx mt-2.5 max-w-[640px] leading-relaxed">
              Every test below runs against a private clone of the live dataset — the engine is executed, not described.
              Evidence is returned with each verdict. Nothing is stubbed: numbering stress, rollback leakage, maker-checker
              refusals and period locks all happen for real.
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <button className="btn btn-acc" disabled={running} onClick={runAll}>
                <Play size={14} /> {allDone ? 'Re-run all 40 tests' : 'Run the full gate'}
              </button>
              <span className="chip !bg-white/5 !border-white/15 !text-side-tx"><Timer size={11} /> {allDone ? `${(totalMs / 1000).toFixed(2)} s engine time` : running ? 'executing…' : 'ready'}</span>
              <span className="chip !bg-white/5 !border-white/15 !text-side-tx"><FlaskConical size={11} /> scratch datasets · live data untouched</span>
            </div>
          </div>

          {/* meter */}
          <div className="shrink-0 w-full lg:w-[240px] rounded-lg bg-white/[0.04] border border-white/10 p-4">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-[9.5px] font-mono tracking-[0.2em] text-side-tx/70">GATE STATUS</div>
                <div className={`font-disp font-extrabold text-[30px] leading-none mt-1 ${failed > 0 && allDone ? 'text-[#ff8a80]' : passed === 40 ? 'text-[#7ddb9e]' : 'text-white'}`}>
                  {passed}<span className="text-[16px] text-side-tx">/40</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[9.5px] font-mono tracking-[0.2em] text-side-tx/70">FAILURES</div>
                <div className={`font-disp font-extrabold text-[30px] leading-none mt-1 ${failed ? 'text-[#ff8a80]' : 'text-[#7ddb9e]'}`}>{failed}</div>
              </div>
            </div>
            <div className="h-2 rounded-full bg-white/10 mt-3 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: failed && allDone ? 'linear-gradient(90deg,#e8590c,#b3261e)' : 'linear-gradient(90deg,#e8590c,#7ddb9e)' }}
                animate={{ width: `${(done.length / GATE_TESTS.length) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <div className="flex gap-1.5 mt-3 flex-wrap">
              {GATE_TESTS.map((t) => {
                const r = results[t.id];
                return (
                  <span
                    key={t.id}
                    title={`#${t.id} ${t.title}`}
                    className={`w-[13px] h-[13px] rounded-[3px] transition-all duration-200 ${activeId === t.id ? 'bg-acc scale-125' : r ? (r.pass ? 'bg-[#2f9e63]' : 'bg-[#c23a32]') : 'bg-white/12'}`}
                  />
                );
              })}
            </div>
            {allDone && (
              <div className={`mt-3 text-[11px] font-mono tracking-wide ${failed ? 'text-[#ff8a80]' : 'text-[#7ddb9e]'}`}>
                {failed ? `✕ GATE BLOCKED — ${failed} test(s) failing` : '✓ GATE PASSED — clear to begin Part 2'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---- test groups ---- */}
      {GATE_GROUPS.map((g) => {
        const tests = GATE_TESTS.filter((t) => t.group === g);
        const gDone = tests.filter((t) => results[t.id]);
        const gPass = gDone.filter((t) => results[t.id].pass).length;
        return (
          <div key={g} className="card overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-line bg-paper/60">
              <FileCheck2 size={15} className="text-acc" />
              <div className="font-disp font-bold text-[14px] tracking-tight">{g}</div>
              <span className="chip">{gDone.length ? `${gPass}/${tests.length} passing` : `${tests.length} tests`}</span>
              <span className="ml-auto text-[10.5px] font-mono text-mute tracking-wider">SPEC REFERENCE INLINE</span>
            </div>
            <div>
              {tests.map((t) => {
                const r = results[t.id];
                const isActive = activeId === t.id;
                const open = openId === t.id;
                return (
                  <div key={t.id} className={`border-b border-line last:border-b-0 ${r && !r.pass ? 'bg-bad-soft/40' : ''}`}>
                    <button className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-pet-soft/40 transition-colors" onClick={() => setOpenId(open ? null : t.id)}>
                      <span className="w-7 h-7 shrink-0 rounded-md grid place-items-center font-mono text-[10.5px] font-bold border border-line-2 bg-white text-mute">
                        {String(t.id).padStart(2, '0')}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] font-semibold leading-snug">{t.title}</span>
                        <span className="block text-[10.5px] font-mono text-mute mt-0.5">{t.spec}</span>
                      </span>
                      {isActive && (
                        <span className="w-4 h-4 rounded-full border-2 border-acc border-t-transparent animate-spin shrink-0" />
                      )}
                      {!isActive && r && (r.pass
                        ? <CheckCircle2 size={17} className="text-ok shrink-0" />
                        : <XCircle size={17} className="text-bad shrink-0" />)}
                      {!isActive && !r && <span className="w-[17px] h-[17px] rounded-full border border-line-2 shrink-0" />}
                      {r && <span className="chip !py-0.5">{r.ms} ms</span>}
                      <ChevronRight size={14} className={`text-mute transition-transform ${open ? 'rotate-90' : ''}`} />
                    </button>
                    <AnimatePresence initial={false}>
                      {open && r && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22 }} className="overflow-hidden"
                        >
                          <div className="px-4 pb-3 pl-[56px]">
                            <div className={`rounded-lg border p-3 font-mono text-[11.5px] leading-relaxed ${r.pass ? 'border-ok/30 bg-ok-soft/50 text-ink' : 'border-bad/30 bg-bad-soft text-ink'}`}>
                              <span className={`font-bold ${r.pass ? 'text-ok' : 'text-bad'}`}>{r.pass ? 'PASS · ' : 'FAIL · '}</span>
                              {r.evidence}
                            </div>
                          </div>
                        </motion.div>
                      )}
                      {open && !r && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <div className="px-4 pb-3 pl-[56px] text-[11.5px] font-mono text-mute">Awaiting execution — run the gate to produce live evidence.</div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="card p-4 flex items-start gap-3">
        <FlaskConical size={16} className="text-pet shrink-0 mt-0.5" />
        <p className="text-[12px] text-mute leading-relaxed">
          <strong className="text-ink">How the gate works.</strong> Tests execute pure engine services against a deep clone of the seeded
          position — {fmtINR(state.docs.length)} documents of live history remain untouched. Each verdict carries machine evidence:
          refused messages, range cursors, snapshot values, journal mirrors. When all 40 cells are green, Part 2 (Master Data
          Management) may begin.
        </p>
      </div>
    </div>
  );
}
