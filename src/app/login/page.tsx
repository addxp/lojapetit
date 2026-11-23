"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  PackageCheck,
  ShoppingBag,
  User,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui";
import { cx, errMsg } from "@/lib/format";

const STORE = process.env.NEXT_PUBLIC_STORE_NAME || "Minha Loja";

type Mode = "login" | "signup";

const FEATURES = [
  { icon: ShoppingBag, title: "Vendas rápidas", text: "Do carrinho ao pagamento em poucos toques." },
  { icon: PackageCheck, title: "Estoque por tamanho e cor", text: "Sempre sabendo o que ainda tem na arara." },
  { icon: BarChart3, title: "Lucro de verdade", text: "Relatórios que separam faturamento de lucro." },
];

function IconInput({
  icon: Icon,
  right,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { icon: LucideIcon; right?: React.ReactNode }) {
  return (
    <div className="relative">
      <Icon size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
      <input {...props} className={cx("input !pl-10", !!right && "!pr-11", className)} />
      {!!right && <div className="absolute right-1.5 top-1/2 -translate-y-1/2">{right}</div>}
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  function switchMode(m: Mode) {
    setMode(m);
    setError("");
    setNotice("");
    setConfirm("");
    setShowPw(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    const supabase = createClient();

    if (mode === "login") {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setError(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message);
        setLoading(false);
        return;
      }
      router.replace("/");
      router.refresh();
      return;
    }

    // ---- cadastro com código de convite ----
    const invite = code.trim();
    if (!name.trim()) return setError("Informe seu nome.");
    if (!invite) return setError("Informe o código de convite que você recebeu.");
    if (password.length < 8) return setError("A senha deve ter pelo menos 8 caracteres.");
    if (password !== confirm) return setError("As senhas não conferem.");

    setLoading(true);
    const check = await supabase.rpc("check_invite_code", { p_code: invite });
    if (check.error) {
      setError(errMsg(check.error));
      setLoading(false);
      return;
    }
    if (!check.data) {
      setError("Código de convite inválido, já utilizado ou expirado.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: name.trim(), invite_code: invite } },
    });
    if (error) {
      const m = error.message;
      setError(
        /already registered/i.test(m)
          ? "Este e-mail já está cadastrado. Entre com sua senha."
          : /database error/i.test(m)
          ? "Não foi possível criar a conta. Confira o código de convite."
          : m
      );
      setLoading(false);
      return;
    }
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setError("Este e-mail já está cadastrado. Entre com sua senha.");
      setLoading(false);
      return;
    }
    if (data.session) {
      router.replace("/");
      router.refresh();
      return;
    }
    // confirmação de e-mail ativada no Supabase
    setLoading(false);
    setMode("login");
    setPassword("");
    setConfirm("");
    setCode("");
    setNotice("Conta criada! Confirme seu e-mail pelo link que enviamos e depois entre.");
  }

  const initial = STORE.charAt(0).toUpperCase();

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* ---------- painel da marca ---------- */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-brand-800 p-12 text-brand-50 lg:flex xl:p-16">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -right-28 -top-28 h-[26rem] w-[26rem] rounded-full border border-white/10" />
          <div className="absolute -right-12 -top-12 h-[19rem] w-[19rem] rounded-full border border-white/10" />
          <div className="absolute -bottom-40 -left-24 h-[30rem] w-[30rem] rounded-full bg-brand-700/60" />
          <div className="absolute bottom-32 left-32 h-44 w-44 rounded-full bg-brand-500/30 blur-3xl" />
        </div>

        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-base font-semibold ring-1 ring-white/20">
            {initial}
          </div>
          <span className="text-lg font-medium tracking-tight">{STORE}</span>
        </div>

        <div className="relative max-w-lg">
          <h1 className="font-display text-4xl leading-[1.1] tracking-tight xl:text-5xl">
            Cada peça, cada venda, <span className="italic text-brand-200">sob controle.</span>
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-brand-100/80">
            Gestão simples e elegante para a sua loja: vendas, estoque, financeiro e relatórios em um só lugar.
          </p>

          <ul className="mt-10 space-y-5">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <Icon size={18} />
                </span>
                <div>
                  <div className="text-sm font-medium">{title}</div>
                  <div className="text-sm text-brand-100/70">{text}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative text-xs text-brand-100/50">© {new Date().getFullYear()} {STORE}</div>
      </aside>

      {/* ---------- formulário ---------- */}
      <main className="flex items-center justify-center bg-stone-50 px-5 py-10 sm:px-8">
        <div className="w-full max-w-[26rem]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-base font-semibold text-white">
              {initial}
            </div>
            <span className="text-lg font-semibold tracking-tight text-stone-900">{STORE}</span>
          </div>

          <h2 className="font-display text-3xl tracking-tight text-stone-900">
            {mode === "login" ? "Bem-vinda de volta" : "Criar sua conta"}
          </h2>
          <p className="mt-2 text-sm text-stone-500">
            {mode === "login"
              ? "Entre para acessar o sistema da loja."
              : "Use o código de convite que você recebeu para se tornar dona da loja."}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-stone-200/60 p-1">
            {(["login", "signup"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={cx(
                  "rounded-lg py-2 text-sm font-medium transition",
                  mode === m ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"
                )}
              >
                {m === "login" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div>
                <label className="label">Seu nome</label>
                <IconInput
                  icon={User}
                  autoComplete="name"
                  placeholder="Como devemos te chamar"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="label">E-mail</label>
              <IconInput
                icon={Mail}
                type="email"
                required
                autoComplete="email"
                placeholder="voce@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="label">Senha</label>
              <IconInput
                icon={Lock}
                type={showPw ? "text" : "password"}
                required
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder={mode === "login" ? "Sua senha" : "Mínimo de 8 caracteres"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                right={
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="rounded-lg p-2 text-stone-400 hover:text-stone-600"
                    aria-label={showPw ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                }
              />
            </div>

            {mode === "signup" && (
              <>
                <div>
                  <label className="label">Confirmar senha</label>
                  <IconInput
                    icon={Lock}
                    type={showPw ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    placeholder="Repita a senha"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </div>

                <div>
                  <label className="label">Código de convite</label>
                  <IconInput
                    icon={KeyRound}
                    required
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="XXXX-XXXX-XXXX"
                    className="font-mono uppercase tracking-widest"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                  />
                </div>
              </>
            )}

            {notice && <p className="rounded-xl bg-brand-50 px-3.5 py-2.5 text-sm text-brand-800">{notice}</p>}
            {error && <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>}

            <button className="btn-primary w-full !py-3" disabled={loading}>
              {loading ? <Spinner className="!text-white" /> : mode === "login" ? "Entrar" : "Criar conta"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-stone-500">
            {mode === "login" ? (
              <>
                Recebeu um código de convite?{" "}
                <button type="button" onClick={() => switchMode("signup")} className="font-medium text-brand-700 hover:underline">
                  Criar conta
                </button>
              </>
            ) : (
              <>
                Já tem conta?{" "}
                <button type="button" onClick={() => switchMode("login")} className="font-medium text-brand-700 hover:underline">
                  Entrar
                </button>
              </>
            )}
          </p>
        </div>
      </main>
    </div>
  );
}
