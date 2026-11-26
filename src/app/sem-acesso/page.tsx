"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui";
import { ThemeToggle } from "@/components/theme";
import { errMsg } from "@/lib/format";

const STORE = process.env.NEXT_PUBLIC_STORE_NAME || "Minha Loja";

export default function SemAcessoPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function redeem(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!code.trim()) return setError("Informe o código de convite.");
    setLoading(true);
    const { error } = await createClient().rpc("redeem_invite", { p_code: code.trim() });
    if (error) {
      setError(errMsg(error));
      setLoading(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-stone-50 px-5">
      <div className="absolute right-4 top-4"><ThemeToggle /></div>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-lg font-semibold text-white">
            {STORE.charAt(0).toUpperCase()}
          </div>
          <h1 className="font-display text-2xl tracking-tight text-stone-900">Falta só o convite</h1>
          <p className="mt-2 text-sm text-stone-500">
            Sua conta ainda não tem acesso ao sistema. Informe o código de convite que você recebeu.
          </p>
        </div>

        <form onSubmit={redeem} className="card space-y-4 p-6">
          <div>
            <label className="label">Código de convite</label>
            <div className="relative">
              <KeyRound size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                className="input !pl-10 font-mono uppercase tracking-widest"
                placeholder="XXXX-XXXX-XXXX"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
            </div>
          </div>
          {error && <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>}
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? <Spinner className="!text-white" /> : "Ativar acesso"}
          </button>
        </form>

        <button onClick={signOut} className="btn-ghost mx-auto mt-4 flex">
          <LogOut size={16} /> Sair
        </button>
      </div>
    </div>
  );
}
