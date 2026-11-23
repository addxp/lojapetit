"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Banknote, Boxes, Clock, Receipt, Shirt, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { brl, errMsg, fillDays, num, rangeFor, shortDay, type Period } from "@/lib/format";
import { Empty, Loading, PageHeader, PeriodFilter, StatCard } from "@/components/ui";
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

const GREEN = "#356a4d";
const SAND = "#b8a98f";

export default function DashboardPage() {
  const toast = useToast();
  const [period, setPeriod] = useState<Period>({ preset: "today", from: "", to: "" });
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [days, setDays] = useState<DayRow[]>([]);
  const [products, setProducts] = useState<Prod[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [low, setLow] = useState<Low[]>([]);
  const [stock, setStock] = useState<StockSum | null>(null);

  const range = useMemo(() => rangeFor(period), [period]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const args = { p_from: range.from, p_to: range.to };
      const [s, d, p, c, st, lw] = await Promise.all([
        supabase.rpc("report_summary", args),
        supabase.rpc("report_by_day", args),
        supabase.rpc("report_products", args),
        supabase.rpc("report_breakdown", { ...args, p_group: "category" }),
        supabase.rpc("stock_summary"),
        supabase.rpc("low_stock_variants", { p_limit: 8 }),
      ]);
      if (!alive) return;
      const err = [s, d, p, c, st, lw].find((r) => r.error)?.error;
      if (err) toast.error(errMsg(err));
      setSummary(s.data);
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
  }, [range, toast]);

  const chartData = useMemo(() => {
    const filled = fillDays(days, range.fromDate, range.toDate, (day) => ({
      day,
      revenue: 0,
      cost: 0,
      profit: 0,
      pieces: 0,
      sales_count: 0,
    }));
    return filled.map((r) => ({ label: shortDay(r.day), Faturamento: Number(r.revenue), Lucro: Number(r.profit) }));
  }, [days, range]);

  const periodLabel = period.preset === "today" ? "do dia" : period.preset === "yesterday" ? "de ontem" : "no período";

  return (
    <>
      <PageHeader title="Dashboard" subtitle={range.label} />
      <PeriodFilter value={period} onChange={setPeriod} />

      {loading || !summary ? (
        <Loading />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard label={`Faturamento ${periodLabel}`} value={brl(summary.revenue)} icon={<Banknote size={16} />} tone="green" hint={`${num(summary.sales_count)} venda(s)`} />
            <StatCard label={`Lucro bruto ${periodLabel}`} value={brl(summary.profit)} icon={<TrendingUp size={16} />} tone="green" hint={`Custo ${brl(summary.cogs)}`} />
            <StatCard label="Peças vendidas" value={num(summary.pieces)} icon={<Shirt size={16} />} />
            <StatCard label="Peças em estoque" value={num(stock?.pieces)} icon={<Boxes size={16} />} hint={`${num(stock?.out_count)} esgotado(s)`} />
            <StatCard label="Despesas" value={brl(summary.expenses)} icon={<Receipt size={16} />} tone="amber" />
            <StatCard
              label="Vendas pendentes"
              value={num(summary.pending_count)}
              icon={<Clock size={16} />}
              tone={summary.pending_count > 0 ? "amber" : "default"}
              hint={`${brl(summary.pending_amount)} a receber`}
            />
          </div>

          <div className="card p-5">
            <h2 className="mb-4 text-sm font-semibold">Vendas por período</h2>
            {chartData.every((d) => d.Faturamento === 0) ? (
              <Empty>Nenhuma venda no período selecionado.</Empty>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ left: -10, right: 8, top: 4 }}>
                    <defs>
                      <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={GREEN} stopOpacity={0.25} />
                        <stop offset="100%" stopColor={GREEN} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#a8a29e" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: "#a8a29e" }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v}`} />
                    <Tooltip formatter={(v) => brl(Number(v))} />
                    <Area type="monotone" dataKey="Faturamento" stroke={GREEN} strokeWidth={2} fill="url(#gRev)" />
                    <Area type="monotone" dataKey="Lucro" stroke={SAND} strokeWidth={2} fill="none" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card p-5">
              <h2 className="mb-4 text-sm font-semibold">Produtos mais vendidos</h2>
              {products.length === 0 ? (
                <Empty>Sem vendas no período.</Empty>
              ) : (
                <ul className="divide-y divide-stone-100">
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
              <h2 className="mb-4 text-sm font-semibold">Categorias com maior faturamento</h2>
              {cats.length === 0 ? (
                <Empty>Sem vendas no período.</Empty>
              ) : (
                <div style={{ height: Math.max(180, cats.slice(0, 6).length * 44) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cats.slice(0, 6).map((c) => ({ ...c, revenue: Number(c.revenue) }))} layout="vertical" margin={{ left: 0, right: 16 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 12, fill: "#78716c" }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v) => brl(Number(v))} cursor={{ fill: "#f5f5f4" }} />
                      <Bar dataKey="revenue" name="Faturamento" fill={GREEN} radius={[0, 6, 6, 0]} barSize={18} />
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
              <Empty>Nenhum item com estoque baixo.</Empty>
            ) : (
              <ul className="grid gap-x-8 sm:grid-cols-2">
                {low.map((l) => (
                  <li key={l.variant_id} className="flex items-center justify-between border-b border-stone-100 py-2.5 text-sm">
                    <span className="min-w-0 truncate">
                      {l.product_name} <span className="text-stone-400">{l.size}{l.color ? ` · ${l.color}` : ""}</span>
                    </span>
                    <span className={l.stock === 0 ? "badge bg-red-50 text-red-700" : "badge bg-amber-50 text-amber-700"}>
                      {l.stock === 0 ? "Esgotado" : `${l.stock} un.`}
                    </span>
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
