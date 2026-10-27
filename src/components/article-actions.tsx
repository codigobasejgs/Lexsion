"use client";

import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";
import { ROUTE_HELP } from "@/content/route-help";
import { useTour } from "@/tours/runner";

/** Botões do artigo: abrir a tela da funcionalidade e iniciar o tour correspondente. */
export function ArticleActions({ slug }: { slug: string }) {
  const tour = useTour();
  const r = ROUTE_HELP.find((x) => x.article === slug);
  if (!r) return null;
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      <Link className="btn btn-secondary" href={r.prefix}>Abrir esta funcionalidade <ArrowRight aria-hidden className="size-4" /></Link>
      {r.tour && <button className="btn btn-primary" onClick={() => tour.start(r.tour!)}><Compass aria-hidden className="size-4" /> Iniciar tour guiado</button>}
    </div>
  );
}
