"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Boxes, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { brl, cx, dateBR, dateTimeBR, errMsg, num, sizeRank } from "@/lib/format";
import { Empty, Field, Loading, Modal, PageHeader, Spinner, Tabs, Pagination, SearchInput, SortTh, StockBadge, usePaged, useSort } from "@/components/ui";
import { useToast } from "@/components/providers";

const supabase = createClient();

type Tab = "posicao" | "mov" | "compras";

export default function EstoquePage() {
  const [tab, setTab] = useState<Tab>("posicao");
  return (
    <>
      <PageHeader title="Estoque" subtitle="Posição por tamanho e cor, movimentações e reposições" />
      <Tabs
        tabs={[
          { id: "posicao", label: "Posição atual" },
          { id: "mov", label: "Movimentações" },
          { id: "compras", label: "Compras e reposição" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "posicao" && <Posicao />}
      {tab === "mov" && <Movimentacoes />}
      {tab === "compras" && <Compras />}
    </>
  );
}

// ---------------------------------------------------------------- Posição
type VRow = {
  id: string;
  size: string;
  color: string;
  stock: number;
  min_stock: number;
  active: boolean;
  products: { id: string; name: string; active: boolean; cost_price: number };
};

function Posicao() {
  const toast = useToast();
  const [rows, setRows] = useState<VRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [adjust, setAdjust] = useState<VRow | null>(null);
  const [summary, setSummary] = useState<{ pieces: number; cost_value: number; low_count: number; out_count: number } | null>(null);

  const load = useCallback(async () => {
    let q = supabase
      .from("product_variants")
      .select("id,size,color,stock,min_stock,active,products!inner(id,name,active,cost_price)")
      .eq("active", true)
      .eq("products.active", true);
    if (search.trim()) q = q.ilike("products.name", `%${search.trim()}%`);
    if (status === "out") q = q.eq("stock", 0);
    const [{ data, error }, s] = await Promise.all([
      q.order("stock", { ascending: true }).limit(300),
      supabase.rpc("stock_summary"),
    ]);
    if (error) toast.error(errMsg(error));
    let list = (data ?? []) as unknown as VRow[];
    if (status === "low") list = list.filter((v) => v.stock > 0 && v.stock <= v.min_stock);
    setRows(list);
    setSummary(s.data);
    setLoading(false);
  }, [search, status, toast]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const sort = useSort(rows, {
    product: (v) => v.products.name,
    size: (v) => sizeRank(v.size),
    color: (v) => v.color,
    stock: (v) => v.stock,
    min: (v) => v.min_stock,
    status: (v) => (v.stock === 0 ? 0 : v.stock <= v.min_stock ? 1 : 2),
  });
  const paged = usePaged(sort.sorted, 15, `${search}|${status}|${sort.sortKey}|${sort.sortDir}`);

  return (
    <>
      {summary && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MiniStat label="Peças em estoque" value={num(summary.pieces)} />
          <MiniStat label="Valor em estoque (custo)" value={brl(summary.cost_value)} />
          <MiniStat label="Estoque baixo" value={num(summary.low_count)} tone="amber" />
          <MiniStat label="Esgotados" value={num(summary.out_count)} tone="red" />
        </div>
      )}

      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_12rem]">
        <SearchInput placeholder="Buscar produto..." value={search} onChange={setSearch} />
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">Todos</option>
          <option value="low">Estoque baixo</option>
          <option value="out">Esgotados</option>
        </select>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty icon={<Boxes size={22} />}>Nenhum item encontrado com esses filtros.</Empty>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <SortTh label="Produto" k="product" sort={sort} />
                <SortTh label="Tamanho" k="size" sort={sort} />
                <SortTh label="Cor" k="color" sort={sort} />
                <SortTh label="Estoque" k="stock" sort={sort} className="text-right" />
                <SortTh label="Mínimo" k="min" sort={sort} className="text-right" />
                <SortTh label="Situação" k="status" sort={sort} />
                <th />
              </tr>
            </thead>
            <tbody>
              {paged.pageItems.map((v) => (
                <tr key={v.id}>
                  <td className="font-medium">{v.products.name}</td>
                  <td>{v.size}</td>
                  <td className="text-stone-500">{v.color || "—"}</td>
                  <td className="text-right font-semibold">{v.stock}</td>
                  <td className="text-right text-stone-400">{v.min_stock}</td>
                  <td>
                    <StockBadge stock={v.stock} min={v.min_stock} />
                  </td>
                  <td className="text-right">
                    <button className="btn-secondary btn-sm" onClick={() => setAdjust(v)}>
                      <SlidersHorizontal size={13} /> Ajustar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && <Pagination paged={paged} />}
      </div>
      {rows.length >= 300 && <p className="mt-2 text-xs text-stone-400">Mostrando os 300 primeiros itens. Use a busca para refinar.</p>}

      {adjust && (
        <AdjustModal
          v={adjust}
          onClose={() => setAdjust(null)}
          onSaved={() => {
            setAdjust(null);
            load();
          }}
        />
      )}
    </>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "amber" | "red" }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-stone-500">{label}</div>
      <div className={cx("mt-1 text-xl font-semibold", tone === "amber" && "text-amber-600", tone === "red" && "text-red-600")}>{value}</div>
    </div>
  );
}

function AdjustModal({ v, onClose, onSaved }: { v: VRow; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [qty, setQty] = useState(String(v.stock));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    const n = Number(qty);
    if (!Number.isInteger(n) || n < 0) return toast.error("Informe uma quantidade inteira não negativa");
    if (n === v.stock) return toast.error("A quantidade não foi alterada");
    if (!reason.trim()) return toast.error("Informe o motivo do ajuste");
    setBusy(true);
    const { error } = await supabase.rpc("adjust_stock", { p_variant_id: v.id, p_new_quantity: n, p_reason: reason, p_type: "ajuste" });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success("Estoque ajustado");
    onSaved();
  }

  return (
    <Modal
      open
      title="Ajuste manual de estoque"
      onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={save} disabled={busy}>
            {busy ? <Spinner className="!text-white" /> : "Salvar ajuste"}
          </button>
        </>
      }
    >
      <p className="mb-4 text-sm text-stone-600">
        <strong>{v.products.name}</strong> · {v.size}
        {v.color ? ` · ${v.color}` : ""}
        <br />
        Estoque atual: <strong>{v.stock}</strong>
      </p>
      <div className="space-y-3">
        <Field label="Nova quantidade">
          <input type="number" min="0" className="input" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
        </Field>
        <Field label="Motivo *">
          <input className="input" placeholder="Ex.: contagem de inventário, peça danificada" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- Movimentações
const TYPE_LABEL: Record<string, { label: string; cls: string }> = {
  entrada: { label: "Entrada", cls: "bg-brand-50 text-brand-700" },
  compra: { label: "Compra", cls: "bg-brand-50 text-brand-700" },
  venda: { label: "Venda", cls: "bg-stone-100 text-stone-600" },
  ajuste: { label: "Ajuste", cls: "bg-amber-50 text-amber-700" },
  devolucao: { label: "Devolução", cls: "bg-sky-50 text-sky-700" },
  cancelamento: { label: "Cancelamento", cls: "bg-sky-50 text-sky-700" },
};

type Mov = {
  id: string;
  type: string;
  quantity: number;
  balance_after: number;
  unit_cost: number | null;
  notes: string | null;
  created_at: string;
  product_variants: { size: string; color: string; products: { name: string } } | null;
};

function Movimentacoes() {
  const toast = useToast();
  const [rows, setRows] = useState<Mov[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      let q = supabase
        .from("stock_movements")
        .select("id,type,quantity,balance_after,unit_cost,notes,created_at,product_variants(size,color,products(name))");
      if (type) q = q.eq("type", type);
      const { data, error } = await q.order("created_at", { ascending: false }).limit(200);
      if (error) toast.error(errMsg(error));
      setRows((data ?? []) as unknown as Mov[]);
      setLoading(false);
    })();
  }, [type, toast]);

  return (
    <>
      <div className="mb-4 max-w-xs">
        <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Todos os tipos</option>
          {Object.entries(TYPE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
      </div>
      <div className="card overflow-x-auto">
        {loading ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty>Nenhuma movimentação registrada.</Empty>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Data</th>
                <th>Produto</th>
                <th>Tipo</th>
                <th className="text-right">Qtd.</th>
                <th className="text-right">Saldo</th>
                <th className="text-right">Custo un.</th>
                <th>Observação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap text-stone-500">{dateTimeBR(m.created_at)}</td>
                  <td>
                    {m.product_variants?.products.name}{" "}
                    <span className="text-stone-400">
                      {m.product_variants?.size}
                      {m.product_variants?.color ? ` · ${m.product_variants.color}` : ""}
                    </span>
                  </td>
                  <td>
                    <span className={cx("badge", TYPE_LABEL[m.type]?.cls)}>{TYPE_LABEL[m.type]?.label ?? m.type}</span>
                  </td>
                  <td className={cx("text-right font-semibold", m.quantity > 0 ? "text-brand-600" : "text-stone-700")}>
                    {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                  </td>
                  <td className="text-right">{m.balance_after}</td>
                  <td className="text-right text-stone-500">{m.unit_cost != null ? brl(m.unit_cost) : "—"}</td>
                  <td className="text-stone-500">{m.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- Compras
type Purchase = { id: string; purchase_date: string; total: number; notes: string | null; suppliers: { name: string } | null };
type VOpt = { id: string; label: string; cost: number };

function Compras() {
  const toast = useToast();
  const [rows, setRows] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<Purchase | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("purchases")
      .select("id,purchase_date,total,notes,suppliers(name)")
      .order("purchase_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) toast.error(errMsg(error));
    setRows((data ?? []) as unknown as Purchase[]);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button className="btn-primary" onClick={() => setCreating(true)}>
          <Plus size={16} /> Registrar compra
        </button>
      </div>
      <div className="card overflow-x-auto">
        {loading ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty>Nenhuma compra registrada.</Empty>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Data</th>
                <th>Fornecedor</th>
                <th className="text-right">Total</th>
                <th>Observação</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>{dateBR(p.purchase_date)}</td>
                  <td>{p.suppliers?.name ?? "—"}</td>
                  <td className="text-right font-semibold">{brl(p.total)}</td>
                  <td className="text-stone-500">{p.notes}</td>
                  <td className="text-right">
                    <button className="btn-secondary btn-sm" onClick={() => setDetail(p)}>
                      Ver itens
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {creating && (
        <PurchaseForm
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            load();
          }}
        />
      )}
      {detail && <PurchaseDetail p={detail} onClose={() => setDetail(null)} />}
    </>
  );
}

function PurchaseDetail({ p, onClose }: { p: Purchase; onClose: () => void }) {
  const [items, setItems] = useState<{ id: string; quantity: number; unit_cost: number; product_variants: { size: string; color: string; products: { name: string } } }[] | null>(null);

  useEffect(() => {
    supabase
      .from("purchase_items")
      .select("id,quantity,unit_cost,product_variants(size,color,products(name))")
      .eq("purchase_id", p.id)
      .then(({ data }) => setItems((data ?? []) as never));
  }, [p.id]);

  return (
    <Modal open title={`Compra de ${dateBR(p.purchase_date)}`} onClose={onClose}>
      {!items ? (
        <Loading />
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th>Item</th>
              <th className="text-right">Qtd.</th>
              <th className="text-right">Custo un.</th>
              <th className="text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td>
                  {i.product_variants.products.name}{" "}
                  <span className="text-stone-400">
                    {i.product_variants.size}
                    {i.product_variants.color ? ` · ${i.product_variants.color}` : ""}
                  </span>
                </td>
                <td className="text-right">{i.quantity}</td>
                <td className="text-right">{brl(i.unit_cost)}</td>
                <td className="text-right font-medium">{brl(i.quantity * i.unit_cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

type PRow = { key: number; label: string; variantId: string; qty: string; cost: string };
let pk = 0;
const newPRow = (): PRow => ({ key: ++pk, label: "", variantId: "", qty: "1", cost: "" });

function PurchaseForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [options, setOptions] = useState<VOpt[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [date, setDate] = useState(() => new Date().toLocaleDateString("sv-SE"));
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<PRow[]>([newPRow()]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const [s, v] = await Promise.all([
        supabase.from("suppliers").select("id,name").order("name"),
        supabase
          .from("product_variants")
          .select("id,size,color,products!inner(name,cost_price,active)")
          .eq("products.active", true)
          .limit(1000),
      ]);
      setSuppliers((s.data ?? []) as { id: string; name: string }[]);
      const list = ((v.data ?? []) as unknown as { id: string; size: string; color: string; products: { name: string; cost_price: number } }[])
        .map((x) => ({
          id: x.id,
          label: `${x.products.name} · ${x.size}${x.color ? ` · ${x.color}` : ""}`,
          cost: x.products.cost_price,
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
      setOptions(list);
    })();
  }, []);

  const update = (key: number, patch: Partial<PRow>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  function onLabel(key: number, label: string) {
    const opt = options.find((o) => o.label === label);
    update(key, { label, variantId: opt?.id ?? "", ...(opt && { cost: String(opt.cost) }) });
  }

  const total = rows.reduce((s, r) => s + Number(r.qty || 0) * Number(r.cost || 0), 0);

  async function save() {
    if (rows.some((r) => !r.variantId)) return toast.error("Selecione um produto válido da lista em todas as linhas");
    if (rows.some((r) => !(Number(r.qty) > 0) || !Number.isInteger(Number(r.qty)))) return toast.error("Quantidades devem ser inteiros maiores que zero");
    if (rows.some((r) => r.cost === "" || Number(r.cost) < 0)) return toast.error("Informe o custo unitário de todos os itens");
    setBusy(true);
    const { error } = await supabase.rpc("register_purchase", {
      p_supplier_id: supplierId || null,
      p_date: date,
      p_notes: notes,
      p_items: rows.map((r) => ({ variant_id: r.variantId, quantity: Number(r.qty), unit_cost: Number(r.cost) })),
    });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success("Compra registrada e estoque atualizado");
    onSaved();
  }

  return (
    <Modal
      open
      size="lg"
      title="Registrar compra / reposição"
      onClose={onClose}
      footer={
        <>
          <div className="mr-auto self-center text-sm text-stone-500">
            Total: <strong className="text-stone-900">{brl(total)}</strong>
          </div>
          <button className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={save} disabled={busy}>
            {busy ? <Spinner className="!text-white" /> : "Registrar compra"}
          </button>
        </>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Field label="Fornecedor">
          <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">Não informado</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Data">
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Observação">
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>

      <datalist id="variant-options">
        {options.map((o) => (
          <option key={o.id} value={o.label} />
        ))}
      </datalist>

      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.key} className="grid grid-cols-[1fr_4.5rem_6rem_2.25rem] gap-2">
            <input
              list="variant-options"
              className="input"
              placeholder="Buscar produto · tamanho · cor"
              value={r.label}
              onChange={(e) => onLabel(r.key, e.target.value)}
            />
            <input type="number" min="1" className="input" title="Quantidade" value={r.qty} onChange={(e) => update(r.key, { qty: e.target.value })} />
            <input type="number" min="0" step="0.01" className="input" title="Custo unitário" placeholder="Custo" value={r.cost} onChange={(e) => update(r.key, { cost: e.target.value })} />
            <button className="btn-ghost btn-sm" aria-label="Remover" onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : rs))}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button className="btn-secondary btn-sm" onClick={() => setRows((rs) => [...rs, newPRow()])}>
          <Plus size={14} /> Adicionar item
        </button>
      </div>
      <p className="mt-4 text-xs text-stone-400">
        O custo pago fica registrado no histórico da compra e o custo médio do produto é recalculado automaticamente.
      </p>
    </Modal>
  );
}
