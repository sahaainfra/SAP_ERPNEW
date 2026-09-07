import { useState } from 'react';
import { runGate10C, GATE10C_TESTS } from '../engine/gate10c';
import { ShieldCheck } from 'lucide-react';

export function Gate10CPage() {
  const [results, setResults] = useState<ReturnType<typeof runGate10C> | null>(null);
  const [running, setRunning] = useState(false);

  const handleRun = () => {
    setRunning(true);
    setTimeout(() => {
      const res = runGate10C();
      setResults(res);
      setRunning(false);
    }, 100);
  };

  const passed = results?.filter((r) => r.pass).length || 0;
  const failed = results?.filter((r) => !r.pass).length || 0;
  const total = results?.length || 0;
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0;

  return (
    <div className="fade-up max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <ShieldCheck className="text-acc" size={32} />
        <div>
          <div className="font-disp font-black text-[28px] leading-tight">Part 10C Acceptance Gate</div>
          <div className="text-mute text-[13px]">Tender & Bid Management · Analytics · AI · Extensibility</div>
        </div>
      </div>

      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-disp font-bold text-[18px]">26 Executable Tests</div>
            <div className="text-mute text-[12px] mt-1">All tests run against the seeded state with live evidence</div>
          </div>
          <button
            onClick={handleRun}
            disabled={running}
            className="btn btn-acc"
          >
            {running ? 'Running…' : 'Run All Tests'}
          </button>
        </div>

        {results && (
          <div className="mt-6">
            <div className="flex items-center gap-6 mb-4">
              <div className="text-center">
                <div className="font-mono text-[32px] font-bold text-ok">{passed}</div>
                <div className="text-[11px] text-mute uppercase tracking-wider">Passed</div>
              </div>
              <div className="text-center">
                <div className="font-mono text-[32px] font-bold text-bad">{failed}</div>
                <div className="text-[11px] text-mute uppercase tracking-wider">Failed</div>
              </div>
              <div className="text-center">
                <div className="font-mono text-[32px] font-bold">{pct}%</div>
                <div className="text-[11px] text-mute uppercase tracking-wider">Score</div>
              </div>
            </div>

            <div className="h-2 bg-paper rounded-full overflow-hidden">
              <div
                className={`h-full ${failed === 0 ? 'bg-ok' : 'bg-bad'}`}
                style={{ width: `${pct}%` }}
              />
            </div>

            <div className="mt-6 space-y-2">
              {results.map((r) => {
                const test = GATE10C_TESTS.find((t) => t.id === r.id);
                return (
                  <div key={r.id} className={`p-3 rounded-lg border ${r.pass ? 'border-ok/30 bg-ok-soft/30' : 'border-bad/30 bg-bad-soft/30'}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-6 h-6 rounded-full grid place-items-center text-white text-[11px] font-bold shrink-0 ${r.pass ? 'bg-ok' : 'bg-bad'}`}>
                        {r.pass ? '✓' : '✕'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-[13px]">{r.id}. {test?.title}</div>
                        <div className="text-[11px] text-mute mt-1 font-mono">{r.evidence}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="card p-5 bg-side text-white">
        <div className="font-disp font-bold text-[15px] mb-2">Test Categories</div>
        <div className="grid grid-cols-2 gap-4 text-[12px]">
          <div>
            <div className="font-bold mb-1">Tender & Bid (11 tests)</div>
            <div className="text-white/70">Pipeline, eligibility, bid capacity, bid/no-bid, estimation, submission, win/loss</div>
          </div>
          <div>
            <div className="font-bold mb-1">Analytics (9 tests)</div>
            <div className="text-white/70">Semantic model, standard reports, report builder, BI extraction</div>
          </div>
          <div>
            <div className="font-bold mb-1">AI Layer (4 tests)</div>
            <div className="text-white/70">Guardrails, citations, authorization, optional layer</div>
          </div>
          <div>
            <div className="font-bold mb-1">Extensibility (2 tests)</div>
            <div className="text-white/70">Custom fields, configuration transport</div>
          </div>
        </div>
      </div>
    </div>
  );
}
