"use client";

import { useId } from "react";
import { brl } from "@/lib/format";
import { useTheme } from "@/components/theme";

/** Cores dos gráficos por tema (hex fixo: Recharts desenha em SVG). */
export function useChartTheme() {
  const dark = useTheme().theme === "dark";
  return {
    dark,
    grid: dark ? "#1E2A44" : "#E2E8F0",
    axis: dark ? "#8C98B0" : "#64748B",
    primary: dark ? "#3FBF8A" : "#286347", // faturamento
    accent: dark ? "#6C9BFF" : "#3B6FD4", // lucro
    warn: dark ? "#E2A24C" : "#C8812B", // despesas
    muted: dark ? "#5C6B88" : "#94A3B8", // período anterior
    cursor: dark ? "rgba(148,163,184,0.08)" : "rgba(15,23,42,0.04)",
  };
}

type Entry = { name?: string | number; value?: number | string; color?: string; dataKey?: string | number };

/** Tooltip customizado, legível nos dois temas. */
export function ChartTooltip({
  active,
  payload,
  label,
  format = (v: number) => brl(v),
}: {
  active?: boolean;
  payload?: Entry[];
  label?: string | number;
  format?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[10rem] rounded-xl border border-stone-200 bg-card px-3 py-2.5 text-xs shadow-pop">
      {label !== undefined && <div className="mb-1.5 font-semibold text-stone-900">{label}</div>}
      <div className="space-y-1">
        {payload.map((p, i) => (
          <div key={`${p.dataKey}-${i}`} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-stone-500">
              <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="font-medium tabular-nums text-stone-900">{format(Number(p.value ?? 0))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Legenda simples (pontos coloridos) para usar fora do <Legend/> do Recharts. */
export function ChartLegend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-4 rounded-full"
            style={i.dashed ? { background: `repeating-linear-gradient(90deg, ${i.color} 0 4px, transparent 4px 7px)` } : { background: i.color, height: 3 }}
          />
          {i.label}
        </span>
      ))}
    </div>
  );
}

export const moneyTick = (v: number) => (Math.abs(v) >= 1000 ? `R$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1).replace(".", ",")}k` : `R$${v}`);

/** Sparkline em SVG puro (usa currentColor). Renderize só com dados reais suficientes. */
export function Sparkline({ data, className }: { data: number[]; className?: string }) {
  const id = useId().replace(/:/g, "");
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const W = 100;
  const H = 32;
  const pad = 3;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * W, H - pad - ((v - min) / span) * (H - pad * 2)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
  const area = `${line} L${W} ${H} L0 ${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
