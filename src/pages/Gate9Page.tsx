import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Play, CheckCircle2, XCircle, ChevronRight, Timer } from 'lucide-react';
import { GATE9_TESTS, runGate9 } from '../engine/gate9';
import type { Gate9Test } from '../engine/gate9';

export function Gate9Page() {
  const [results, setResults] = useState<{ id: number; pass: boolean; evidence: string }[]>([]);
  const [running, setRunning] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  const runAll = () => {
    setRunning(true);
    setResults([]);
    setOpenId(null);
    setTimeout(() => {
      const res = runGate9();
      setResults(res);
      setRunning(false);
    }, 100);
  };

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  const total = GATE9_TESTS.length;
  const pct = Math.round((passed / total) * 100);

  const groups = [
    { name: 'Communication Suite', range: [1, 15] },
    { name: 'Shared Tool Library', range: [16, 35] },
  ];

  return (
    <div className="fade-up">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="chip !bg-acc !text-white !border-acc">PART 9 OF 10</span>
            <span className="chip">35 EXECUTABLE TESTS</span>
          </div>
          <h1 className="font-disp font-black text-[32px] leading-[1.05] tracking-tight">
            Communication Suite & Shared Tool Library
          </h1>
          <p className="text-mute mt-2 max-w-2xl">
            The communication platform bound to ERP records — conversations, messages, notifications, tasks —
            plus 20 foundational tools consumed by every module. Build once, use everywhere.
          </p>
        </div>
        <button
          onClick={runAll}
          disabled={running}
          className="btn btn-acc !py-3 !px-6 !text-[14px]"
        >
          {running ? (
            <>
              <Timer size={16} className="animate-spin" />
              Running tests…
            </>
          ) : (
            <>
              <Play size={16} />
              Run all 35 tests
            </>
          )}
        </button>
      </div>

      {results.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-6 mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-disp font-black text-[24px]">
                {failed === 0 ? (
                  <span className="text-ok">✓ GATE PASSED</span>
                ) : (
                  <span className="text-bad">✕ GATE BLOCKED</span>
                )}
              </div>
              <div className="text-mute text-[13px] mt-1">
                {passed} passed · {failed} failed · {pct}%
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="font-mono text-[28px] font-bold text-ok">{passed}</div>
                <div className="text-[10px] text-mute uppercase tracking-wider">Passed</div>
              </div>
              <div className="w-px h-12 bg-line" />
              <div className="text-right">
                <div className="font-mono text-[28px] font-bold text-bad">{failed}</div>
                <div className="text-[10px] text-mute uppercase tracking-wider">Failed</div>
              </div>
            </div>
          </div>
          <div className="h-2 bg-paper rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6 }}
              className={`h-full ${failed === 0 ? 'bg-ok' : 'bg-bad'}`}
            />
          </div>
        </motion.div>
      )}

      {groups.map((group) => {
        const tests = GATE9_TESTS.filter((t) => t.id >= group.range[0] && t.id <= group.range[1]);
        const groupResults = results.filter((r) => r.id >= group.range[0] && r.id <= group.range[1]);
        const groupPassed = groupResults.filter((r) => r.pass).length;

        return (
          <div key={group.name} className="card mb-4">
            <div className="px-5 py-3 border-b border-line flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-acc" />
                <span className="font-disp font-bold text-[15px]">{group.name}</span>
                <span className="chip !py-0 !px-2 !text-[10px]">
                  {group.range[0]}–{group.range[1]}
                </span>
              </div>
              {groupResults.length > 0 && (
                <span className={`chip !py-0 !px-2 !text-[10px] ${groupPassed === tests.length ? '!bg-ok-soft !text-ok !border-ok' : '!bg-bad-soft !text-bad !border-bad'}`}>
                  {groupPassed}/{tests.length}
                </span>
              )}
            </div>
            <div className="divide-y divide-line">
              {tests.map((test) => {
                const result = groupResults.find((r) => r.id === test.id);
                const isOpen = openId === test.id;

                return (
                  <div key={test.id}>
                    <button
                      onClick={() => result && setOpenId(isOpen ? null : test.id)}
                      className="w-full px-5 py-3 flex items-center gap-3 hover:bg-paper/50 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-paper grid place-items-center font-mono text-[11px] font-bold text-mute shrink-0">
                        {test.id}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium">{test.title}</div>
                      </div>
                      {result ? (
                        result.pass ? (
                          <CheckCircle2 size={18} className="text-ok shrink-0" />
                        ) : (
                          <XCircle size={18} className="text-bad shrink-0" />
                        )
                      ) : (
                        <div className="w-[18px] h-[18px] rounded-full border-2 border-line shrink-0" />
                      )}
                      {result && <ChevronRight size={14} className={`text-mute transition-transform ${isOpen ? 'rotate-90' : ''}`} />}
                    </button>
                    {isOpen && result && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="px-5 pb-4 pl-16"
                      >
                        <div className={`text-[12px] font-mono p-3 rounded-lg ${result.pass ? 'bg-ok-soft text-ok' : 'bg-bad-soft text-bad'}`}>
                          {result.evidence}
                        </div>
                      </motion.div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="card p-5 mt-6 bg-side text-white">
        <div className="font-disp font-bold text-[15px] mb-2">How the gate works</div>
        <div className="text-[12px] text-white/70 leading-relaxed">
          Tests execute pure engine services against a deep clone of the seeded state. Each test is a function that
          returns <span className="font-mono text-acc">{'{ pass, evidence }'}</span>. The evidence string is the
          live output — numbers, document references, account balances — not a static assertion. Click any test to
          see the evidence. The gate passes only when all 35 tests return <span className="font-mono text-ok">pass: true</span>.
        </div>
      </div>
    </div>
  );
}
