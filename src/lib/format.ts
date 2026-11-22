export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export const brl = (v: number | string | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));

export const num = (v: number | string | null | undefined) =>
  new Intl.NumberFormat("pt-BR").format(Number(v ?? 0));

export function dateBR(d: string | Date) {
  const date = typeof d === "string" ? new Date(d.length === 10 ? d + "T12:00:00" : d) : d;
  return new Intl.DateTimeFormat("pt-BR").format(date);
}

export function dateTimeBR(d: string | Date) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(d)
  );
}

export const r2 = (n: number) => Math.round(n * 100) / 100;

export function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  if (typeof e === "string") return e;
  return "Erro inesperado";
}

export const PAYMENT_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  credito: "Cartão de crédito",
  debito: "Cartão de débito",
  fiado: "Fiado",
};

const SIZE_ORDER = ["PP", "P", "M", "G", "GG", "XG", "EG", "Único"];
export function sizeRank(s: string) {
  const i = SIZE_ORDER.indexOf(s);
  if (i >= 0) return i;
  const n = Number(s);
  return Number.isFinite(n) ? 100 + n : 1000;
}

// ---------- Períodos ----------
export type Preset = "today" | "yesterday" | "7d" | "30d" | "week" | "month" | "custom";

export const PRESET_LABEL: Record<Preset, string> = {
  today: "Hoje",
  yesterday: "Ontem",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  week: "Esta semana",
  month: "Este mês",
  custom: "Personalizado",
};

export type Period = { preset: Preset; from: string; to: string };

export function isoDate(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Retorna intervalo [from, to) em ISO e um rótulo legível. */
export function rangeFor(p: Period) {
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  let from = today;
  let to = tomorrow;
  switch (p.preset) {
    case "today":
      break;
    case "yesterday":
      from = addDays(today, -1);
      to = today;
      break;
    case "7d":
      from = addDays(today, -6);
      break;
    case "30d":
      from = addDays(today, -29);
      break;
    case "week":
      from = addDays(today, -((today.getDay() + 6) % 7));
      break;
    case "month":
      from = new Date(today.getFullYear(), today.getMonth(), 1);
      break;
    case "custom": {
      const f = p.from ? new Date(p.from + "T00:00:00") : today;
      const t = p.to ? new Date(p.to + "T00:00:00") : f;
      from = f;
      to = addDays(t < f ? f : t, 1);
      break;
    }
  }
  const last = addDays(to, -1);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    fromDate: from,
    toDate: to,
    label: `${dateBR(from)} a ${dateBR(last)}`,
  };
}

/** Preenche dias sem venda com zero (para gráficos contínuos). */
export function fillDays<T extends { day: string }>(
  rows: T[],
  fromDate: Date,
  toDate: Date,
  zero: (day: string) => T
): T[] {
  const map = new Map(rows.map((r) => [r.day, r]));
  const out: T[] = [];
  let d = fromDate;
  let guard = 0;
  while (d < toDate && guard++ < 400) {
    const k = isoDate(d);
    out.push(map.get(k) ?? zero(k));
    d = addDays(d, 1);
  }
  return out;
}

export const shortDay = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};
