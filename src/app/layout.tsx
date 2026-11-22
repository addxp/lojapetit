import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const sans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });

const store = process.env.NEXT_PUBLIC_STORE_NAME || "Minha Loja";

export const metadata: Metadata = {
  title: `${store} · Gestão`,
  description: "Sistema de gestão e vendas para loja de roupas",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={sans.variable}>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
