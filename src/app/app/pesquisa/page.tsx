"use client";

import { useMemo } from "react";
import { ExternalLink } from "lucide-react";
import { Guard } from "@/components/guard";
import { Badge, EmptyState, PageHeader, SimulatedBadge } from "@/components/ui";
import { SearchBox, useUrlState } from "@/modules/shared";

// Fontes reais apontam para portais oficiais de pesquisa (abrir em nova aba).
// Resultados "Exemplo fictício" NÃO são precedentes reais e não trazem número de processo.
const OFFICIAL = [
  { name: "Legislação — Planalto", url: "https://www4.planalto.gov.br/legislacao/", kind: "Legislação" },
  { name: "Jurisprudência — STF", url: "https://jurisprudencia.stf.jus.br/", kind: "Jurisprudência" },
  { name: "Jurisprudência — STJ", url: "https://scon.stj.jus.br/SCON/", kind: "Jurisprudência" },
  { name: "Jurisprudência unificada — CJF", url: "https://www.cjf.jus.br/cjf/jurisprudencia", kind: "Jurisprudência" },
  { name: "TNU — Turma Nacional de Uniformização", url: "https://www.cjf.jus.br/cjf/corregedoria-da-justica-federal/turma-nacional-de-uniformizacao", kind: "Jurisprudência" },
  { name: "CNJ DataJud (metadados)", url: "https://datajud-wiki.cnj.jus.br/api-publica/", kind: "Processos" },
];

const SAMPLES = [
  { title: "Exemplo fictício: qualidade de segurado e período de graça", court: "Turma recursal (fictícia)", area: "Previdenciário", date: "2025-03-10", kind: "Acórdão", text: "Trecho ilustrativo sobre manutenção da qualidade de segurado após o fim do vínculo. Não citar como precedente." },
  { title: "Exemplo fictício: prova de atividade rural por início de prova material", court: "Tribunal (fictício)", area: "Previdenciário", date: "2024-11-22", kind: "Acórdão", text: "Trecho ilustrativo sobre documentos que podem compor início de prova material. Não citar como precedente." },
  { title: "Exemplo fictício: miserabilidade no BPC e outros meios de prova", court: "Turma (fictícia)", area: "Previdenciário", date: "2024-08-05", kind: "Súmula (fictícia)", text: "Enunciado ilustrativo para testar a busca. Não citar." },
  { title: "Exemplo fictício: horas extras e cartões de ponto", court: "Vara do trabalho (fictícia)", area: "Trabalhista", date: "2025-01-15", kind: "Sentença", text: "Trecho ilustrativo. Não citar." },
];

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export default function PesquisaPage() {
  const url = useUrlState();
  const q = url.get("q") ?? "";
  const area = url.get("area") ?? "";
  const results = useMemo(() => SAMPLES.filter((s) => (!area || s.area === area) && (!q || norm(`${s.title} ${s.text}`).includes(norm(q)))), [q, area]);
  return (
    <Guard area="pesquisa">
      <div className="mx-auto max-w-[1100px]">
        <PageHeader title="Pesquisa jurídica" description="Pesquise nas fontes oficiais (abrem em nova aba). A busca interna usa apenas exemplos fictícios marcados — nenhum número de precedente é inventado." />
        <section className="panel mb-6 p-4">
          <h2 className="mb-2 font-semibold">Fontes oficiais</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {OFFICIAL.map((o) => (
              <li key={o.url}><a href={o.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-[var(--radius-control)] border border-line p-3 text-sm hover:border-line-strong"><span className="flex-1">{o.name}</span><Badge icon={false}>{o.kind}</Badge><ExternalLink aria-hidden className="size-4 text-fg-muted" /></a></li>
            ))}
          </ul>
        </section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <SearchBox label="Buscar nos exemplos" placeholder="Texto, tema…" value={q} onChange={(v) => url.set("q", v || null)} />
          <select aria-label="Área" className="field min-h-10 w-auto text-sm" value={area} onChange={(e) => url.set("area", e.target.value || null)}><option value="">Todas as áreas</option><option>Previdenciário</option><option>Trabalhista</option></select>
          <SimulatedBadge label="Exemplos fictícios" />
        </div>
        {results.length === 0 ? <EmptyState title="Nenhum exemplo encontrado" text="Use as fontes oficiais acima para pesquisa real." /> : (
          <ul className="space-y-3">
            {results.map((r) => (
              <li key={r.title} className="panel p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2"><p className="flex-1 font-medium">{r.title}</p><Badge tone="warning">Referência fictícia</Badge></div>
                <p className="text-fg-muted">{r.court} · {r.kind} · {r.date.split("-").reverse().join("/")} · {r.area}</p>
                <p className="mt-2 font-serif">“{r.text}”</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Guard>
  );
}
