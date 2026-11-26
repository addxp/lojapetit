"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { Modal } from "@/components/ui";

type ToastItem = { id: number; kind: "success" | "error"; msg: string };
type ConfirmOpts = { title: string; message: string; confirmLabel?: string; danger?: boolean };

const ToastCtx = createContext<{ success: (m: string) => void; error: (m: string) => void }>({
  success: () => {},
  error: () => {},
});
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);

export const useToast = () => useContext(ToastCtx);
export const useConfirm = () => useContext(ConfirmCtx);

export function Providers({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const push = useCallback((kind: "success" | "error", msg: string) => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, kind, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 7000 : 4500);
  }, []);

  const dismiss = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));

  const api = useMemo(
    () => ({ success: (m: string) => push("success", m), error: (m: string) => push("error", m) }),
    [push]
  );

  const [dlg, setDlg] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const confirm = useCallback(
    (o: ConfirmOpts) => new Promise<boolean>((resolve) => setDlg({ ...o, resolve })),
    []
  );
  const close = (v: boolean) => {
    dlg?.resolve(v);
    setDlg(null);
  };

  return (
    <ToastCtx.Provider value={api}>
      <ConfirmCtx.Provider value={confirm}>
        {children}

        <Modal
          open={!!dlg}
          title={dlg?.title ?? ""}
          onClose={() => close(false)}
          footer={
            <>
              <button className="btn-secondary" onClick={() => close(false)}>
                Voltar
              </button>
              <button className={dlg?.danger ? "btn-danger" : "btn-primary"} onClick={() => close(true)}>
                {dlg?.confirmLabel ?? "Confirmar"}
              </button>
            </>
          }
        >
          <p className="text-sm leading-relaxed text-stone-600">{dlg?.message}</p>
        </Modal>

        <div
          className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[110] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:px-6"
          aria-live="polite"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              role={t.kind === "error" ? "alert" : "status"}
              className="pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-3 rounded-xl border border-stone-200 bg-card py-3 pl-4 pr-2 text-sm text-stone-800 shadow-pop"
            >
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                  t.kind === "success" ? "bg-brand-100 text-brand-700" : "bg-red-50 text-red-600"
                }`}
              >
                {t.kind === "success" ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
              </span>
              <span className="flex-1 py-0.5 leading-snug">{t.msg}</span>
              <button onClick={() => dismiss(t.id)} className="btn-icon h-7 w-7" aria-label="Fechar aviso">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      </ConfirmCtx.Provider>
    </ToastCtx.Provider>
  );
}
