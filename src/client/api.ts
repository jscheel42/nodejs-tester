import { addBreadcrumb } from './sentry';

const API_BASE = '/api';

// Generic fetch wrapper with Sentry integration
async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
  addBreadcrumb('http', `${options.method || 'GET'} ${endpoint}`, {
    url,
    method: options.method || 'GET',
  });

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// Users API
export const usersApi = {
  // Get all users (inefficient - no pagination)
  getAll: () => fetchApi<{ data: unknown[]; total: number; warning?: string }>('/users'),
  
  // Get users with pagination (efficient)
  getPaginated: (page = 1, pageSize = 20) =>
    fetchApi<{ data: unknown[]; total: number; page: number; pageSize: number; totalPages: number }>(
      `/users/paginated?page=${page}&pageSize=${pageSize}`
    ),
  
  // Get single user
  getById: (id: number) => fetchApi<unknown>(`/users/${id}`),
  
  // Get user orders (N+1 problem)
  getOrders: (userId: number) =>
    fetchApi<{ data: unknown[]; total: number; warning?: string }>(`/users/${userId}/orders`),
  
  // Get user orders optimized
  getOrdersOptimized: (userId: number) =>
    fetchApi<{ data: unknown[]; total: number }>(`/users/${userId}/orders-optimized`),
  
  // Search users by date (slow - no index)
  searchByDate: (startDate: string, endDate: string) =>
    fetchApi<{ data: unknown[]; total: number; warning?: string }>(
      `/users/search/by-date?startDate=${startDate}&endDate=${endDate}`
    ),
  
  // Export all users (memory intensive)
  exportAll: () =>
    fetchApi<{ data: unknown[]; total: number; warning?: string }>('/users/export/all'),
};

// Orders API
export const ordersApi = {
  // Get orders with pagination
  getAll: (page = 1, pageSize = 20) =>
    fetchApi<{ data: unknown[]; total: number; page: number; pageSize: number; totalPages: number }>(
      `/orders?page=${page}&pageSize=${pageSize}`
    ),
  
  // Search orders (slow query)
  search: (params: { startDate?: string; endDate?: string; status?: string; minAmount?: number }) => {
    const searchParams = new URLSearchParams();
    if (params.startDate) searchParams.set('startDate', params.startDate);
    if (params.endDate) searchParams.set('endDate', params.endDate);
    if (params.status) searchParams.set('status', params.status);
    if (params.minAmount) searchParams.set('minAmount', String(params.minAmount));
    return fetchApi<{ data: unknown[]; total: number; warning?: string }>(
      `/orders/search?${searchParams}`
    );
  },
  
  // Get single order
  getById: (id: number) => fetchApi<unknown>(`/orders/${id}`),
  
  // Get order with deep nesting (slow)
  getFull: (id: number) =>
    fetchApi<{ data: unknown; warning?: string }>(`/orders/${id}/full`),
  
  // Get daily report
  getDailyReport: (days = 30) =>
    fetchApi<{ data: unknown[]; warning?: string }>(`/orders/report/daily?days=${days}`),
  
  // Create order
  create: (userId: number, items: Array<{ productId: number; quantity: number }>) =>
    fetchApi<unknown>('/orders', {
      method: 'POST',
      body: JSON.stringify({ userId, items }),
    }),
};

// Products API
export const productsApi = {
  // Get products with pagination
  getAll: (page = 1, pageSize = 20) =>
    fetchApi<{ data: unknown[]; total: number; page: number; pageSize: number; totalPages: number }>(
      `/products?page=${page}&pageSize=${pageSize}`
    ),
  
  // Search products (slow LIKE query)
  search: (query: string, category?: number) => {
    const params = new URLSearchParams({ query });
    if (category) params.set('category', String(category));
    return fetchApi<{ data: unknown[]; total: number; warning?: string }>(
      `/products/search?${params}`
    );
  },
  
  // Get product report (cartesian join - very slow)
  getReport: () =>
    fetchApi<{ data: unknown[]; total: number; warning?: string }>('/products/report'),
  
  // Get optimized product report
  getReportOptimized: () =>
    fetchApi<{ data: unknown[]; total: number }>('/products/report-optimized'),
  
  // Get categories
  getCategories: () =>
    fetchApi<{ data: unknown[]; total: number }>('/products/categories'),
  
  // Get single product
  getById: (id: number) => fetchApi<unknown>(`/products/${id}`),
};

// Debug API
export const debugApi = {
  // Trigger error
  triggerError: (message = 'Test error', type = 'Error') =>
    fetchApi<{ error: string; message: string; sentryEventId?: string }>('/debug/error', {
      method: 'POST',
      body: JSON.stringify({ message, type }),
    }),
  
  // Trigger unhandled rejection
  triggerUnhandled: () =>
    fetchApi<{ info: string }>('/debug/unhandled', { method: 'POST' }),
  
  // Slow endpoint with custom spans
  testSlow: (delay = 2000) =>
    fetchApi<{ success: boolean; totalDelay: number; info: string }>(`/debug/slow?delay=${delay}`),
  
  // Memory intensive operation
  testMemory: (sizeMB = 10) =>
    fetchApi<{ allocatedMB: number; sum: string; memoryUsage: unknown; info: string }>(
      `/debug/memory?size=${sizeMB}`
    ),
  
  // Send custom message
  sendMessage: (message: string, level = 'info') =>
    fetchApi<{ message: string; level: string; sentryEventId?: string; info: string }>(
      '/debug/message',
      {
        method: 'POST',
        body: JSON.stringify({ message, level }),
      }
    ),
  
  // Test breadcrumbs
  testBreadcrumbs: (count = 5) =>
    fetchApi<{ breadcrumbsCreated: number; sentryEventId?: string; info: string }>(
      '/debug/breadcrumbs',
      {
        method: 'POST',
        body: JSON.stringify({ count }),
      }
    ),
  
  // Test user context
  testUserContext: (user: { id: number; email: string; name: string }) =>
    fetchApi<{ user: unknown; sentryEventId?: string; info: string }>('/debug/user-context', {
      method: 'POST',
      body: JSON.stringify(user),
    }),
  
  // Test custom transaction
  testTransaction: () =>
    fetchApi<{ steps: string[]; info: string }>('/debug/transaction'),
  
  // Health check
  health: () =>
    fetchApi<{ status: string; sentry: unknown; environment: string; timestamp: string }>(
      '/debug/health'
    ),
};
