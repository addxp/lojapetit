"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronsLeft, ChevronsRight, ChevronsUpDown, LogOut, MoreHorizontal, Moon, Plus, Sun, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cx } from "@/lib/format";
import { ALL_NAV, NAV_GROUPS, STORE, isActive, type NavItem } from "@/lib/nav";
import { useTheme, ThemeToggle } from "@/components/theme";
import { Tip } from "@/components/ui";

export { ALL_NAV, STORE };

const supabase = createClient();

export function useUser() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? "");
      setName((data.user?.user_metadata?.full_name as string) || "");
    });
  }, []);
  return { email, name: name || email.split("@")[0] || "Usuário" };
}

/** Itens de estoque esgotado/baixo (dado real via stock_summary) para o selo do menu. */
function useStockAlerts(pathname: string) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let alive = true;
    supabase.rpc("stock_summary").then(({ data }) => {
      if (!alive || !data) return;
      setCount(Number(data.low_count ?? 0) + Number(data.out_count ?? 0));
    });
    return () => {
      alive = false;
    };
  }, [pathname]);
  return count;
}

function useSignOut() {
  const router = useRouter();
  return async () => {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };
}

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-lg bg-brand-600 font-semibold uppercase text-white"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {name.charAt(0) || "U"}
    </span>
  );
}

function NavLink({ item, active, collapsed, badge }: { item: NavItem; active: boolean; collapsed: boolean; badge?: number }) {
  const Icon = item.icon;
  return (
    <Tip label={item.label} disabled={!collapsed} className="w-full">
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        aria-label={collapsed ? item.label : undefined}
        className={cx(
          "group relative flex w-full items-center rounded-lg py-2 text-[13px] font-medium transition-colors duration-150",
          collapsed ? "justify-center px-0" : "gap-2.5 px-2.5",
          active ? "bg-stone-100 text-stone-900 ring-1 ring-inset ring-stone-200/80" : "text-stone-500 hover:bg-stone-100/70 hover:text-stone-900"
        )}
      >
        {active && <span className="absolute -left-3 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-500" />}
        <Icon size={17} className={cx("shrink-0 transition-colors", active ? "text-brand-700" : "text-stone-400 group-hover:text-stone-600")} />
        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
        {!!badge && !collapsed && <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-amber-600">{badge}</span>}
        {!!badge && collapsed && <span className="absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 ring-2 ring-sidebar" />}
      </Link>
    </Tip>
  );
}

function UserMenu({ collapsed }: { collapsed: boolean }) {
  const { email, name } = useUser();
  const signOut = useSignOut();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("keydown", k);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {open && (
        <div className="absolute bottom-full left-0 z-40 mb-2 w-60 animate-slide-up overflow-hidden rounded-xl border border-stone-200 bg-card p-1.5 shadow-pop">
          <div className="flex items-center gap-2.5 px-2.5 py-2">
            <Avatar name={name} size={34} />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-medium text-stone-900">{name}</div>
              <div className="truncate text-xs text-stone-500">{email}</div>
            </div>
          </div>
          <div className="my-1 h-px bg-stone-200" />
          <button onClick={toggle} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-stone-700 transition hover:bg-stone-100">
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            {theme === "dark" ? "Tema claro" : "Tema escuro"}
          </button>
          <button onClick={signOut} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-stone-700 transition hover:bg-stone-100">
            <LogOut size={15} /> Sair da conta
          </button>
        </div>
      )}
      <Tip label={name} disabled={!collapsed || open} className="w-full">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
          className={cx(
            "flex w-full items-center rounded-lg border border-transparent p-1.5 text-left transition hover:border-stone-200 hover:bg-stone-100/70",
            collapsed ? "justify-center" : "gap-2.5",
            open && "border-stone-200 bg-stone-100/70"
          )}
        >
          <Avatar name={name} />
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[13px] font-medium text-stone-900">{name}</span>
                <span className="block truncate text-[11px] text-stone-500">{email}</span>
              </span>
              <ChevronsUpDown size={14} className="shrink-0 text-stone-400" />
            </>
          )}
        </button>
      </Tip>
    </div>
  );
}

/** Sidebar desktop (recolhível) */
export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const alerts = useStockAlerts(pathname);

  return (
    <aside
      className={cx(
        "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-stone-200 bg-sidebar transition-[width] duration-300 ease-out lg:flex",
        collapsed ? "w-[68px]" : "w-60"
      )}
    >
      <div className={cx("flex h-14 shrink-0 items-center border-b border-stone-200", collapsed ? "justify-center" : "justify-between gap-2 pl-4 pr-2.5")}>
        <Link href="/" className="flex min-w-0 items-center gap-2.5" aria-label={`${STORE} — início`}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-sm font-semibold text-white shadow-sm">
            {STORE.charAt(0).toUpperCase()}
          </span>
          {!collapsed && (
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-semibold text-stone-900">{STORE}</span>
              <span className="block text-[11px] text-stone-500">Gestão da loja</span>
            </span>
          )}
        </Link>
        {!collapsed && (
          <Tip label="Recolher menu" side="bottom">
            <button onClick={onToggle} className="btn-icon h-8 w-8" aria-label="Recolher menu">
              <ChevronsLeft size={16} />
            </button>
          </Tip>
        )}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Navegação principal">
        {NAV_GROUPS.map((g) => (
          <div key={g.title}>
            {!collapsed ? (
              <div className="mb-1.5 px-2.5 text-[11px] font-medium uppercase tracking-wider text-stone-400">{g.title}</div>
            ) : (
              <div className="mx-2 mb-2 h-px bg-stone-200" />
            )}
            <div className="space-y-0.5">
              {g.items.map((item) => (
                <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} collapsed={collapsed} badge={item.href === "/estoque" ? alerts : undefined} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 space-y-1 border-t border-stone-200 p-3">
        {collapsed && (
          <Tip label="Expandir menu" className="w-full">
            <button onClick={onToggle} className="btn-ghost w-full !px-0" aria-label="Expandir menu">
              <ChevronsRight size={16} />
            </button>
          </Tip>
        )}
        <UserMenu collapsed={collapsed} />
      </div>
    </aside>
  );
}

/** Navegação mobile: barra inferior + folha "Mais" */
export function MobileNav() {
  const pathname = usePathname();
  const { email, name } = useUser();
  const signOut = useSignOut();
  const alerts = useStockAlerts(pathname);
  const [more, setMore] = useState(false);

  useEffect(() => setMore(false), [pathname]);

  const primary = ALL_NAV.slice(0, 4);
  const secondary = ALL_NAV.slice(4);
  const moreActive = secondary.some((i) => isActive(pathname, i.href));

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-sidebar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Navegação principal">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {primary.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cx("relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors", active ? "text-brand-700" : "text-stone-500")}>
                <span className={cx("relative flex h-7 w-12 items-center justify-center rounded-full transition-colors", active && "bg-brand-100")}>
                  <Icon size={19} />
                  {href === "/estoque" && alerts > 0 && <span className="absolute right-2.5 top-0.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-sidebar" />}
                </span>
                {label}
              </Link>
            );
          })}
          <button onClick={() => setMore(true)} className={cx("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors", moreActive ? "text-brand-700" : "text-stone-500")}>
            <span className={cx("flex h-7 w-12 items-center justify-center rounded-full", moreActive && "bg-brand-100")}>
              <MoreHorizontal size={19} />
            </span>
            Mais
          </button>
        </div>
      </nav>

      {more && (
        <div className="fixed inset-0 z-[100] lg:hidden" role="dialog" aria-modal="true" aria-label="Mais opções">
          <div className="absolute inset-0 animate-fade-in bg-black/50 backdrop-blur-sm" onClick={() => setMore(false)} />
          <div className="absolute inset-x-0 bottom-0 animate-slide-up rounded-t-2xl border-t border-stone-200 bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-pop">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-stone-300" />
            <div className="mb-3 flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-100/50 p-3">
              <Avatar name={name} size={40} />
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
                <Link key={href} href={href} className={cx("flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3.5 text-xs font-medium transition active:scale-95", isActive(pathname, href) ? "border-brand-500/40 bg-brand-100 text-brand-700" : "border-stone-200 text-stone-600")}>
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
    <Link href="/vendas" aria-label="Nova venda" className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-pop transition active:scale-95 lg:hidden">
      <Plus size={24} />
    </Link>
  );
}
