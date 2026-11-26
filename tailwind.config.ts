import type { Config } from "tailwindcss";

// Cores dirigidas por variáveis CSS (ver globals.css). O tema claro/escuro
// troca só os valores das variáveis, então todas as classes existentes
// (stone-*, brand-*, card) se adaptam automaticamente.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;
const scale = (prefix: string, steps: number[]) =>
  Object.fromEntries(steps.map((s) => [s, v(`${prefix}-${s}`)]));
const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        stone: scale("stone", steps),
        brand: scale("brand", steps),
        card: v("card"),
        surface: v("surface"),
        sidebar: v("sidebar"),
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "ui-serif", "Georgia", "serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgb(var(--shadow) / .05), 0 6px 20px rgb(var(--shadow) / .05)",
        pop: "0 10px 40px -8px rgb(var(--shadow) / .25)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-up": { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "none" } },
        "slide-in": { from: { transform: "translateX(-100%)" }, to: { transform: "none" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        "fade-in": "fade-in .18s ease-out both",
        "slide-up": "slide-up .22s ease-out both",
        "slide-in": "slide-in .22s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
