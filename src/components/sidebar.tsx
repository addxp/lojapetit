"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Boxes,
  ChevronsLeft,
  ChevronsRight,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  Plus,
  ShieldCheck,
  Shirt,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cx } from "@/lib/format";
import { ThemeToggle } from "@/components/theme";

type Item = { href: string; label: string; icon: LucideIcon };
const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Operação",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/vendas", label: "Vendas", icon: ShoppingCart },
      { href: "/produtos", label: "Produtos", icon: Shirt },
      { href: "/estoque", label: "Estoque", icon: Boxes },
    ],
  },
  {
    title: "Gestão",
    items: [
      { href: "/financeiro", label: "Financeiro", icon: Wallet },
      { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
      { href: "/clientes", label: "Clientes", icon: Users },
      { href: "/fornecedores", label: "Fornecedores", icon: Truck },
      { href: "/equipe", label: "Equipe", icon: ShieldCheck },
    ],
  },
];
export const ALL_NAV = GROUPS.flatMap((g) => g.items);

export const STORE = process.env.NEXT_PUBLIC_STORE_NAME || "Minha Loja";
const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

export function useUser() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        setEmail(data.user?.email ?? "");
        setName((data.user?.user_metadata?.full_name as string) || "");
      });
  }, []);
  return { email, name: name || email.split("@")[0] || "Usuário" };
}

/** Sidebar desktop (recolhível) */
export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { email, name } = useUser();

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside
      className={cx(
        "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-stone-200 bg-sidebar transition-[width] duration-300 ease-out lg:flex",
        collapsed ? "w-[72px]" : "w-64"
      )}
    >
      {/* marca */}
      <div className={cx("flex h-16 items-center border-b border-stone-200", collapsed ? "justify-center" : "gap-3 px-5")}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-sm font-semibold text-white shadow-sm">
          {STORE.charAt(0).toUpperCase()}
        </div>
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold text-stone-900">{STORE}</div>
            <div className="text-xs text-stone-500">Gestão da loja</div>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Navegação principal">
        {GROUPS.map((g) => (
          <div key={g.title}>
            {!collapsed ? (
              <div className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-stone-400">{g.title}</div>
            ) : (
              <div className="mx-3 mb-2 h-px bg-stone-200" />
            )}
            <div className="space-y-0.5">
              {g.items.map(({ href, label, icon: Icon }) => {
                const active = isActive(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    title={collapsed ? label : undefined}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "group relative flex items-center rounded-xl py-2.5 text-sm font-medium transition-colors duration-150",
                      collapsed ? "justify-center px-0" : "gap-3 px-3",
                      active ? "bg-brand-100 text-brand-700" : "text-stone-500 hover:bg-stone-100 hover:text-stone-900"
                    )}
                  >
                    {active && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-600 dark:bg-brand-700" />}
                    <Icon size={18} className="shrink-0 transition-transform duration-150 group-hover:scale-110" />
                    {!collapsed && <span className="truncate">{label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* rodapé: perfil + tema + recolher */}
      <div className="space-y-1 border-t border-stone-200 p-3">
        <div className={cx("flex items-center gap-2", collapsed && "flex-col")}>
          <ThemeToggle withLabel={!collapsed} className={collapsed ? "" : "flex-1"} />
          <button onClick={onToggle} className="btn-icon" aria-label={collapsed ? "Expandir menu" : "Recolher menu"} title={collapsed ? "Expandir menu" : "Recolher menu"}>
            {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          </button>
        </div>
        <div className={cx("flex items-center rounded-xl bg-stone-100/70 p-2", collapsed ? "flex-col gap-2" : "gap-2.5")}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold uppercase text-white">
            {name.charAt(0) || "U"}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-medium text-stone-900">{name}</div>
              <div className="truncate text-xs text-stone-500">{email}</div>
            </div>
          )}
          <button onClick={signOut} className="btn-icon h-8 w-8" aria-label="Sair" title="Sair">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}

/** Navegação mobile: barra inferior + folha "Mais" */
export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { email, name } = useUser();
  const [more, setMore] = useState(false);

  useEffect(() => setMore(false), [pathname]);

  const primary: Item[] = [ALL_NAV[0], ALL_NAV[1], ALL_NAV[2], ALL_NAV[3]];
  const secondary = ALL_NAV.slice(4);
  const moreActive = secondary.some((i) => isActive(pathname, i.href));

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-sidebar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        aria-label="Navegação principal"
      >
        <div className="mx-auto grid max-w-md grid-cols-5">
          {primary.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cx("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors", active ? "text-brand-700" : "text-stone-500")}
              >
                <span className={cx("flex h-7 w-12 items-center justify-center rounded-full transition-colors", active && "bg-brand-100")}>
                  <Icon size={19} />
                </span>
                {label}
              </Link>
            );
          })}
          <button
            onClick={() => setMore(true)}
            className={cx("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors", moreActive ? "text-brand-700" : "text-stone-500")}
          >
            <span className={cx("flex h-7 w-12 items-center justify-center rounded-full", moreActive && "bg-brand-100")}>
              <MoreHorizontal size={19} />
            </span>
            Mais
          </button>
        </div>
      </nav>

      {more && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Mais opções">
          <div className="absolute inset-0 animate-fade-in bg-black/50 backdrop-blur-sm" onClick={() => setMore(false)} />
          <div className="absolute inset-x-0 bottom-0 animate-slide-up rounded-t-3xl border-t border-stone-200 bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-pop">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-stone-300" />
            <div className="mb-3 flex items-center gap-3 rounded-2xl bg-stone-100/70 p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold uppercase text-white">{name.charAt(0) || "U"}</div>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-sm font-semibold text-stone-900">{name}</div>
                <div className="truncate text-xs text-stone-500">{email || STORE}</div>
              </div>
              <button className="btn-icon" onClick={() => setMore(false)} aria-label="Fechar">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {secondary.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={cx(
                    "flex flex-col items-center gap-1.5 rounded-2xl border border-stone-200 px-2 py-3.5 text-xs font-medium transition active:scale-95",
                    isActive(pathname, href) ? "border-brand-600/40 bg-brand-100 text-brand-700" : "text-stone-600"
                  )}
                >
                  <Icon size={20} />
                  {label}
                </Link>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <ThemeToggle withLabel className="!w-auto flex-1 border border-stone-200" />
              <button onClick={signOut} className="btn-secondary flex-1">
                <LogOut size={16} /> Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Botão flutuante de nova venda (mobile) */
export function QuickSaleFab() {
  const pathname = usePathname();
  if (pathname.startsWith("/vendas")) return null;
  return (
    <Link
      href="/vendas"
      aria-label="Nova venda"
      className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-pop transition active:scale-95 lg:hidden"
    >
      <Plus size={24} />
    </Link>
  );
}
