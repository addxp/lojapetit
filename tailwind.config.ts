import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f2f7f3",
          100: "#dfece3",
          200: "#bfd9c7",
          300: "#94bfa2",
          400: "#66a07c",
          500: "#468461",
          600: "#356a4d",
          700: "#2c5540",
          800: "#264535",
          900: "#203a2d",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(28,25,23,.04), 0 6px 20px rgba(28,25,23,.045)",
      },
    },
  },
  plugins: [],
};

export default config;
