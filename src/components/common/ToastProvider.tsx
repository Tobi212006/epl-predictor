import React, { createContext, useCallback, useContext, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  pushToast: (toast: Omit<ToastItem, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (toast: Omit<ToastItem, 'id'>) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setToasts((prev) => [...prev.slice(-2), { ...toast, id }]);
      setTimeout(() => {
        dismiss(id);
      }, 4200);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ pushToast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-16 lg:bottom-6 right-4 z-[120] flex flex-col gap-2.5 w-[min(360px,calc(100vw-32px))] pointer-events-none"
      >
        {toasts.map((t) => {
          const borderClass =
            t.variant === 'success'
              ? 'border-[#63E6A5]/45'
              : t.variant === 'error'
              ? 'border-[#F87171]/55'
              : 'border-[#7DD3FC]/45';
          const Icon =
            t.variant === 'success'
              ? CheckCircle2
              : t.variant === 'error'
              ? AlertCircle
              : Info;
          const iconColor =
            t.variant === 'success'
              ? 'text-[#63E6A5]'
              : t.variant === 'error'
              ? 'text-[#F87171]'
              : 'text-[#7DD3FC]';

          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto rounded-xl bg-[#1B2732]/95 backdrop-blur-xl border ${borderClass} px-4 py-3 shadow-[0_14px_40px_rgba(6,10,16,0.65)] flex items-start gap-3 text-xs text-[#F4F7F5]`}
            >
              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconColor}`} />
              <div className="flex-1 min-w-0">
                <div className="font-display font-semibold text-[#F4F7F5]">{t.title}</div>
                {t.description && (
                  <p className="mt-0.5 text-[#A5B2BD] leading-snug">{t.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="text-[#A5B2BD] hover:text-[#F4F7F5] p-0.5"
              >
                <X className="w-3.5 h-3.5" />
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
    return { pushToast: () => {} };
  }
  return ctx;
}
