"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Minus, Plus, Search, ShoppingCart, Trash2, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { brl, cx, dateTimeBR, errMsg, PAYMENT_LABEL, r2, rangeFor, type Period } from "@/lib/format";
import { Empty, Field, Loading, Modal, PageHeader, PeriodFilter, Spinner, Tabs, Pagination, SearchInput, SortTh, usePaged, useSort } from "@/components/ui";
import { useConfirm, useToast } from "@/components/providers";

const supabase = createClient();

export default function VendasPage() {
  const [tab, setTab] = useState<"nova" | "historico">("nova");
  return (
    <>
      <PageHeader title="Vendas" subtitle="Registre vendas e consulte o histórico" />
      <Tabs
        tabs={[
          { id: "nova", label: "Nova venda" },
          { id: "historico", label: "Vendas realizadas" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "nova" ? <NovaVenda /> : <Historico />}
    </>
  );
}

// ================================================================ PDV
type PVariant = { id: string; size: string; color: string; stock: number; active: boolean };
type PProduct = { id: string; name: string; sale_price: number; image_url: string | null; product_variants: PVariant[] };
type CartItem = { variantId: string; productName: string; size: string; color: string; qty: number; price: number; stock: number };
type Method = "dinheiro" | "pix" | "credito" | "debito" | "fiado" | "dividido";
type Split = { key: number; method: Exclude<Method, "dividido">; amount: string };

const METHODS: { id: Method; label: string }[] = [
  { id: "dinheiro", label: "Dinheiro" },
  { id: "pix", label: "Pix" },
  { id: "credito", label: "Crédito" },
  { id: "debito", label: "Débito" },
  { id: "fiado", label: "Fiado" },
  { id: "dividido", label: "Dividido" },
];
let splitSeq = 0;

function NovaVenda() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<PProduct[]>([]);
  const [searching, setSearching] = useState(true);
  const [selected, setSelected] = useState<PProduct | null>(null);
  const [qty, setQty] = useState(1);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountMode, setDiscountMode] = useState<"brl" | "pct">("brl");
  const [discountValue, setDiscountValue] = useState("");
  const [method, setMethod] = useState<Method>("dinheiro");
  const [splits, setSplits] = useState<Split[]>([
    { key: ++splitSeq, method: "dinheiro", amount: "" },
    { key: ++splitSeq, method: "pix", amount: "" },
  ]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [newCustomer, setNewCustomer] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadProducts = useCallback(async () => {
    let q = supabase
      .from("products")
      .select("id,name,sale_price,image_url,product_variants(id,size,color,stock,active)")
      .eq("active", true);
    if (search.trim()) q = q.ilike("name", `%${search.trim()}%`);
    const { data, error } = await q.order("name").limit(24);
    if (error) toast.error(errMsg(error));
    setProducts((data ?? []) as PProduct[]);
    setSearching(false);
  }, [search, toast]);

  useEffect(() => {
    const t = setTimeout(loadProducts, 250);
    return () => clearTimeout(t);
  }, [loadProducts]);

  const loadCustomers = useCallback(async () => {
    const { data } = await supabase.from("customers").select("id,name").order("name");
    setCustomers((data ?? []) as { id: string; name: string }[]);
  }, []);
  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const subtotal = useMemo(() => r2(cart.reduce((s, i) => s + i.qty * i.price, 0)), [cart]);
  const discount = useMemo(() => {
    const v = Number(discountValue || 0);
    if (!(v > 0)) return 0;
    const d = discountMode === "pct" ? (subtotal * Math.min(v, 100)) / 100 : v;
    return r2(Math.min(d, subtotal));
  }, [discountValue, discountMode, subtotal]);
  const total = r2(subtotal - discount);

  const splitSum = r2(splits.reduce((s, x) => s + Number(x.amount || 0), 0));
  const splitRemaining = r2(total - splitSum);

  function addToCart(p: PProduct, v: PVariant) {
    const inCart = cart.find((c) => c.variantId === v.id)?.qty ?? 0;
    if (inCart + qty > v.stock) {
      return toast.error(`Estoque insuficiente: restam ${v.stock - inCart} un. de ${v.size}${v.color ? " " + v.color : ""}`);
    }
    setCart((c) => {
      const exists = c.find((x) => x.variantId === v.id);
      if (exists) return c.map((x) => (x.variantId === v.id ? { ...x, qty: x.qty + qty } : x));
      return [...c, { variantId: v.id, productName: p.name, size: v.size, color: v.color, qty, price: p.sale_price, stock: v.stock }];
    });
    setQty(1);
  }

  function changeQty(id: string, delta: number) {
    setCart((c) =>
      c.flatMap((x) => {
        if (x.variantId !== id) return [x];
        const n = x.qty + delta;
        if (n <= 0) return [];
        if (n > x.stock) {
          toast.error("Quantidade acima do estoque disponível");
          return [x];
        }
        return [{ ...x, qty: n }];
      })
    );
  }

  const needsCustomer = method === "fiado" || (method === "dividido" && splits.some((s) => s.method === "fiado" && Number(s.amount) > 0));
  const paymentsValid =
    method === "dividido" ? Math.abs(splitRemaining) < 0.005 && splits.every((s) => Number(s.amount || 0) >= 0) : true;
  const canFinish = cart.length > 0 && total >= 0 && paymentsValid && (!needsCustomer || !!customerId) && !saving;

  async function finalize() {
    if (!canFinish) return;
    const payments =
      method === "dividido"
        ? splits.filter((s) => Number(s.amount) > 0).map((s) => ({ method: s.method, amount: Number(s.amount) }))
        : total > 0
        ? [{ method, amount: total }]
        : [];
    setSaving(true);
    const { error } = await supabase.rpc("finalize_sale", {
      p_customer_id: customerId || null,
      p_items: cart.map((i) => ({ variant_id: i.variantId, quantity: i.qty, unit_price: i.price })),
      p_discount: discount,
      p_payments: payments,
      p_notes: null,
    });
    setSaving(false);
    if (error) {
      toast.error(errMsg(error));
      loadProducts();
      return;
    }
    toast.success(`Venda de ${brl(total)} registrada com sucesso`);
    setCart([]);
    setDiscountValue("");
    setMethod("dinheiro");
    setCustomerId("");
    setSplits([
      { key: ++splitSeq, method: "dinheiro", amount: "" },
      { key: ++splitSeq, method: "pix", amount: "" },
    ]);
    setSelected(null);
    loadProducts();
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_24rem]">
      {/* ---- Catálogo ---- */}
      <div>
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3.5 top-3.5 text-stone-400" />
          <input className="input !pl-10" placeholder="Pesquisar produto..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {searching ? (
          <Loading />
        ) : products.length === 0 ? (
          <div className="card">
            <Empty>Nenhum produto ativo encontrado.</Empty>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {products.map((p) => {
              const stock = p.product_variants.filter((v) => v.active).reduce((s, v) => s + v.stock, 0);
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelected(p);
                    setQty(1);
                  }}
                  className={cx(
                    "card overflow-hidden text-left transition hover:border-brand-300",
                    selected?.id === p.id && "!border-brand-500 ring-4 ring-brand-100",
                    stock === 0 && "opacity-50"
                  )}
                >
                  <div className="aspect-[4/3] bg-stone-100">
                    {p.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image_url} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="p-3">
                    <div className="truncate text-sm font-medium">{p.name}</div>
                    <div className="mt-0.5 flex items-center justify-between text-xs">
                      <span className="font-semibold text-stone-900">{brl(p.sale_price)}</span>
                      <span className={stock === 0 ? "text-red-600" : "text-stone-400"}>{stock === 0 ? "Esgotado" : `${stock} un.`}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ---- Carrinho ---- */}
      <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        {selected && (
          <div className="card p-4">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <div className="text-sm font-semibold">{selected.name}</div>
                <div className="text-xs text-stone-500">{brl(selected.sale_price)} · escolha tamanho/cor</div>
              </div>
              <div className="flex items-center gap-1">
                <button className="btn-secondary btn-sm !px-2" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Diminuir">
                  <Minus size={13} />
                </button>
                <span className="w-7 text-center text-sm font-semibold">{qty}</span>
                <button className="btn-secondary btn-sm !px-2" onClick={() => setQty((q) => q + 1)} aria-label="Aumentar">
                  <Plus size={13} />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {selected.product_variants
                .filter((v) => v.active)
                .map((v) => (
                  <button
                    key={v.id}
                    disabled={v.stock === 0}
                    onClick={() => addToCart(selected, v)}
                    className="rounded-xl border border-stone-200 px-3 py-2 text-left text-sm transition hover:border-brand-500 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-stone-200 disabled:hover:bg-transparent"
                  >
                    <div className="font-medium">
                      {v.size}
                      {v.color ? ` · ${v.color}` : ""}
                    </div>
                    <div className={cx("text-xs", v.stock === 0 ? "text-red-600" : "text-stone-400")}>
                      {v.stock === 0 ? "Esgotado" : `${v.stock} em estoque`}
                    </div>
                  </button>
                ))}
            </div>
          </div>
        )}

        <div className="card p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <ShoppingCart size={16} /> Carrinho
          </div>

          {cart.length === 0 ? (
            <p className="py-6 text-center text-sm text-stone-400">Selecione um produto para começar.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {cart.map((i) => (
                <li key={i.variantId} className="flex items-center gap-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{i.productName}</div>
                    <div className="text-xs text-stone-500">
                      {i.size}
                      {i.color ? ` · ${i.color}` : ""} · {brl(i.price)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="btn-secondary btn-sm !px-2" onClick={() => changeQty(i.variantId, -1)} aria-label="Diminuir">
                      <Minus size={12} />
                    </button>
                    <span className="w-6 text-center text-sm">{i.qty}</span>
                    <button className="btn-secondary btn-sm !px-2" onClick={() => changeQty(i.variantId, 1)} aria-label="Aumentar">
                      <Plus size={12} />
                    </button>
                  </div>
                  <div className="w-20 text-right text-sm font-medium">{brl(i.qty * i.price)}</div>
                  <button className="text-stone-300 hover:text-red-600" onClick={() => setCart((c) => c.filter((x) => x.variantId !== i.variantId))} aria-label="Remover">
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {cart.length > 0 && (
            <>
              <div className="mt-3 space-y-3 border-t border-stone-100 pt-3">
                <div className="flex items-end gap-2">
                  <Field label="Desconto" className="flex-1">
                    <input type="number" min="0" step="0.01" className="input" placeholder="0" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} />
                  </Field>
                  <select className="input !w-20" value={discountMode} onChange={(e) => setDiscountMode(e.target.value as "brl" | "pct")}>
                    <option value="brl">R$</option>
                    <option value="pct">%</option>
                  </select>
                </div>

                <div>
                  <label className="label">Forma de pagamento</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {METHODS.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setMethod(m.id)}
                        className={cx(
                          "rounded-xl border px-2 py-2 text-xs font-medium transition",
                          method === m.id ? "border-brand-600 bg-brand-600 text-white" : "border-stone-200 text-stone-600 hover:bg-stone-50"
                        )}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {method === "dividido" && (
                  <div className="space-y-2">
                    {splits.map((s) => (
                      <div key={s.key} className="flex gap-2">
                        <select
                          className="input"
                          value={s.method}
                          onChange={(e) => setSplits((x) => x.map((y) => (y.key === s.key ? { ...y, method: e.target.value as Split["method"] } : y)))}
                        >
                          {METHODS.filter((m) => m.id !== "dividido").map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="input"
                          placeholder="Valor"
                          value={s.amount}
                          onChange={(e) => setSplits((x) => x.map((y) => (y.key === s.key ? { ...y, amount: e.target.value } : y)))}
                        />
                        {splits.length > 2 && (
                          <button className="text-stone-300 hover:text-red-600" onClick={() => setSplits((x) => x.filter((y) => y.key !== s.key))} aria-label="Remover">
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    ))}
                    <div className="flex items-center justify-between">
                      <button className="text-xs font-medium text-brand-600 hover:underline" onClick={() => setSplits((x) => [...x, { key: ++splitSeq, method: "dinheiro", amount: "" }])}>
                        + Adicionar forma
                      </button>
                      <span className={cx("text-xs", Math.abs(splitRemaining) < 0.005 ? "text-brand-600" : "text-amber-600")}>
                        {Math.abs(splitRemaining) < 0.005 ? "Valores conferem" : splitRemaining > 0 ? `Faltam ${brl(splitRemaining)}` : `Excede ${brl(-splitRemaining)}`}
                      </span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="label">Cliente {needsCustomer ? "*" : "(opcional)"}</label>
                  <div className="flex gap-2">
                    <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                      <option value="">Sem cliente</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <button className="btn-secondary !px-3" onClick={() => setNewCustomer(true)} aria-label="Novo cliente">
                      <UserPlus size={16} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-1 border-t border-stone-100 pt-3 text-sm">
                <div className="flex justify-between text-stone-500">
                  <span>Subtotal</span>
                  <span>{brl(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-stone-500">
                    <span>Desconto</span>
                    <span>− {brl(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span>{brl(total)}</span>
                </div>
              </div>

              <button className="btn-primary mt-4 w-full !py-3" disabled={!canFinish} onClick={finalize}>
                {saving ? <Spinner className="!text-white" /> : "Finalizar venda"}
              </button>
              {needsCustomer && !customerId && <p className="mt-2 text-center text-xs text-amber-600">Selecione um cliente para vender no fiado.</p>}
            </>
          )}
        </div>
      </div>

      {newCustomer && (
        <CustomerQuickAdd
          onClose={() => setNewCustomer(false)}
          onCreated={(id) => {
            setNewCustomer(false);
            loadCustomers().then(() => setCustomerId(id));
          }}
        />
      )}
    </div>
  );
}

function CustomerQuickAdd({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim()) return toast.error("Informe o nome do cliente");
    setBusy(true);
    const { data, error } = await supabase.from("customers").insert({ name: name.trim(), phone: phone.trim() || null }).select("id").single();
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success("Cliente cadastrado");
    onCreated(data.id);
  }

  return (
    <Modal
      open
      title="Novo cliente"
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
        <Field label="Nome *">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Telefone">
          <input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

// ================================================================ Histórico
type SaleRow = {
  id: string;
  created_at: string;
  total: number;
  status: "concluida" | "pendente" | "cancelada";
  amount_pending: number;
  refunded_total: number;
  customers: { name: string } | null;
  payments: { method: string; kind: string }[];
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  concluida: { label: "Concluída", cls: "bg-brand-50 text-brand-700" },
  pendente: { label: "Pendente", cls: "bg-amber-50 text-amber-700" },
  cancelada: { label: "Cancelada", cls: "bg-red-50 text-red-700" },
};

function Historico() {
  const toast = useToast();
  const [period, setPeriod] = useState<Period>({ preset: "today", from: "", to: "" });
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const range = useMemo(() => rangeFor(period), [period]);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("sales")
      .select("id,created_at,total,status,amount_pending,refunded_total,customers(name),payments(method,kind)")
      .gte("created_at", range.from)
      .lt("created_at", range.to);
    if (status) q = q.eq("status", status);
    const { data, error } = await q.order("created_at", { ascending: false }).limit(300);
    if (error) toast.error(errMsg(error));
    setRows((data ?? []) as unknown as SaleRow[]);
    setLoading(false);
  }, [range, status, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => !q || (r.customers?.name ?? "").toLowerCase().includes(q));
  }, [rows, search]);
  const sort = useSort(filtered, {
    date: (r) => r.created_at,
    customer: (r) => r.customers?.name,
    total: (r) => Number(r.total),
    status: (r) => r.status,
  }, { key: "date", dir: "desc" });
  const paged = usePaged(sort.sorted, 12, `${search}|${status}|${period.preset}|${sort.sortKey}|${sort.sortDir}`);

  return (
    <>
      <PeriodFilter value={period} onChange={setPeriod} presets={["today", "yesterday", "7d", "30d", "month", "custom"]} />
      <div className="mb-4 grid gap-2 sm:max-w-xl sm:grid-cols-2">
        <SearchInput placeholder="Buscar por cliente..." value={search} onChange={setSearch} />
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="concluida">Concluídas</option>
          <option value="pendente">Pendentes (fiado)</option>
          <option value="cancelada">Canceladas</option>
        </select>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <Loading />
        ) : filtered.length === 0 ? (
          <Empty>Nenhuma venda encontrada no período.</Empty>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <SortTh label="Data" k="date" sort={sort} />
                <SortTh label="Cliente" k="customer" sort={sort} />
                <th>Pagamento</th>
                <SortTh label="Total" k="total" sort={sort} className="text-right" />
                <SortTh label="Status" k="status" sort={sort} />
                <th />
              </tr>
            </thead>
            <tbody>
              {paged.pageItems.map((s) => {
                const methods = Array.from(new Set(s.payments.filter((p) => p.kind === "venda").map((p) => PAYMENT_LABEL[p.method] ?? p.method)));
                return (
                  <tr key={s.id}>
                    <td className="whitespace-nowrap">{dateTimeBR(s.created_at)}</td>
                    <td>{s.customers?.name ?? <span className="text-stone-400">—</span>}</td>
                    <td className="text-stone-500">{methods.join(" + ") || "—"}</td>
                    <td className="text-right font-semibold">
                      {brl(s.total)}
                      {s.refunded_total > 0 && <div className="text-xs font-normal text-sky-600">devolvido {brl(s.refunded_total)}</div>}
                    </td>
                    <td>
                      <span className={cx("badge", STATUS_BADGE[s.status].cls)}>{STATUS_BADGE[s.status].label}</span>
                      {s.status === "pendente" && <div className="text-xs text-amber-600">{brl(s.amount_pending)} a receber</div>}
                    </td>
                    <td className="text-right">
                      <button className="btn-secondary btn-sm" onClick={() => setOpenId(s.id)}>
                        Detalhes
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {!loading && <Pagination paged={paged} />}
      </div>

      {openId && (
        <SaleDetail
          id={openId}
          onClose={() => setOpenId(null)}
          onChanged={() => {
            load();
          }}
        />
      )}
    </>
  );
}

type SaleFull = {
  id: string;
  created_at: string;
  status: "concluida" | "pendente" | "cancelada";
  subtotal: number;
  discount: number;
  total: number;
  cost_total: number;
  profit: number;
  amount_pending: number;
  refunded_total: number;
  cancel_reason: string | null;
  customers: { name: string; phone: string | null } | null;
  sale_items: {
    id: string;
    product_name: string;
    size: string;
    color: string;
    quantity: number;
    returned_qty: number;
    unit_price: number;
    unit_cost: number;
    discount: number;
  }[];
  payments: { id: string; method: string; kind: string; amount: number; paid_at: string }[];
};

const KIND_LABEL: Record<string, string> = {
  venda: "Pagamento",
  recebimento_fiado: "Recebimento de fiado",
  devolucao: "Devolução",
  estorno: "Estorno (cancelamento)",
};

function SaleDetail({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [sale, setSale] = useState<SaleFull | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [returning, setReturning] = useState(false);
  const [retQty, setRetQty] = useState<Record<string, string>>({});
  const [refundMethod, setRefundMethod] = useState("dinheiro");
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("dinheiro");

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("sales")
      .select("*, customers(name,phone), sale_items(*), payments(*)")
      .eq("id", id)
      .single();
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    setSale(data as unknown as SaleFull);
  }, [id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(fn: () => PromiseLike<{ error: unknown }>, okMsg: string) {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success(okMsg);
    setReturning(false);
    setRetQty({});
    setPayAmount("");
    await load();
    onChanged();
  }

  async function cancel() {
    const ok = await confirm({
      title: "Cancelar venda",
      message: "Os itens voltarão ao estoque e os pagamentos serão estornados. O histórico da venda será mantido. Deseja continuar?",
      confirmLabel: "Cancelar venda",
      danger: true,
    });
    if (!ok) return;
    run(() => supabase.rpc("cancel_sale", { p_sale_id: id, p_reason: reason }), "Venda cancelada");
  }

  async function submitReturn() {
    const items = Object.entries(retQty)
      .map(([sale_item_id, q]) => ({ sale_item_id, quantity: Number(q) }))
      .filter((i) => i.quantity > 0);
    if (items.length === 0) return toast.error("Informe a quantidade de ao menos um item");
    const ok = await confirm({
      title: "Registrar devolução",
      message: "Os itens devolvidos voltarão ao estoque e o valor será reembolsado (ou abatido do fiado). Confirmar?",
      confirmLabel: "Registrar devolução",
    });
    if (!ok) return;
    run(
      () => supabase.rpc("return_sale_items", { p_sale_id: id, p_items: items, p_refund_method: refundMethod, p_notes: null }),
      "Devolução registrada"
    );
  }

  function submitPayment() {
    const v = Number(payAmount);
    if (!(v > 0)) return toast.error("Informe um valor válido");
    run(() => supabase.rpc("receive_fiado", { p_sale_id: id, p_amount: v, p_method: payMethod }), "Recebimento registrado");
  }

  async function removeSale() {
    const ok = await confirm({
      title: "Excluir venda",
      message: "A venda cancelada e os pagamentos dela serão apagados definitivamente do histórico. Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    const { error } = await supabase.rpc("delete_sale", { p_sale_id: id });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success("Venda excluída");
    onChanged();
    onClose();
  }

  const canAct = sale && sale.status !== "cancelada";

  return (
    <Modal open size="lg" title="Detalhes da venda" onClose={onClose}>
      {!sale ? (
        <Loading />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div>
              <div className="text-stone-500">{dateTimeBR(sale.created_at)}</div>
              <div className="font-medium">{sale.customers?.name ?? "Sem cliente"}</div>
            </div>
            <span className={cx("badge", STATUS_BADGE[sale.status].cls)}>{STATUS_BADGE[sale.status].label}</span>
          </div>
          {sale.cancel_reason && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Motivo do cancelamento: {sale.cancel_reason}</p>}

          <div className="overflow-x-auto rounded-xl border border-stone-200">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="text-right">Qtd.</th>
                  <th className="text-right">Preço</th>
                  <th className="text-right">Custo</th>
                  {returning && <th className="text-right">Devolver</th>}
                </tr>
              </thead>
              <tbody>
                {sale.sale_items.map((i) => {
                  const avail = i.quantity - i.returned_qty;
                  return (
                    <tr key={i.id}>
                      <td>
                        {i.product_name}
                        <div className="text-xs text-stone-400">
                          {i.size}
                          {i.color ? ` · ${i.color}` : ""}
                          {i.returned_qty > 0 && <span className="ml-1 text-sky-600">({i.returned_qty} devolvida(s))</span>}
                        </div>
                      </td>
                      <td className="text-right">{i.quantity}</td>
                      <td className="text-right">{brl(i.unit_price)}</td>
                      <td className="text-right text-stone-500">{brl(i.unit_cost)}</td>
                      {returning && (
                        <td className="text-right">
                          <input
                            type="number"
                            min="0"
                            max={avail}
                            disabled={avail === 0}
                            className="input !w-20 !py-1.5 text-right"
                            value={retQty[i.id] ?? ""}
                            onChange={(e) => setRetQty((r) => ({ ...r, [i.id]: String(Math.min(avail, Math.max(0, Number(e.target.value)))) }))}
                          />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="ml-auto max-w-xs space-y-1 text-sm">
            <Line label="Subtotal" value={brl(sale.subtotal)} />
            {sale.discount > 0 && <Line label="Desconto" value={`− ${brl(sale.discount)}`} />}
            <Line label="Total" value={brl(sale.total)} bold />
            {sale.refunded_total > 0 && <Line label="Devolvido" value={`− ${brl(sale.refunded_total)}`} />}
            <Line label="Custo das peças" value={brl(sale.cost_total)} muted />
            <Line label="Lucro bruto (na venda)" value={brl(sale.profit)} muted />
            {sale.amount_pending > 0 && <Line label="A receber (fiado)" value={brl(sale.amount_pending)} amber />}
          </div>

          <div>
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-500">Pagamentos</h4>
            <ul className="space-y-1 text-sm">
              {sale.payments
                .slice()
                .sort((a, b) => a.paid_at.localeCompare(b.paid_at))
                .map((p) => (
                  <li key={p.id} className="flex justify-between">
                    <span className="text-stone-600">
                      {KIND_LABEL[p.kind]} · {PAYMENT_LABEL[p.method]} <span className="text-stone-400">{dateTimeBR(p.paid_at)}</span>
                    </span>
                    <span className={p.amount < 0 ? "text-red-600" : ""}>{brl(p.amount)}</span>
                  </li>
                ))}
            </ul>
          </div>

          {canAct && sale.amount_pending > 0 && (
            <div className="rounded-xl bg-amber-50 p-4">
              <h4 className="mb-2 text-sm font-medium text-amber-800">Receber fiado</h4>
              <div className="flex flex-wrap gap-2">
                <input type="number" min="0" step="0.01" className="input !w-32" placeholder="Valor" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                <button className="btn-secondary btn-sm" onClick={() => setPayAmount(String(sale.amount_pending))}>
                  Total
                </button>
                <select className="input !w-36" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                  {["dinheiro", "pix", "credito", "debito"].map((m) => (
                    <option key={m} value={m}>
                      {PAYMENT_LABEL[m]}
                    </option>
                  ))}
                </select>
                <button className="btn-primary btn-sm" disabled={busy} onClick={submitPayment}>
                  Registrar recebimento
                </button>
              </div>
            </div>
          )}

          {canAct && (
            <div className="flex flex-wrap items-center gap-2 border-t border-stone-100 pt-4">
              {returning ? (
                <>
                  <select className="input !w-44" value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)} title="Forma de reembolso">
                    {["dinheiro", "pix", "credito", "debito"].map((m) => (
                      <option key={m} value={m}>
                        Reembolso: {PAYMENT_LABEL[m]}
                      </option>
                    ))}
                  </select>
                  <button className="btn-primary" disabled={busy} onClick={submitReturn}>
                    Confirmar devolução
                  </button>
                  <button className="btn-ghost" onClick={() => setReturning(false)}>
                    Voltar
                  </button>
                </>
              ) : (
                <>
                  <button className="btn-secondary" onClick={() => setReturning(true)}>
                    Registrar devolução
                  </button>
                  <input className="input !w-56" placeholder="Motivo do cancelamento (opcional)" value={reason} onChange={(e) => setReason(e.target.value)} />
                  <button className="btn-danger" disabled={busy} onClick={cancel}>
                    Cancelar venda
                  </button>
                </>
              )}
            </div>
          )}
          {sale.status === "cancelada" && (
            <div className="border-t border-stone-100 pt-4">
              <button className="btn-danger" disabled={busy} onClick={removeSale}>
                Excluir definitivamente
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function Line({ label, value, bold, muted, amber }: { label: string; value: string; bold?: boolean; muted?: boolean; amber?: boolean }) {
  return (
    <div className={cx("flex justify-between", bold && "text-base font-semibold", muted && "text-stone-400", amber && "font-medium text-amber-700")}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
