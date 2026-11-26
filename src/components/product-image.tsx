"use client";

import { useEffect, useRef, useState } from "react";
import { ImageIcon } from "lucide-react";
import { cx } from "@/lib/format";
import { disableTransforms, thumbUrl } from "@/lib/images";

/**
 * Imagem de produto otimizada:
 *  - miniatura sob medida (quando o Supabase suporta) em vez da foto original;
 *  - lazy-loading + decode assíncrono (só baixa o que está na tela);
 *  - skeleton enquanto carrega e fade-in suave;
 *  - fallback automático para a imagem original / ícone.
 */
export function ProductImage({
  src,
  alt = "",
  width = 400,
  priority = false,
  className,
}: {
  src: string | null | undefined;
  alt?: string;
  /** largura de exibição aproximada em px (a miniatura pede 2x para telas retina) */
  width?: number;
  priority?: boolean;
  className?: string;
}) {
  const thumb = thumbUrl(src, width * 2);
  const [url, setUrl] = useState<string | null>(thumb ?? src ?? null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setUrl(thumbUrl(src, width * 2) ?? src ?? null);
    setLoaded(false);
    setFailed(false);
  }, [src, width]);

  // imagem já em cache pode ter carregado antes da hidratação
  useEffect(() => {
    if (ref.current?.complete && ref.current.naturalWidth > 0) setLoaded(true);
  }, [url]);

  function onError() {
    if (url && url !== src && src) {
      disableTransforms(); // plano sem transformações → usa o original daqui em diante
      setUrl(src);
      return;
    }
    setFailed(true);
  }

  if (!url || failed) {
    return (
      <div className={cx("flex h-full w-full items-center justify-center bg-stone-100 text-stone-300", className)}>
        <ImageIcon size={26} />
      </div>
    );
  }

  return (
    <div className={cx("relative h-full w-full overflow-hidden bg-stone-100", className)}>
      {!loaded && <div className="skeleton absolute inset-0 !rounded-none" aria-hidden />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={ref}
        src={url}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        onLoad={() => setLoaded(true)}
        onError={onError}
        className={cx("h-full w-full object-cover transition-opacity duration-300", loaded ? "opacity-100" : "opacity-0")}
      />
    </div>
  );
}
