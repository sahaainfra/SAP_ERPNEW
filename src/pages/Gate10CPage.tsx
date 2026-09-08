import { useState, useEffect } from 'react';
import { runGate10C, TestResult } from '../engine/gate10c';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export function Gate10CPage() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);

  const handleRunTests = () => {
    setRunning(true);
    setTimeout(() => {
      const testResults = runGate10C();
      setResults(testResults);
      setRunning(false);
    }, 100);
  };

  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  const allPassed = totalCount > 0 && passedCount === totalCount;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Part 10C Acceptance Gate</h1>
        <p className="text-gray-600">
          Tender & Bid Management, Analytics, Semantic Layer, AI & Extensibility
        </p>
      </div>

      <div className="mb-6">
        <button
          onClick={handleRunTests}
          disabled={running}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold"
        >
          {running ? 'Running Tests...' : 'Run All 26 Tests'}
        </button>
      </div>

      {results.length > 0 && (
        <>
          <div className={`mb-6 p-4 rounded-lg ${allPassed ? 'bg-green-50 border-2 border-green-500' : 'bg-red-50 border-2 border-red-500'}`}>
            <div className="flex items-center gap-3">
              {allPassed ? (
                <CheckCircle className="w-8 h-8 text-green-600" />
              ) : (
                <XCircle className="w-8 h-8 text-red-600" />
              )}
              <div>
                <h2 className="text-xl font-bold">
                  {allPassed ? '✓ All Tests Passed' : '✗ Some Tests Failed'}
                </h2>
                <p className="text-sm text-gray-600">
                  {passedCount} of {totalCount} tests passed
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {results.map((result) => (
              <div
                key={result.id}
                className={`p-4 rounded-lg border-2 ${
                  result.passed
                    ? 'bg-green-50 border-green-300'
                    : 'bg-red-50 border-red-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  {result.passed ? (
                    <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="font-semibold mb-1">
                      Test {result.id}: {result.title}
                    </div>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap">
                      <strong>Evidence:</strong> {result.evidence}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {results.length === 0 && !running && (
        <div className="text-center py-12 text-gray-500">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Click "Run All 26 Tests" to execute the Part 10C acceptance gate</p>
        </div>
      )}
    </div>
  );
}
