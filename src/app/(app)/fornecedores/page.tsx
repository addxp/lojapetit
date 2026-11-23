"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { brl, dateBR, errMsg } from "@/lib/format";
import { Empty, Field, Loading, Modal, PageHeader, Spinner } from "@/components/ui";
import { useConfirm, useToast } from "@/components/providers";

const supabase = createClient();

type Supplier = { id: string; name: string; contact: string | null; products_supplied: string | null };

export default function FornecedoresPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Supplier | "new" | null>(null);
  const [history, setHistory] = useState<Supplier | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("suppliers").select("id,name,contact,products_supplied").order("name");
    if (error) toast.error(errMsg(error));
    setRows((data ?? []) as Supplier[]);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(s: Supplier) {
    const ok = await confirm({
      title: "Excluir fornecedor",
      message: `Excluir "${s.name}"? As compras dele continuam no histórico, apenas sem fornecedor.`,
      confirmLabel: "Excluir",
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("suppliers").delete().eq("id", s.id);
    if (error) return toast.error(errMsg(error));
    toast.success("Fornecedor excluído");
    load();
  }

  return (
    <>
      <PageHeader
        title="Fornecedores"
        subtitle="Contatos e histórico de compras"
        actions={
          <button className="btn-primary" onClick={() => setEditing("new")}>
            <Plus size={16} /> Novo fornecedor
          </button>
        }
      />
      <div className="card overflow-x-auto">
        {loading ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty>Nenhum fornecedor cadastrado.</Empty>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Contato</th>
                <th>Produtos fornecidos</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td className="font-medium">{s.name}</td>
                  <td className="text-stone-500">{s.contact ?? "—"}</td>
                  <td className="text-stone-500">{s.products_supplied ?? "—"}</td>
                  <td className="whitespace-nowrap text-right">
                    <button className="btn-secondary btn-sm" onClick={() => setHistory(s)}>
                      Compras
                    </button>
                    <button className="btn-ghost btn-sm" onClick={() => setEditing(s)} aria-label="Editar">
                      <Pencil size={14} />
                    </button>
                    <button className="btn-ghost btn-sm text-red-500" onClick={() => remove(s)} aria-label="Excluir">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <SupplierForm
          supplier={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
      {history && <SupplierHistory supplier={history} onClose={() => setHistory(null)} />}
    </>
  );
}

function SupplierForm({ supplier, onClose, onSaved }: { supplier: Supplier | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(supplier?.name ?? "");
  const [contact, setContact] = useState(supplier?.contact ?? "");
  const [products, setProducts] = useState(supplier?.products_supplied ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim()) return toast.error("Informe o nome");
    setBusy(true);
    const payload = { name: name.trim(), contact: contact.trim() || null, products_supplied: products.trim() || null };
    const { error } = supplier ? await supabase.from("suppliers").update(payload).eq("id", supplier.id) : await supabase.from("suppliers").insert(payload);
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success(supplier ? "Fornecedor atualizado" : "Fornecedor cadastrado");
    onSaved();
  }

  return (
    <Modal
      open
      title={supplier ? "Editar fornecedor" : "Novo fornecedor"}
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
        <Field label="Contato (telefone, e-mail...)">
          <input className="input" value={contact} onChange={(e) => setContact(e.target.value)} />
        </Field>
        <Field label="Produtos fornecidos">
          <input className="input" placeholder="Ex.: conjuntos, moda praia" value={products} onChange={(e) => setProducts(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function SupplierHistory({ supplier, onClose }: { supplier: Supplier; onClose: () => void }) {
  const [rows, setRows] = useState<{ id: string; purchase_date: string; total: number; notes: string | null }[] | null>(null);

  useEffect(() => {
    supabase
      .from("purchases")
      .select("id,purchase_date,total,notes")
      .eq("supplier_id", supplier.id)
      .order("purchase_date", { ascending: false })
      .limit(100)
      .then(({ data }) => setRows((data ?? []) as never));
  }, [supplier.id]);

  const total = (rows ?? []).reduce((s, r) => s + Number(r.total), 0);

  return (
    <Modal open title={`Compras — ${supplier.name}`} onClose={onClose}>
      {!rows ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Empty>Nenhuma compra registrada com este fornecedor.</Empty>
      ) : (
        <>
          <ul className="divide-y divide-stone-100 text-sm">
            {rows.map((r) => (
              <li key={r.id} className="flex justify-between py-2.5">
                <span>
                  {dateBR(r.purchase_date)} {r.notes && <span className="text-stone-400">· {r.notes}</span>}
                </span>
                <span className="font-medium">{brl(r.total)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-between border-t border-stone-100 pt-3 text-sm font-semibold">
            <span>Total comprado</span>
            <span>{brl(total)}</span>
          </div>
        </>
      )}
    </Modal>
  );
}

