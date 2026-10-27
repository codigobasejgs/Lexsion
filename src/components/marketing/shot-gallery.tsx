"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Maximize2 } from "lucide-react";
import { Dialog } from "@/components/ui";
import type { LandingShot } from "@/content/landing-shots";

/* eslint-disable @next/next/no-img-element -- prints estáticos gerados pelo pipeline de captura */

// Print real do app com ampliação acessível e atalho para o módulo na demonstração.
export function ShotCard({ shot, priority }: { shot: LandingShot; priority?: boolean }) {
  const [zoom, setZoom] = useState(false);
  return (
    <figure className="panel overflow-hidden">
      <button type="button" className="group relative block w-full" onClick={() => setZoom(true)} aria-label={`Ampliar print: ${shot.title}`}>
        <picture>
          <source media="(max-width: 640px)" srcSet={`/landing/${shot.id}-mobile.webp`} />
          <img src={`/landing/${shot.id}-desktop.webp`} alt={`Tela real da LexSion: ${shot.title}. ${shot.caption}`} width={1440} height={900} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} decoding="async" className="aspect-[16/10] w-full object-cover object-top" />
        </picture>
        <span aria-hidden className="absolute right-2 top-2 inline-flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"><Maximize2 className="size-3.5" /> Ampliar</span>
      </button>
      <figcaption className="space-y-2 p-4">
        <p className="font-semibold">{shot.title}</p>
        <p className="text-sm text-fg-muted">{shot.caption}</p>
        <Link href={shot.href} className="inline-flex items-center gap-1 text-sm text-accent underline underline-offset-2">Ver na demonstração <ArrowRight aria-hidden className="size-3.5" /></Link>
      </figcaption>
      <Dialog open={zoom} onClose={() => setZoom(false)} title={shot.title} wide>
        {zoom && <img src={`/landing/${shot.id}-desktop.webp`} alt={`Tela real da LexSion ampliada: ${shot.title}`} className="w-full rounded border border-line" />}
        <p className="mt-2 text-sm text-fg-muted">{shot.caption} Dados fictícios de demonstração.</p>
      </Dialog>
    </figure>
  );
}
