"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Inbox, Loader2, Search, TrendingDown, TrendingUp, X } from "lucide-react";
import { cx, PRESET_LABEL, type Period, type Preset } from "@/lib/format";

/* ───────────────────────── Modal ───────────────────────── */
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
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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

  if (!open || !mounted) return null;

  // Portal no <body>: fica acima da barra de navegação mobile e de qualquer contexto de empilhamento.
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 animate-fade-in bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cx(
          "relative flex max-h-[92dvh] w-full animate-slide-up flex-col overflow-hidden rounded-t-3xl border border-stone-200 bg-card shadow-pop sm:max-h-[90dvh] sm:rounded-2xl",
          size === "xl" ? "sm:max-w-5xl" : size === "lg" ? "sm:max-w-3xl" : "sm:max-w-lg"
        )}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-stone-300 sm:hidden" aria-hidden />
        <div className="flex shrink-0 items-center justify-between border-b border-stone-200 px-5 py-3.5 sm:py-4">
          <h2 className="text-base font-semibold tracking-tight text-stone-900">{title}</h2>
          <button onClick={onClose} className="btn-icon -mr-2 h-9 w-9" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {footer && (
          <div className="flex shrink-0 gap-2 border-t border-stone-200 bg-card px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 max-sm:[&>*]:flex-1 sm:justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

/* ───────────────────────── Loading / Skeleton ───────────────────────── */
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx("animate-spin text-brand-600", className)} size={20} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton", className)} aria-hidden />;
}

/** Substitui o spinner por linhas de skeleton (mesma API de antes). */
export function Loading({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 px-4 py-6" role="status" aria-label="Carregando">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="hidden h-4 w-1/6 sm:block" />
        </div>
      ))}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="card space-y-3 p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-9 !rounded-xl" />
      </div>
      <Skeleton className="h-7 w-28" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="card p-5">
        <Skeleton className="mb-4 h-4 w-40" />
        <Skeleton className="h-64 w-full !rounded-xl" />
      </div>
    </div>
  );
}

export function Empty({
  children,
  icon,
  action,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
        {icon ?? <Inbox size={22} />}
      </div>
      <div className="max-w-xs text-sm text-stone-500">{children}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ───────────────────────── Cabeçalho / formulário ───────────────────────── */
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

/* ───────────────────────── Cards de indicador ───────────────────────── */
export function Trend({ value, invert, label = "vs. período anterior" }: { value: number | null | undefined; invert?: boolean; label?: string }) {
  if (value == null || !Number.isFinite(value)) return null;
  const up = value > 0;
  const flat = Math.abs(value) < 0.05;
  const good = flat ? null : invert ? !up : up;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span
        className={cx(
          "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-semibold tabular-nums",
          flat && "bg-stone-100 text-stone-500",
          good === true && "bg-brand-100 text-brand-700",
          good === false && "bg-red-50 text-red-700"
        )}
      >
        {!flat && <Icon size={12} />}
        {up && !flat ? "+" : ""}
        {value.toFixed(1).replace(".", ",")}%
      </span>
      <span className="text-stone-400">{label}</span>
    </span>
  );
}

export function StatCard({
  label,
  value,
  icon,
  hint,
  tone = "default",
  trend,
  invertTrend,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  hint?: string;
  tone?: "default" | "green" | "amber" | "red";
  /** variação percentual vs. período anterior */
  trend?: number | null;
  /** true quando "subir" é ruim (ex.: despesas) */
  invertTrend?: boolean;
}) {
  return (
    <div className={cx("card group p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-pop sm:p-5", tone === "green" && "bg-gradient-to-br from-brand-50 to-card")}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium leading-snug text-stone-500">{label}</span>
        {icon && (
          <span
            className={cx(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition group-hover:scale-105",
              tone === "green" && "bg-brand-100 text-brand-700",
              tone === "amber" && "bg-amber-50 text-amber-600",
              tone === "red" && "bg-red-50 text-red-600",
              tone === "default" && "bg-stone-100 text-stone-500"
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <div className="mt-3 text-xl font-semibold tracking-tight tabular-nums text-stone-900 sm:text-[1.65rem] sm:leading-8">{value}</div>
      <div className="mt-1.5 flex min-h-[1.25rem] flex-wrap items-center gap-x-2 gap-y-1">
        {trend !== undefined && <Trend value={trend} invert={invertTrend} label="" />}
        {hint && <span className="text-xs text-stone-400">{hint}</span>}
      </div>
    </div>
  );
}

/* ───────────────────────── Tabs / período ───────────────────────── */
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
    <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-stone-100 p-1" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cx(
            "whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition",
            value === t.id ? "bg-card text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800"
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
      <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-stone-100 p-1">
        {presets.map((p) => (
          <button
            key={p}
            onClick={() => onChange({ ...value, preset: p })}
            className={cx(
              "whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition sm:text-sm",
              value.preset === p ? "bg-card text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800"
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

/* ───────────────────────── Busca, ordenação, paginação ───────────────────────── */
export function SearchInput({
  value,
  onChange,
  placeholder = "Buscar...",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cx("relative", className)}>
      <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
      <input className="input !pl-10 !pr-9" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-stone-400 hover:text-stone-700"
          aria-label="Limpar busca"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

type SortDir = "asc" | "desc";
type Accessors<T> = Record<string, (row: T) => string | number | null | undefined>;

export function useSort<T>(items: T[], accessors: Accessors<T>, initial?: { key: string; dir?: SortDir }) {
  const [key, setKey] = useState<string | null>(initial?.key ?? null);
  const [dir, setDir] = useState<SortDir>(initial?.dir ?? "asc");

  const sorted = useMemo(() => {
    const get = key ? accessors[key] : undefined;
    if (!get) return items;
    const mult = dir === "asc" ? 1 : -1;
    return [...items].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      if (typeof x === "number" && typeof y === "number") return (x - y) * mult;
      return String(x).localeCompare(String(y), "pt-BR", { numeric: true, sensitivity: "base" }) * mult;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, key, dir]);

  const toggle = (k: string) => {
    if (key === k) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setKey(k);
      setDir("asc");
    }
  };
  const setSort = (k: string | null, d: SortDir = "asc") => {
    setKey(k);
    setDir(d);
  };
  return { sorted, sortKey: key, sortDir: dir, toggle, setSort };
}

/** <th> clicável com indicador de ordenação. */
export function SortTh({
  label,
  k,
  sort,
  className,
}: {
  label: string;
  k: string;
  sort: { sortKey: string | null; sortDir: SortDir; toggle: (k: string) => void };
  className?: string;
}) {
  const active = sort.sortKey === k;
  const Icon = !active ? ArrowUpDown : sort.sortDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={className} aria-sort={active ? (sort.sortDir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => sort.toggle(k)}
        className={cx(
          "inline-flex items-center gap-1 uppercase tracking-wider transition hover:text-stone-900",
          active && "text-stone-900",
          className?.includes("text-right") && "flex-row-reverse"
        )}
      >
        {label}
        <Icon size={12} className={cx(!active && "opacity-40")} />
      </button>
    </th>
  );
}

export function usePaged<T>(items: T[], pageSize = 10, resetKey?: unknown) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  useEffect(() => setPage(0), [resetKey, items.length, pageSize]);
  const safe = Math.min(page, pages - 1);
  const pageItems = useMemo(() => items.slice(safe * pageSize, safe * pageSize + pageSize), [items, safe, pageSize]);
  return { page: safe, setPage, pages, pageItems, total: items.length, pageSize };
}

export function Pagination({ paged }: { paged: { page: number; pages: number; total: number; pageSize: number; setPage: (n: number) => void } }) {
  const { page, pages, total, pageSize, setPage } = paged;
  if (total <= pageSize) return null;
  const from = page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  return (
    <div className="flex items-center justify-between gap-3 border-t border-stone-200 px-4 py-3 text-xs text-stone-500">
      <span className="tabular-nums">
        {from}–{to} de {total}
      </span>
      <div className="flex items-center gap-1">
        <button className="btn-icon h-8 w-8 disabled:opacity-40" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Página anterior">
          <ChevronLeft size={16} />
        </button>
        <span className="px-2 tabular-nums">
          {page + 1} / {pages}
        </span>
        <button className="btn-icon h-8 w-8 disabled:opacity-40" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="Próxima página">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

/* ───────────────────────── Estoque ───────────────────────── */
export function StockBadge({ stock, min }: { stock: number; min?: number }) {
  if (stock <= 0) return <span className="badge gap-1.5 bg-red-50 text-red-700"><span className="h-1.5 w-1.5 rounded-full bg-red-500" />Esgotado</span>;
  if (min != null && stock <= min)
    return <span className="badge gap-1.5 bg-amber-50 text-amber-700"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />{stock} un. · baixo</span>;
  return <span className="badge gap-1.5 bg-brand-100 text-brand-700"><span className="h-1.5 w-1.5 rounded-full bg-brand-600" />{stock} un.</span>;
}
