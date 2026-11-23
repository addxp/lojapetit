"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ImageIcon, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { brl, cx, errMsg } from "@/lib/format";
import { Empty, Field, Loading, Modal, PageHeader, Spinner } from "@/components/ui";
import { useToast } from "@/components/providers";

const supabase = createClient();

type Variant = { id: string; size: string; color: string; stock: number; min_stock: number; active: boolean };
type Product = {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  collection_id: string | null;
  image_url: string | null;
  cost_price: number;
  sale_price: number;
  active: boolean;
  created_at: string;
  categories: { name: string } | null;
  collections: { name: string } | null;
  product_variants: Variant[];
};
type Option = { id: string; name: string };
type Row = { key: string; id?: string; size: string; color: string; stock: number; min_stock: number; active: boolean };

const SIZES = ["PP", "P", "M", "G", "GG", "XG", "Único", "34", "36", "38", "40", "42", "44", "46"];
let keySeq = 0;
const newRow = (over: Partial<Row> = {}): Row => ({
  key: `n${++keySeq}`,
  size: "",
  color: "",
  stock: 0,
  min_stock: 2,
  active: true,
  ...over,
});

export default function ProdutosPage() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [collections, setCollections] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [colFilter, setColFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [editing, setEditing] = useState<Product | "new" | null>(null);

  const loadLists = useCallback(async () => {
    const [c, l] = await Promise.all([
      supabase.from("categories").select("id,name").order("name"),
      supabase.from("collections").select("id,name").order("name"),
    ]);
    setCategories((c.data ?? []) as Option[]);
    setCollections((l.data ?? []) as Option[]);
  }, []);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("products")
      .select(
        "*, categories(name), collections(name), product_variants(id,size,color,stock,min_stock,active)"
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast.error(errMsg(error));
    setProducts((data ?? []) as Product[]);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    loadLists();
    load();
  }, [load, loadLists]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(
      (p) =>
        (!q || p.name.toLowerCase().includes(q)) &&
        (!catFilter || p.category_id === catFilter) &&
        (!colFilter || p.collection_id === colFilter) &&
        (statusFilter === "all" || (statusFilter === "active" ? p.active : !p.active))
    );
  }, [products, search, catFilter, colFilter, statusFilter]);

  async function toggleActive(p: Product) {
    const { error } = await supabase.from("products").update({ active: !p.active }).eq("id", p.id);
    if (error) return toast.error(errMsg(error));
    toast.success(p.active ? "Produto inativado" : "Produto reativado");
    load();
  }

  return (
    <>
      <PageHeader
        title="Produtos"
        subtitle="Cadastro de produtos, variações e preços"
        actions={
          <button className="btn-primary" onClick={() => setEditing("new")}>
            <Plus size={16} /> Novo produto
          </button>
        }
      />

      <div className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-3.5 text-stone-400" />
          <input
            className="input !pl-10"
            placeholder="Buscar produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
          <option value="">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select className="input" value={colFilter} onChange={(e) => setColFilter(e.target.value)}>
          <option value="">Todas as linhas</option>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
          <option value="all">Todos</option>
        </select>
      </div>

      {loading ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <div className="card">
          <Empty>
            {products.length === 0 ? "Nenhum produto cadastrado ainda." : "Nenhum produto encontrado com esses filtros."}
          </Empty>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => {
            const total = p.product_variants.filter((v) => v.active).reduce((s, v) => s + v.stock, 0);
            const margin = p.sale_price > 0 ? ((p.sale_price - p.cost_price) / p.sale_price) * 100 : 0;
            return (
              <div key={p.id} className={cx("card flex gap-4 p-4", !p.active && "opacity-60")}>
                <div className="h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-stone-100">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-stone-300">
                      <ImageIcon size={24} />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="truncate font-medium text-stone-900">{p.name}</h3>
                    <button className="btn-ghost btn-sm shrink-0" onClick={() => setEditing(p)} aria-label="Editar">
                      <Pencil size={14} />
                    </button>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {p.categories && (
                      <span className="badge bg-brand-50 text-brand-700">{p.categories.name}</span>
                    )}
                    {p.collections && (
                      <span className="badge bg-stone-100 text-stone-600">{p.collections.name}</span>
                    )}
                  </div>
                  <div className="mt-2 text-sm">
                    <span className="font-semibold text-stone-900">{brl(p.sale_price)}</span>
                    <span className="ml-2 text-xs text-stone-400">
                      custo {brl(p.cost_price)} · {margin.toFixed(0)}%
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {[...p.product_variants]
                      .filter((v) => v.active)
                      .slice(0, 8)
                      .map((v) => (
                        <span
                          key={v.id}
                          className={cx(
                            "badge",
                            v.stock === 0
                              ? "bg-red-50 text-red-700"
                              : v.stock <= v.min_stock
                              ? "bg-amber-50 text-amber-700"
                              : "bg-stone-100 text-stone-600"
                          )}
                        >
                          {v.size}
                          {v.color ? ` ${v.color}` : ""} · {v.stock}
                        </span>
                      ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-stone-400">
                    <span>{total} peças em estoque</span>
                    <button className="font-medium text-stone-500 hover:text-stone-800" onClick={() => toggleActive(p)}>
                      {p.active ? "Inativar" : "Reativar"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <ProductForm
          product={editing === "new" ? null : editing}
          categories={categories}
          collections={collections}
          onListsChanged={loadLists}
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

function InlineAdd({
  table,
  placeholder,
  onAdded,
}: {
  table: "categories" | "collections";
  placeholder: string;
  onAdded: (id: string) => void;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!name.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.from(table).insert({ name: name.trim() }).select("id").single();
    setBusy(false);
    if (error) {
      return toast.error(error.code === "23505" ? "Esse nome já existe" : errMsg(error));
    }
    toast.success("Criado com sucesso");
    setName("");
    setOpen(false);
    onAdded(data.id);
  }

  if (!open)
    return (
      <button type="button" className="mt-1.5 text-xs font-medium text-brand-600 hover:underline" onClick={() => setOpen(true)}>
        + Criar nova
      </button>
    );
  return (
    <div className="mt-1.5 flex gap-1.5">
      <input className="input !py-1.5" placeholder={placeholder} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <button type="button" className="btn-primary btn-sm" onClick={add} disabled={busy}>
        Salvar
      </button>
      <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(false)}>
        Cancelar
      </button>
    </div>
  );
}

function ProductForm({
  product,
  categories,
  collections,
  onListsChanged,
  onClose,
  onSaved,
}: {
  product: Product | null;
  categories: Option[];
  collections: Option[];
  onListsChanged: () => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const isEdit = !!product;
  const singleExisting =
    !!product && product.product_variants.length === 1 && product.product_variants[0].size === "Único" && !product.product_variants[0].color;

  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [categoryId, setCategoryId] = useState(product?.category_id ?? "");
  const [collectionId, setCollectionId] = useState(product?.collection_id ?? "");
  const [cost, setCost] = useState(String(product?.cost_price ?? ""));
  const [price, setPrice] = useState(String(product?.sale_price ?? ""));
  const [active, setActive] = useState(product?.active ?? true);
  const [hasVariants, setHasVariants] = useState(isEdit ? !singleExisting : true);
  const [rows, setRows] = useState<Row[]>(
    product && product.product_variants.length
      ? product.product_variants.map((v) => ({ ...v, key: v.id }))
      : [newRow()]
  );
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState(product?.image_url ?? "");
  const [saving, setSaving] = useState(false);

  const updateRow = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  function pickFile(f: File | null) {
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast.error("Selecione um arquivo de imagem");
    if (f.size > 5 * 1024 * 1024) return toast.error("A imagem deve ter no máximo 5 MB");
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const costN = Number(cost || 0);
    const priceN = Number(price || 0);
    if (!name.trim()) return toast.error("Informe o nome do produto");
    if (!(costN >= 0) || !(priceN >= 0)) return toast.error("Preços inválidos");
    if (priceN === 0) return toast.error("Informe o preço de venda");

    const list: Row[] = hasVariants
      ? rows.map((r) => ({ ...r, size: r.size.trim(), color: r.color.trim() }))
      : [{ ...rows[0], size: "Único", color: "" }];
    if (list.length === 0) return toast.error("Adicione ao menos uma variação");
    if (list.some((r) => !r.size)) return toast.error("Informe o tamanho de todas as variações");
    if (list.some((r) => !(r.stock >= 0) || !Number.isInteger(r.stock) || !(r.min_stock >= 0)))
      return toast.error("Quantidades devem ser números inteiros não negativos");
    const keys = list.map((r) => `${r.size.toLowerCase()}|${r.color.toLowerCase()}`);
    if (new Set(keys).size !== keys.length) return toast.error("Há variações repetidas (mesmo tamanho e cor)");

    setSaving(true);
    try {
      let image_url = product?.image_url ?? null;
      if (file) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type });
        if (up.error) throw up.error;
        image_url = supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
      }

      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        category_id: categoryId || null,
        collection_id: collectionId || null,
        image_url,
        cost_price: costN,
        sale_price: priceN,
        active,
      };

      let productId = product?.id;
      if (isEdit) {
        const { error } = await supabase.from("products").update(payload).eq("id", product!.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("products").insert(payload).select("id").single();
        if (error) throw error;
        productId = data.id;
      }

      for (const r of list) {
        if (r.id) {
          const { error } = await supabase
            .from("product_variants")
            .update({ size: r.size, color: r.color, min_stock: r.min_stock, active: r.active })
            .eq("id", r.id);
          if (error) throw error;
        } else {
          const { data, error } = await supabase
            .from("product_variants")
            .insert({ product_id: productId, size: r.size, color: r.color, min_stock: r.min_stock, active: r.active, stock: 0 })
            .select("id")
            .single();
          if (error) throw error;
          if (r.stock > 0) {
            const { error: e2 } = await supabase.rpc("adjust_stock", {
              p_variant_id: data.id,
              p_new_quantity: r.stock,
              p_reason: "Estoque inicial",
              p_type: "entrada",
            });
            if (e2) throw e2;
          }
        }
      }

      toast.success(isEdit ? "Produto atualizado" : "Produto cadastrado");
      onSaved();
    } catch (err) {
      toast.error(errMsg(err));
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      size="lg"
      title={isEdit ? "Editar produto" : "Novo produto"}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="product-form" className="btn-primary" disabled={saving}>
            {saving ? <Spinner className="!text-white" /> : "Salvar produto"}
          </button>
        </>
      }
    >
      <form id="product-form" onSubmit={submit} className="space-y-5">
        <div className="flex gap-4">
          <label className="flex h-28 w-24 shrink-0 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-stone-300 bg-stone-50 text-xs text-stone-400 hover:bg-stone-100">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="h-full w-full object-cover" />
            ) : (
              <>
                <Upload size={18} className="mb-1" />
                Imagem
              </>
            )}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
          </label>
          <div className="flex-1 space-y-3">
            <Field label="Nome *">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Conjunto Elegance" />
            </Field>
            <Field label="Descrição">
              <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Field label="Categoria">
              <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Sem categoria</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <InlineAdd
              table="categories"
              placeholder="Nome da categoria"
              onAdded={(id) => {
                onListsChanged();
                setCategoryId(id);
              }}
            />
          </div>
          <div>
            <Field label="Linha / coleção">
              <select className="input" value={collectionId} onChange={(e) => setCollectionId(e.target.value)}>
                <option value="">Sem linha</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <InlineAdd
              table="collections"
              placeholder="Nome da linha"
              onAdded={(id) => {
                onListsChanged();
                setCollectionId(id);
              }}
            />
          </div>
          <Field label={isEdit ? "Custo médio (R$) — atualizado nas compras" : "Preço de custo (R$)"}>
            <input type="number" min="0" step="0.01" inputMode="decimal" className="input" value={cost} onChange={(e) => setCost(e.target.value)} />
          </Field>
          <Field label="Preço de venda (R$) *">
            <input type="number" min="0" step="0.01" inputMode="decimal" className="input" value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
        </div>

        <div className="rounded-2xl border border-stone-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Estoque</h3>
            {!isEdit && (
              <label className="flex items-center gap-2 text-sm text-stone-600">
                <input
                  type="checkbox"
                  checked={hasVariants}
                  onChange={(e) => {
                    setHasVariants(e.target.checked);
                    if (!e.target.checked) setRows([{ ...rows[0], size: "Único", color: "" }]);
                  }}
                />
                Possui tamanhos/cores
              </label>
            )}
          </div>

          {!hasVariants ? (
            <div className="max-w-[10rem]">
              <Field label={isEdit ? "Quantidade atual" : "Quantidade inicial"}>
                <input
                  type="number"
                  min="0"
                  className="input"
                  disabled={!!rows[0]?.id}
                  value={rows[0]?.stock ?? 0}
                  onChange={(e) => updateRow(rows[0].key, { stock: Number(e.target.value) })}
                />
              </Field>
              {rows[0]?.id && <p className="mt-1 text-xs text-stone-400">Ajuste pela tela de Estoque.</p>}
            </div>
          ) : (
            <div className="space-y-2">
              <datalist id="sizes">
                {SIZES.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              <div className="hidden grid-cols-[1fr_1fr_5rem_5rem_2.5rem] gap-2 text-xs text-stone-500 sm:grid">
                <span>Tamanho</span>
                <span>Cor</span>
                <span>{isEdit ? "Estoque" : "Qtd."}</span>
                <span>Mínimo</span>
                <span />
              </div>
              {rows.map((r) => (
                <div key={r.key} className={cx("grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_5rem_5rem_2.5rem]", !r.active && "opacity-50")}>
                  <input list="sizes" className="input" placeholder="Tamanho" value={r.size} onChange={(e) => updateRow(r.key, { size: e.target.value })} />
                  <input className="input" placeholder="Cor (opcional)" value={r.color} onChange={(e) => updateRow(r.key, { color: e.target.value })} />
                  <input
                    type="number"
                    min="0"
                    className="input"
                    title={r.id ? "Ajuste o estoque pela tela de Estoque" : "Quantidade inicial"}
                    disabled={!!r.id}
                    value={r.stock}
                    onChange={(e) => updateRow(r.key, { stock: Number(e.target.value) })}
                  />
                  <input type="number" min="0" className="input" title="Estoque mínimo" value={r.min_stock} onChange={(e) => updateRow(r.key, { min_stock: Number(e.target.value) })} />
                  {r.id ? (
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      title={r.active ? "Inativar variação" : "Reativar variação"}
                      onClick={() => updateRow(r.key, { active: !r.active })}
                    >
                      {r.active ? "Off" : "On"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      aria-label="Remover linha"
                      onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : rs))}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button type="button" className="btn-secondary btn-sm" onClick={() => setRows((rs) => [...rs, newRow()])}>
                <Plus size={14} /> Adicionar variação
              </button>
            </div>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm text-stone-600">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Produto ativo (disponível para venda)
        </label>
      </form>
    </Modal>
  );
}
