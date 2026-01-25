// Shared types between frontend and backend

export interface UserDTO {
  id: number;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryDTO {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductDTO {
  id: number;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  categoryId: number;
  category?: CategoryDTO;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItemDTO {
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
  price: number;
  product?: ProductDTO;
  createdAt: string;
  updatedAt: string;
}

export interface OrderDTO {
  id: number;
  userId: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  totalAmount: number;
  user?: UserDTO;
  items?: OrderItemDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  error: string;
  message: string;
  sentryEventId?: string;
}

// Seed sizes for database population
export type SeedSize = 'small' | 'medium' | 'large';

export const SEED_CONFIGS: Record<SeedSize, {
  users: number;
  categories: number;
  products: number;
  orders: number;
  itemsPerOrder: { min: number; max: number };
}> = {
  small: {
    users: 100,
    categories: 10,
    products: 500,
    orders: 1000,
    itemsPerOrder: { min: 1, max: 5 },
  },
  medium: {
    users: 1000,
    categories: 25,
    products: 2000,
    orders: 10000,
    itemsPerOrder: { min: 1, max: 8 },
  },
  large: {
    users: 100000,
    categories: 50,
    products: 10000,
    orders: 500000,
    itemsPerOrder: { min: 1, max: 10 },
  },
};
