import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

// Get environment variables with fallbacks
const SENTRY_DSN = process.env.SENTRY_DSN || 'https://placeholder@sentry.example.com/0';
const SENTRY_ENVIRONMENT = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development';
const SENTRY_RELEASE = process.env.SENTRY_RELEASE || 'nodejs-tester@1.0.0';
const SENTRY_ENABLED = ['true', '1', 'yes'].includes((process.env.SENTRY_ENABLED || '').toLowerCase());

// Kubernetes context from Downward API
const POD_NAME = process.env.POD_NAME || 'local';
const POD_NAMESPACE = process.env.POD_NAMESPACE || 'default';
const NODE_NAME = process.env.NODE_NAME || 'local';

export function initSentry() {
  if (!SENTRY_ENABLED) {
    console.log('[Sentry] Disabled');
    return;
  }
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    release: SENTRY_RELEASE,
    
    // Send PII for better debugging (user info, IPs, etc.)
    sendDefaultPii: true,

    // Performance monitoring - capture 100% of transactions for testing
    tracesSampleRate: 1.0,

    // Profiling - capture profiles for performance analysis
    profilesSampleRate: 1.0,

    // Enable structured logs
    _experiments: {
      enableLogs: true,
    },

    integrations: [
      // Profiling integration for detailed performance analysis
      nodeProfilingIntegration(),
    ],

    // Add Kubernetes context as tags to all events
    initialScope: {
      tags: {
        'k8s.pod.name': POD_NAME,
        'k8s.namespace': POD_NAMESPACE,
        'k8s.node.name': NODE_NAME,
      },
    },

    // Before sending events, add additional context
    beforeSend(event) {
      // Add server-side context
      event.contexts = {
        ...event.contexts,
        kubernetes: {
          pod_name: POD_NAME,
          namespace: POD_NAMESPACE,
          node_name: NODE_NAME,
        },
        runtime: {
          name: 'node',
          version: process.version,
        },
      };
      return event;
    },

    // Before sending transactions, ensure we have good data
    beforeSendTransaction(transaction) {
      // You can filter or modify transactions here
      return transaction;
    },
  });

  console.log(`[Sentry] Initialized for ${SENTRY_ENVIRONMENT} environment`);
  console.log(`[Sentry] Release: ${SENTRY_RELEASE}`);
  console.log(`[Sentry] K8s Context: ${POD_NAMESPACE}/${POD_NAME} on ${NODE_NAME}`);
}

export function isSentryEnabled() {
  return SENTRY_ENABLED;
}

// Helper to set user context (call after authentication)
export function setSentryUser(user: { id: number; email: string; name: string }) {
  if (!SENTRY_ENABLED) {
    return;
  }
  Sentry.setUser({
    id: String(user.id),
    email: user.email,
    username: user.name,
  });
}

// Helper to clear user context (call on logout)
export function clearSentryUser() {
  if (!SENTRY_ENABLED) {
    return;
  }
  Sentry.setUser(null);
}

// Helper to add custom breadcrumb
export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>,
  level: Sentry.SeverityLevel = 'info'
) {
  if (!SENTRY_ENABLED) {
    return;
  }
  Sentry.addBreadcrumb({
    category,
    message,
    data,
    level,
    timestamp: Date.now() / 1000,
  });
}

// Helper for custom spans
export async function withSpan<T>(
  name: string,
  op: string,
  fn: () => Promise<T>,
  data?: Record<string, unknown>
): Promise<T> {
  if (!SENTRY_ENABLED) {
    return fn();
  }
  return Sentry.startSpan(
    {
      name,
      op,
      attributes: data as Record<string, string | number | boolean>,
    },
    async () => fn()
  );
}

// Re-export Sentry for direct usage
export { Sentry };
