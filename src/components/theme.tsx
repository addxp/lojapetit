"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cx } from "@/lib/format";

export const THEME_KEY = "loja-theme";
type Theme = "light" | "dark";

/** Roda ANTES da hidratação (inline no <head>) para não piscar o tema errado. */
export const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('${THEME_KEY}');var d=s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

const Ctx = createContext<{ theme: Theme; toggle: () => void; set: (t: Theme) => void }>({
  theme: "light",
  toggle: () => {},
  set: () => {},
});
export const useTheme = () => useContext(Ctx);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  // sincroniza com o que o script inicial já aplicou
  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    // segue o sistema enquanto o usuário não escolheu manualmente
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      try {
        if (localStorage.getItem(THEME_KEY)) return;
      } catch {}
      apply(e.matches ? "dark" : "light");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function apply(t: Theme) {
    const r = document.documentElement;
    r.classList.toggle("dark", t === "dark");
    r.style.colorScheme = t;
    setTheme(t);
  }

  const set = useCallback((t: Theme) => {
    apply(t);
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {}
  }, []);

  const toggle = useCallback(() => set(document.documentElement.classList.contains("dark") ? "light" : "dark"), [set]);

  return <Ctx.Provider value={{ theme, toggle, set }}>{children}</Ctx.Provider>;
}

export function ThemeToggle({ className, withLabel }: { className?: string; withLabel?: boolean }) {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  const label = dark ? "Mudar para tema claro" : "Mudar para tema escuro";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={cx(withLabel ? "btn-ghost w-full !justify-start" : "btn-icon", className)}
    >
      <span className="relative inline-flex h-[18px] w-[18px] items-center justify-center">
        <Sun size={18} className={cx("absolute transition duration-200", dark ? "scale-0 -rotate-90 opacity-0" : "scale-100 opacity-100")} />
        <Moon size={18} className={cx("absolute transition duration-200", dark ? "scale-100 opacity-100" : "scale-0 rotate-90 opacity-0")} />
      </span>
      {withLabel && <span>{dark ? "Tema claro" : "Tema escuro"}</span>}
    </button>
  );
}
