import { useState } from 'react';
import { Shield, CheckCircle, XCircle, Play } from 'lucide-react';
import { GATE6_TESTS, runGate6 } from '../engine/gate6';
import { fmtINR } from '../engine/engine';

export function Gate6Page() {
  const [results, setResults] = useState<{ id: number; pass: boolean; evidence: string }[] | null>(null);
  const [running, setRunning] = useState(false);

  const handleRun = () => {
    setRunning(true);
    setTimeout(() => {
      const res = runGate6();
      setResults(res);
      setRunning(false);
    }, 100);
  };

  const passed = results?.filter((r) => r.pass).length ?? 0;
  const failed = results ? results.length - passed : 0;
  const allPassed = results && failed === 0;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-8 h-8 text-orange-600" />
          <h1 className="text-3xl font-bold text-gray-900">Part 6 Acceptance Gate</h1>
        </div>
        <p className="text-gray-600">
          Contracts, Measurement, Billing, Subcontract & Receivables — 40 executable tests
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Gate Status</h2>
            <p className="text-sm text-gray-600">Run all 40 tests to verify Part 6 implementation</p>
          </div>
          <button
            onClick={handleRun}
            disabled={running}
            className="flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Play className="w-5 h-5" />
            {running ? 'Running...' : results ? 'Re-run Gate' : 'Run Gate'}
          </button>
        </div>

        {results && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Total Tests</div>
              <div className="text-3xl font-bold text-gray-900">{results.length}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-sm text-green-700 mb-1">Passed</div>
              <div className="text-3xl font-bold text-green-900">{passed}</div>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <div className="text-sm text-red-700 mb-1">Failed</div>
              <div className="text-3xl font-bold text-red-900">{failed}</div>
            </div>
          </div>
        )}

        {allPassed && (
          <div className="bg-green-100 border border-green-400 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle className="w-6 h-6" />
              <span className="font-semibold text-lg">✓ GATE PASSED — All 40 tests passed. Clear to begin Part 7.</span>
            </div>
          </div>
        )}

        {results && failed > 0 && (
          <div className="bg-red-100 border border-red-400 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-red-800">
              <XCircle className="w-6 h-6" />
              <span className="font-semibold text-lg">✕ GATE BLOCKED — {failed} test(s) failing. Fix before proceeding.</span>
            </div>
          </div>
        )}
      </div>

      {results && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Test Results</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {results.map((result) => {
              const test = GATE6_TESTS.find((t) => t.id === result.id);
              return (
                <div key={result.id} className={`p-4 ${result.pass ? 'bg-green-50' : 'bg-red-50'}`}>
                  <div className="flex items-start gap-3">
                    {result.pass ? (
                      <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-mono text-gray-500">Test {result.id}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${result.pass ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                          {result.pass ? 'PASS' : 'FAIL'}
                        </span>
                      </div>
                      <div className="font-medium text-gray-900 mb-2">{test?.title}</div>
                      <div className="text-sm text-gray-700 bg-white rounded p-3 border border-gray-200">
                        <span className="font-mono text-xs">{result.evidence}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!results && (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Ready to Run</h3>
          <p className="text-gray-600">Click "Run Gate" to execute all 40 acceptance tests</p>
        </div>
      )}
    </div>
  );
}
