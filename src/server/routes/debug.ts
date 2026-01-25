import { Router } from 'express';
import * as Sentry from '@sentry/node';
import { addBreadcrumb, withSpan, setSentryUser } from '../sentry.js';

const router = Router();

/**
 * POST /api/debug/error
 * Trigger an intentional error for Sentry testing
 */
router.post('/error', async (req, res, _next) => {
  const { message = 'Test error from debug endpoint', type = 'Error' } = req.body;
  
  addBreadcrumb('debug', 'Triggering intentional error', { message, type });
  
  // Simulate some user context
  setSentryUser({ id: 999, email: 'debug@test.com', name: 'Debug User' });

  try {
    // Different error types for testing
    switch (type) {
      case 'TypeError':
        throw new TypeError(message);
      case 'RangeError':
        throw new RangeError(message);
      case 'ReferenceError':
        throw new ReferenceError(message);
      case 'SyntaxError':
        throw new SyntaxError(message);
      default:
        throw new Error(message);
    }
  } catch (error) {
    // Capture with additional context
    Sentry.captureException(error, {
      tags: {
        'debug.triggered': 'true',
        'error.type': type,
      },
      extra: {
        requestBody: req.body,
        timestamp: new Date().toISOString(),
      },
    });

    const eventId = Sentry.lastEventId();
    
    res.status(500).json({
      error: type,
      message,
      sentryEventId: eventId,
      info: 'This error was intentionally triggered and captured by Sentry',
    });
  }
});

/**
 * POST /api/debug/unhandled
 * Trigger an unhandled promise rejection
 */
router.post('/unhandled', async (_req, res) => {
  addBreadcrumb('debug', 'Triggering unhandled promise rejection');

  // This creates an unhandled promise rejection
  // Sentry will capture it automatically
  Promise.reject(new Error('Unhandled promise rejection from debug endpoint'));

  res.json({
    info: 'Unhandled promise rejection triggered - check Sentry for capture',
  });
});

/**
 * GET /api/debug/slow
 * Simulate a slow endpoint with custom spans
 */
router.get('/slow', async (req, res, next) => {
  try {
    const { delay = 2000 } = req.query;
    const delayMs = parseInt(delay as string);

    addBreadcrumb('debug', 'Starting slow operation', { delayMs });

    // Create custom spans for different "operations"
    const result = await withSpan(
      'slow-operation-total',
      'function',
      async () => {
        // Simulate database query
        await withSpan(
          'slow-db-query',
          'db.query',
          async () => {
            await new Promise(resolve => setTimeout(resolve, delayMs * 0.4));
            return { rows: 1000 };
          },
          { 'db.system': 'postgresql', 'db.operation': 'SELECT' }
        );

        // Simulate external API call
        await withSpan(
          'external-api-call',
          'http.client',
          async () => {
            await new Promise(resolve => setTimeout(resolve, delayMs * 0.3));
            return { status: 200 };
          },
          { 'http.method': 'GET', 'http.url': 'https://api.example.com/data' }
        );

        // Simulate data processing
        await withSpan(
          'data-processing',
          'function',
          async () => {
            await new Promise(resolve => setTimeout(resolve, delayMs * 0.3));
            return { processed: 500 };
          }
        );

        return { success: true, totalDelay: delayMs };
      }
    );

    res.json({
      ...result,
      info: 'Check Sentry Performance for trace with custom spans',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/debug/memory
 * Simulate memory-intensive operation
 */
router.get('/memory', async (req, res, next) => {
  try {
    const { size = 10 } = req.query;
    const sizeMB = parseInt(size as string);

    addBreadcrumb('debug', 'Starting memory-intensive operation', { sizeMB });

    const result = await withSpan(
      'memory-intensive-operation',
      'function',
      async () => {
        // Allocate memory
        const arrays: number[][] = [];
        const bytesPerMB = 1024 * 1024;
        const elementsPerMB = bytesPerMB / 8; // 8 bytes per number

        for (let i = 0; i < sizeMB; i++) {
          arrays.push(new Array(elementsPerMB).fill(Math.random()));
        }

        // Do some work
        let sum = 0;
        for (const arr of arrays) {
          sum += arr.reduce((a, b) => a + b, 0);
        }

        // Memory will be freed after this function returns
        return { allocatedMB: sizeMB, sum: sum.toFixed(2) };
      },
      { 'memory.allocated_mb': sizeMB }
    );

    // Get memory usage
    const memUsage = process.memoryUsage();

    res.json({
      ...result,
      memoryUsage: {
        heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
        rss: `${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`,
      },
      info: 'Check Sentry for performance impact',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/debug/message
 * Send a custom message to Sentry
 */
router.post('/message', async (req, res) => {
  const { message = 'Test message', level = 'info' } = req.body;
  
  addBreadcrumb('debug', 'Sending custom message', { message, level });

  Sentry.captureMessage(message, level as Sentry.SeverityLevel);

  const eventId = Sentry.lastEventId();

  res.json({
    message,
    level,
    sentryEventId: eventId,
    info: 'Message sent to Sentry',
  });
});

/**
 * POST /api/debug/breadcrumbs
 * Test breadcrumb creation
 */
router.post('/breadcrumbs', async (req, res) => {
  const { count = 5 } = req.body;

  // Create multiple breadcrumbs
  for (let i = 1; i <= count; i++) {
    addBreadcrumb('debug', `Breadcrumb ${i} of ${count}`, {
      index: i,
      timestamp: Date.now(),
    });
    
    // Small delay between breadcrumbs
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Now trigger an error to see the breadcrumbs
  Sentry.captureMessage(`Test message with ${count} breadcrumbs`, 'info');

  res.json({
    breadcrumbsCreated: count,
    sentryEventId: Sentry.lastEventId(),
    info: 'Check Sentry to see breadcrumb trail',
  });
});

/**
 * POST /api/debug/user-context
 * Test user context setting
 */
router.post('/user-context', async (req, res) => {
  const { id = 123, email = 'test@example.com', name = 'Test User' } = req.body;

  setSentryUser({ id, email, name });

  Sentry.captureMessage('Test message with user context', 'info');

  res.json({
    user: { id, email, name },
    sentryEventId: Sentry.lastEventId(),
    info: 'User context set and test message sent',
  });
});

/**
 * GET /api/debug/transaction
 * Create a custom transaction with multiple spans
 */
router.get('/transaction', async (_req, res, next) => {
  try {
    const result = await Sentry.startSpan(
      {
        name: 'custom-transaction',
        op: 'test',
        attributes: {
          'custom.attribute': 'value',
        },
      },
      async () => {
        const steps: string[] = [];

        // Step 1: Initialize
        await Sentry.startSpan({ name: 'initialize', op: 'function' }, async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          steps.push('initialized');
        });

        // Step 2: Fetch data
        await Sentry.startSpan({ name: 'fetch-data', op: 'db.query' }, async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          steps.push('data fetched');
        });

        // Step 3: Process
        await Sentry.startSpan({ name: 'process-data', op: 'function' }, async () => {
          await new Promise(resolve => setTimeout(resolve, 75));
          steps.push('processed');
        });

        // Step 4: Cleanup
        await Sentry.startSpan({ name: 'cleanup', op: 'function' }, async () => {
          await new Promise(resolve => setTimeout(resolve, 25));
          steps.push('cleaned up');
        });

        return { steps };
      }
    );

    res.json({
      ...result,
      info: 'Custom transaction created with multiple spans - check Sentry Performance',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/debug/health
 * Health check with Sentry status
 */
router.get('/health', (_req, res) => {
  const client = Sentry.getClient();
  
  res.json({
    status: 'ok',
    sentry: {
      initialized: !!client,
      dsn: client?.getDsn()?.toString() || 'not configured',
    },
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

export default router;
