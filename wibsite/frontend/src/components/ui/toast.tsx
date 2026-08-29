"use client";

import { createContext, useContext, useCallback, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: number;
  type: ToastType;
  title: string;
  description?: string;
}

const ToastContext = createContext<{
  toast: (type: ToastType, title: string, description?: string) => void;
  dismiss: (id: number) => void;
}>({ toast: () => {}, dismiss: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const ICONS: Record<ToastType, ReactNode> = {
  success: (
    <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  ),
};

const BAR: Record<ToastType, string> = {
  success: "bg-success",
  error: "bg-danger",
  info: "bg-primary",
  warning: "bg-warning",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (type: ToastType, title: string, description?: string) => {
      const id = Date.now() + Math.random();
      setToasts((ts) => [...ts.slice(-4), { id, type, title, description }]);
      setTimeout(() => dismiss(id), 5000);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 w-[360px] max-w-[calc(100vw-3rem)]">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "glass-panel rounded-xl overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300 shadow-2xl relative",
              "bg-surface-container-highest/95 border border-white/10"
            )}
          >
            <div className={cn("absolute left-0 top-0 bottom-0 w-1", BAR[t.type])} />
            <div className="flex items-start gap-3 p-4 pl-5">
              <div className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center border border-white/10 shrink-0">
                {ICONS[t.type]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white leading-tight">{t.title}</p>
                {t.description && <p className="text-xs text-on-surface-variant mt-0.5">{t.description}</p>}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="text-on-surface-variant hover:text-white transition-colors shrink-0"
                aria-label="Cerrar"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeWidth={2} />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}