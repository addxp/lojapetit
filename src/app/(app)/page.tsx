"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Banknote, Boxes, Clock, Receipt, Shirt, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { brl, errMsg, fillDays, num, rangeFor, shortDay, type Period } from "@/lib/format";
import { DashboardSkeleton, Empty, PageHeader, PeriodFilter, StatCard, StockBadge } from "@/components/ui";
import { ChartLegend, ChartTooltip, moneyTick, useChartTheme } from "@/components/charts";
import { useToast } from "@/components/providers";

const supabase = createClient();

type Summary = {
  revenue: number;
  cogs: number;
  profit: number;
  pieces: number;
  sales_count: number;
  pending_count: number;
  pending_amount: number;
  expenses: number;
};
type DayRow = { day: string; revenue: number; cost: number; profit: number; pieces: number; sales_count: number };
type Prod = { product: string; pieces: number; revenue: number; profit: number };
type Cat = { label: string; pieces: number; revenue: number; profit: number };
type Low = { variant_id: string; product_name: string; size: string; color: string; stock: number; min_stock: number };
type StockSum = { pieces: number; cost_value: number; low_count: number; out_count: number };

const pct = (cur: number, prev: number | undefined | null) => (prev && prev > 0 ? ((cur - prev) / prev) * 100 : null);

/** Período imediatamente anterior, com a mesma duração. */
function previousRange(fromDate: Date, toDate: Date) {
  const n = Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / 86400000));
  const pf = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate() - n);
  return { fromDate: pf, toDate: fromDate, from: pf.toISOString(), to: fromDate.toISOString() };
}

export default function DashboardPage() {
  const toast = useToast();
  const ct = useChartTheme();
  const [period, setPeriod] = useState<Period>({ preset: "today", from: "", to: "" });
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [prevSummary, setPrevSummary] = useState<Summary | null>(null);
  const [prevDays, setPrevDays] = useState<DayRow[]>([]);
  const [days, setDays] = useState<DayRow[]>([]);
  const [products, setProducts] = useState<Prod[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [low, setLow] = useState<Low[]>([]);
  const [stock, setStock] = useState<StockSum | null>(null);

  const range = useMemo(() => rangeFor(period), [period]);
  const prev = useMemo(() => previousRange(range.fromDate, range.toDate), [range]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const args = { p_from: range.from, p_to: range.to };
      const pargs = { p_from: prev.from, p_to: prev.to };
      const [s, d, p, c, st, lw, ps, pd] = await Promise.all([
        supabase.rpc("report_summary", args),
        supabase.rpc("report_by_day", args),
        supabase.rpc("report_products", args),
        supabase.rpc("report_breakdown", { ...args, p_group: "category" }),
        supabase.rpc("stock_summary"),
        supabase.rpc("low_stock_variants", { p_limit: 8 }),
        supabase.rpc("report_summary", pargs),
        supabase.rpc("report_by_day", pargs),
      ]);
      if (!alive) return;
      const err = [s, d, p, c, st, lw, ps, pd].find((r) => r.error)?.error;
      if (err) toast.error(errMsg(err));
      setSummary(s.data);
      setPrevSummary(ps.data ?? null);
      setPrevDays((pd.data ?? []) as DayRow[]);
      setDays((d.data ?? []) as DayRow[]);
      setProducts((p.data ?? []) as Prod[]);
      setCats((c.data ?? []) as Cat[]);
      setStock(st.data);
      setLow((lw.data ?? []) as Low[]);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [range, prev, toast]);

  const chartData = useMemo(() => {
    const zero = (day: string): DayRow => ({ day, revenue: 0, cost: 0, profit: 0, pieces: 0, sales_count: 0 });
    const cur = fillDays(days, range.fromDate, range.toDate, zero);
    const old = fillDays(prevDays, prev.fromDate, prev.toDate, zero);
    return cur.map((r, i) => ({
      label: shortDay(r.day),
      Faturamento: Number(r.revenue),
      Lucro: Number(r.profit),
      "Fat. anterior": Number(old[i]?.revenue ?? 0),
      "Lucro anterior": Number(old[i]?.profit ?? 0),
    }));
  }, [days, prevDays, range, prev]);

  const hasPrev = chartData.some((d) => d["Fat. anterior"] > 0 || d["Lucro anterior"] > 0);
  // poucos pontos (ex.: "Hoje") → barras; linha/área ficariam vazias
  const sparse = chartData.length <= 2;

  const compare = useMemo(() => {
    if (!summary) return [];
    return [
      { name: "Faturamento", Atual: Number(summary.revenue), Anterior: Number(prevSummary?.revenue ?? 0) },
      { name: "Lucro", Atual: Number(summary.profit), Anterior: Number(prevSummary?.profit ?? 0) },
      { name: "Despesas", Atual: Number(summary.expenses), Anterior: Number(prevSummary?.expenses ?? 0) },
    ];
  }, [summary, prevSummary]);

  const periodLabel = period.preset === "today" ? "do dia" : period.preset === "yesterday" ? "de ontem" : "no período";

  const axisProps = {
    tick: { fontSize: 12, fill: ct.axis },
    axisLine: false,
    tickLine: false,
  } as const;

  return (
    <>
      <PageHeader title="Dashboard" subtitle={range.label} />
      <PeriodFilter value={period} onChange={setPeriod} />

      {loading || !summary ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard label={`Faturamento ${periodLabel}`} value={brl(summary.revenue)} icon={<Banknote size={17} />} tone="green" trend={pct(summary.revenue, prevSummary?.revenue)} hint={`${num(summary.sales_count)} venda(s)`} />
            <StatCard label={`Lucro bruto ${periodLabel}`} value={brl(summary.profit)} icon={<TrendingUp size={17} />} tone="green" trend={pct(summary.profit, prevSummary?.profit)} hint={`Custo ${brl(summary.cogs)}`} />
            <StatCard label="Peças vendidas" value={num(summary.pieces)} icon={<Shirt size={17} />} trend={pct(summary.pieces, prevSummary?.pieces)} />
            <StatCard label="Produtos em estoque" value={num(stock?.pieces)} icon={<Boxes size={17} />} hint={`${num(stock?.out_count)} esgotado(s) · ${num(stock?.low_count)} baixo(s)`} />
            <StatCard label="Despesas" value={brl(summary.expenses)} icon={<Receipt size={17} />} tone="amber" trend={pct(summary.expenses, prevSummary?.expenses)} invertTrend />
            <StatCard
              label="Vendas pendentes"
              value={num(summary.pending_count)}
              icon={<Clock size={17} />}
              tone={summary.pending_count > 0 ? "amber" : "default"}
              hint={`${brl(summary.pending_amount)} a receber`}
            />
          </div>

          <div className="card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-stone-900">Vendas por período</h2>
              <ChartLegend
                items={[
                  { label: "Faturamento", color: ct.primary },
                  { label: "Lucro", color: ct.accent },
                  ...(hasPrev ? [{ label: "Período anterior", color: ct.muted, dashed: true }] : []),
                ]}
              />
            </div>
            {chartData.every((d) => d.Faturamento === 0) ? (
              <Empty icon={<TrendingUp size={22} />}>Nenhuma venda no período selecionado.</Empty>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  {sparse ? (
                    <BarChart data={chartData} margin={{ left: -6, right: 8, top: 8 }} barGap={6}>
                      <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
                      <XAxis dataKey="label" {...axisProps} />
                      <YAxis {...axisProps} tickFormatter={moneyTick} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: ct.cursor }} />
                      <Bar dataKey="Faturamento" fill={ct.primary} radius={[6, 6, 0, 0]} maxBarSize={56} />
                      <Bar dataKey="Lucro" fill={ct.accent} radius={[6, 6, 0, 0]} maxBarSize={56} />
                      {hasPrev && <Bar dataKey="Fat. anterior" name="Fat. período anterior" fill={ct.muted} fillOpacity={0.45} radius={[6, 6, 0, 0]} maxBarSize={56} />}
                    </BarChart>
                  ) : (
                    <AreaChart data={chartData} margin={{ left: -6, right: 8, top: 8 }}>
                      <defs>
                        <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={ct.primary} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={ct.primary} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
                      <XAxis dataKey="label" {...axisProps} minTickGap={24} />
                      <YAxis {...axisProps} tickFormatter={moneyTick} />
                      <Tooltip content={<ChartTooltip />} cursor={{ stroke: ct.grid }} />
                      {hasPrev && (
                        <Area type="monotone" dataKey="Fat. anterior" name="Fat. período anterior" stroke={ct.muted} strokeWidth={1.75} strokeDasharray="5 4" fill="none" dot={false} activeDot={false} />
                      )}
                      <Area type="monotone" dataKey="Faturamento" stroke={ct.primary} strokeWidth={2.25} fill="url(#gRev)" dot={chartData.length <= 14 ? { r: 3, strokeWidth: 0, fill: ct.primary } : false} activeDot={{ r: 5 }} />
                      <Area type="monotone" dataKey="Lucro" stroke={ct.accent} strokeWidth={2} fill="none" dot={chartData.length <= 14 ? { r: 3, strokeWidth: 0, fill: ct.accent } : false} activeDot={{ r: 5 }} />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-stone-900">Lucro por dia</h2>
                {hasPrev && <ChartLegend items={[{ label: "Lucro", color: ct.primary }, { label: "Período anterior", color: ct.muted, dashed: true }]} />}
              </div>
              {chartData.every((d) => d.Lucro === 0 && d["Lucro anterior"] === 0) ? (
                <Empty>Sem lucro registrado no período.</Empty>
              ) : (
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ left: -6, right: 8, top: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
                      <XAxis dataKey="label" {...axisProps} minTickGap={24} />
                      <YAxis {...axisProps} tickFormatter={moneyTick} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: ct.cursor }} />
                      <Bar dataKey="Lucro" fill={ct.primary} radius={[6, 6, 0, 0]} maxBarSize={36} />
                      {hasPrev && <Line type="monotone" dataKey="Lucro anterior" name="Lucro período anterior" stroke={ct.muted} strokeWidth={1.75} strokeDasharray="5 4" dot={false} />}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="card p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-stone-900">Comparação entre períodos</h2>
                <ChartLegend items={[{ label: "Atual", color: ct.primary }, { label: "Anterior", color: ct.muted }]} />
              </div>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={compare} margin={{ left: -6, right: 8, top: 8 }} barGap={6}>
                    <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
                    <XAxis dataKey="name" {...axisProps} />
                    <YAxis {...axisProps} tickFormatter={moneyTick} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: ct.cursor }} />
                    <Bar dataKey="Atual" fill={ct.primary} radius={[6, 6, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="Anterior" fill={ct.muted} fillOpacity={0.5} radius={[6, 6, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card p-5">
              <h2 className="mb-4 text-sm font-semibold text-stone-900">Produtos mais vendidos</h2>
              {products.length === 0 ? (
                <Empty>Sem vendas no período.</Empty>
              ) : (
                <ul className="divide-y divide-stone-200/70">
                  {products.slice(0, 6).map((p, i) => (
                    <li key={p.product} className="flex items-center gap-3 py-2.5 text-sm">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-stone-100 text-xs font-medium text-stone-500">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate">{p.product}</span>
                      <span className="text-stone-400">{num(p.pieces)} un.</span>
                      <span className="w-24 text-right font-medium">{brl(p.revenue)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card p-5">
              <h2 className="mb-4 text-sm font-semibold text-stone-900">Categorias com maior faturamento</h2>
              {cats.length === 0 ? (
                <Empty>Sem vendas no período.</Empty>
              ) : (
                <div style={{ height: Math.max(180, cats.slice(0, 6).length * 44) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cats.slice(0, 6).map((c) => ({ ...c, revenue: Number(c.revenue) }))} layout="vertical" margin={{ left: 0, right: 16 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 12, fill: ct.axis }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: ct.cursor }} />
                      <Bar dataKey="revenue" name="Faturamento" fill={ct.primary} radius={[0, 6, 6, 0]} barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle size={16} className="text-amber-500" /> Alertas de estoque
              </h2>
              <Link href="/estoque" className="text-xs font-medium text-brand-600 hover:underline">
                Ver estoque
              </Link>
            </div>
            {low.length === 0 ? (
              <Empty icon={<Boxes size={22} />}>Nenhum item com estoque baixo.</Empty>
            ) : (
              <ul className="grid gap-x-8 sm:grid-cols-2">
                {low.map((l) => (
                  <li key={l.variant_id} className="flex items-center justify-between border-b border-stone-200/70 py-2.5 text-sm">
                    <span className="min-w-0 truncate">
                      {l.product_name} <span className="text-stone-400">{l.size}{l.color ? ` · ${l.color}` : ""}</span>
                    </span>
                    <StockBadge stock={l.stock} min={l.min_stock} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
