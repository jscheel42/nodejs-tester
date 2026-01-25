import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { debugApi } from '../api';
import { addBreadcrumb } from '../sentry';

interface HealthStatus {
  status: string;
  sentry: unknown;
  environment: string;
  timestamp: string;
}

export default function Dashboard() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    addBreadcrumb('navigation', 'Viewed dashboard');
    fetchHealth();
  }, []);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      const data = await debugApi.health();
      setHealth(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Dashboard</h2>
        <button onClick={fetchHealth} className="btn btn-secondary" disabled={loading}>
          Refresh Status
        </button>
      </div>

      <p className="page-description">
        Welcome to the Sentry Integration Testing Application. Use this dashboard to test
        various Sentry features including error tracking, performance monitoring, session replay,
        and more.
      </p>

      {/* Health Status */}
      <div className="card">
        <h3 className="card-title">Backend Health</h3>
        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
            Loading...
          </div>
        ) : error ? (
          <div className="alert alert-danger">{error}</div>
        ) : health ? (
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value" style={{ color: health.status === 'healthy' ? '#10b981' : '#ef4444' }}>
                {health.status === 'healthy' ? '✓' : '✗'}
              </div>
              <div className="stat-label">Status: {health.status}</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ fontSize: '1.25rem' }}>
                {health.environment}
              </div>
              <div className="stat-label">Environment</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ fontSize: '1rem' }}>
                {new Date(health.timestamp).toLocaleTimeString()}
              </div>
              <div className="stat-label">Last Check</div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Quick Links */}
      <div className="card">
        <h3 className="card-title">Testing Areas</h3>
        <div className="card-grid">
          <Link to="/users" className="demo-section" style={{ textDecoration: 'none' }}>
            <div className="demo-section-title">Users</div>
            <div className="demo-section-description">
              Test N+1 queries, pagination vs unpaginated loading, and user data exports.
            </div>
          </Link>

          <Link to="/orders" className="demo-section" style={{ textDecoration: 'none' }}>
            <div className="demo-section-title">Orders</div>
            <div className="demo-section-description">
              Test complex search queries, deep nested includes, and slow aggregations.
            </div>
          </Link>

          <Link to="/products" className="demo-section" style={{ textDecoration: 'none' }}>
            <div className="demo-section-title">Products</div>
            <div className="demo-section-description">
              Test LIKE queries with leading wildcards and cartesian join reports.
            </div>
          </Link>

          <Link to="/slow-queries" className="demo-section" style={{ textDecoration: 'none' }}>
            <div className="demo-section-title">Slow Query Demos</div>
            <div className="demo-section-description">
              Compare slow vs optimized endpoints and see performance differences.
            </div>
          </Link>

          <Link to="/errors" className="demo-section" style={{ textDecoration: 'none' }}>
            <div className="demo-section-title">Error Testing</div>
            <div className="demo-section-description">
              Trigger various error types, test breadcrumbs, user context, and custom spans.
            </div>
          </Link>
        </div>
      </div>

      {/* Sentry Features */}
      <div className="card">
        <h3 className="card-title">Sentry Features Being Tested</h3>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Error Tracking</div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
              Automatic error capture, custom error context, error boundaries
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Performance Monitoring</div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
              Transaction traces, custom spans, database query timing
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Session Replay</div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
              Visual debugging, user session recording, replay on error
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Profiling</div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
              Backend CPU profiling, function-level performance data
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Breadcrumbs</div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
              Automatic HTTP, console, and custom breadcrumb trails
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">User Feedback</div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
              Feedback widget integrated in bottom-right corner
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
