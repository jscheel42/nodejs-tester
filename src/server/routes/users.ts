import { Router } from 'express';
import { Op } from 'sequelize';
import { User, Order, OrderItem, Product } from '../models/index.js';
import { addBreadcrumb, withSpan, setSentryUser } from '../sentry.js';

const router = Router();

/**
 * GET /api/users
 * INTENTIONALLY INEFFICIENT: No pagination - fetches ALL users
 * This will be slow with large datasets and cause memory issues
 */
router.get('/', async (_req, res, next) => {
  try {
    addBreadcrumb('api', 'Fetching all users (no pagination)', { warning: 'inefficient' });
    
    // BAD: No limit, no pagination - will fetch 100k+ rows
    const users = await User.findAll({
      order: [['createdAt', 'DESC']],
    });

    res.json({
      data: users,
      total: users.length,
      warning: 'This endpoint has no pagination and may be slow with large datasets',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/users/paginated
 * EFFICIENT: Proper pagination
 */
router.get('/paginated', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100);
    const offset = (page - 1) * pageSize;

    addBreadcrumb('api', 'Fetching users with pagination', { page, pageSize });

    const { count, rows } = await User.findAndCountAll({
      limit: pageSize,
      offset,
      order: [['createdAt', 'DESC']],
    });

    res.json({
      data: rows,
      total: count,
      page,
      pageSize,
      totalPages: Math.ceil(count / pageSize),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/users/:id
 * Get a single user by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const user = await User.findByPk(id);
    
    if (!user) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found' });
    }

    // Set Sentry user context (simulating authentication)
    setSentryUser({ id: user.id, email: user.email, name: user.name });

    res.json(user);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/users/:id/orders
 * INTENTIONALLY INEFFICIENT: N+1 query problem
 * Fetches orders then loops to fetch items one by one
 */
router.get('/:id/orders', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    addBreadcrumb('api', 'Fetching user orders with N+1 problem', { userId: id, warning: 'N+1 queries' });

    // First query: Get all orders for user
    const orders = await Order.findAll({
      where: { userId: id },
      order: [['createdAt', 'DESC']],
    });

    // BAD: N+1 problem - fetching items for each order in a loop
    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        // This creates N additional queries!
        const items = await OrderItem.findAll({
          where: { orderId: order.id },
        });

        // Even worse: fetch product for each item (N*M queries!)
        const itemsWithProducts = await Promise.all(
          items.map(async (item) => {
            const product = await Product.findByPk(item.productId);
            return {
              ...item.toJSON(),
              product: product?.toJSON(),
            };
          })
        );

        return {
          ...order.toJSON(),
          items: itemsWithProducts,
        };
      })
    );

    res.json({
      data: ordersWithItems,
      total: orders.length,
      warning: 'This endpoint demonstrates N+1 query problem',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/users/:id/orders-optimized
 * EFFICIENT: Uses eager loading to avoid N+1
 */
router.get('/:id/orders-optimized', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    addBreadcrumb('api', 'Fetching user orders with eager loading', { userId: id });

    // GOOD: Single query with eager loading
    const orders = await Order.findAll({
      where: { userId: id },
      include: [
        {
          association: 'items',
          include: [
            {
              association: 'product',
              include: ['category'],
            },
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    res.json({
      data: orders,
      total: orders.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/users/search
 * INTENTIONALLY INEFFICIENT: Full table scan on non-indexed column
 */
router.get('/search/by-date', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    addBreadcrumb('api', 'Searching users by date range (no index)', { 
      startDate, 
      endDate, 
      warning: 'full table scan' 
    });

    // BAD: createdAt is not indexed, causes full table scan
    const users = await User.findAll({
      where: {
        createdAt: {
          [Op.between]: [
            new Date(startDate as string || '2020-01-01'),
            new Date(endDate as string || new Date().toISOString()),
          ],
        },
      },
    });

    res.json({
      data: users,
      total: users.length,
      warning: 'This query performs a full table scan (createdAt not indexed)',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/users/export
 * INTENTIONALLY INEFFICIENT: Loads all users into memory with all associations
 */
router.get('/export/all', async (_req, res, next) => {
  try {
    addBreadcrumb('api', 'Exporting all users with orders', { warning: 'memory intensive' });

    // BAD: Loads everything into memory
    const users = await withSpan(
      'export-all-users',
      'db.query',
      async () => {
        return User.findAll({
          include: [
            {
              association: 'orders',
              include: [
                {
                  association: 'items',
                  include: ['product'],
                },
              ],
            },
          ],
        });
      },
      { 'db.operation': 'SELECT', 'db.table': 'users' }
    );

    // Simulate some processing
    await withSpan(
      'process-export-data',
      'function',
      async () => {
        // Artificial delay to simulate processing
        await new Promise(resolve => setTimeout(resolve, 100));
        return users.map(u => u.toJSON());
      }
    );

    res.json({
      data: users,
      total: users.length,
      warning: 'This endpoint loads all data into memory',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
