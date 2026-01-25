import { Sequelize } from 'sequelize';
import * as Sentry from '@sentry/node';

// Database URL from environment
const databaseUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/tester';

// Create Sequelize instance with logging that integrates with Sentry
export const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  logging: (sql, timing) => {
    // Add breadcrumb for every SQL query (useful for debugging)
    Sentry.addBreadcrumb({
      category: 'database',
      message: sql,
      level: 'debug',
      data: {
        timing: typeof timing === 'number' ? timing : undefined,
      },
    });
    
    // Also log to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[SQL] ${sql}`);
    }
  },
  benchmark: true, // Enable timing
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

// Import and initialize models
import { User, initUser } from './User.js';
import { Category, initCategory } from './Category.js';
import { Product, initProduct } from './Product.js';
import { Order, initOrder } from './Order.js';
import { OrderItem, initOrderItem } from './OrderItem.js';

// Initialize all models
export function initModels() {
  initUser();
  initCategory();
  initProduct();
  initOrder();
  initOrderItem();

  // Set up associations
  setupAssociations();
}

function setupAssociations() {
  // User <-> Order (one-to-many)
  User.hasMany(Order, { foreignKey: 'userId', as: 'orders' });
  Order.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  // Category <-> Product (one-to-many)
  Category.hasMany(Product, { foreignKey: 'categoryId', as: 'products' });
  Product.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });

  // Order <-> OrderItem (one-to-many)
  Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items' });
  OrderItem.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

  // Product <-> OrderItem (one-to-many)
  Product.hasMany(OrderItem, { foreignKey: 'productId', as: 'orderItems' });
  OrderItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });
}

// Re-export models
export { User } from './User.js';
export { Category } from './Category.js';
export { Product } from './Product.js';
export { Order } from './Order.js';
export { OrderItem } from './OrderItem.js';
