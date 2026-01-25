import { Router } from 'express';
import { Op, literal } from 'sequelize';
import { Product, Category, sequelize } from '../models/index.js';
import { addBreadcrumb, withSpan } from '../sentry.js';

const router = Router();

/**
 * GET /api/products
 * Get products with pagination
 */
router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100);
    const offset = (page - 1) * pageSize;

    const { count, rows } = await Product.findAndCountAll({
      include: ['category'],
      limit: pageSize,
      offset,
      order: [['name', 'ASC']],
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
 * GET /api/products/search
 * INTENTIONALLY INEFFICIENT: LIKE query on non-indexed column
 */
router.get('/search', async (req, res, next) => {
  try {
    const { query, category } = req.query;
    
    addBreadcrumb('api', 'Searching products (slow LIKE query)', { 
      query, category,
      warning: 'no index on name' 
    });

    const whereClause: Record<string, unknown> = {};

    if (query) {
      // BAD: LIKE with leading wildcard prevents index usage
      whereClause.name = {
        [Op.iLike]: `%${query}%`,
      };
    }

    if (category) {
      whereClause.categoryId = category;
    }

    const products = await Product.findAll({
      where: whereClause,
      include: ['category'],
      order: [['name', 'ASC']],
    });

    res.json({
      data: products,
      total: products.length,
      warning: 'LIKE query with leading wildcard is slow',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/products/report
 * INTENTIONALLY INEFFICIENT: Cartesian join / cross join behavior
 */
router.get('/report', async (_req, res, next) => {
  try {
    addBreadcrumb('api', 'Generating product report (cartesian join)', { 
      warning: 'very slow query' 
    });

    // BAD: This query is extremely inefficient
    // Fetches all products with all their order items and orders
    const report = await withSpan(
      'generate-product-report',
      'db.query',
      async () => {
        return Product.findAll({
          include: [
            {
              association: 'category',
            },
            {
              association: 'orderItems',
              include: [
                {
                  association: 'order',
                  include: ['user'],
                },
              ],
            },
          ],
        });
      },
      { 'db.operation': 'SELECT', 'db.warning': 'cartesian_join' }
    );

    // Calculate stats (also inefficient - should be done in DB)
    const stats = await withSpan(
      'calculate-product-stats',
      'function',
      async () => {
        return report.map((product: any) => {
          const items = product.orderItems || [];
          const totalSold = items.reduce((sum: number, item: any) => sum + item.quantity, 0);
          const totalRevenue = items.reduce((sum: number, item: any) => sum + (item.quantity * parseFloat(item.price.toString())), 0);
          
          return {
            id: product.id,
            name: product.name,
            category: product.category?.name,
            stock: product.stock,
            totalSold,
            totalRevenue,
            orderCount: items.length,
          };
        });
      }
    );

    res.json({
      data: stats,
      total: stats.length,
      warning: 'This report uses inefficient joins and in-memory calculations',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/products/report-optimized
 * EFFICIENT: Uses raw SQL with proper aggregation
 */
router.get('/report-optimized', async (_req, res, next) => {
  try {
    addBreadcrumb('api', 'Generating optimized product report');

    const report = await withSpan(
      'generate-optimized-product-report',
      'db.query',
      async () => {
        const [results] = await sequelize.query(`
          SELECT 
            p.id,
            p.name,
            c.name as category,
            p.stock,
            COALESCE(SUM(oi.quantity), 0) as "totalSold",
            COALESCE(SUM(oi.quantity * oi.price), 0) as "totalRevenue",
            COUNT(DISTINCT oi.id) as "orderCount"
          FROM products p
          LEFT JOIN categories c ON p."categoryId" = c.id
          LEFT JOIN order_items oi ON p.id = oi."productId"
          GROUP BY p.id, p.name, c.name, p.stock
          ORDER BY "totalRevenue" DESC
        `);
        return results;
      },
      { 'db.operation': 'SELECT', 'db.aggregation': 'GROUP BY' }
    );

    res.json({
      data: report,
      total: (report as unknown[]).length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/products/categories
 * Get all categories with product counts
 */
router.get('/categories', async (_req, res, next) => {
  try {
    const categories = await Category.findAll({
      include: [
        {
          association: 'products',
          attributes: [],
        },
      ],
      attributes: {
        include: [
          [literal('(SELECT COUNT(*) FROM products WHERE products."categoryId" = "Category".id)'), 'productCount'],
        ],
      },
      order: [['name', 'ASC']],
    });

    res.json({
      data: categories,
      total: categories.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/products/:id
 * Get a single product
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const product = await Product.findByPk(id, {
      include: ['category'],
    });

    if (!product) {
      return res.status(404).json({ error: 'Not Found', message: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    next(error);
  }
});

export default router;
