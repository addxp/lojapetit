"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, KeyRound, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cx, dateBR, dateTimeBR, errMsg } from "@/lib/format";
import { Empty, Loading, PageHeader, Spinner } from "@/components/ui";
import { useConfirm, useToast } from "@/components/providers";

const supabase = createClient();

type Member = { user_id: string; email: string | null; full_name: string | null; created_at: string };
type Invite = { id: string; code: string; expires_at: string; created_at: string; used_at: string | null; used_by: string | null };

const DAYS = [
  { v: 1, label: "1 dia" },
  { v: 3, label: "3 dias" },
  { v: 7, label: "7 dias" },
  { v: 30, label: "30 dias" },
];

export default function EquipePage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);
  const [creating, setCreating] = useState(false);
  const [fresh, setFresh] = useState("");
  const [copied, setCopied] = useState("");

  const load = useCallback(async () => {
    const [m, i] = await Promise.all([
      supabase.from("profiles").select("user_id,email,full_name,created_at").order("created_at"),
      supabase.from("invite_codes").select("id,code,expires_at,created_at,used_at,used_by").order("created_at", { ascending: false }).limit(50),
    ]);
    const err = m.error ?? i.error;
    if (err) toast.error(errMsg(err));
    setMembers((m.data ?? []) as Member[]);
    setInvites((i.data ?? []) as Invite[]);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function generate() {
    setCreating(true);
    const { data, error } = await supabase.rpc("create_invite_code", { p_days: days });
    setCreating(false);
    if (error) return toast.error(errMsg(error));
    setFresh(data as string);
    toast.success("Código gerado");
    load();
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto e copie manualmente.");
    }
  }

  async function remove(inv: Invite) {
    const ok = await confirm({
      title: "Excluir código",
      message: `O código ${inv.code} deixará de funcionar. Deseja excluir?`,
      confirmLabel: "Excluir",
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("invite_codes").delete().eq("id", inv.id);
    if (error) return toast.error(errMsg(error));
    toast.success("Código excluído");
    if (fresh === inv.code) setFresh("");
    load();
  }

  const nameOf = (id: string | null) => {
    const m = members.find((x) => x.user_id === id);
    return m ? m.full_name || m.email || "—" : "—";
  };

  const link = typeof window !== "undefined" ? `${window.location.origin}/login` : "/login";
  const message = `Você foi convidada para a gestão da loja! Acesse ${link}, toque em "Criar conta" e use o código: ${fresh}`;

  return (
    <>
      <PageHeader title="Equipe" subtitle="Quem tem acesso ao sistema e convites para novas donas" />

      {loading ? (
        <Loading />
      ) : (
        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <KeyRound size={16} className="text-brand-600" /> Convidar nova dona
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              Gere um código e envie para a pessoa. Ao criar a conta com ele, ela passa a ter acesso total ao sistema. Cada código vale para uma única pessoa.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <select className="input !w-36" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Validade">
                {DAYS.map((d) => (
                  <option key={d.v} value={d.v}>
                    Vale por {d.label}
                  </option>
                ))}
              </select>
              <button className="btn-primary" onClick={generate} disabled={creating}>
                {creating ? <Spinner className="!text-white" /> : "Gerar código"}
              </button>
            </div>

            {fresh && (
              <div className="mt-5 rounded-2xl border border-brand-200 bg-brand-50 p-4">
                <div className="text-xs font-medium text-brand-700">Novo código</div>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <span className="font-mono text-2xl font-semibold tracking-widest text-brand-900">{fresh}</span>
                  <button className="btn-secondary btn-sm" onClick={() => copy(fresh, "code")}>
                    {copied === "code" ? <Check size={14} /> : <Copy size={14} />} Copiar código
                  </button>
                  <button className="btn-secondary btn-sm" onClick={() => copy(message, "msg")}>
                    {copied === "msg" ? <Check size={14} /> : <Copy size={14} />} Copiar mensagem pronta
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="card overflow-x-auto">
            <div className="border-b border-stone-100 px-4 py-3 text-sm font-semibold">Códigos de convite</div>
            {invites.length === 0 ? (
              <Empty>Nenhum código gerado ainda.</Empty>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Situação</th>
                    <th>Criado em</th>
                    <th>Validade</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {invites.map((inv) => {
                    const used = !!inv.used_at;
                    const expired = !used && new Date(inv.expires_at) < new Date();
                    return (
                      <tr key={inv.id}>
                        <td className="font-mono tracking-wider">{inv.code}</td>
                        <td>
                          {used ? (
                            <>
                              <span className="badge bg-stone-100 text-stone-600">Usado</span>
                              <div className="mt-0.5 text-xs text-stone-400">
                                por {nameOf(inv.used_by)} em {dateTimeBR(inv.used_at!)}
                              </div>
                            </>
                          ) : expired ? (
                            <span className="badge bg-red-50 text-red-700">Expirado</span>
                          ) : (
                            <span className="badge bg-brand-50 text-brand-700">Disponível</span>
                          )}
                        </td>
                        <td className="text-stone-500">{dateBR(inv.created_at)}</td>
                        <td className="text-stone-500">até {dateBR(inv.expires_at)}</td>
                        <td className="whitespace-nowrap text-right">
                          {!used && (
                            <>
                              {!expired && (
                                <button className="btn-ghost btn-sm" onClick={() => copy(inv.code, inv.id)} aria-label="Copiar código">
                                  {copied === inv.id ? <Check size={14} /> : <Copy size={14} />}
                                </button>
                              )}
                              <button className="btn-ghost btn-sm" onClick={() => remove(inv)} aria-label="Excluir código">
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="card overflow-x-auto">
            <div className="border-b border-stone-100 px-4 py-3 text-sm font-semibold">Donas com acesso</div>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Acesso desde</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.user_id}>
                    <td className="font-medium">
                      {m.full_name || <span className={cx("text-stone-400")}>—</span>}
                    </td>
                    <td className="text-stone-500">{m.email}</td>
                    <td className="text-stone-500">{dateBR(m.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
