import { useState } from 'react';
import { usersApi, ordersApi, productsApi, debugApi } from '../api';
import { addBreadcrumb } from '../sentry';

interface TestResult {
  name: string;
  timing: number;
  success: boolean;
  warning?: string;
  error?: string;
}

export default function SlowQueryDemo() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string | null>(null);

  const addResult = (result: TestResult) => {
    setResults((prev) => [...prev, result]);
  };

  const runTest = async (
    name: string,
    testFn: () => Promise<{ warning?: string }>
  ): Promise<void> => {
    setCurrentTest(name);
    const start = performance.now();
    try {
      const data = await testFn();
      const elapsed = performance.now() - start;
      addResult({
        name,
        timing: elapsed,
        success: true,
        warning: data.warning,
      });
      addBreadcrumb('test', `Completed: ${name}`, { timing: elapsed });
    } catch (err) {
      const elapsed = performance.now() - start;
      addResult({
        name,
        timing: elapsed,
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  const runAllTests = async () => {
    setRunning(true);
    setResults([]);
    addBreadcrumb('test', 'Started slow query demo tests');

    // Users tests
    await runTest('Users: Load All (N+1)', () => usersApi.getAll());
    await runTest('Users: Paginated (Optimized)', () => usersApi.getPaginated(1, 20));
    await runTest('Users: Export All', () => usersApi.exportAll());
    await runTest('Users: Search by Date', () =>
      usersApi.searchByDate('2023-01-01', '2024-12-31')
    );

    // Orders tests
    await runTest('Orders: Search (No Index)', () =>
      ordersApi.search({ status: 'pending', minAmount: 100 })
    );
    await runTest('Orders: Daily Report', () => ordersApi.getDailyReport(30));

    // Products tests
    await runTest('Products: LIKE Search', () => productsApi.search('test'));
    await runTest('Products: Slow Report (Cartesian)', () => productsApi.getReport());
    await runTest('Products: Fast Report (Optimized)', () => productsApi.getReportOptimized());

    // Debug slow endpoint
    await runTest('Debug: Custom Slow (2s)', () => debugApi.testSlow(2000));
    await runTest('Debug: Memory Intensive (10MB)', () => debugApi.testMemory(10));

    setCurrentTest(null);
    setRunning(false);
    addBreadcrumb('test', 'Completed all slow query demo tests');
  };

  const runSingleTest = async (
    name: string,
    testFn: () => Promise<{ warning?: string }>
  ) => {
    setRunning(true);
    setResults([]);
    await runTest(name, testFn);
    setCurrentTest(null);
    setRunning(false);
  };

  const getTimingClass = (timing: number) => {
    if (timing > 2000) return 'timing-slow';
    if (timing < 500) return 'timing-fast';
    return '';
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Slow Query Demo</h2>
        <button
          onClick={runAllTests}
          className="btn btn-primary"
          disabled={running}
        >
          {running ? 'Running...' : 'Run All Tests'}
        </button>
      </div>

      <p className="page-description">
        This page runs various slow and fast queries to compare performance.
        Watch the timing differences and check Sentry for detailed transaction traces.
      </p>

      {/* Quick Tests */}
      <div className="card">
        <h3 className="card-title">Quick Tests</h3>
        <p className="demo-section-description">
          Run individual tests to compare slow vs fast implementations.
        </p>
        <div className="card-grid">
          <div className="demo-section">
            <div className="demo-section-title">Users: N+1 vs Paginated</div>
            <div className="btn-group" style={{ marginTop: '0.5rem' }}>
              <button
                onClick={() => runSingleTest('Users: N+1', () => usersApi.getAll())}
                className="btn btn-warning btn-sm"
                disabled={running}
              >
                N+1 (Slow)
              </button>
              <button
                onClick={() => runSingleTest('Users: Paginated', () => usersApi.getPaginated(1, 20))}
                className="btn btn-success btn-sm"
                disabled={running}
              >
                Paginated (Fast)
              </button>
            </div>
          </div>

          <div className="demo-section">
            <div className="demo-section-title">Products: Report Comparison</div>
            <div className="btn-group" style={{ marginTop: '0.5rem' }}>
              <button
                onClick={() => runSingleTest('Products: Cartesian', () => productsApi.getReport())}
                className="btn btn-warning btn-sm"
                disabled={running}
              >
                Cartesian (Slow)
              </button>
              <button
                onClick={() => runSingleTest('Products: Optimized', () => productsApi.getReportOptimized())}
                className="btn btn-success btn-sm"
                disabled={running}
              >
                Optimized (Fast)
              </button>
            </div>
          </div>

          <div className="demo-section">
            <div className="demo-section-title">Custom Delay Test</div>
            <div className="btn-group" style={{ marginTop: '0.5rem' }}>
              <button
                onClick={() => runSingleTest('Slow: 1s', () => debugApi.testSlow(1000))}
                className="btn btn-secondary btn-sm"
                disabled={running}
              >
                1 second
              </button>
              <button
                onClick={() => runSingleTest('Slow: 3s', () => debugApi.testSlow(3000))}
                className="btn btn-warning btn-sm"
                disabled={running}
              >
                3 seconds
              </button>
              <button
                onClick={() => runSingleTest('Slow: 5s', () => debugApi.testSlow(5000))}
                className="btn btn-danger btn-sm"
                disabled={running}
              >
                5 seconds
              </button>
            </div>
          </div>

          <div className="demo-section">
            <div className="demo-section-title">Memory Allocation</div>
            <div className="btn-group" style={{ marginTop: '0.5rem' }}>
              <button
                onClick={() => runSingleTest('Memory: 5MB', () => debugApi.testMemory(5))}
                className="btn btn-secondary btn-sm"
                disabled={running}
              >
                5 MB
              </button>
              <button
                onClick={() => runSingleTest('Memory: 25MB', () => debugApi.testMemory(25))}
                className="btn btn-warning btn-sm"
                disabled={running}
              >
                25 MB
              </button>
              <button
                onClick={() => runSingleTest('Memory: 50MB', () => debugApi.testMemory(50))}
                className="btn btn-danger btn-sm"
                disabled={running}
              >
                50 MB
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Current Test */}
      {currentTest && (
        <div className="alert alert-info">
          <div className="loading" style={{ padding: 0 }}>
            <div className="spinner"></div>
            Running: {currentTest}
          </div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="card">
          <h3 className="card-title">Results</h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Test</th>
                  <th>Timing</th>
                  <th>Status</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result, index) => (
                  <tr key={index}>
                    <td>{result.name}</td>
                    <td>
                      <span className={`timing ${getTimingClass(result.timing)}`}>
                        {result.timing.toFixed(0)}ms
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${result.success ? 'badge-delivered' : 'badge-cancelled'}`}>
                        {result.success ? 'Success' : 'Failed'}
                      </span>
                    </td>
                    <td style={{ color: '#666', fontSize: '0.875rem' }}>
                      {result.warning && <span style={{ color: '#f59e0b' }}>{result.warning}</span>}
                      {result.error && <span style={{ color: '#ef4444' }}>{result.error}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          <div className="stats-grid" style={{ marginTop: '1rem' }}>
            <div className="stat-card">
              <div className="stat-value">{results.length}</div>
              <div className="stat-label">Tests Run</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: '#10b981' }}>
                {results.filter((r) => r.success).length}
              </div>
              <div className="stat-label">Passed</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: '#ef4444' }}>
                {results.filter((r) => !r.success).length}
              </div>
              <div className="stat-label">Failed</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {(results.reduce((sum, r) => sum + r.timing, 0) / 1000).toFixed(1)}s
              </div>
              <div className="stat-label">Total Time</div>
            </div>
          </div>

          <button
            onClick={() => setResults([])}
            className="btn btn-secondary"
            style={{ marginTop: '1rem' }}
          >
            Clear Results
          </button>
        </div>
      )}
    </div>
  );
}
