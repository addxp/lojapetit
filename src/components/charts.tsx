"use client";

import { brl } from "@/lib/format";
import { useTheme } from "@/components/theme";

/** Cores dos gráficos por tema (hex fixo: Recharts desenha em SVG). */
export function useChartTheme() {
  const dark = useTheme().theme === "dark";
  return {
    dark,
    grid: dark ? "#374151" : "#E5E7EB",
    axis: dark ? "#9CA3AF" : "#6B7280",
    primary: dark ? "#4AA175" : "#286347",
    accent: dark ? "#E0B25A" : "#C8923A",
    muted: dark ? "#94A3B8" : "#94A3B8",
    cursor: dark ? "rgba(255,255,255,0.06)" : "rgba(17,24,39,0.05)",
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
