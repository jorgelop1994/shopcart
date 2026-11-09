import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextValue {
  showToast: (
    toastOrTitle: Omit<ToastItem, 'id'> | string,
    type?: ToastType,
    message?: string
  ) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback(
    (
      toastOrTitle: Omit<ToastItem, 'id'> | string,
      type: ToastType = 'info',
      message?: string
    ) => {
      const id = crypto.randomUUID();
      const normalized: ToastItem =
        typeof toastOrTitle === 'string'
          ? { id, title: toastOrTitle, type, message }
          : { ...toastOrTitle, id };
      setToasts((prev) => [...prev, normalized]);
      window.setTimeout(() => {
        dismissToast(id);
      }, 4800);
    },
    [dismissToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-md w-full pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((t) => {
          const styles =
            t.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
              : t.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-950'
                : t.type === 'warning'
                  ? 'border-amber-200 bg-amber-50 text-amber-950'
                  : 'border-indigo-200 bg-indigo-50 text-indigo-950';

          const Icon =
            t.type === 'success'
              ? CheckCircle2
              : t.type === 'error' || t.type === 'warning'
                ? AlertCircle
                : Info;
          const iconColor =
            t.type === 'success'
              ? 'text-emerald-600'
              : t.type === 'error'
                ? 'text-red-600'
                : t.type === 'warning'
                  ? 'text-amber-600'
                  : 'text-indigo-600';

          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-lg transition-all ${styles}`}
            >
              <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${iconColor}`} />
              <div className="flex-1 text-sm">
                <p className="font-semibold">{t.title}</p>
                {t.message && <p className="mt-0.5 text-xs opacity-90">{t.message}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                aria-label="Cerrar notificación"
                className="rounded-lg p-1 opacity-70 hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast debe utilizarse dentro de un ToastProvider');
  }
  return ctx;
}
