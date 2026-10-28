"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Bookmark, ExternalLink } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection, useSession } from "@/components/providers";
import { Badge, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { Feedback, useAction } from "@/modules/shared";
import { NEWS_KIND, readNewsPrefs, writeNewsPrefs } from "@/modules/news/labels";
import { createRow } from "@/services/mock/generic";
import { formatCivil, formatInstant } from "@/lib/dates";
import { RealJornalItem } from "@/modules/news/real-intel";

function NoticiaDemo({ params }: PageProps<"/app/jornal/[id]">) {
  const { id } = use(params);
  const { user } = useSession();
  const news = useCollection("news");
  const cases = useCollection("cases");
  const act = useAction("tasks");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- preferência local
    setSaved(readNewsPrefs().saved.includes(id));
  }, [id]);
  const n = news.data?.find((x) => x.id === id);
  if (news.isPending) return <LoadingBlock />;
  if (!n) return <EmptyState title="Notícia não encontrada" text="" action={<Link className="btn btn-secondary" href="/app/jornal">Voltar</Link>} />;
  const related = (cases.data ?? []).filter((k) => n.areas.includes(k.area)).slice(0, 4);
  const toggleSave = () => { const p = readNewsPrefs(); p.saved = saved ? p.saved.filter((x) => x !== id) : [...p.saved, id]; writeNewsPrefs(p); setSaved(!saved); };
  return (
    <Guard area="jornal">
      <article className="mx-auto max-w-[70ch]">
        <PageHeader breadcrumb={[{ href: "/app/jornal", label: "Jornal" }]} title={n.title} description={<><Badge tone={NEWS_KIND[n.kind].tone}>{NEWS_KIND[n.kind].label}</Badge> {n.source} · data original {formatCivil(n.originalDate)} · coletado {formatInstant(n.collectedAt)}</>} />
        <p className="font-serif text-lg leading-relaxed">{n.summary}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a className="btn btn-secondary" href={n.url} target="_blank" rel="noopener noreferrer">Fonte oficial <ExternalLink aria-hidden className="size-4" /></a>
          <button className="btn btn-ghost" onClick={toggleSave} aria-pressed={saved}><Bookmark aria-hidden className="size-4" /> {saved ? "Salvo" : "Salvar"}</button>
        </div>
        <section className="panel mt-6 p-4 text-sm">
          <h2 className="mb-2 font-semibold">Casos possivelmente relacionados (sugestão por área)</h2>
          <p className="mb-2 text-fg-muted">Sugestão precisa de conferência. Uma notícia nunca altera cálculo ou estratégia de um caso automaticamente.</p>
          <ul className="space-y-2">{related.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center gap-2"><Link className="flex-1 underline underline-offset-2" href={`/app/casos/${k.id}`}>{k.title}</Link>
              <button className="btn btn-ghost min-h-8 text-xs" onClick={() => act.run((ctx) => createRow("tasks", { id: `t-news-${n.id}-${k.id}`, title: `Revisar impacto de notícia: ${n.title.slice(0, 60)}`, caseId: k.id, clientId: k.clientId, assigneeId: k.ownerId ?? user!.id, due: "2026-10-30", priority: "baixa", done: false }, ctx, "Tarefa de revisão criada"), "Tarefa de revisão criada.")}>Criar tarefa de revisão</button>
            </li>
          ))}</ul>
          <Feedback error={act.error} notice={act.notice} />
        </section>
      </article>
    </Guard>
  );
}

/** Operação: dados reais coletados de fontes oficiais. Demonstração: amostras. */
export default function NoticiaPage({ params, searchParams }: PageProps<"/app/jornal/[id]">) {
  const { mode } = useSession();
  const { id: realId } = use(params);
  if (mode === "real") return <Guard area="jornal"><div className="mx-auto max-w-3xl"><PageHeader breadcrumb={[{ href: "/app/jornal", label: "Jornal" }]} title="Atualização" /><RealJornalItem id={realId} /></div></Guard>;
  return <NoticiaDemo params={params} searchParams={searchParams} />;
}
