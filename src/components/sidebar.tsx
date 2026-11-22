"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Boxes,
  LayoutDashboard,
  LogOut,
  Menu,
  Shirt,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cx } from "@/lib/format";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/vendas", label: "Vendas", icon: ShoppingCart },
  { href: "/produtos", label: "Produtos", icon: Shirt },
  { href: "/estoque", label: "Estoque", icon: Boxes },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/fornecedores", label: "Fornecedores", icon: Truck },
];

const STORE = process.env.NEXT_PUBLIC_STORE_NAME || "Minha Loja";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-sm font-semibold text-white">
          {STORE.charAt(0).toUpperCase()}
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-stone-900">{STORE}</div>
          <div className="text-xs text-stone-400">Gestão da loja</div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cx(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                active ? "bg-brand-50 text-brand-700" : "text-stone-500 hover:bg-stone-100 hover:text-stone-800"
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-stone-100 p-3">
        {email && <div className="truncate px-3 pb-2 text-xs text-stone-400">{email}</div>}
        <button onClick={signOut} className="btn-ghost w-full !justify-start">
          <LogOut size={18} /> Sair
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-stone-200/80 bg-white lg:block">
        {content}
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-stone-200/80 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-semibold text-white">
            {STORE.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-semibold">{STORE}</span>
        </div>
        <button className="btn-ghost btn-sm" onClick={() => setOpen(true)} aria-label="Abrir menu">
          <Menu size={20} />
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-stone-900/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-white shadow-2xl">
            <button
              className="btn-ghost btn-sm absolute right-3 top-4"
              onClick={() => setOpen(false)}
              aria-label="Fechar menu"
            >
              <X size={18} />
            </button>
            {content}
          </div>
        </div>
      )}
    </>
  );
}
