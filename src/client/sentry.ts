import * as Sentry from '@sentry/react';

type SentryRuntimeConfig = {
  dsn: string;
  environment: string;
  release: string;
  enabled: boolean;
};

const fallbackConfig: SentryRuntimeConfig = {
  dsn: import.meta.env.VITE_SENTRY_DSN || 'https://placeholder@sentry.example.com/0',
  environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || 'development',
  release: import.meta.env.VITE_SENTRY_RELEASE || 'nodejs-tester@1.0.0',
  enabled: ['true', '1', 'yes'].includes((import.meta.env.VITE_SENTRY_ENABLED || '').toLowerCase()),
};

let sentryEnabled = false;

async function loadRuntimeConfig(): Promise<SentryRuntimeConfig> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch('/api/config', { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Failed to load config: ${response.status}`);
    }
    const data = (await response.json()) as {
      sentryEnabled?: boolean;
      sentryDsn?: string;
      sentryEnvironment?: string;
      sentryRelease?: string;
    };

    return {
      dsn: data.sentryDsn || fallbackConfig.dsn,
      environment: data.sentryEnvironment || fallbackConfig.environment,
      release: data.sentryRelease || fallbackConfig.release,
      enabled: data.sentryEnabled ?? fallbackConfig.enabled,
    };
  } catch (error) {
    console.warn('[Sentry] Failed to load runtime config, using fallback', error);
    return fallbackConfig;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function initSentry() {
  const config = await loadRuntimeConfig();
  sentryEnabled = config.enabled;

  if (!config.enabled) {
    console.log('[Sentry] Disabled');
    return;
  }
  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    release: config.release,

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

  console.log(`[Sentry] Frontend initialized for ${config.environment}`);
}

export function isSentryEnabled() {
  return sentryEnabled;
}

// Helper to set user context
export function setSentryUser(user: { id: string | number; email: string; name: string }) {
  if (!sentryEnabled) {
    return;
  }
  Sentry.setUser({
    id: String(user.id),
    email: user.email,
    username: user.name,
  });
}

// Helper to clear user context
export function clearSentryUser() {
  if (!sentryEnabled) {
    return;
  }
  Sentry.setUser(null);
}

// Helper to add breadcrumb
export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>,
  level: Sentry.SeverityLevel = 'info'
) {
  if (!sentryEnabled) {
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

// Helper to capture error with context
export function captureError(error: Error, context?: Record<string, unknown>) {
  if (!sentryEnabled) {
    return;
  }
  Sentry.captureException(error, {
    extra: context,
  });
}

// Helper to capture message
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  if (!sentryEnabled) {
    return;
  }
  Sentry.captureMessage(message, level);
}

// Helper for custom spans
export function withSpan<T>(
  name: string,
  op: string,
  fn: () => T,
  data?: Record<string, unknown>
): T {
  if (!sentryEnabled) {
    return fn();
  }
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
