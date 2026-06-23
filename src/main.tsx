import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Safe sandbox event interceptors for iframe runtime environments
if (typeof window !== 'undefined') {
  const originalOnError = window.onerror;
  window.onerror = function (message, source, lineno, colno, error) {
    const msgStr = String(message).toLowerCase();
    if (
      msgStr.includes('script error') ||
      msgStr.includes('websocket') ||
      msgStr.includes('failed to connect') ||
      msgStr.includes('connection') ||
      !source
    ) {
      console.warn('Swallowed cross-origin/sandbox error:', message, source);
      return true; // Stop propagation
    }
    if (originalOnError) {
      return originalOnError.apply(this, arguments as any);
    }
    return false;
  };

  window.addEventListener('error', (event) => {
    const msgStr = String(event.message || '').toLowerCase();
    if (
      msgStr.includes('script error') ||
      msgStr.includes('websocket') ||
      msgStr.includes('failed to connect') ||
      msgStr.includes('connection') ||
      !event.filename
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    const reasonStr = String(event.reason || '').toLowerCase();
    if (
      reasonStr.includes('script error') ||
      reasonStr.includes('websocket') ||
      reasonStr.includes('failed to connect') ||
      reasonStr.includes('connection')
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  });

  // Polyfill alert immediately on start before any other logic initiates
  window.alert = (message: string) => {
    console.warn("Polyfilled native alert executed:", message);
    window.dispatchEvent(
      new CustomEvent('app-toast', {
        detail: {
          message: String(message),
          type: 'warning',
        },
      })
    );
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

