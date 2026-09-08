import { useState } from 'react';
import { Shield, CheckCircle, XCircle, AlertCircle, Play } from 'lucide-react';
import { runGate10D, GATE10D_TESTS } from '../engine/gate10d';

export function Gate10DPage() {
  const [results, setResults] = useState<ReturnType<typeof runGate10D> | null>(null);
  const [running, setRunning] = useState(false);

  const handleRun = () => {
    setRunning(true);
    setTimeout(() => {
      const testResults = runGate10D();
      setResults(testResults);
      setRunning(false);
    }, 100);
  };

  const passed = results?.filter((r) => r.pass).length || 0;
  const failed = results?.filter((r) => !r.pass).length || 0;
  const total = results?.length || 0;
  const percentage = total > 0 ? Math.round((passed / total) * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-8 h-8 text-acc" />
          <h1 className="font-disp font-black text-3xl">Part 10D Acceptance Gate</h1>
        </div>
        <p className="text-mute text-sm">
          Roles, Approval Matrix, Security, Migration, Cutover & Final Acceptance — 24 executable tests
        </p>
      </div>

      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-disp font-bold text-xl mb-1">Final Acceptance</h2>
            <p className="text-mute text-sm">
              Complete system verification: role catalog, approval workflows, segregation of duties, migration reconciliation, cutover readiness, and end-to-end integration
            </p>
          </div>
          <button
            onClick={handleRun}
            disabled={running}
            className="btn btn-acc flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            {running ? 'Running Tests...' : 'Run All 24 Tests'}
          </button>
        </div>

        {results && (
          <div className="mt-6">
            <div className="flex items-center gap-6 mb-4">
              <div className="text-center">
                <div className="font-mono text-3xl font-bold text-ok">{passed}</div>
                <div className="text-xs text-mute uppercase tracking-wider">Passed</div>
              </div>
              <div className="text-center">
                <div className="font-mono text-3xl font-bold text-bad">{failed}</div>
                <div className="text-xs text-mute uppercase tracking-wider">Failed</div>
              </div>
              <div className="text-center">
                <div className="font-mono text-3xl font-bold">{percentage}%</div>
                <div className="text-xs text-mute uppercase tracking-wider">Score</div>
              </div>
            </div>

            <div className="h-2 bg-paper rounded-full overflow-hidden">
              <div
                className={`h-full ${failed === 0 ? 'bg-ok' : 'bg-bad'}`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {results && (
        <div className="space-y-3">
          {results.map((result) => {
            const test = GATE10D_TESTS.find((t) => t.id === result.id);
            return (
              <div
                key={result.id}
                className={`card p-4 border-l-4 ${
                  result.pass ? 'border-ok bg-ok-soft/30' : 'border-bad bg-bad-soft/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {result.pass ? (
                      <CheckCircle className="w-5 h-5 text-ok" />
                    ) : (
                      <XCircle className="w-5 h-5 text-bad" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm mb-1">
                      Test {result.id}: {test?.title}
                    </div>
                    <div className="text-xs text-mute font-mono">{result.evidence}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!results && !running && (
        <div className="card p-12 text-center">
          <AlertCircle className="w-12 h-12 text-mute mx-auto mb-4" />
          <p className="text-mute">Click "Run All 24 Tests" to verify the final acceptance gate</p>
        </div>
      )}

      {running && (
        <div className="card p-12 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-acc border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-mute">Running acceptance tests...</p>
        </div>
      )}
    </div>
  );
}
