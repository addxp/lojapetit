"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ImageIcon, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { brl, cx, errMsg } from "@/lib/format";
import { Empty, Field, Loading, Modal, PageHeader, Spinner, Pagination, SearchInput, Skeleton, usePaged, useSort } from "@/components/ui";
import { useConfirm, useToast } from "@/components/providers";
import { ProductImage } from "@/components/product-image";
import { compressImage } from "@/lib/images";

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
  const confirm = useConfirm();
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

  const sort = useSort(filtered, {
    name: (p) => p.name,
    price: (p) => Number(p.sale_price),
    stock: (p) => p.product_variants.filter((v) => v.active).reduce((t, v) => t + v.stock, 0),
  });
  const paged = usePaged(sort.sorted, 12, `${search}|${catFilter}|${colFilter}|${statusFilter}|${sort.sortKey}|${sort.sortDir}`);

  async function toggleActive(p: Product) {
    const { error } = await supabase.from("products").update({ active: !p.active }).eq("id", p.id);
    if (error) return toast.error(errMsg(error));
    toast.success(p.active ? "Produto inativado" : "Produto reativado");
    load();
  }

  async function removeProduct(p: Product) {
    const ok = await confirm({
      title: "Excluir produto",
      message: `Excluir "${p.name}" com todas as variações, estoque e histórico de movimentações e compras dele? As vendas já feitas continuam nos relatórios. Esta ação não pode ser desfeita. Para apenas tirar de venda, use Inativar.`,
      confirmLabel: "Excluir produto",
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.rpc("delete_product", { p_product_id: p.id });
    if (error) return toast.error(errMsg(error));
    toast.success("Produto excluído");
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
        <SearchInput placeholder="Buscar produto..." value={search} onChange={setSearch} />
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

      {!loading && filtered.length > 1 && (
        <div className="mb-4 flex items-center justify-between gap-3 text-sm text-stone-500">
          <span>{filtered.length} produto(s)</span>
          <select
            className="input !w-auto !py-1.5"
            value={sort.sortKey ? `${sort.sortKey}:${sort.sortDir}` : ""}
            onChange={(e) => {
              const [k, d] = e.target.value.split(":");
              sort.setSort(k || null, (d as "asc" | "desc") || "asc");
            }}
            aria-label="Ordenar produtos"
          >
            <option value="">Ordenar: padrão</option>
            <option value="name:asc">Nome (A–Z)</option>
            <option value="price:asc">Menor preço</option>
            <option value="price:desc">Maior preço</option>
            <option value="stock:asc">Menor estoque</option>
            <option value="stock:desc">Maior estoque</option>
          </select>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card overflow-hidden">
              <Skeleton className="aspect-[4/5] w-full !rounded-none" />
              <div className="space-y-2.5 p-4">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-5 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <Empty>
            {products.length === 0 ? "Nenhum produto cadastrado ainda." : "Nenhum produto encontrado com esses filtros."}
          </Empty>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
          {paged.pageItems.map((p, idx) => {
            const vars = [...p.product_variants].filter((v) => v.active);
            const total = vars.reduce((s, v) => s + v.stock, 0);
            const margin = p.sale_price > 0 ? ((p.sale_price - p.cost_price) / p.sale_price) * 100 : 0;
            const out = total === 0;
            const low = !out && vars.some((v) => v.stock <= v.min_stock);
            return (
              <article key={p.id} className={cx("card group flex flex-col overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:shadow-pop", !p.active && "opacity-60")}>
                <div className="relative aspect-[4/5] w-full overflow-hidden bg-stone-100">
                  <ProductImage src={p.image_url} alt={p.name} width={360} priority={idx < 4} className="transition duration-500 group-hover:scale-[1.03]" />
                  <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                    {!p.active && <span className="badge bg-card/90 text-stone-600 shadow-sm backdrop-blur">Inativo</span>}
                    {out ? (
                      <span className="badge bg-red-600 text-white shadow-sm">Esgotado</span>
                    ) : low ? (
                      <span className="badge bg-amber-500 text-white shadow-sm">Estoque baixo</span>
                    ) : null}
                  </div>
                  <button
                    className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-card/90 text-stone-600 shadow-sm backdrop-blur transition hover:text-stone-900 active:scale-95"
                    onClick={() => setEditing(p)}
                    aria-label={`Editar ${p.name}`}
                  >
                    <Pencil size={15} />
                  </button>
                </div>

                <div className="flex flex-1 flex-col p-3 sm:p-4">
                  <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-snug text-stone-900">{p.name}</h3>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {p.categories && <span className="badge bg-brand-100 text-brand-700">{p.categories.name}</span>}
                    {p.collections && <span className="badge bg-stone-100 text-stone-600">{p.collections.name}</span>}
                  </div>
                  <div className="mt-2.5 flex items-baseline justify-between gap-2">
                    <span className="text-base font-semibold tabular-nums text-stone-900">{brl(p.sale_price)}</span>
                    <span className="text-[11px] tabular-nums text-stone-400">margem {margin.toFixed(0)}%</span>
                  </div>
                  <div className="text-[11px] text-stone-400">custo {brl(p.cost_price)}</div>

                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {vars.slice(0, 5).map((v) => (
                      <span
                        key={v.id}
                        className={cx(
                          "badge !px-2 !text-[11px]",
                          v.stock === 0 ? "bg-red-50 text-red-700" : v.stock <= v.min_stock ? "bg-amber-50 text-amber-700" : "bg-stone-100 text-stone-600"
                        )}
                      >
                        {v.size}
                        {v.color ? ` ${v.color}` : ""} · {v.stock}
                      </span>
                    ))}
                    {vars.length > 5 && <span className="badge !px-2 !text-[11px] bg-stone-100 text-stone-500">+{vars.length - 5}</span>}
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-2 border-t border-stone-200/70 pt-3 text-xs">
                    <span className="text-stone-500">{total} em estoque</span>
                    <span className="flex gap-3">
                      <button className="font-medium text-stone-500 hover:text-stone-900" onClick={() => toggleActive(p)}>
                        {p.active ? "Inativar" : "Reativar"}
                      </button>
                      <button className="font-medium text-red-500 hover:text-red-700" onClick={() => removeProduct(p)} aria-label={`Excluir ${p.name}`}>
                        Excluir
                      </button>
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {!loading && filtered.length > 0 && (
        <div className="card mt-4">
          <Pagination paged={paged} />
        </div>
      )}

      {editing && (
        <ProductForm
          product={editing === "new" ? null : editing}
          onChanged={load}
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
  onChanged,
}: {
  product: Product | null;
  categories: Option[];
  collections: Option[];
  onListsChanged: () => void;
  onClose: () => void;
  onSaved: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
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

  async function removeVariant(r: Row) {
    if (!r.id) return;
    const ok = await confirm({
      title: "Excluir variação",
      message: `Excluir ${r.size}${r.color ? " " + r.color : ""} (${r.stock} em estoque) e o histórico de estoque dela? Esta ação não pode ser desfeita.`,
      confirmLabel: "Excluir variação",
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.rpc("delete_variant", { p_variant_id: r.id });
    if (error) return toast.error(errMsg(error));
    toast.success("Variação excluída");
    setRows((rs) => {
      const next = rs.filter((x) => x.key !== r.key);
      return next.length ? next : [newRow()];
    });
    onChanged();
  }

  function pickFile(f: File | null) {
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast.error("Selecione um arquivo de imagem");
    if (f.size > 20 * 1024 * 1024) return toast.error("A imagem deve ter no máximo 20 MB");
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
        // reduz e converte para WebP antes de enviar (foto de celular: ~4 MB → ~150 KB)
        const img = await compressImage(file);
        const path = `${crypto.randomUUID()}.${img.ext}`;
        const up = await supabase.storage
          .from("product-images")
          .upload(path, img.blob, { contentType: img.type, cacheControl: "31536000" });
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
              <img src={preview} alt="" decoding="async" className="h-full w-full object-cover" />
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
              <div className="hidden grid-cols-[1fr_1fr_5rem_5rem_5.5rem] gap-2 text-xs text-stone-500 sm:grid">
                <span>Tamanho</span>
                <span>Cor</span>
                <span>{isEdit ? "Estoque" : "Qtd."}</span>
                <span>Mínimo</span>
                <span />
              </div>
              {rows.map((r) => (
                <div key={r.key} className={cx("grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_5rem_5rem_5.5rem]", !r.active && "opacity-50")}>
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
                    <div className="flex items-center">
                      <button
                        type="button"
                        className="btn-ghost btn-sm"
                        title={r.active ? "Inativar variação" : "Reativar variação"}
                        onClick={() => updateRow(r.key, { active: !r.active })}
                      >
                        {r.active ? "Off" : "On"}
                      </button>
                      <button type="button" className="btn-ghost btn-sm text-red-500" aria-label="Excluir variação" onClick={() => removeVariant(r)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
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
