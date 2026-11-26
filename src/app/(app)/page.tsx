"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, Banknote, Boxes, Clock, PackageX, Receipt, Shirt, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { brl, cx, errMsg, fillDays, isoDate, num, rangeFor, shortDay, type Period } from "@/lib/format";
import { QUICK_ACTIONS } from "@/lib/nav";
import { DashboardSkeleton, Empty, PageHeader, PeriodFilter, SectionCard, Segmented, StatCard, Trend } from "@/components/ui";
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
type ExpRow = { expense_date: string; amount: number };
type Metric = "rev" | "profit" | "exp";

const pct = (cur: number, prev: number | undefined | null) => (prev && prev > 0 ? ((cur - prev) / prev) * 100 : null);
const dstr = (d: Date) => d.toLocaleDateString("sv-SE");

/** Período imediatamente anterior, com a mesma duração. */
function previousRange(fromDate: Date, toDate: Date) {
  const n = Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / 86400000));
  const pf = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate() - n);
  return { fromDate: pf, toDate: fromDate, from: pf.toISOString(), to: fromDate.toISOString() };
}

function sumByDay(rows: ExpRow[]) {
  const m = new Map<string, number>();
  rows.forEach((r) => m.set(r.expense_date, (m.get(r.expense_date) ?? 0) + Number(r.amount)));
  return m;
}

export default function DashboardPage() {
  const toast = useToast();
  const ct = useChartTheme();
  const [period, setPeriod] = useState<Period>({ preset: "today", from: "", to: "" });
  const [metric, setMetric] = useState<Metric>("rev");
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [prevSummary, setPrevSummary] = useState<Summary | null>(null);
  const [prevDays, setPrevDays] = useState<DayRow[]>([]);
  const [days, setDays] = useState<DayRow[]>([]);
  const [exp, setExp] = useState<ExpRow[]>([]);
  const [prevExp, setPrevExp] = useState<ExpRow[]>([]);
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
      const expQ = (a: Date, b: Date) =>
        supabase.from("expenses").select("expense_date,amount").gte("expense_date", dstr(a)).lt("expense_date", dstr(b)).limit(2000);
      const [s, d, p, c, st, lw, ps, pd, ex, pex] = await Promise.all([
        supabase.rpc("report_summary", args),
        supabase.rpc("report_by_day", args),
        supabase.rpc("report_products", args),
        supabase.rpc("report_breakdown", { ...args, p_group: "category" }),
        supabase.rpc("stock_summary"),
        supabase.rpc("low_stock_variants", { p_limit: 40 }),
        supabase.rpc("report_summary", pargs),
        supabase.rpc("report_by_day", pargs),
        expQ(range.fromDate, range.toDate),
        expQ(prev.fromDate, prev.toDate),
      ]);
      if (!alive) return;
      const err = [s, d, p, c, st, lw, ps, pd, ex, pex].find((r) => r.error)?.error;
      if (err) toast.error(errMsg(err));
      setSummary(s.data);
      setPrevSummary(ps.data ?? null);
      setPrevDays((pd.data ?? []) as DayRow[]);
      setDays((d.data ?? []) as DayRow[]);
      setExp((ex.data ?? []) as ExpRow[]);
      setPrevExp((pex.data ?? []) as ExpRow[]);
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

  // séries diárias (período atual × anterior, alinhadas por posição)
  const chartData = useMemo(() => {
    const zero = (day: string): DayRow => ({ day, revenue: 0, cost: 0, profit: 0, pieces: 0, sales_count: 0 });
    const cur = fillDays(days, range.fromDate, range.toDate, zero);
    const old = fillDays(prevDays, prev.fromDate, prev.toDate, zero);
    const curExp = sumByDay(exp);
    const oldExp = sumByDay(prevExp);
    const oldKeys = old.map((o) => o.day);
    return cur.map((r, i) => ({
      label: shortDay(r.day),
      rev: Number(r.revenue),
      profit: Number(r.profit),
      pieces: Number(r.pieces),
      exp: curExp.get(r.day) ?? curExp.get(isoDate(new Date(r.day + "T00:00:00"))) ?? 0,
      prevRev: Number(old[i]?.revenue ?? 0),
      prevProfit: Number(old[i]?.profit ?? 0),
      prevExp: oldKeys[i] ? oldExp.get(oldKeys[i]) ?? 0 : 0,
    }));
  }, [days, prevDays, exp, prevExp, range, prev]);

  const spark = useMemo(
    () => ({
      rev: chartData.map((d) => d.rev),
      profit: chartData.map((d) => d.profit),
      pieces: chartData.map((d) => d.pieces),
      exp: chartData.map((d) => d.exp),
    }),
    [chartData]
  );

  const periodLabel = period.preset === "today" ? "de hoje" : period.preset === "yesterday" ? "de ontem" : "do período";
  const axisProps = { tick: { fontSize: 12, fill: ct.axis }, axisLine: false, tickLine: false } as const;

  const metrics: Record<Metric, { label: string; cur: keyof (typeof chartData)[number]; old: keyof (typeof chartData)[number]; color: string; total: number; prevTotal: number | undefined; invert?: boolean }> = {
    rev: { label: "Faturamento", cur: "rev", old: "prevRev", color: ct.primary, total: Number(summary?.revenue ?? 0), prevTotal: prevSummary?.revenue },
    profit: { label: "Lucro", cur: "profit", old: "prevProfit", color: ct.accent, total: Number(summary?.profit ?? 0), prevTotal: prevSummary?.profit },
    exp: { label: "Despesas", cur: "exp", old: "prevExp", color: ct.warn, total: Number(summary?.expenses ?? 0), prevTotal: prevSummary?.expenses, invert: true },
  };
  const m = metrics[metric];
  const hasPrev = chartData.some((d) => Number(d[m.old]) > 0);
  const empty = chartData.every((d) => Number(d[m.cur]) === 0);
  const sparse = chartData.length <= 2;

  // alertas de estoque agrupados por produto (piores primeiro)
  const lowGroups = useMemo(() => {
    const map = new Map<string, Low[]>();
    low.forEach((l) => map.set(l.product_name, [...(map.get(l.product_name) ?? []), l]));
    return [...map.entries()]
      .map(([name, variants]) => ({ name, variants, out: variants.filter((v) => v.stock === 0).length, worst: Math.min(...variants.map((v) => v.stock)) }))
      .sort((a, b) => b.out - a.out || a.worst - b.worst);
  }, [low]);

  const maxRev = Math.max(1, ...products.map((p) => Number(p.revenue)));

  return (
    <>
      <PageHeader title="Dashboard" subtitle={range.label} />

      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {QUICK_ACTIONS.map(({ href, label, hint, icon: Icon }) => (
          <Link key={label} href={href} className="card group flex items-center gap-3 px-3.5 py-3 transition duration-150 hover:border-stone-300 hover:bg-stone-100/40 active:scale-[0.99]">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-stone-100 text-stone-500 transition group-hover:bg-brand-100 group-hover:text-brand-700">
              <Icon size={16} />
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[13px] font-medium text-stone-900">{label}</span>
              <span className="hidden truncate text-[11px] text-stone-500 sm:block">{hint}</span>
            </span>
            <ArrowRight size={14} className="hidden shrink-0 -translate-x-1 text-stone-300 opacity-0 transition group-hover:translate-x-0 group-hover:text-stone-500 group-hover:opacity-100 lg:block" />
          </Link>
        ))}
      </div>

      <PeriodFilter value={period} onChange={setPeriod} />

      {loading || !summary ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-4 sm:space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
            <StatCard label={`Faturamento ${periodLabel}`} value={brl(summary.revenue)} icon={<Banknote size={15} />} tone="green" trend={pct(summary.revenue, prevSummary?.revenue)} hint={`${num(summary.sales_count)} venda(s)`} spark={spark.rev} />
            <StatCard label={`Lucro bruto ${periodLabel}`} value={brl(summary.profit)} icon={<TrendingUp size={15} />} tone="green" trend={pct(summary.profit, prevSummary?.profit)} hint={`Custo ${brl(summary.cogs)}`} spark={spark.profit} />
            <StatCard label="Peças vendidas" value={num(summary.pieces)} icon={<Shirt size={15} />} trend={pct(summary.pieces, prevSummary?.pieces)} spark={spark.pieces} />
            <StatCard label="Produtos em estoque" value={num(stock?.pieces)} icon={<Boxes size={15} />} hint={`${num(stock?.out_count)} esgotado(s) · ${num(stock?.low_count)} baixo(s)`} />
            <StatCard label="Despesas" value={brl(summary.expenses)} icon={<Receipt size={15} />} tone="amber" trend={pct(summary.expenses, prevSummary?.expenses)} invertTrend spark={spark.exp} />
            <StatCard label="Vendas pendentes" value={num(summary.pending_count)} icon={<Clock size={15} />} tone={summary.pending_count > 0 ? "amber" : "default"} hint={`${brl(summary.pending_amount)} a receber`} />
          </div>

          <div className="grid gap-4 sm:gap-5 lg:grid-cols-3">
            <SectionCard
              className="lg:col-span-2"
              title="Desempenho"
              subtitle={range.label}
              actions={<Segmented label="Métrica" options={[{ id: "rev", label: "Faturamento" }, { id: "profit", label: "Lucro" }, { id: "exp", label: "Despesas" }]} value={metric} onChange={setMetric} />}
            >
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-2xl font-semibold tracking-tight tabular-nums text-stone-900">{brl(m.total)}</div>
                  <div className="mt-1">
                    <Trend value={pct(m.total, m.prevTotal)} invert={m.invert} label="vs. período anterior" />
                  </div>
                </div>
                <ChartLegend items={[{ label: m.label, color: m.color }, ...(hasPrev ? [{ label: "Período anterior", color: ct.muted, dashed: true }] : [])]} />
              </div>
              {empty ? (
                <Empty icon={<TrendingUp size={20} />}>{metric === "exp" ? "Nenhuma despesa no período selecionado." : "Nenhuma venda no período selecionado."}</Empty>
              ) : (
                <div className="h-64 sm:h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    {sparse ? (
                      <BarChart data={chartData} margin={{ left: -6, right: 8, top: 8 }} barGap={6}>
                        <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
                        <XAxis dataKey="label" {...axisProps} />
                        <YAxis {...axisProps} tickFormatter={moneyTick} />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: ct.cursor }} />
                        <Bar dataKey={m.cur as string} name={m.label} fill={m.color} radius={[6, 6, 0, 0]} maxBarSize={64} />
                        {hasPrev && <Bar dataKey={m.old as string} name="Período anterior" fill={ct.muted} fillOpacity={0.5} radius={[6, 6, 0, 0]} maxBarSize={64} />}
                      </BarChart>
                    ) : (
                      <AreaChart data={chartData} margin={{ left: -6, right: 8, top: 8 }}>
                        <defs>
                          <linearGradient id="gMain" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={m.color} stopOpacity={0.28} />
                            <stop offset="100%" stopColor={m.color} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
                        <XAxis dataKey="label" {...axisProps} minTickGap={24} />
                        <YAxis {...axisProps} tickFormatter={moneyTick} />
                        <Tooltip content={<ChartTooltip />} cursor={{ stroke: ct.grid }} />
                        {hasPrev && <Area type="monotone" dataKey={m.old as string} name="Período anterior" stroke={ct.muted} strokeWidth={1.5} strokeDasharray="5 4" fill="none" dot={false} activeDot={false} />}
                        <Area type="monotone" dataKey={m.cur as string} name={m.label} stroke={m.color} strokeWidth={2} fill="url(#gMain)" dot={chartData.length <= 14 ? { r: 3, strokeWidth: 0, fill: m.color } : false} activeDot={{ r: 5 }} />
                      </AreaChart>
                    )}
                  </ResponsiveContainer>
                </div>
              )}
            </SectionCard>

            <SectionCard title="Comparação" subtitle="Período atual × anterior">
              <ul className="divide-y divide-stone-200/70">
                {[
                  { label: "Faturamento", cur: summary.revenue, old: prevSummary?.revenue, fmt: brl },
                  { label: "Lucro bruto", cur: summary.profit, old: prevSummary?.profit, fmt: brl },
                  { label: "Despesas", cur: summary.expenses, old: prevSummary?.expenses, fmt: brl, invert: true },
                  { label: "Peças vendidas", cur: summary.pieces, old: prevSummary?.pieces, fmt: num },
                  { label: "Vendas", cur: summary.sales_count, old: prevSummary?.sales_count, fmt: num },
                ].map((r) => (
                  <li key={r.label} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] text-stone-500">{r.label}</span>
                      <Trend value={pct(Number(r.cur), r.old)} invert={r.invert} label="" />
                    </div>
                    <div className="mt-1 flex items-baseline justify-between gap-2">
                      <span className="text-base font-semibold tabular-nums text-stone-900">{r.fmt(r.cur)}</span>
                      <span className="text-xs tabular-nums text-stone-400">antes {r.fmt(r.old ?? 0)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>

          <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
            <SectionCard title="Produtos mais vendidos" subtitle="Por faturamento no período">
              {products.length === 0 ? (
                <Empty icon={<Shirt size={20} />}>Sem vendas no período.</Empty>
              ) : (
                <ul className="space-y-3.5">
                  {products.slice(0, 6).map((p, i) => (
                    <li key={p.product}>
                      <div className="flex items-center gap-3 text-sm">
                        <span className={cx("flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums", i === 0 ? "bg-brand-100 text-brand-700" : "bg-stone-100 text-stone-500")}>{i + 1}</span>
                        <span className="min-w-0 flex-1 truncate font-medium text-stone-900">{p.product}</span>
                        <span className="shrink-0 text-xs text-stone-400">{num(p.pieces)} un.</span>
                        <span className="w-24 shrink-0 text-right font-medium tabular-nums text-stone-900">{brl(p.revenue)}</span>
                      </div>
                      <div className="ml-9 mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100">
                        <div className="h-full rounded-full bg-brand-500/80 transition-[width] duration-500" style={{ width: `${Math.max(4, (Number(p.revenue) / maxRev) * 100)}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard title="Categorias com maior faturamento" subtitle="Período selecionado">
              {cats.length === 0 ? (
                <Empty>Sem vendas no período.</Empty>
              ) : (
                <div style={{ height: Math.max(190, cats.slice(0, 6).length * 44) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cats.slice(0, 6).map((c) => ({ ...c, revenue: Number(c.revenue) }))} layout="vertical" margin={{ left: 0, right: 16 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 12, fill: ct.axis }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: ct.cursor }} />
                      <Bar dataKey="revenue" name="Faturamento" fill={ct.primary} radius={[0, 6, 6, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </SectionCard>
          </div>

          <SectionCard
            title="Alertas de estoque"
            subtitle={lowGroups.length ? `${lowGroups.length} produto(s) precisam de atenção` : undefined}
            actions={
              <Link href="/estoque" className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
                Ver estoque <ArrowRight size={12} />
              </Link>
            }
          >
            {lowGroups.length === 0 ? (
              <Empty icon={<Boxes size={20} />}>Nenhum item com estoque baixo. Tudo certo por aqui.</Empty>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {lowGroups.slice(0, 6).map((g) => (
                  <div key={g.name} className="rounded-lg border border-stone-200 bg-stone-50/50 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-sm font-medium text-stone-900">{g.name}</span>
                      {g.out > 0 && (
                        <span className="badge shrink-0 gap-1 bg-red-50 text-red-700">
                          <PackageX size={11} /> {g.out} esgotado{g.out > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {g.variants.map((v) => (
                        <span key={v.variant_id} className={cx("badge gap-1 tabular-nums", v.stock === 0 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700")}>
                          {v.size}
                          {v.color ? ` ${v.color}` : ""} · {v.stock}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {lowGroups.length > 6 && (
              <div className="mt-3 text-center">
                <Link href="/estoque" className="text-xs font-medium text-stone-500 hover:text-stone-900">
                  + {lowGroups.length - 6} produto(s) com alerta
                </Link>
              </div>
            )}
          </SectionCard>
        </div>
      )}
    </>
  );
}
