import { Router } from 'express';
import { Op, literal } from 'sequelize';
import { Order, OrderItem, Product, sequelize } from '../models/index.js';
import { addBreadcrumb, withSpan } from '../sentry.js';

const router = Router();

/**
 * GET /api/orders
 * Get orders with pagination
 */
router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100);
    const offset = (page - 1) * pageSize;

    addBreadcrumb('api', 'Fetching orders', { page, pageSize });

    const { count, rows } = await Order.findAndCountAll({
      include: ['user'],
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
 * GET /api/orders/search
 * INTENTIONALLY INEFFICIENT: Full table scan on date range (no index on createdAt)
 */
router.get('/search', async (req, res, next) => {
  try {
    const { startDate, endDate, status, minAmount } = req.query;
    
    addBreadcrumb('api', 'Searching orders (slow query)', { 
      startDate, endDate, status, minAmount,
      warning: 'no index on createdAt' 
    });

    const whereClause: Record<string, unknown> = {};

    if (startDate || endDate) {
      whereClause.createdAt = {
        [Op.between]: [
          new Date(startDate as string || '2020-01-01'),
          new Date(endDate as string || new Date().toISOString()),
        ],
      };
    }

    if (status) {
      whereClause.status = status;
    }

    if (minAmount) {
      whereClause.totalAmount = {
        [Op.gte]: parseFloat(minAmount as string),
      };
    }

    // BAD: Complex query without proper indexes
    const orders = await Order.findAll({
      where: whereClause,
      include: [
        { association: 'user' },
        { 
          association: 'items',
          include: ['product'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    res.json({
      data: orders,
      total: orders.length,
      warning: 'This query may be slow due to missing indexes',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/orders/:id
 * Get a single order
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const order = await Order.findByPk(id, {
      include: ['user', 'items'],
    });

    if (!order) {
      return res.status(404).json({ error: 'Not Found', message: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/orders/:id/full
 * INTENTIONALLY INEFFICIENT: Deep nested eager loading
 */
router.get('/:id/full', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    addBreadcrumb('api', 'Fetching order with deep nesting', { 
      orderId: id,
      warning: '4+ levels of includes' 
    });

    // BAD: Very deep nesting causes complex JOINs
    const order = await Order.findByPk(id, {
      include: [
        { 
          association: 'user',
          include: [
            {
              association: 'orders',
              limit: 10, // Still bad - fetches other orders of same user
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
            },
          ],
        },
        { 
          association: 'items',
          include: [
            {
              association: 'product',
              include: [
                {
                  association: 'category',
                },
                {
                  association: 'orderItems',
                  limit: 5, // Fetches other order items for same product
                },
              ],
            },
          ],
        },
      ],
    });

    if (!order) {
      return res.status(404).json({ error: 'Not Found', message: 'Order not found' });
    }

    res.json({
      data: order,
      warning: 'This query has deeply nested includes which can be slow',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/orders/report/daily
 * INTENTIONALLY INEFFICIENT: Aggregation without proper indexes
 */
router.get('/report/daily', async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    
    addBreadcrumb('api', 'Generating daily report', { days, warning: 'slow aggregation' });

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days as string));

    // BAD: Aggregation on unindexed columns
    const report = await withSpan(
      'generate-daily-report',
      'db.query',
      async () => {
        return Order.findAll({
          attributes: [
            [literal("DATE(\"createdAt\")"), 'date'],
            [literal('COUNT(*)'), 'orderCount'],
            [literal('SUM("totalAmount")'), 'totalRevenue'],
            [literal('AVG("totalAmount")'), 'averageOrderValue'],
          ],
          where: {
            createdAt: {
              [Op.gte]: startDate,
            },
          },
          group: ['createdAt'],
          order: [['createdAt', 'DESC']],
          raw: true,
        });
      },
      { 'db.operation': 'SELECT', 'db.aggregation': 'GROUP BY' }
    );

    res.json({
      data: report,
      warning: 'This aggregation query may be slow without proper indexes',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/orders
 * Create a new order
 */
router.post('/', async (req, res, next) => {
  try {
    const { userId, items } = req.body;

    if (!userId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        error: 'Bad Request', 
        message: 'userId and items array are required' 
      });
    }

    addBreadcrumb('api', 'Creating new order', { userId, itemCount: items.length });

    // Use transaction for order creation
    const result = await sequelize.transaction(async (t) => {
      // Calculate total from products
      let totalAmount = 0;
      const orderItems: Array<{ productId: number; quantity: number; price: number }> = [];

      for (const item of items) {
        const product = await Product.findByPk(item.productId, { transaction: t });
        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }
        const price = parseFloat(product.price.toString());
        totalAmount += price * item.quantity;
        orderItems.push({
          productId: item.productId,
          quantity: item.quantity,
          price,
        });
      }

      // Create order
      const order = await Order.create(
        { userId, totalAmount, status: 'pending' },
        { transaction: t }
      );

      // Create order items
      await OrderItem.bulkCreate(
        orderItems.map(item => ({ ...item, orderId: order.id })),
        { transaction: t }
      );

      return order;
    });

    // Fetch the complete order
    const order = await Order.findByPk(result.id, {
      include: ['items'],
    });

    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
});

export default router;
