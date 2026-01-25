import { useState, useEffect } from 'react';
import { productsApi } from '../api';
import { addBreadcrumb } from '../sentry';

interface Category {
  id: number;
  name: string;
}

interface Product {
  id: number;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  categoryId: number;
  category?: Category;
  createdAt: string;
}

export default function ProductSearch() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [timing, setTiming] = useState<number | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    addBreadcrumb('navigation', 'Viewed product search');
    fetchCategories();
  }, []);

  useEffect(() => {
    if (!isSearching) {
      fetchProducts();
    }
  }, [page]);

  const fetchCategories = async () => {
    try {
      const data = await productsApi.getCategories();
      setCategories(data.data as Category[]);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      setWarning(null);

      const start = performance.now();
      const data = await productsApi.getAll(page, pageSize);
      const elapsed = performance.now() - start;

      setTiming(elapsed);
      setProducts(data.data as Product[]);
      setTotal(data.total);
      setTotalPages(data.totalPages);

      addBreadcrumb('data', `Loaded ${data.data.length} products`, { timing: elapsed });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setIsSearching(false);
      fetchProducts();
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setWarning(null);
      setIsSearching(true);

      const start = performance.now();
      const data = await productsApi.search(searchQuery, selectedCategory || undefined);
      const elapsed = performance.now() - start;

      setTiming(elapsed);
      setProducts(data.data as Product[]);
      setTotal(data.total);
      setWarning((data as { warning?: string }).warning || null);

      addBreadcrumb('search', `Searched products: "${searchQuery}"`, {
        query: searchQuery,
        category: selectedCategory,
        results: data.total,
        timing: elapsed,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const resetSearch = () => {
    setSearchQuery('');
    setSelectedCategory(null);
    setIsSearching(false);
    setPage(1);
    fetchProducts();
  };

  const formatPrice = (price: number | string) => {
    const value = typeof price === 'number' ? price : Number(price);
    if (Number.isNaN(value)) {
      return '-';
    }
    return value.toFixed(2);
  };

  const loadReport = async (optimized: boolean) => {
    try {
      setLoading(true);
      setError(null);
      setWarning(null);

      const start = performance.now();
      const data = optimized
        ? await productsApi.getReportOptimized()
        : await productsApi.getReport();
      const elapsed = performance.now() - start;

      setTiming(elapsed);
      setWarning((data as { warning?: string }).warning || null);

      addBreadcrumb('report', `Generated ${optimized ? 'optimized' : 'slow'} product report`, {
        timing: elapsed,
      });

      alert(`Product Report (${optimized ? 'Optimized' : 'Slow'}):\n\nLoaded in ${elapsed.toFixed(0)}ms\n\n${JSON.stringify(data.data.slice(0, 5), null, 2)}${data.data.length > 5 ? `\n\n... and ${data.data.length - 5} more` : ''}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Report failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Products</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {timing !== null && (
            <span className={`timing ${timing > 1000 ? 'timing-slow' : timing < 200 ? 'timing-fast' : ''}`}>
              {timing.toFixed(0)}ms
            </span>
          )}
          <div className="btn-group">
            <button onClick={() => loadReport(false)} className="btn btn-warning btn-sm" disabled={loading}>
              Slow Report
            </button>
            <button onClick={() => loadReport(true)} className="btn btn-success btn-sm" disabled={loading}>
              Fast Report
            </button>
          </div>
        </div>
      </div>

      <p className="page-description">
        Search products using LIKE queries with leading wildcards (intentionally slow).
        Compare the "Slow Report" (cartesian join) vs "Fast Report" (optimized query).
      </p>

      {/* Search Form */}
      <div className="card">
        <h3 className="card-title">Search Products</h3>
        <form onSubmit={handleSearch} className="form-inline">
          <div className="form-group" style={{ flex: 2 }}>
            <label className="form-label">Search Query</label>
            <input
              type="text"
              className="form-input"
              placeholder="Search by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Category</label>
            <select
              className="form-select"
              value={selectedCategory || ''}
              onChange={(e) => setSelectedCategory(e.target.value ? parseInt(e.target.value) : null)}
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div className="btn-group" style={{ marginTop: '1.5rem' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              Search
            </button>
            {isSearching && (
              <button type="button" onClick={resetSearch} className="btn btn-secondary" disabled={loading}>
                Reset
              </button>
            )}
          </div>
        </form>
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
          Loading products...
        </div>
      ) : (
        <>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>{product.id}</td>
                    <td>
                      <strong>{product.name}</strong>
                      {product.description && (
                        <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                          {product.description.substring(0, 100)}...
                        </div>
                      )}
                    </td>
                    <td>{product.category?.name || '-'}</td>
                    <td>${formatPrice(product.price)}</td>
                    <td>
                      <span style={{ color: product.stock < 10 ? '#ef4444' : product.stock < 50 ? '#f59e0b' : '#10b981' }}>
                        {product.stock}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!isSearching && (
            <div className="pagination">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </button>
              <span className="pagination-info">
                Page {page} of {totalPages} ({total} total products)
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

          {isSearching && (
            <div style={{ marginTop: '1rem', textAlign: 'center', color: '#666' }}>
              Found {total} products matching "{searchQuery}"
            </div>
          )}
        </>
      )}
    </div>
  );
}
