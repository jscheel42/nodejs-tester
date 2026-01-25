import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import App from './App';
import { initSentry, isSentryEnabled } from './sentry';
import './App.css';

async function bootstrap() {
  try {
    await initSentry();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[Sentry] Failed to initialize', message);
  }

  const root = (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );

  const content = isSentryEnabled() ? (
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => (
        <div className="error-boundary">
          <h1>Something went wrong</h1>
          <pre>{error instanceof Error ? error.message : String(error)}</pre>
          <button onClick={resetError}>Try again</button>
        </div>
      )}
      onError={(error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error('ErrorBoundary caught:', message);
      }}
    >
      {root}
    </Sentry.ErrorBoundary>
  ) : (
    root
  );

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>{content}</React.StrictMode>
  );
}

bootstrap();
