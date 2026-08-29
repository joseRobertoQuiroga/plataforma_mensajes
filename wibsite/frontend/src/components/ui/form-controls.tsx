"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

export function Select({
  value,
  onChange,
  options,
  placeholder,
  className,
  label,
}: {
  value?: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  label?: string;
}) {
  const id = useId();
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <label htmlFor={id} className="text-xs font-medium text-on-surface-variant">{label}</label>}
      <select
        id={id}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-surface-container-highest border border-outline-variant rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 appearance-none"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-surface-container text-white">
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Textarea({
  value,
  onChange,
  placeholder,
  rows = 4,
  className,
  label,
}: {
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  label?: string;
}) {
  const id = useId();
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <label htmlFor={id} className="text-xs font-medium text-on-surface-variant">{label}</label>}
      <textarea
        id={id}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full bg-surface-container-highest border border-outline-variant rounded-xl px-3 py-2.5 text-sm text-white placeholder-on-surface-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 resize-y min-h-[90px]"
      />
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  description?: string;
}) {
  return (
    <label className="flex items-center justify-between gap-4 cursor-pointer select-none">
      <div>
        {label && <p className="text-sm font-medium text-white">{label}</p>}
        {description && <p className="text-xs text-on-surface-variant mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative w-12 h-6 rounded-full transition-colors shrink-0",
          checked ? "bg-success" : "bg-surface-container-high border border-outline-variant"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200",
            checked ? "translate-x-6" : "translate-x-0"
          )}
        />
      </button>
    </label>
  );
}