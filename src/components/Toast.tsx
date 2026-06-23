import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from 'lucide-react';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const handleToastEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ message: string; type: Toast['type'] }>;
      if (!customEvent.detail || !customEvent.detail.message) return;
      
      const newToast: Toast = {
        id: Math.random().toString(36).substring(2, 9),
        message: customEvent.detail.message,
        type: customEvent.detail.type || 'info',
      };

      setToasts((prev) => [...prev, newToast]);

      // Auto-remove after 4 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
      }, 4000);
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
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-14 right-4 z-[9999] flex flex-col gap-2.5 max-w-sm w-full font-sans">
      {toasts.map((toast) => {
        let bgClass = '';
        if (toast.type === 'success') {
          bgClass = 'bg-emerald-50 dark:bg-emerald-950/90 border-emerald-500/30 text-emerald-800 dark:text-emerald-200';
        } else if (toast.type === 'error') {
          bgClass = 'bg-rose-50 dark:bg-rose-950/90 border-rose-500/30 text-rose-800 dark:text-rose-200';
        } else if (toast.type === 'warning') {
          bgClass = 'bg-amber-50 dark:bg-amber-950/90 border-amber-500/30 text-amber-800 dark:text-amber-200';
        } else {
          bgClass = 'bg-blue-50 dark:bg-blue-950/90 border-blue-500/30 text-blue-800 dark:text-blue-200';
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
            className={`flex items-start gap-3 p-3.5 rounded-xl border shadow-lg transition-all duration-300 transform translate-y-0 scale-100 ${bgClass}`}
          >
            <Icon className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="flex-1 text-xs font-semibold leading-relaxed">
              {toast.message}
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="opacity-60 hover:opacity-100 transition-opacity p-0.5 rounded-full"
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
