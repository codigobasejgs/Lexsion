"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelp } from "lucide-react";
import { helpForRoute } from "@/content/route-help";
import { useTour } from "@/tours/runner";

/** “Como usar esta tela?” — artigo da tela + tour guiado. */
export function ScreenHelp() {
  const path = usePathname();
  const tour = useTour();
  const h = helpForRoute(path);
  if (!h) return null;
  return (
    <details className="relative">
      <summary className="flex min-h-10 min-w-10 cursor-pointer list-none items-center justify-center rounded-[var(--radius-control)] hover:bg-surface-muted" aria-label="Como usar esta tela?" title="Como usar esta tela?" data-tour="ajuda-contextual">
        <CircleHelp aria-hidden className="size-5" />
      </summary>
      <div className="absolute right-0 top-12 z-40 w-[min(20rem,calc(100vw-2rem))] space-y-2 rounded-[var(--radius-panel)] border border-line bg-surface-raised p-3 text-sm shadow-xl">
        <p className="font-medium">Como usar esta tela?</p>
        <Link className="block rounded px-2 py-2 hover:bg-surface-muted" href={`/app/ajuda/${h.article}`}>Ler: {h.title}</Link>
        {h.tour && <button className="block w-full rounded px-2 py-2 text-left hover:bg-surface-muted" onClick={(e) => { (e.currentTarget.closest("details") as HTMLDetailsElement).open = false; tour.start(h.tour!); }}>Fazer o tour guiado desta tela</button>}
        <Link className="block rounded px-2 py-2 text-fg-muted hover:bg-surface-muted" href="/app/academia">Ver todos os tours e trilhas</Link>
      </div>
    </details>
  );
}
