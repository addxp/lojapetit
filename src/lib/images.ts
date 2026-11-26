/**
 * Utilitários de imagem:
 *  - compressImage: reduz/recodifica a foto ANTES do upload (fotos de celular têm 3–8 MB).
 *  - thumbUrl: pede ao Supabase uma miniatura (Image Transformations). Se o projeto não tiver
 *    esse recurso (plano gratuito), o <ProductImage> detecta a falha e volta ao original.
 */

const MAX_EDGE = 1280;
const FLAG = "loja-img-transform"; // "0" = transformações indisponíveis

export function transformsEnabled() {
  try {
    return localStorage.getItem(FLAG) !== "0";
  } catch {
    return true;
  }
}
export function disableTransforms() {
  try {
    localStorage.setItem(FLAG, "0");
  } catch {}
}

/** URL pública do Storage → URL de miniatura (render/image). Retorna null se não for do Storage. */
export function thumbUrl(url: string | null | undefined, width: number): string | null {
  if (!url || !transformsEnabled()) return null;
  const marker = "/storage/v1/object/public/";
  const i = url.indexOf(marker);
  if (i < 0) return null;
  const base = url.slice(0, i);
  const rest = url.slice(i + marker.length).split("?")[0];
  return `${base}/storage/v1/render/image/public/${rest}?width=${Math.round(width)}&quality=72&resize=cover`;
}

/** Redimensiona (lado maior ≤ 1280px) e converte para WebP/JPEG. Em caso de falha devolve o original. */
export async function compressImage(file: File): Promise<{ blob: Blob; ext: string; type: string }> {
  const original = { blob: file as Blob, ext: (file.name.split(".").pop() || "jpg").toLowerCase(), type: file.type };
  try {
    if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") return original;

    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return original;
    ctx.fillStyle = "#fff"; // PNG com transparência → fundo branco
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();

    const toBlob = (type: string, q: number) => new Promise<Blob | null>((res) => canvas.toBlob(res, type, q));
    let out = await toBlob("image/webp", 0.82);
    let ext = "webp";
    if (!out || out.type !== "image/webp") {
      out = await toBlob("image/jpeg", 0.84);
      ext = "jpg";
    }
    if (!out || out.size === 0) return original;
    // só usa o resultado se realmente ficou menor
    if (out.size >= file.size && scale === 1) return original;
    return { blob: out, ext, type: out.type };
  } catch {
    return original; // ex.: HEIC não decodificável no navegador
  }
}
