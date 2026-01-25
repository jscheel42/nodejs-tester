import { useState } from 'react';
import { debugApi } from '../api';
import {
  addBreadcrumb,
  captureError,
  captureMessage,
  setSentryUser,
  clearSentryUser,
  Sentry,
} from '../sentry';

interface TestResult {
  action: string;
  success: boolean;
  message: string;
  sentryEventId?: string;
}

function ErrorButton() {
  return (
    <button
      onClick={() => {
        throw new Error('This is your first error!');
      }}
      className="btn btn-danger btn-sm"
    >
      Break the world
    </button>
  );
}

export default function ErrorDemo() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: number; email: string; name: string } | null>(null);

  // User context form
  const [userForm, setUserForm] = useState({ id: '1', email: 'test@example.com', name: 'Test User' });

  const addResult = (result: TestResult) => {
    setResults((prev) => [result, ...prev].slice(0, 20)); // Keep last 20
  };

  // Backend error tests
  const triggerBackendError = async (type: string) => {
    setLoading(`backend-${type}`);
    try {
      const data = await debugApi.triggerError(`Test ${type} from frontend`, type);
      addResult({
        action: `Backend ${type}`,
        success: true,
        message: data.message,
        sentryEventId: data.sentryEventId,
      });
    } catch (err) {
      addResult({
        action: `Backend ${type}`,
        success: false,
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setLoading(null);
    }
  };

  const triggerUnhandled = async () => {
    setLoading('unhandled');
    try {
      await debugApi.triggerUnhandled();
      addResult({
        action: 'Unhandled Rejection',
        success: true,
        message: 'Triggered unhandled promise rejection on backend',
      });
    } catch {
      addResult({
        action: 'Unhandled Rejection',
        success: false,
        message: 'Request failed as expected',
      });
    } finally {
      setLoading(null);
    }
  };

  // Frontend error tests
  const triggerFrontendError = () => {
    addBreadcrumb('test', 'About to throw frontend error');
    try {
      throw new Error('Test frontend error');
    } catch (err) {
      captureError(err as Error, { source: 'ErrorDemo', type: 'manual' });
      addResult({
        action: 'Frontend Error',
        success: true,
        message: 'Captured frontend error and sent to Sentry',
      });
    }
  };

  const triggerTypeError = () => {
    addBreadcrumb('test', 'About to trigger TypeError');
    try {
      const obj: unknown = null;
      // @ts-expect-error intentional error for testing
      obj.nonexistentMethod();
    } catch (err) {
      captureError(err as Error, { source: 'ErrorDemo', type: 'TypeError' });
      addResult({
        action: 'TypeError',
        success: true,
        message: 'Captured TypeError and sent to Sentry',
      });
    }
  };

  const triggerUncaughtError = () => {
    addBreadcrumb('test', 'About to throw uncaught error');
    // This will be caught by ErrorBoundary
    addResult({
      action: 'Uncaught Error',
      success: true,
      message: 'About to throw - check ErrorBoundary',
    });
    setTimeout(() => {
      throw new Error('Uncaught frontend error for Sentry');
    }, 100);
  };

  // Message tests
  const sendMessage = async (level: 'info' | 'warning' | 'error') => {
    setLoading(`message-${level}`);
    try {
      const data = await debugApi.sendMessage(`Test ${level} message from frontend`, level);
      addResult({
        action: `Message (${level})`,
        success: true,
        message: data.message,
        sentryEventId: data.sentryEventId,
      });
    } catch (err) {
      addResult({
        action: `Message (${level})`,
        success: false,
        message: err instanceof Error ? err.message : 'Failed',
      });
    } finally {
      setLoading(null);
    }
  };

  const sendFrontendMessage = (level: Sentry.SeverityLevel) => {
    captureMessage(`Frontend ${level} message`, level);
    addResult({
      action: `Frontend Message (${level})`,
      success: true,
      message: 'Sent message to Sentry from frontend',
    });
  };

  // Breadcrumb tests
  const testBreadcrumbs = async () => {
    setLoading('breadcrumbs');
    addBreadcrumb('test', 'Starting breadcrumb test');
    addBreadcrumb('user', 'User clicked breadcrumb test button');
    addBreadcrumb('navigation', 'Testing navigation breadcrumb');

    try {
      const data = await debugApi.testBreadcrumbs(5);
      addResult({
        action: 'Breadcrumbs',
        success: true,
        message: `Created ${data.breadcrumbsCreated} breadcrumbs on backend`,
        sentryEventId: data.sentryEventId,
      });
    } catch (err) {
      addResult({
        action: 'Breadcrumbs',
        success: false,
        message: err instanceof Error ? err.message : 'Failed',
      });
    } finally {
      setLoading(null);
    }
  };

  // User context tests
  const setUser = () => {
    const user = {
      id: parseInt(userForm.id),
      email: userForm.email,
      name: userForm.name,
    };
    setSentryUser(user);
    setCurrentUser(user);
    addBreadcrumb('user', `Set user context: ${user.name}`);
    addResult({
      action: 'Set User',
      success: true,
      message: `Set Sentry user: ${user.name} (${user.email})`,
    });
  };

  const clearUser = () => {
    clearSentryUser();
    setCurrentUser(null);
    addBreadcrumb('user', 'Cleared user context');
    addResult({
      action: 'Clear User',
      success: true,
      message: 'Cleared Sentry user context',
    });
  };

  const testUserContext = async () => {
    if (!currentUser) {
      addResult({
        action: 'User Context Test',
        success: false,
        message: 'Set a user first',
      });
      return;
    }

    setLoading('user-context');
    try {
      const data = await debugApi.testUserContext(currentUser);
      addResult({
        action: 'User Context Test',
        success: true,
        message: `Backend set user context`,
        sentryEventId: data.sentryEventId,
      });
    } catch (err) {
      addResult({
        action: 'User Context Test',
        success: false,
        message: err instanceof Error ? err.message : 'Failed',
      });
    } finally {
      setLoading(null);
    }
  };

  // Transaction test
  const testTransaction = async () => {
    setLoading('transaction');
    addBreadcrumb('test', 'Starting custom transaction test');

    try {
      const data = await debugApi.testTransaction();
      addResult({
        action: 'Custom Transaction',
        success: true,
        message: `Completed ${data.steps.length} spans: ${data.steps.join(', ')}`,
      });
    } catch (err) {
      addResult({
        action: 'Custom Transaction',
        success: false,
        message: err instanceof Error ? err.message : 'Failed',
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Error Testing</h2>
        <button onClick={() => setResults([])} className="btn btn-secondary">
          Clear Results
        </button>
      </div>

      <p className="page-description">
        Test various Sentry features including error capture, messages, breadcrumbs,
        user context, and custom transactions. Check your Sentry dashboard to see the events.
      </p>

      <div className="card-grid">
        {/* Backend Errors */}
        <div className="demo-section">
          <div className="demo-section-title">Backend Errors</div>
          <div className="demo-section-description">
            Trigger errors on the backend server
          </div>
          <div className="btn-group">
            <button
              onClick={() => triggerBackendError('Error')}
              className="btn btn-danger btn-sm"
              disabled={loading === 'backend-Error'}
            >
              Error
            </button>
            <button
              onClick={() => triggerBackendError('TypeError')}
              className="btn btn-danger btn-sm"
              disabled={loading === 'backend-TypeError'}
            >
              TypeError
            </button>
            <button
              onClick={() => triggerBackendError('ReferenceError')}
              className="btn btn-danger btn-sm"
              disabled={loading === 'backend-ReferenceError'}
            >
              ReferenceError
            </button>
            <button
              onClick={triggerUnhandled}
              className="btn btn-danger btn-sm"
              disabled={loading === 'unhandled'}
            >
              Unhandled
            </button>
          </div>
        </div>

        {/* Frontend Errors */}
        <div className="demo-section">
          <div className="demo-section-title">Frontend Errors</div>
          <div className="demo-section-description">
            Trigger errors in the browser
          </div>
          <div className="btn-group">
            <button onClick={triggerFrontendError} className="btn btn-danger btn-sm">
              Caught Error
            </button>
            <button onClick={triggerTypeError} className="btn btn-danger btn-sm">
              TypeError
            </button>
            <button onClick={triggerUncaughtError} className="btn btn-warning btn-sm">
              Uncaught (Risky!)
            </button>
            <ErrorButton />
          </div>
        </div>

        {/* Messages */}
        <div className="demo-section">
          <div className="demo-section-title">Backend Messages</div>
          <div className="demo-section-description">
            Send messages to Sentry from backend
          </div>
          <div className="btn-group">
            <button
              onClick={() => sendMessage('info')}
              className="btn btn-secondary btn-sm"
              disabled={loading === 'message-info'}
            >
              Info
            </button>
            <button
              onClick={() => sendMessage('warning')}
              className="btn btn-warning btn-sm"
              disabled={loading === 'message-warning'}
            >
              Warning
            </button>
            <button
              onClick={() => sendMessage('error')}
              className="btn btn-danger btn-sm"
              disabled={loading === 'message-error'}
            >
              Error
            </button>
          </div>
        </div>

        {/* Frontend Messages */}
        <div className="demo-section">
          <div className="demo-section-title">Frontend Messages</div>
          <div className="demo-section-description">
            Send messages to Sentry from browser
          </div>
          <div className="btn-group">
            <button
              onClick={() => sendFrontendMessage('info')}
              className="btn btn-secondary btn-sm"
            >
              Info
            </button>
            <button
              onClick={() => sendFrontendMessage('warning')}
              className="btn btn-warning btn-sm"
            >
              Warning
            </button>
            <button
              onClick={() => sendFrontendMessage('error')}
              className="btn btn-danger btn-sm"
            >
              Error
            </button>
          </div>
        </div>

        {/* Breadcrumbs */}
        <div className="demo-section">
          <div className="demo-section-title">Breadcrumbs</div>
          <div className="demo-section-description">
            Test breadcrumb trails for debugging
          </div>
          <button
            onClick={testBreadcrumbs}
            className="btn btn-primary btn-sm"
            disabled={loading === 'breadcrumbs'}
          >
            Test Breadcrumbs
          </button>
        </div>

        {/* Custom Transaction */}
        <div className="demo-section">
          <div className="demo-section-title">Custom Transaction</div>
          <div className="demo-section-description">
            Test custom spans and transactions
          </div>
          <button
            onClick={testTransaction}
            className="btn btn-primary btn-sm"
            disabled={loading === 'transaction'}
          >
            Run Transaction
          </button>
        </div>
      </div>

      {/* User Context */}
      <div className="card">
        <h3 className="card-title">User Context</h3>
        <p className="demo-section-description">
          Set user context to associate errors with specific users.
          {currentUser && (
            <span style={{ marginLeft: '0.5rem', color: '#10b981' }}>
              Current: {currentUser.name} ({currentUser.email})
            </span>
          )}
        </p>
        <div className="form-inline">
          <div className="form-group">
            <label className="form-label">User ID</label>
            <input
              type="number"
              className="form-input"
              value={userForm.id}
              onChange={(e) => setUserForm({ ...userForm, id: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-input"
              value={userForm.email}
              onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Name</label>
            <input
              type="text"
              className="form-input"
              value={userForm.name}
              onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
            />
          </div>
          <div className="btn-group" style={{ marginTop: '1.5rem' }}>
            <button onClick={setUser} className="btn btn-primary btn-sm">
              Set User
            </button>
            <button onClick={clearUser} className="btn btn-secondary btn-sm" disabled={!currentUser}>
              Clear User
            </button>
            <button
              onClick={testUserContext}
              className="btn btn-success btn-sm"
              disabled={!currentUser || loading === 'user-context'}
            >
              Test on Backend
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="card">
          <h3 className="card-title">Recent Actions</h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Status</th>
                  <th>Message</th>
                  <th>Sentry Event ID</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result, index) => (
                  <tr key={index}>
                    <td>{result.action}</td>
                    <td>
                      <span className={`badge ${result.success ? 'badge-delivered' : 'badge-cancelled'}`}>
                        {result.success ? 'OK' : 'Failed'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.875rem' }}>{result.message}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {result.sentryEventId || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
