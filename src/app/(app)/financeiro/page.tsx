"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { brl, cx, dateBR, dateTimeBR, errMsg, PAYMENT_LABEL, rangeFor, type Period } from "@/lib/format";
import { Empty, Field, Loading, Modal, PageHeader, PeriodFilter, Spinner, StatCard, Tabs } from "@/components/ui";
import { useConfirm, useToast } from "@/components/providers";

const supabase = createClient();

type Tab = "resumo" | "despesas" | "receber" | "caixa";

export default function FinanceiroPage() {
  const [tab, setTab] = useState<Tab>("resumo");
  return (
    <>
      <PageHeader title="Financeiro" subtitle="Resultado, despesas, fiado e fechamento de caixa" />
      <Tabs
        tabs={[
          { id: "resumo", label: "Resumo" },
          { id: "despesas", label: "Despesas" },
          { id: "receber", label: "A receber (fiado)" },
          { id: "caixa", label: "Fechamento de caixa" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "resumo" && <Resumo />}
      {tab === "despesas" && <Despesas />}
      {tab === "receber" && <Receber />}
      {tab === "caixa" && <Caixa />}
    </>
  );
}

// ------------------------------------------------------------------ Resumo
function Resumo() {
  const toast = useToast();
  const [period, setPeriod] = useState<Period>({ preset: "month", from: "", to: "" });
  const [loading, setLoading] = useState(true);
  const [s, setS] = useState<{ revenue: number; cogs: number; profit: number; expenses: number; pending_amount: number } | null>(null);
  const [methods, setMethods] = useState<{ method: string; total: number }[]>([]);
  const range = useMemo(() => rangeFor(period), [period]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const a = { p_from: range.from, p_to: range.to };
      const [sum, pm] = await Promise.all([supabase.rpc("report_summary", a), supabase.rpc("payments_by_method", a)]);
      if (!alive) return;
      const err = sum.error ?? pm.error;
      if (err) toast.error(errMsg(err));
      setS(sum.data);
      setMethods((pm.data ?? []) as { method: string; total: number }[]);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [range, toast]);

  const entradas = methods.filter((m) => m.method !== "fiado").reduce((x, m) => x + Number(m.total), 0);
  const fiado = methods.find((m) => m.method === "fiado");

  return (
    <>
      <PeriodFilter value={period} onChange={setPeriod} presets={["today", "week", "month", "30d", "custom"]} />
      {loading || !s ? (
        <Loading />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard label="Receita líquida (vendas)" value={brl(s.revenue)} tone="green" hint="Após devoluções e cancelamentos" />
            <StatCard label="Custo das mercadorias" value={brl(s.cogs)} />
            <StatCard label="Lucro bruto" value={brl(s.profit)} tone="green" />
            <StatCard label="Despesas operacionais" value={brl(s.expenses)} tone="amber" />
            <StatCard label="Resultado operacional" value={brl(s.profit - s.expenses)} tone={s.profit - s.expenses >= 0 ? "green" : "red"} hint="Lucro bruto − despesas" />
          </div>

          <div className="card p-5">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">Entradas por forma de pagamento</h2>
              <span className="text-xs text-stone-400">Dinheiro efetivamente recebido no período</span>
            </div>
            {methods.length === 0 ? (
              <Empty>Nenhum pagamento no período.</Empty>
            ) : (
              <ul className="divide-y divide-stone-100">
                {methods
                  .filter((m) => m.method !== "fiado")
                  .map((m) => (
                    <li key={m.method} className="flex justify-between py-2.5 text-sm">
                      <span>{PAYMENT_LABEL[m.method] ?? m.method}</span>
                      <span className="font-medium">{brl(m.total)}</span>
                    </li>
                  ))}
                <li className="flex justify-between py-2.5 text-sm font-semibold">
                  <span>Total de entradas</span>
                  <span>{brl(entradas)}</span>
                </li>
                {fiado && Number(fiado.total) !== 0 && (
                  <li className="flex justify-between py-2.5 text-sm text-amber-700">
                    <span>Vendido no fiado (não é entrada)</span>
                    <span>{brl(fiado.total)}</span>
                  </li>
                )}
              </ul>
            )}
          </div>

          <p className="text-xs text-stone-400">
            Faturamento não é lucro: o lucro bruto considera o custo das peças vendidas, e o resultado operacional ainda desconta as despesas.
            A receita é reconhecida na data da venda (inclui fiado); as entradas refletem o que foi pago.
          </p>
        </div>
      )}
    </>
  );
}

// ------------------------------------------------------------------ Despesas
const EXP_CATS = ["Aluguel", "Energia", "Água", "Internet", "Salários", "Marketing", "Embalagens/Frete", "Impostos", "Manutenção", "Outros"];
type Expense = { id: string; description: string; category: string; amount: number; expense_date: string; payment_method: string };

function Despesas() {
  const toast = useToast();
  const confirm = useConfirm();
  const [period, setPeriod] = useState<Period>({ preset: "month", from: "", to: "" });
  const [rows, setRows] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Expense | "new" | null>(null);
  const range = useMemo(() => rangeFor(period), [period]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .gte("expense_date", range.fromDate.toLocaleDateString("sv-SE"))
      .lt("expense_date", range.toDate.toLocaleDateString("sv-SE"))
      .order("expense_date", { ascending: false })
      .limit(500);
    if (error) toast.error(errMsg(error));
    setRows((data ?? []) as Expense[]);
    setLoading(false);
  }, [range, toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(e: Expense) {
    const ok = await confirm({ title: "Excluir despesa", message: `Excluir "${e.description}" (${brl(e.amount)})? Esta ação não pode ser desfeita.`, confirmLabel: "Excluir", danger: true });
    if (!ok) return;
    const { error } = await supabase.from("expenses").delete().eq("id", e.id);
    if (error) return toast.error(errMsg(error));
    toast.success("Despesa excluída");
    load();
  }

  const total = rows.reduce((s, r) => s + Number(r.amount), 0);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <PeriodFilter value={period} onChange={setPeriod} presets={["today", "week", "month", "30d", "custom"]} />
        <button className="btn-primary" onClick={() => setEditing("new")}>
          <Plus size={16} /> Nova despesa
        </button>
      </div>
      <div className="card overflow-x-auto">
        {loading ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty>Nenhuma despesa no período.</Empty>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Data</th>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Pago via</th>
                <th className="text-right">Valor</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td>{dateBR(e.expense_date)}</td>
                  <td className="font-medium">{e.description}</td>
                  <td>
                    <span className="badge bg-stone-100 text-stone-600">{e.category}</span>
                  </td>
                  <td className="text-stone-500">{PAYMENT_LABEL[e.payment_method]}</td>
                  <td className="text-right font-semibold">{brl(e.amount)}</td>
                  <td className="whitespace-nowrap text-right">
                    <button className="btn-ghost btn-sm" onClick={() => setEditing(e)} aria-label="Editar">
                      <Pencil size={14} />
                    </button>
                    <button className="btn-ghost btn-sm" onClick={() => remove(e)} aria-label="Excluir">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={4} className="text-right font-medium text-stone-500">
                  Total
                </td>
                <td className="text-right font-semibold">{brl(total)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        )}
      </div>
      {editing && (
        <ExpenseForm
          expense={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </>
  );
}

function ExpenseForm({ expense, onClose, onSaved }: { expense: Expense | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [description, setDescription] = useState(expense?.description ?? "");
  const [category, setCategory] = useState(expense?.category ?? "Outros");
  const [amount, setAmount] = useState(String(expense?.amount ?? ""));
  const [date, setDate] = useState(expense?.expense_date ?? new Date().toLocaleDateString("sv-SE"));
  const [method, setMethod] = useState(expense?.payment_method ?? "dinheiro");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!description.trim()) return toast.error("Informe a descrição");
    if (!(Number(amount) > 0)) return toast.error("Informe um valor maior que zero");
    if (!date) return toast.error("Informe a data");
    setBusy(true);
    const payload = { description: description.trim(), category, amount: Number(amount), expense_date: date, payment_method: method };
    const { error } = expense ? await supabase.from("expenses").update(payload).eq("id", expense.id) : await supabase.from("expenses").insert(payload);
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success(expense ? "Despesa atualizada" : "Despesa registrada");
    onSaved();
  }

  return (
    <Modal
      open
      title={expense ? "Editar despesa" : "Nova despesa"}
      onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={save} disabled={busy}>
            {busy ? <Spinner className="!text-white" /> : "Salvar"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Descrição *">
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoria">
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {EXP_CATS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Valor (R$) *">
            <input type="number" min="0" step="0.01" inputMode="decimal" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Data">
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Pago com">
            <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
              {["dinheiro", "pix", "credito", "debito"].map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_LABEL[m]}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ A receber
type Pending = { id: string; created_at: string; total: number; amount_pending: number; customers: { name: string; phone: string | null } | null };
type RecPay = { id: string; method: string; amount: number; paid_at: string; sales: { customers: { name: string } | null } | null };

function Receber() {
  const toast = useToast();
  const [rows, setRows] = useState<Pending[]>([]);
  const [history, setHistory] = useState<RecPay[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<Pending | null>(null);

  const load = useCallback(async () => {
    const [p, h] = await Promise.all([
      supabase.from("sales").select("id,created_at,total,amount_pending,customers(name,phone)").eq("status", "pendente").order("created_at"),
      supabase
        .from("payments")
        .select("id,method,amount,paid_at,sales(customers(name))")
        .eq("kind", "recebimento_fiado")
        .order("paid_at", { ascending: false })
        .limit(30),
    ]);
    const err = p.error ?? h.error;
    if (err) toast.error(errMsg(err));
    setRows((p.data ?? []) as unknown as Pending[]);
    setHistory((h.data ?? []) as unknown as RecPay[]);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const total = rows.reduce((s, r) => s + Number(r.amount_pending), 0);

  return loading ? (
    <Loading />
  ) : (
    <div className="space-y-6">
      <StatCard label="Total a receber" value={brl(total)} tone={total > 0 ? "amber" : "default"} hint={`${rows.length} venda(s) pendente(s)`} />

      <div className="card overflow-x-auto">
        {rows.length === 0 ? (
          <Empty>Nenhuma venda pendente. 🎉</Empty>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Data da venda</th>
                <th>Cliente</th>
                <th className="text-right">Total da venda</th>
                <th className="text-right">Pendente</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{dateTimeBR(r.created_at)}</td>
                  <td className="font-medium">
                    {r.customers?.name ?? "—"}
                    {r.customers?.phone && <div className="text-xs font-normal text-stone-400">{r.customers.phone}</div>}
                  </td>
                  <td className="text-right text-stone-500">{brl(r.total)}</td>
                  <td className="text-right font-semibold text-amber-700">{brl(r.amount_pending)}</td>
                  <td className="text-right">
                    <button className="btn-primary btn-sm" onClick={() => setPaying(r)}>
                      Receber
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card overflow-x-auto">
        <div className="border-b border-stone-100 px-4 py-3 text-sm font-semibold">Histórico de recebimentos</div>
        {history.length === 0 ? (
          <Empty>Nenhum recebimento registrado.</Empty>
        ) : (
          <table className="tbl">
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td>{dateTimeBR(h.paid_at)}</td>
                  <td>{h.sales?.customers?.name ?? "—"}</td>
                  <td className="text-stone-500">{PAYMENT_LABEL[h.method]}</td>
                  <td className="text-right font-semibold text-brand-700">{brl(h.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {paying && (
        <ReceiveModal
          sale={paying}
          onClose={() => setPaying(null)}
          onSaved={() => {
            setPaying(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ReceiveModal({ sale, onClose, onSaved }: { sale: Pending; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [amount, setAmount] = useState(String(sale.amount_pending));
  const [method, setMethod] = useState("dinheiro");
  const [busy, setBusy] = useState(false);

  async function save() {
    const v = Number(amount);
    if (!(v > 0) || v > Number(sale.amount_pending)) return toast.error(`Informe um valor entre 0,01 e ${brl(sale.amount_pending)}`);
    setBusy(true);
    const { error } = await supabase.rpc("receive_fiado", { p_sale_id: sale.id, p_amount: v, p_method: method });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success("Recebimento registrado");
    onSaved();
  }

  return (
    <Modal
      open
      title="Receber fiado"
      onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={save} disabled={busy}>
            {busy ? <Spinner className="!text-white" /> : "Confirmar recebimento"}
          </button>
        </>
      }
    >
      <p className="mb-4 text-sm text-stone-600">
        {sale.customers?.name} · pendente <strong>{brl(sale.amount_pending)}</strong>
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor recebido">
          <input type="number" min="0" step="0.01" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Forma">
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
            {["dinheiro", "pix", "credito", "debito"].map((m) => (
              <option key={m} value={m}>
                {PAYMENT_LABEL[m]}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ Caixa
type Preview = { period_start: string; totals: Record<string, number>; cash_expenses: number; expected_cash: number };
type Closing = { id: string; period_start: string; period_end: string; expected_cash: number; counted_cash: number; difference: number; notes: string | null };

function Caixa() {
  const toast = useToast();
  const confirm = useConfirm();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [history, setHistory] = useState<Closing[]>([]);
  const [loading, setLoading] = useState(true);
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [p, h] = await Promise.all([
      supabase.rpc("cash_preview"),
      supabase.from("cash_registers").select("id,period_start,period_end,expected_cash,counted_cash,difference,notes").order("period_end", { ascending: false }).limit(30),
    ]);
    const err = p.error ?? h.error;
    if (err) toast.error(errMsg(err));
    setPreview(p.data);
    setHistory((h.data ?? []) as Closing[]);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function close() {
    const v = Number(counted);
    if (counted === "" || !(v >= 0)) return toast.error("Informe o valor contado em dinheiro");
    const ok = await confirm({
      title: "Fechar caixa",
      message: "O fechamento encerra o período atual: o próximo começará a partir de agora. Confirmar?",
      confirmLabel: "Fechar caixa",
    });
    if (!ok) return;
    setBusy(true);
    const { error } = await supabase.rpc("close_cash_register", { p_counted: v, p_notes: notes });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success("Caixa fechado");
    setCounted("");
    setNotes("");
    load();
  }

  if (loading || !preview) return <Loading />;
  const diff = counted === "" ? null : Number(counted) - preview.expected_cash;

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h2 className="mb-1 text-sm font-semibold">Período em aberto</h2>
        <p className="mb-4 text-xs text-stone-400">Desde {dateTimeBR(preview.period_start)}</p>
        <ul className="divide-y divide-stone-100 text-sm">
          {Object.entries(preview.totals)
            .filter(([m]) => m !== "fiado")
            .map(([m, v]) => (
              <li key={m} className="flex justify-between py-2">
                <span>{PAYMENT_LABEL[m] ?? m}</span>
                <span className="font-medium">{brl(v)}</span>
              </li>
            ))}
          {Object.keys(preview.totals).filter((m) => m !== "fiado").length === 0 && <li className="py-2 text-stone-400">Nenhuma movimentação.</li>}
          <li className="flex justify-between py-2 text-stone-500">
            <span>(−) Despesas pagas em dinheiro</span>
            <span>{brl(preview.cash_expenses)}</span>
          </li>
          <li className="flex justify-between py-2 font-semibold">
            <span>Dinheiro esperado no caixa</span>
            <span>{brl(preview.expected_cash)}</span>
          </li>
        </ul>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Field label="Dinheiro contado (R$)">
            <input type="number" min="0" step="0.01" className="input" value={counted} onChange={(e) => setCounted(e.target.value)} />
          </Field>
          <Field label="Observação">
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
        {diff !== null && (
          <p className={cx("mt-3 text-sm font-medium", Math.abs(diff) < 0.005 ? "text-brand-600" : diff > 0 ? "text-sky-600" : "text-red-600")}>
            {Math.abs(diff) < 0.005 ? "Caixa conferido, sem diferença." : diff > 0 ? `Sobra de ${brl(diff)}` : `Falta de ${brl(-diff)}`}
          </p>
        )}
        <button className="btn-primary mt-4" disabled={busy} onClick={close}>
          {busy ? <Spinner className="!text-white" /> : "Fechar caixa"}
        </button>
        <p className="mt-3 text-xs text-stone-400">O valor esperado não considera troco inicial; informe o contado já descontando o fundo de caixa, se houver.</p>
      </div>

      <div className="card overflow-x-auto">
        <div className="border-b border-stone-100 px-4 py-3 text-sm font-semibold">Fechamentos anteriores</div>
        {history.length === 0 ? (
          <Empty>Nenhum fechamento realizado.</Empty>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Período</th>
                <th className="text-right">Esperado</th>
                <th className="text-right">Contado</th>
                <th className="text-right">Diferença</th>
                <th>Obs.</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td className="whitespace-nowrap">
                    {dateTimeBR(h.period_start)} → {dateTimeBR(h.period_end)}
                  </td>
                  <td className="text-right">{brl(h.expected_cash)}</td>
                  <td className="text-right">{brl(h.counted_cash)}</td>
                  <td className={cx("text-right font-medium", Number(h.difference) < 0 ? "text-red-600" : Number(h.difference) > 0 ? "text-sky-600" : "text-brand-600")}>{brl(h.difference)}</td>
                  <td className="text-stone-500">{h.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
