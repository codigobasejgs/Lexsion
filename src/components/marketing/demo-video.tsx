"use client";

import { useRef, useState } from "react";
import { Play } from "lucide-react";

// Vídeo demonstrativo (telas reais da LexSion com dados fictícios). Nada é baixado até a pessoa tocar em "Assistir":
// a página continua leve; depois, controles nativos do navegador (pausa, volume, tela cheia).
export function DemoVideo({ src, poster, title, duration }: { src: string; poster: string; title: string; duration: string }) {
  const [on, setOn] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);
  return (
    <div className="relative overflow-hidden rounded-[var(--radius-panel)] border border-[#3a3f49] bg-black shadow-2xl" style={{ aspectRatio: "16 / 9" }}>
      {on ? (
        <video ref={ref} className="size-full" src={src} poster={poster} controls autoPlay playsInline preload="auto" aria-label={title} data-testid="video-demonstracao">
          Seu navegador não reproduz vídeo. <a href={src}>Baixe o vídeo</a>.
        </video>
      ) : (
        <button type="button" onClick={() => setOn(true)} className="group absolute inset-0 size-full" aria-label={`Assistir: ${title} (${duration})`} data-testid="assistir-video">
          {/* eslint-disable-next-line @next/next/no-img-element -- capa estática já no tamanho certo */}
          <img src={poster} alt="" className="size-full object-cover opacity-90 transition group-hover:opacity-100" loading="lazy" decoding="async" />
          <span className="absolute inset-0 grid place-items-center bg-black/25">
            <span className="flex items-center gap-2 rounded-full bg-[#c59a4a] px-5 py-3 text-base font-semibold text-[#090a0d] shadow-lg transition group-hover:bg-[#d6ad5f] group-focus-visible:ring-4 group-focus-visible:ring-[#f6d88c]">
              <Play aria-hidden className="size-5 fill-current" /> Assistir ({duration})
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
