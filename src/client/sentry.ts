import * as Sentry from '@sentry/react';

// Get environment variables (Vite exposes them via import.meta.env)
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || 'https://placeholder@sentry.example.com/0';
const SENTRY_ENVIRONMENT = import.meta.env.VITE_SENTRY_ENVIRONMENT || 'development';
const SENTRY_RELEASE = import.meta.env.VITE_SENTRY_RELEASE || 'nodejs-tester@1.0.0';

export function initSentry() {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    release: SENTRY_RELEASE,

    // Send PII for better debugging
    sendDefaultPii: true,

    integrations: [
      // Browser tracing for performance monitoring
      Sentry.browserTracingIntegration(),

      // Session Replay for visual debugging
      Sentry.replayIntegration({
        // Mask all text for privacy (can be disabled for testing)
        maskAllText: false,
        blockAllMedia: false,
      }),

      // User feedback widget
      Sentry.feedbackIntegration({
        colorScheme: 'system',
        buttonLabel: 'Report a Bug',
        submitButtonLabel: 'Send Report',
        formTitle: 'Report a Bug',
        messagePlaceholder: 'What happened?',
        successMessageText: 'Thanks for the feedback!',
      }),
    ],

    // Performance monitoring - capture 100% for testing
    tracesSampleRate: 1.0,

    // Trace propagation to backend
    tracePropagationTargets: [
      'localhost',
      /^\/api/,
      /^https?:\/\/[^/]*\.joshuascheel\.com/,
    ],

    // Session Replay sampling
    replaysSessionSampleRate: 1.0, // 100% for testing
    replaysOnErrorSampleRate: 1.0, // Always capture on error

    // Before sending events
    beforeSend(event) {
      // Add custom context
      event.contexts = {
        ...event.contexts,
        app: {
          name: 'nodejs-tester-frontend',
          version: '1.0.0',
        },
      };
      return event;
    },
  });

  console.log(`[Sentry] Frontend initialized for ${SENTRY_ENVIRONMENT}`);
}

// Helper to set user context
export function setSentryUser(user: { id: string | number; email: string; name: string }) {
  Sentry.setUser({
    id: String(user.id),
    email: user.email,
    username: user.name,
  });
}

// Helper to clear user context
export function clearSentryUser() {
  Sentry.setUser(null);
}

// Helper to add breadcrumb
export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>,
  level: Sentry.SeverityLevel = 'info'
) {
  Sentry.addBreadcrumb({
    category,
    message,
    data,
    level,
    timestamp: Date.now() / 1000,
  });
}

// Helper to capture error with context
export function captureError(error: Error, context?: Record<string, unknown>) {
  Sentry.captureException(error, {
    extra: context,
  });
}

// Helper to capture message
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  Sentry.captureMessage(message, level);
}

// Helper for custom spans
export function withSpan<T>(
  name: string,
  op: string,
  fn: () => T,
  data?: Record<string, unknown>
): T {
  return Sentry.startSpan(
    {
      name,
      op,
      attributes: data as Record<string, string | number | boolean>,
    },
    () => fn()
  );
}

// Re-export Sentry for direct usage
export { Sentry };
