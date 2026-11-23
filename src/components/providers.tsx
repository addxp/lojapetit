"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
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
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

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
          <p className="text-sm text-stone-600">{dlg?.message}</p>
        </Modal>

        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="pointer-events-auto flex max-w-md items-start gap-2.5 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm shadow-lg"
            >
              {t.kind === "success" ? (
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-brand-600" />
              ) : (
                <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-600" />
              )}
              <span>{t.msg}</span>
            </div>
          ))}
        </div>
      </ConfirmCtx.Provider>
    </ToastCtx.Provider>
  );
}
