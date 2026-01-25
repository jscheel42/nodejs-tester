import { Router } from 'express';
import usersRouter from './users.js';
import ordersRouter from './orders.js';
import productsRouter from './products.js';
import debugRouter from './debug.js';

export function createRoutes(): Router {
  const router = Router();

  router.use('/users', usersRouter);
  router.use('/orders', ordersRouter);
  router.use('/products', productsRouter);
  router.use('/debug', debugRouter);

  router.get('/config', (_req, res) => {
    res.json({
      sentryEnabled: ['true', '1', 'yes'].includes((process.env.SENTRY_ENABLED || '').toLowerCase()),
      sentryDsn: process.env.VITE_SENTRY_DSN || '',
      sentryEnvironment: process.env.SENTRY_ENVIRONMENT || 'development',
      sentryRelease: process.env.SENTRY_RELEASE || 'nodejs-tester@1.0.0',
    });
  });

  // API info endpoint
  router.get('/', (_req, res) => {
    res.json({
      name: 'nodejs-tester API',
      version: '1.0.0',
      endpoints: {
        users: '/api/users',
        orders: '/api/orders',
        products: '/api/products',
        debug: '/api/debug',
      },
    });
  });

  return router;
}
