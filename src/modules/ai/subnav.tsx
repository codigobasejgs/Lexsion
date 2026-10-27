"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AiNav() {
  const path = usePathname();
  const items = [["/app/ia/agentes", "Agentes"], ["/app/ia/simulador", "Simulador"], ["/app/ia/execucoes", "Execuções e logs"], ["/app/ia/objecoes", "Objeções"]] as const;
  return (
    <nav aria-label="IA" className="-mx-1 mb-5 flex gap-1 overflow-x-auto border-b border-line px-1">
      {items.map(([h, l]) => <Link key={h} href={h} aria-current={path === h ? "page" : undefined} className={`-mb-px min-h-11 shrink-0 border-b-2 px-3 py-3 text-sm ${path === h ? "border-brand font-medium" : "border-transparent text-fg-muted hover:text-fg"}`}>{l}</Link>)}
    </nav>
  );
}
