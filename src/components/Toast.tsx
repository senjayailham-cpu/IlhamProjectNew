import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from 'lucide-react';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const scheduleDismiss = (id: string, delay = 4000) => {
    const existing = timersRef.current.get(id);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timersRef.current.delete(id);
    }, delay);
    timersRef.current.set(id, timer);
  };

  const pauseDismiss = (id: string) => {
    const existing = timersRef.current.get(id);
    if (existing) {
      clearTimeout(existing);
      timersRef.current.delete(id);
    }
  };

  useEffect(() => {
    const handleToastEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ message: string; type: Toast['type'] }>;
      if (!customEvent.detail || !customEvent.detail.message) return;

      const id = Math.random().toString(36).substring(2, 9);
      const newToast: Toast = {
        id,
        message: customEvent.detail.message,
        type: customEvent.detail.type || 'info',
      };

      setToasts((prev) => {
        // Prevent duplicate back-to-back identical messages
        const filtered = prev.filter((t) => t.message !== newToast.message);
        const next = [...filtered, newToast];
        return next.slice(-4); // Cap visible toast stack at 4
      });

      scheduleDismiss(id, newToast.type === 'error' ? 5500 : 4000);
    };

    window.addEventListener('app-toast', handleToastEvent);

    // Intercept native alert
    const originalAlert = window.alert;
    window.alert = (message: string) => {
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: {
            message,
            type: 'warning',
          },
        })
      );
    };

    return () => {
      window.removeEventListener('app-toast', handleToastEvent);
      window.alert = originalAlert;
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-16 md:bottom-6 right-4 z-[9999] flex flex-col gap-2.5 max-w-sm w-[calc(100vw-2rem)] font-sans pointer-events-none">
      {toasts.map((toast) => {
        let bgClass = '';
        if (toast.type === 'success') {
          bgClass = 'bg-emerald-50 dark:bg-emerald-950/95 border-emerald-500/35 text-emerald-800 dark:text-emerald-200';
        } else if (toast.type === 'error') {
          bgClass = 'bg-rose-50 dark:bg-rose-950/95 border-rose-500/35 text-rose-800 dark:text-rose-200';
        } else if (toast.type === 'warning') {
          bgClass = 'bg-amber-50 dark:bg-amber-950/95 border-amber-500/35 text-amber-800 dark:text-amber-200';
        } else {
          bgClass = 'bg-blue-50 dark:bg-blue-950/95 border-blue-500/35 text-blue-800 dark:text-blue-200';
        }

        const Icon =
          toast.type === 'success'
            ? CheckCircle
            : toast.type === 'error'
              ? AlertCircle
              : toast.type === 'warning'
                ? AlertTriangle
                : Info;

        return (
          <div
            key={toast.id}
            role="status"
            onMouseEnter={() => pauseDismiss(toast.id)}
            onMouseLeave={() => scheduleDismiss(toast.id, 2500)}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-200 animate-in slide-in-from-right-4 fade-in ${bgClass}`}
          >
            <Icon className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="flex-1 text-xs font-semibold leading-relaxed">
              {toast.message}
            </div>
            <button
              type="button"
              onClick={() => {
                pauseDismiss(toast.id);
                setToasts((prev) => prev.filter((t) => t.id !== toast.id));
              }}
              aria-label="Tutup notifikasi"
              className="opacity-60 hover:opacity-100 transition-opacity p-0.5 rounded-full cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// Global helper to show toast from non-react code
export function showToast(message: string, type: Toast['type'] = 'info') {
  window.dispatchEvent(
    new CustomEvent('app-toast', {
      detail: { message, type },
    })
  );
}
