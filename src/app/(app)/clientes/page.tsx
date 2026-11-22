"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { brl, cx, dateTimeBR, errMsg, num } from "@/lib/format";
import { Empty, Field, Loading, Modal, PageHeader, Spinner } from "@/components/ui";
import { useToast } from "@/components/providers";

const supabase = createClient();

type Customer = { id: string; name: string; phone: string | null; total_spent: number; pending: number; purchases: number };

export default function ClientesPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Customer | "new" | null>(null);
  const [history, setHistory] = useState<Customer | null>(null);

  const load = useCallback(async () => {
    const [c, s] = await Promise.all([
      supabase.from("customers").select("id,name,phone").order("name"),
      supabase.rpc("customer_stats"),
    ]);
    const err = c.error ?? s.error;
    if (err) toast.error(errMsg(err));
    const stats = new Map(
      ((s.data ?? []) as { customer_id: string; total_spent: number; pending: number; purchases: number }[]).map((x) => [x.customer_id, x])
    );
    setRows(
      ((c.data ?? []) as { id: string; name: string; phone: string | null }[]).map((x) => ({
        ...x,
        total_spent: Number(stats.get(x.id)?.total_spent ?? 0),
        pending: Number(stats.get(x.id)?.pending ?? 0),
        purchases: Number(stats.get(x.id)?.purchases ?? 0),
      }))
    );
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => !q || r.name.toLowerCase().includes(q) || (r.phone ?? "").includes(q));
  }, [rows, search]);

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle="Histórico de compras, total gasto e pendências"
        actions={
          <button className="btn-primary" onClick={() => setEditing("new")}>
            <Plus size={16} /> Novo cliente
          </button>
        }
      />
      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3.5 top-3.5 text-stone-400" />
        <input className="input !pl-10" placeholder="Buscar por nome ou telefone..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <Loading />
        ) : filtered.length === 0 ? (
          <Empty>{rows.length === 0 ? "Nenhum cliente cadastrado." : "Nenhum cliente encontrado."}</Empty>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Telefone</th>
                <th className="text-right">Compras</th>
                <th className="text-right">Total gasto</th>
                <th className="text-right">Pendente</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.name}</td>
                  <td className="text-stone-500">{c.phone ?? "—"}</td>
                  <td className="text-right">{num(c.purchases)}</td>
                  <td className="text-right">{brl(c.total_spent)}</td>
                  <td className={cx("text-right", c.pending > 0 && "font-semibold text-amber-700")}>{c.pending > 0 ? brl(c.pending) : "—"}</td>
                  <td className="whitespace-nowrap text-right">
                    <button className="btn-secondary btn-sm" onClick={() => setHistory(c)}>
                      Histórico
                    </button>
                    <button className="btn-ghost btn-sm" onClick={() => setEditing(c)} aria-label="Editar">
                      <Pencil size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <CustomerForm
          customer={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
      {history && <CustomerHistory customer={history} onClose={() => setHistory(null)} />}
    </>
  );
}

function CustomerForm({ customer, onClose, onSaved }: { customer: Customer | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim()) return toast.error("Informe o nome");
    setBusy(true);
    const payload = { name: name.trim(), phone: phone.trim() || null };
    const { error } = customer ? await supabase.from("customers").update(payload).eq("id", customer.id) : await supabase.from("customers").insert(payload);
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success(customer ? "Cliente atualizado" : "Cliente cadastrado");
    onSaved();
  }

  return (
    <Modal
      open
      title={customer ? "Editar cliente" : "Novo cliente"}
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

type HSale = { id: string; created_at: string; total: number; status: string; amount_pending: number; sale_items: { product_name: string; size: string; quantity: number }[] };

function CustomerHistory({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const [sales, setSales] = useState<HSale[] | null>(null);

  useEffect(() => {
    supabase
      .from("sales")
      .select("id,created_at,total,status,amount_pending,sale_items(product_name,size,quantity)")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => setSales((data ?? []) as unknown as HSale[]));
  }, [customer.id]);

  return (
    <Modal open size="lg" title={`Compras de ${customer.name}`} onClose={onClose}>
      {!sales ? (
        <Loading />
      ) : sales.length === 0 ? (
        <Empty>Nenhuma compra registrada.</Empty>
      ) : (
        <ul className="divide-y divide-stone-100">
          {sales.map((s) => (
            <li key={s.id} className="py-3 text-sm">
              <div className="flex justify-between">
                <span className="text-stone-500">{dateTimeBR(s.created_at)}</span>
                <span className="font-semibold">
                  {brl(s.total)}
                  {s.status === "cancelada" && <span className="badge ml-2 bg-red-50 text-red-700">Cancelada</span>}
                  {s.status === "pendente" && <span className="badge ml-2 bg-amber-50 text-amber-700">{brl(s.amount_pending)} pendente</span>}
                </span>
              </div>
              <div className="mt-0.5 text-xs text-stone-400">
                {s.sale_items.map((i) => `${i.quantity}× ${i.product_name} (${i.size})`).join(", ")}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
