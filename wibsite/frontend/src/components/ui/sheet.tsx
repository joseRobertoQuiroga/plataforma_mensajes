"use client";

import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Sheet({
  open,
  onClose,
  children,
  side = "right",
  className,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  side?: "right" | "left";
  className?: string;
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
    <div className="fixed inset-0 z-[90]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
      <div
        className={cn(
          "absolute top-0 bottom-0 w-[480px] max-w-[95vw] glass-panel border-white/10 flex flex-col shadow-2xl animate-in slide-in-from-right-6 duration-300",
          side === "right" ? "right-0 border-l" : "left-0 border-r",
          className
        )}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  );
}