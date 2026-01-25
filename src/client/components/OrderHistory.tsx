import { useState, useEffect } from 'react';
import { ordersApi } from '../api';
import { addBreadcrumb } from '../sentry';

interface Order {
  id: number;
  userId: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  totalAmount: number;
  createdAt: string;
  user?: { name: string; email: string };
  items?: Array<{ id: number; quantity: number; price: number; product?: { name: string } }>;
}

export default function OrderHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [timing, setTiming] = useState<number | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);

  // Search filters
  const [searchMode, setSearchMode] = useState(false);
  const [searchFilters, setSearchFilters] = useState({
    startDate: '',
    endDate: '',
    status: '',
    minAmount: '',
  });

  useEffect(() => {
    addBreadcrumb('navigation', 'Viewed order history');
  }, []);

  useEffect(() => {
    if (!searchMode) {
      fetchOrders();
    }
  }, [page, searchMode]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      setWarning(null);

      const start = performance.now();
      const data = await ordersApi.getAll(page, pageSize);
      const elapsed = performance.now() - start;

      setTiming(elapsed);
      setOrders(data.data as Order[]);
      setTotal(data.total);
      setTotalPages(data.totalPages);

      addBreadcrumb('data', `Loaded ${data.data.length} orders`, { timing: elapsed });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    try {
      setLoading(true);
      setError(null);
      setWarning(null);
      setSearchMode(true);

      const start = performance.now();
      const data = await ordersApi.search({
        startDate: searchFilters.startDate || undefined,
        endDate: searchFilters.endDate || undefined,
        status: searchFilters.status || undefined,
        minAmount: searchFilters.minAmount ? parseFloat(searchFilters.minAmount) : undefined,
      });
      const elapsed = performance.now() - start;

      setTiming(elapsed);
      setOrders(data.data as Order[]);
      setTotal(data.total);
      setWarning(data.warning || null);

      addBreadcrumb('data', `Search returned ${data.data.length} orders`, {
        filters: searchFilters,
        timing: elapsed,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const resetSearch = () => {
    setSearchFilters({ startDate: '', endDate: '', status: '', minAmount: '' });
    setSearchMode(false);
    setPage(1);
  };

  const loadDailyReport = async () => {
    try {
      setLoading(true);
      setError(null);

      const start = performance.now();
      const data = await ordersApi.getDailyReport(30);
      const elapsed = performance.now() - start;

      setTiming(elapsed);
      setWarning(data.warning || null);

      addBreadcrumb('data', `Generated daily report`, { timing: elapsed });

      // Show in alert since report structure is different
      alert(`Daily Report (last 30 days):\n${JSON.stringify(data.data, null, 2)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Report failed');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    return `badge badge-${status}`;
  };

  const formatTotal = (totalAmount: number | string) => {
    const value = typeof totalAmount === 'number' ? totalAmount : Number(totalAmount);
    if (Number.isNaN(value)) {
      return '-';
    }
    return value.toFixed(2);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Orders</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {timing !== null && (
            <span className={`timing ${timing > 1000 ? 'timing-slow' : timing < 200 ? 'timing-fast' : ''}`}>
              {timing.toFixed(0)}ms
            </span>
          )}
          <button onClick={loadDailyReport} className="btn btn-secondary" disabled={loading}>
            Daily Report (Slow)
          </button>
        </div>
      </div>

      <p className="page-description">
        Search orders using various filters. The search endpoint intentionally lacks proper indexing
        to demonstrate slow query performance in Sentry.
      </p>

      {/* Search Filters */}
      <div className="card">
        <h3 className="card-title">Search Filters</h3>
        <div className="form-inline">
          <div className="form-group">
            <label className="form-label">Start Date</label>
            <input
              type="date"
              className="form-input"
              value={searchFilters.startDate}
              onChange={(e) => setSearchFilters({ ...searchFilters, startDate: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">End Date</label>
            <input
              type="date"
              className="form-input"
              value={searchFilters.endDate}
              onChange={(e) => setSearchFilters({ ...searchFilters, endDate: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select
              className="form-select"
              value={searchFilters.status}
              onChange={(e) => setSearchFilters({ ...searchFilters, status: e.target.value })}
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Min Amount</label>
            <input
              type="number"
              className="form-input"
              placeholder="0.00"
              value={searchFilters.minAmount}
              onChange={(e) => setSearchFilters({ ...searchFilters, minAmount: e.target.value })}
            />
          </div>
          <div className="btn-group" style={{ marginTop: '1.5rem' }}>
            <button onClick={handleSearch} className="btn btn-primary" disabled={loading}>
              Search
            </button>
            {searchMode && (
              <button onClick={resetSearch} className="btn btn-secondary" disabled={loading}>
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

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
          Loading orders...
        </div>
      ) : (
        <>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>User</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Items</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.id}</td>
                    <td>{order.user?.name || `User #${order.userId}`}</td>
                    <td>
                      <span className={getStatusBadgeClass(order.status)}>
                        {order.status}
                      </span>
                    </td>
                    <td>${formatTotal(order.totalAmount)}</td>
                    <td>{order.items?.length || '-'}</td>
                    <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!searchMode && (
            <div className="pagination">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </button>
              <span className="pagination-info">
                Page {page} of {totalPages} ({total} total orders)
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

          {searchMode && (
            <div style={{ marginTop: '1rem', textAlign: 'center', color: '#666' }}>
              Found {total} orders matching filters
            </div>
          )}
        </>
      )}
    </div>
  );
}
