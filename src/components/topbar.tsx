"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Bell, Clock, CornerDownLeft, Package, Plus, Search, Shirt, User, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { brl, cx } from "@/lib/format";
import { ALL_NAV, STORE } from "@/components/sidebar";
import { ThemeToggle } from "@/components/theme";

const supabase = createClient();

type Hit = { id: string; label: string; sub?: string; href: string; icon: React.ReactNode; group: string };

/* ───────── Busca global (Ctrl/⌘ + K) ───────── */
function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [remote, setRemote] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setRemote([]);
      setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  // busca produtos e clientes reais (somente leitura, com debounce)
  useEffect(() => {
    const term = q.trim();
    if (!open || term.length < 2) {
      setRemote([]);
      return;
    }
    let alive = true;
    setBusy(true);
    const t = setTimeout(async () => {
      const safe = term.replace(/[%,()]/g, " ");
      const [p, c] = await Promise.all([
        supabase.from("products").select("id,name,sale_price").ilike("name", `%${safe}%`).limit(5),
        supabase.from("customers").select("id,name,phone").or(`name.ilike.%${safe}%,phone.ilike.%${safe}%`).limit(5),
      ]);
      if (!alive) return;
      const hits: Hit[] = [
        ...(p.data ?? []).map((x) => ({
          id: `p-${x.id}`,
          label: x.name as string,
          sub: brl(x.sale_price as number),
          href: "/produtos",
          group: "Produtos",
          icon: <Shirt size={16} />,
        })),
        ...(c.data ?? []).map((x) => ({
          id: `c-${x.id}`,
          label: x.name as string,
          sub: (x.phone as string) || undefined,
          href: "/clientes",
          group: "Clientes",
          icon: <User size={16} />,
        })),
      ];
      setRemote(hits);
      setBusy(false);
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, open]);

  const pages = useMemo<Hit[]>(() => {
    const term = q.trim().toLowerCase();
    return ALL_NAV.filter((n) => !term || n.label.toLowerCase().includes(term)).map((n) => ({
      id: `n-${n.href}`,
      label: n.label,
      href: n.href,
      group: "Páginas",
      icon: <n.icon size={16} />,
    }));
  }, [q]);

  const results = useMemo(() => [...pages, ...remote], [pages, remote]);
  useEffect(() => setIdx(0), [q, remote.length]);

  const go = useCallback(
    (h: Hit) => {
      onClose();
      router.push(h.href);
    },
    [onClose, router]
  );

  if (!open) return null;

  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-3 pt-[10vh] sm:pt-[14vh]" role="dialog" aria-modal="true" aria-label="Busca global">
      <div className="absolute inset-0 animate-fade-in bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl animate-slide-up overflow-hidden rounded-2xl border border-stone-200 bg-card shadow-pop">
        <div className="flex items-center gap-3 border-b border-stone-200 px-4">
          <Search size={18} className="text-stone-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              else if (e.key === "ArrowDown") {
                e.preventDefault();
                setIdx((i) => Math.min(i + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIdx((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter" && results[idx]) go(results[idx]);
            }}
            placeholder="Buscar produtos, clientes ou páginas…"
            className="h-14 flex-1 bg-transparent text-base text-stone-900 outline-none placeholder:text-stone-400 sm:text-sm"
          />
          <button onClick={onClose} className="btn-icon h-8 w-8" aria-label="Fechar busca">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 && !busy && <div className="px-3 py-10 text-center text-sm text-stone-500">Nada encontrado para “{q}”.</div>}
          {results.map((h, i) => {
            const header = h.group !== lastGroup ? h.group : null;
            lastGroup = h.group;
            return (
              <div key={h.id}>
                {header && <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-stone-400">{header}</div>}
                <button
                  onClick={() => go(h)}
                  onMouseEnter={() => setIdx(i)}
                  className={cx("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm", i === idx ? "bg-brand-100 text-brand-700" : "text-stone-700")}
                >
                  <span className="text-stone-400">{h.icon}</span>
                  <span className="min-w-0 flex-1 truncate">{h.label}</span>
                  {h.sub && <span className="text-xs text-stone-400">{h.sub}</span>}
                  {i === idx && <CornerDownLeft size={14} className="text-stone-400" />}
                </button>
              </div>
            );
          })}
          {busy && <div className="px-3 py-2 text-xs text-stone-400">Buscando…</div>}
        </div>
      </div>
    </div>
  );
}

/* ───────── Notificações (estoque baixo + vendas pendentes, dados já existentes) ───────── */
type Notif = { id: string; icon: React.ReactNode; title: string; text: string; href: string; tone: "amber" | "red" };

function Notifications() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [low, sales] = await Promise.all([
        supabase.rpc("low_stock_variants", { p_limit: 6 }),
        supabase.from("sales").select("id,total,amount_pending,customers(name)").eq("status", "pendente").order("created_at").limit(5),
      ]);
      if (!alive) return;
      const out: Notif[] = [];
      ((low.data ?? []) as { variant_id: string; product_name: string; size: string; stock: number }[]).forEach((l) =>
        out.push({
          id: `l-${l.variant_id}`,
          icon: l.stock === 0 ? <Package size={16} /> : <AlertTriangle size={16} />,
          title: l.stock === 0 ? "Produto esgotado" : "Estoque baixo",
          text: `${l.product_name} (${l.size}) · ${l.stock} un.`,
          href: "/estoque",
          tone: l.stock === 0 ? "red" : "amber",
        })
      );
      ((sales.data ?? []) as unknown as { id: string; amount_pending: number; customers: { name: string } | { name: string }[] | null }[]).forEach((s) => {
        const c = Array.isArray(s.customers) ? s.customers[0] : s.customers;
        out.push({
          id: `s-${s.id}`,
          icon: <Clock size={16} />,
          title: "Venda pendente",
          text: `${c?.name ?? "Cliente"} · ${brl(s.amount_pending)} a receber`,
          href: "/financeiro",
          tone: "amber",
        });
      });
      setItems(out);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="btn-icon relative" aria-label="Notificações" aria-expanded={open}>
        <Bell size={18} />
        {items.length > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-surface" />}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-1.5rem))] animate-slide-up overflow-hidden rounded-2xl border border-stone-200 bg-card shadow-pop">
          <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
            <span className="text-sm font-semibold text-stone-900">Notificações</span>
            <span className="text-xs text-stone-400">{items.length}</span>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-stone-500">Tudo em dia por aqui.</div>
            ) : (
              items.map((n) => (
                <Link key={n.id} href={n.href} onClick={() => setOpen(false)} className="flex items-start gap-3 border-b border-stone-200/60 px-4 py-3 last:border-0 hover:bg-stone-100/60">
                  <span className={cx("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", n.tone === "red" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600")}>{n.icon}</span>
                  <span className="min-w-0 text-sm leading-snug">
                    <span className="block font-medium text-stone-900">{n.title}</span>
                    <span className="block truncate text-stone-500">{n.text}</span>
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function Topbar() {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-surface/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:px-6 lg:h-16 lg:px-8">
          {/* marca (só mobile; no desktop ela fica na sidebar) */}
          <div className="flex items-center gap-2 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-semibold text-white">{STORE.charAt(0).toUpperCase()}</div>
            <span className="max-w-[9rem] truncate text-sm font-semibold text-stone-900">{STORE}</span>
          </div>

          <button
            onClick={() => setSearchOpen(true)}
            className="hidden h-10 w-full max-w-md items-center gap-2.5 rounded-xl border border-stone-200 bg-card px-3.5 text-sm text-stone-400 transition hover:border-stone-300 lg:flex"
          >
            <Search size={16} />
            <span className="flex-1 text-left">Buscar produtos, clientes, páginas…</span>
            <kbd className="rounded-md border border-stone-200 bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-500">Ctrl K</kbd>
          </button>

          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => setSearchOpen(true)} className="btn-icon lg:hidden" aria-label="Buscar">
              <Search size={18} />
            </button>
            <div className="lg:hidden">
              <ThemeToggle />
            </div>
            <Notifications />
            <Link href="/vendas" className="btn-primary ml-1 hidden !py-2 sm:inline-flex">
              <Plus size={16} /> Nova venda
            </Link>
          </div>
        </div>
      </header>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
