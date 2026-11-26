"use client";

import { useEffect, useState } from "react";
import { MobileNav, QuickSaleFab, Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { cx } from "@/lib/format";

const KEY = "loja-sidebar-collapsed";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(KEY) === "1");
    } catch {}
  }, []);

  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(KEY, c ? "0" : "1");
      } catch {}
      return !c;
    });

  return (
    <div className="min-h-dvh">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div className={cx("transition-[padding] duration-300 ease-out", collapsed ? "lg:pl-[72px]" : "lg:pl-64")}>
        <Topbar />
        <main className="mx-auto max-w-7xl animate-fade-in px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">{children}</main>
      </div>
      <QuickSaleFab />
      <MobileNav />
    </div>
  );
}
