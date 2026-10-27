"use client";

import Link from "next/link";
import { useState } from "react";
import { BookOpen, GraduationCap, Search } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { GLOSSARY, HELP_ARTICLES } from "@/content/help";

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export default function AjudaPage() {
  const [q, setQ] = useState("");
  const n = norm(q.trim());
  const results = HELP_ARTICLES.filter((a) => !n || norm(`${a.title} ${a.goal} ${a.steps.join(" ")} ${a.buttons.join(" ")}`).includes(n));
  const terms = GLOSSARY.filter(([k, v]) => !n || norm(`${k} ${v}`).includes(n));
  const cats = [...new Set(results.map((a) => a.category))];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Central de ajuda" description="Passo a passo em linguagem simples, com telas reais da versão atual." actions={<Link href="/app/academia" className="btn btn-secondary"><GraduationCap aria-hidden className="size-4" /> Academia e tours</Link>} />
      <label className="relative mb-6 block">
        <span className="sr-only">Buscar na ajuda</span>
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted" />
        <input type="search" className="field pl-9" placeholder="Ex.: pagamento parcial, instalar, assistente" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      {results.length === 0 && terms.length === 0 && <p className="text-fg-muted">Nenhum artigo encontrado para “{q}”.</p>}
      {cats.map((c) => (
        <section key={c} className="mb-6" aria-labelledby={`cat-${norm(c).replace(/\W+/g, "-")}`}>
          <h2 id={`cat-${norm(c).replace(/\W+/g, "-")}`} className="mb-2 text-sm font-semibold uppercase tracking-wider text-accent">{c}</h2>
          <ul className="panel divide-y divide-line">
            {results.filter((a) => a.category === c).map((a) => (
              <li key={a.slug}>
                <Link href={`/app/ajuda/${a.slug}`} className="flex items-start gap-3 p-4 hover:bg-surface-muted/50">
                  <BookOpen aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-muted" />
                  <span><span className="block font-medium">{a.title}</span><span className="block text-sm text-fg-muted">{a.goal}</span></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {terms.length > 0 && (
        <section id="glossario" className="panel p-4" aria-labelledby="glo-t">
          <h2 id="glo-t" className="mb-2 font-semibold">Glossário</h2>
          <dl className="space-y-1.5 text-sm">{terms.map(([k, v]) => <div key={k}><dt className="inline font-medium">{k}: </dt><dd className="inline text-fg-muted">{v}</dd></div>)}</dl>
        </section>
      )}
    </div>
  );
}
