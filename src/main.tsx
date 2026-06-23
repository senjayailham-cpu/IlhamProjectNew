import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined') {
  const resizeObserverError = (e: ErrorEvent) => {
    if (e) {
      const msg = e.message || '';
      if (
        msg.includes('ResizeObserver') ||
        msg.includes('loop completed') ||
        msg.includes('loop limit exceeded') ||
        msg.toLowerCase().includes('script error') ||
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('Importing a module script failed')
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }
  };

  const rejectionHandler = (e: PromiseRejectionEvent) => {
    if (e && e.reason) {
      const reasonStr = String(e.reason.message || e.reason || '');
      if (
        reasonStr.includes('ResizeObserver') ||
        reasonStr.toLowerCase().includes('script error') ||
        reasonStr.includes('Failed to fetch dynamically imported module') ||
        reasonStr.includes('Importing a module script failed')
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }
  };

  window.addEventListener('error', resizeObserverError, true);
  window.addEventListener('unhandledrejection', rejectionHandler, true);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

