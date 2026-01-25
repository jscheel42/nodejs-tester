import { useState, useEffect } from 'react';
import { usersApi } from '../api';
import { addBreadcrumb, withSpan } from '../sentry';

interface User {
  id: number;
  email: string;
  name: string;
  createdAt: string;
}

interface UsersResponse {
  data: User[];
  total: number;
  warning?: string;
}

interface PaginatedUsersResponse extends UsersResponse {
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function UserList() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [timing, setTiming] = useState<number | null>(null);

  // Pagination state
  const [mode, setMode] = useState<'paginated' | 'all'>('paginated');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    addBreadcrumb('navigation', 'Viewed user list');
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [mode, page]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      setWarning(null);

      const start = performance.now();

      const data = await withSpan('fetch-users', 'http.client', async () => {
        if (mode === 'paginated') {
          return usersApi.getPaginated(page, pageSize);
        } else {
          return usersApi.getAll();
        }
      });

      const elapsed = performance.now() - start;
      setTiming(elapsed);

      setUsers(data.data as User[]);
      setTotal(data.total);
      setWarning((data as UsersResponse).warning || null);

      if ('totalPages' in data) {
        setTotalPages((data as PaginatedUsersResponse).totalPages);
      } else {
        setTotalPages(1);
      }

      addBreadcrumb('data', `Loaded ${data.data.length} users in ${elapsed.toFixed(0)}ms`, {
        mode,
        count: data.data.length,
        total: data.total,
        timing: elapsed,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleModeChange = (newMode: 'paginated' | 'all') => {
    setMode(newMode);
    setPage(1);
    addBreadcrumb('user', `Switched to ${newMode} mode`);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Users</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {timing !== null && (
            <span className={`timing ${timing > 1000 ? 'timing-slow' : timing < 200 ? 'timing-fast' : ''}`}>
              {timing.toFixed(0)}ms
            </span>
          )}
          <div className="toggle-group">
            <button
              className={`toggle-btn ${mode === 'paginated' ? 'active' : ''}`}
              onClick={() => handleModeChange('paginated')}
            >
              Paginated (Fast)
            </button>
            <button
              className={`toggle-btn ${mode === 'all' ? 'active' : ''}`}
              onClick={() => handleModeChange('all')}
            >
              Load All (Slow)
            </button>
          </div>
        </div>
      </div>

      <p className="page-description">
        Compare paginated loading (efficient) vs loading all users at once (inefficient N+1 queries).
        The "Load All" mode intentionally uses inefficient queries to demonstrate Sentry performance monitoring.
      </p>

      {warning && (
        <div className="alert alert-warning">
          <strong>Performance Warning:</strong> {warning}
        </div>
      )}

      {error && (
        <div className="alert alert-danger">{error}</div>
      )}

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          Loading users...
        </div>
      ) : (
        <>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.id}</td>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {mode === 'paginated' && (
            <div className="pagination">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </button>
              <span className="pagination-info">
                Page {page} of {totalPages} ({total} total users)
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </button>
            </div>
          )}

          {mode === 'all' && (
            <div style={{ marginTop: '1rem', textAlign: 'center', color: '#666' }}>
              Showing all {users.length} of {total} users
            </div>
          )}
        </>
      )}
    </div>
  );
}
