import 'dotenv/config';
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { Sentry, addBreadcrumb, isSentryEnabled } from './sentry.js';

import { initDatabase } from './db.js';
import { createRoutes } from './routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware with Sentry breadcrumbs
app.use((req, _res, next) => {
  addBreadcrumb('http', `${req.method} ${req.path}`, {
    method: req.method,
    url: req.url,
    query: req.query,
  });
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint (before other routes)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api', createRoutes());

// Sentry error handler must be registered before any other error middleware
if (isSentryEnabled()) {
  Sentry.setupExpressErrorHandler(app);
}

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const clientPath = path.join(__dirname, '../client');
  app.use(express.static(clientPath));
  
  // SPA fallback
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
  });
}

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found', message: 'The requested resource was not found' });
});

// Error handler (Sentry will capture these automatically)
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Error]', err);
  
  // Get the Sentry event ID for correlation
  const eventId = isSentryEnabled() ? Sentry.lastEventId() : undefined;
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
    sentryEventId: eventId,
  });
});

// Start server
async function start() {
  try {
    // Initialize database
    await initDatabase();
    
    // Start listening
    app.listen(PORT, () => {
      console.log(`[Server] Running on http://localhost:${PORT}`);
      console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
      
      // Log a Sentry message to verify it's working
      if (isSentryEnabled()) {
        Sentry.captureMessage('Server started successfully', 'info');
      }
    });
  } catch (error) {
    console.error('[Server] Failed to start:', error);
    if (isSentryEnabled()) {
      Sentry.captureException(error);
    }
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Server] SIGTERM received, shutting down gracefully');
  if (isSentryEnabled()) {
    await Sentry.close(2000);
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Server] SIGINT received, shutting down gracefully');
  if (isSentryEnabled()) {
    await Sentry.close(2000);
  }
  process.exit(0);
});

start();
