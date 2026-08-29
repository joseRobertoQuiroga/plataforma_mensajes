"use client";

import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Dialog({
  open,
  onClose,
  children,
  className,
  title,
  description,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
      <div
        className={cn(
          "relative glass-panel rounded-2xl border border-white/10 w-full max-w-lg max-h-[88vh] flex flex-col shadow-2xl animate-in zoom-in-95 fade-in duration-200",
          className
        )}
        role="dialog"
        aria-modal="true"
      >
        {(title || description) && (
          <div className="p-6 pb-0">
            {title && <h3 className="text-lg font-bold text-white">{title}</h3>}
            {description && <p className="text-sm text-on-surface-variant mt-1">{description}</p>}
          </div>
        )}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg text-on-surface-variant hover:text-white hover:bg-white/5 transition-colors z-10"
          aria-label="Cerrar diálogo"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeWidth={2} />
          </svg>
        </button>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}