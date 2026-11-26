"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FileSpreadsheet, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { brl, errMsg, fillDays, num, rangeFor, shortDay, sizeRank, dateBR, type Period } from "@/lib/format";
import { exportPdf, exportXlsx } from "@/lib/export";
import { Empty, Loading, PageHeader, PeriodFilter, StatCard, Tabs } from "@/components/ui";
import { useToast } from "@/components/providers";
import { ChartTooltip, moneyTick, useChartTheme } from "@/components/charts";

const supabase = createClient();

type Summary = { revenue: number; cogs: number; profit: number; pieces: number; sales_count: number };
type DayRow = { day: string; revenue: number; cost: number; profit: number; pieces: number; sales_count: number };
type Brk = { label: string; pieces: number; revenue: number; cost: number; profit: number };
type Prod = { product: string; pieces: number; revenue: number; cost: number; profit: number; sizes: string };
type Tab = "diario" | "tamanho" | "categoria" | "linha" | "produto";

const pct = (profit: number, revenue: number) => (revenue > 0 ? `${((profit / revenue) * 100).toFixed(0)}%` : "—");

export default function RelatoriosPage() {
  const toast = useToast();
  const [period, setPeriod] = useState<Period>({ preset: "month", from: "", to: "" });
  const [tab, setTab] = useState<Tab>("diario");
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [days, setDays] = useState<DayRow[]>([]);
  const [sizes, setSizes] = useState<Brk[]>([]);
  const [cats, setCats] = useState<Brk[]>([]);
  const [lines, setLines] = useState<Brk[]>([]);
  const [prods, setProds] = useState<Prod[]>([]);

  const range = useMemo(() => rangeFor(period), [period]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const a = { p_from: range.from, p_to: range.to };
      const res = await Promise.all([
        supabase.rpc("report_summary", a),
        supabase.rpc("report_by_day", a),
        supabase.rpc("report_breakdown", { ...a, p_group: "size" }),
        supabase.rpc("report_breakdown", { ...a, p_group: "category" }),
        supabase.rpc("report_breakdown", { ...a, p_group: "collection" }),
        supabase.rpc("report_products", a),
      ]);
      if (!alive) return;
      const err = res.find((r) => r.error)?.error;
      if (err) toast.error(errMsg(err));
      setSummary(res[0].data);
      setDays((res[1].data ?? []) as DayRow[]);
      setSizes(((res[2].data ?? []) as Brk[]).sort((x, y) => sizeRank(x.label) - sizeRank(y.label)));
      setCats((res[3].data ?? []) as Brk[]);
      setLines((res[4].data ?? []) as Brk[]);
      setProds((res[5].data ?? []) as Prod[]);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [range, toast]);

  const filledDays = useMemo(
    () =>
      fillDays(days, range.fromDate, range.toDate, (day) => ({ day, revenue: 0, cost: 0, profit: 0, pieces: 0, sales_count: 0 })).map((d) => ({
        ...d,
        revenue: Number(d.revenue),
        cost: Number(d.cost),
        profit: Number(d.profit),
        pieces: Number(d.pieces),
        sales_count: Number(d.sales_count),
      })),
    [days, range]
  );

  // ---- exportação (tabela atual) ----
  function dataset() {
    const sub = `Período: ${range.label}`;
    if (tab === "diario") {
      const rows = filledDays.filter((d) => d.sales_count > 0);
      return {
        name: "Relatório diário",
        sub,
        columns: ["Data", "Vendas", "Peças", "Faturamento", "Custo", "Lucro bruto", "Ticket médio"],
        pdf: rows.map((d) => [dateBR(d.day), d.sales_count, d.pieces, brl(d.revenue), brl(d.cost), brl(d.profit), brl(d.sales_count ? d.revenue / d.sales_count : 0)]),
        xlsx: rows.map((d) => ({
          Data: dateBR(d.day),
          Vendas: d.sales_count,
          Peças: d.pieces,
          Faturamento: d.revenue,
          Custo: d.cost,
          "Lucro bruto": d.profit,
          "Ticket médio": d.sales_count ? Number((d.revenue / d.sales_count).toFixed(2)) : 0,
        })),
      };
    }
    if (tab === "produto") {
      return {
        name: "Relatório por produto",
        sub,
        columns: ["Produto", "Qtd.", "Tamanhos", "Faturamento", "Custo", "Lucro bruto"],
        pdf: prods.map((p) => [p.product, p.pieces, p.sizes, brl(p.revenue), brl(p.cost), brl(p.profit)]),
        xlsx: prods.map((p) => ({ Produto: p.product, Quantidade: p.pieces, Tamanhos: p.sizes, Faturamento: Number(p.revenue), Custo: Number(p.cost), "Lucro bruto": Number(p.profit) })),
      };
    }
    const rows = tab === "tamanho" ? sizes : tab === "categoria" ? cats : lines;
    const title = tab === "tamanho" ? "Tamanho" : tab === "categoria" ? "Categoria" : "Linha";
    return {
      name: `Relatório por ${title.toLowerCase()}`,
      sub,
      columns: [title, "Peças", "Faturamento", "Custo", "Lucro bruto", "Margem"],
      pdf: rows.map((r) => [r.label, r.pieces, brl(r.revenue), brl(r.cost), brl(r.profit), pct(r.profit, r.revenue)]),
      xlsx: rows.map((r) => ({ [title]: r.label, Peças: r.pieces, Faturamento: Number(r.revenue), Custo: Number(r.cost), "Lucro bruto": Number(r.profit) })),
    };
  }

  async function doExport(kind: "pdf" | "xlsx") {
    const d = dataset();
    if (d.pdf.length === 0) return toast.error("Não há dados para exportar neste período");
    const file = `${d.name.toLowerCase().replace(/\s+/g, "-")}-${new Date().toLocaleDateString("sv-SE")}`;
    try {
      if (kind === "pdf") await exportPdf(file, d.name, d.sub, d.columns, d.pdf);
      else await exportXlsx(file, d.name, d.xlsx);
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  const ticket = summary && summary.sales_count > 0 ? summary.revenue / summary.sales_count : 0;

  return (
    <>
      <PageHeader
        title="Relatórios"
        subtitle={range.label}
        actions={
          <>
            <button className="btn-secondary" onClick={() => doExport("xlsx")}>
              <FileSpreadsheet size={16} /> Excel
            </button>
            <button className="btn-secondary" onClick={() => doExport("pdf")}>
              <FileText size={16} /> PDF
            </button>
          </>
        }
      />
      <PeriodFilter value={period} onChange={setPeriod} presets={["today", "yesterday", "week", "month", "30d", "custom"]} />

      {loading || !summary ? (
        <Loading />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Faturamento" value={brl(summary.revenue)} tone="green" />
            <StatCard label="Custo das peças vendidas" value={brl(summary.cogs)} />
            <StatCard label="Lucro bruto" value={brl(summary.profit)} tone="green" hint={`Margem ${pct(summary.profit, summary.revenue)}`} />
            <StatCard label="Peças vendidas" value={num(summary.pieces)} />
            <StatCard label="Nº de vendas" value={num(summary.sales_count)} />
            <StatCard label="Ticket médio" value={brl(ticket)} />
          </div>

          <Tabs
            tabs={[
              { id: "diario", label: "Diário" },
              { id: "tamanho", label: "Por tamanho" },
              { id: "categoria", label: "Por categoria" },
              { id: "linha", label: "Por linha" },
              { id: "produto", label: "Por produto" },
            ]}
            value={tab}
            onChange={setTab}
          />

          {tab === "diario" && (
            <>
              <ChartCard
                data={filledDays.map((d) => ({ label: shortDay(d.day), Faturamento: d.revenue, Lucro: d.profit }))}
                empty={filledDays.every((d) => d.revenue === 0)}
              />
              <TableCard>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th className="text-right">Vendas</th>
                    <th className="text-right">Peças</th>
                    <th className="text-right">Faturamento</th>
                    <th className="text-right">Custo</th>
                    <th className="text-right">Lucro bruto</th>
                    <th className="text-right">Ticket médio</th>
                  </tr>
                </thead>
                <tbody>
                  {filledDays
                    .filter((d) => d.sales_count > 0)
                    .reverse()
                    .map((d) => (
                      <tr key={d.day}>
                        <td>{dateBR(d.day)}</td>
                        <td className="text-right">{d.sales_count}</td>
                        <td className="text-right">{d.pieces}</td>
                        <td className="text-right">{brl(d.revenue)}</td>
                        <td className="text-right text-stone-500">{brl(d.cost)}</td>
                        <td className="text-right font-semibold text-brand-700">{brl(d.profit)}</td>
                        <td className="text-right">{brl(d.sales_count ? d.revenue / d.sales_count : 0)}</td>
                      </tr>
                    ))}
                </tbody>
              </TableCard>
            </>
          )}

          {(tab === "tamanho" || tab === "categoria" || tab === "linha") && (
            <BreakdownView
              rows={tab === "tamanho" ? sizes : tab === "categoria" ? cats : lines}
              title={tab === "tamanho" ? "Tamanho" : tab === "categoria" ? "Categoria" : "Linha"}
            />
          )}

          {tab === "produto" && (
            <TableCard>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th className="text-right">Qtd.</th>
                  <th>Tamanhos vendidos</th>
                  <th className="text-right">Faturamento</th>
                  <th className="text-right">Custo</th>
                  <th className="text-right">Lucro bruto</th>
                </tr>
              </thead>
              <tbody>
                {prods.map((p) => (
                  <tr key={p.product}>
                    <td className="font-medium">{p.product}</td>
                    <td className="text-right">{num(p.pieces)}</td>
                    <td className="text-stone-500">{p.sizes}</td>
                    <td className="text-right">{brl(p.revenue)}</td>
                    <td className="text-right text-stone-500">{brl(p.cost)}</td>
                    <td className="text-right font-semibold text-brand-700">{brl(p.profit)}</td>
                  </tr>
                ))}
                {prods.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <Empty>Sem vendas no período.</Empty>
                    </td>
                  </tr>
                )}
              </tbody>
            </TableCard>
          )}
        </>
      )}
    </>
  );
}

function TableCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="card mt-5 overflow-x-auto">
      <table className="tbl">{children}</table>
    </div>
  );
}

function ChartCard({ data, empty }: { data: { label: string; Faturamento: number; Lucro: number }[]; empty: boolean }) {
  const ct = useChartTheme();
  return (
    <div className="card p-5">
      {empty ? (
        <Empty>Nenhuma venda no período selecionado.</Empty>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ left: -10, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: ct.axis }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: ct.axis }} axisLine={false} tickLine={false} tickFormatter={moneyTick} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: ct.cursor }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: ct.axis }} />
              <Bar dataKey="Faturamento" fill={ct.primary} radius={[6, 6, 0, 0]} maxBarSize={48} />
              <Bar dataKey="Lucro" fill={ct.accent} radius={[6, 6, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function BreakdownView({ rows, title }: { rows: Brk[]; title: string }) {
  const data = rows.map((r) => ({ label: r.label, Faturamento: Number(r.revenue), Lucro: Number(r.profit) }));
  const totalPieces = rows.reduce((s, r) => s + Number(r.pieces), 0);
  return (
    <>
      <ChartCard data={data} empty={rows.length === 0} />
      <TableCard>
        <thead>
          <tr>
            <th>{title}</th>
            <th className="text-right">Peças</th>
            <th className="text-right">% das peças</th>
            <th className="text-right">Faturamento</th>
            <th className="text-right">Custo</th>
            <th className="text-right">Lucro bruto</th>
            <th className="text-right">Margem</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="font-medium">{r.label}</td>
              <td className="text-right">{num(r.pieces)}</td>
              <td className="text-right text-stone-500">{totalPieces ? `${((Number(r.pieces) / totalPieces) * 100).toFixed(0)}%` : "—"}</td>
              <td className="text-right">{brl(r.revenue)}</td>
              <td className="text-right text-stone-500">{brl(r.cost)}</td>
              <td className="text-right font-semibold text-brand-700">{brl(r.profit)}</td>
              <td className="text-right text-stone-500">{pct(Number(r.profit), Number(r.revenue))}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7}>
                <Empty>Sem vendas no período.</Empty>
              </td>
            </tr>
          )}
        </tbody>
      </TableCard>
    </>
  );
}
