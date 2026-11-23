"use client";

import { useEffect } from "react";
import { Loader2, X } from "lucide-react";
import { cx, PRESET_LABEL, type Period, type Preset } from "@/lib/format";

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "md" | "lg" | "xl";
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={cx(
          "relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl",
          size === "xl" ? "sm:max-w-5xl" : size === "lg" ? "sm:max-w-3xl" : "sm:max-w-lg"
        )}
      >
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="btn-ghost btn-sm" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-stone-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx("animate-spin text-brand-600", className)} size={20} />;
}

export function Loading() {
  return (
    <div className="flex justify-center py-16">
      <Spinner />
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-12 text-center text-sm text-stone-400">{children}</div>;
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  hint?: string;
  tone?: "default" | "green" | "amber" | "red";
}) {
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-stone-500">{label}</span>
        {icon && (
          <span
            className={cx(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              tone === "green" && "bg-brand-50 text-brand-600",
              tone === "amber" && "bg-amber-50 text-amber-600",
              tone === "red" && "bg-red-50 text-red-600",
              tone === "default" && "bg-stone-100 text-stone-500"
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <div className="mt-2 text-xl font-semibold tracking-tight text-stone-900 sm:text-2xl">{value}</div>
      {hint && <div className="mt-1 text-xs text-stone-400">{hint}</div>}
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-stone-100 p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cx(
            "whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition",
            value === t.id ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function PeriodFilter({
  value,
  onChange,
  presets = ["today", "yesterday", "7d", "30d", "custom"],
}: {
  value: Period;
  onChange: (p: Period) => void;
  presets?: Preset[];
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-stone-100 p-1">
        {presets.map((p) => (
          <button
            key={p}
            onClick={() => onChange({ ...value, preset: p })}
            className={cx(
              "whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition sm:text-sm",
              value.preset === p ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"
            )}
          >
            {PRESET_LABEL[p]}
          </button>
        ))}
      </div>
      {value.preset === "custom" && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            className="input !w-auto"
            value={value.from}
            onChange={(e) => onChange({ ...value, from: e.target.value, to: value.to || e.target.value })}
          />
          <span className="text-stone-400">até</span>
          <input
            type="date"
            className="input !w-auto"
            value={value.to}
            min={value.from}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}
