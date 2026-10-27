import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { HELP_ARTICLES, shotPath } from "@/content/help";
import { PageHeader } from "@/components/ui";
import { ArticleActions } from "@/components/article-actions";

export function generateStaticParams() {
  return HELP_ARTICLES.map((a) => ({ slug: a.slug }));
}

// Só exibe prints que existem de fato (gerados por `pnpm capture:help`); nunca imagem quebrada.
const exists = (p: string) => fs.existsSync(path.join(process.cwd(), "public", p));

export default async function ArtigoPage({ params }: PageProps<"/app/ajuda/[slug]">) {
  const { slug } = await params;
  const a = HELP_ARTICLES.find((x) => x.slug === slug);
  if (!a) notFound();
  const shots = a.shots.map((s) => ({ ...s, src: shotPath(a.slug, s) })).filter((s) => exists(s.src));
  const related = a.related.map((r) => HELP_ARTICLES.find((x) => x.slug === r)).filter((x) => !!x);
  return (
    <article className="mx-auto max-w-[75ch]">
      <PageHeader breadcrumb={[{ href: "/app/ajuda", label: "Central de ajuda" }]} title={a.title} description={a.goal} />
      <dl className="mb-6 grid gap-2 text-sm sm:grid-cols-2">
        <div><dt className="font-medium">Quem pode fazer</dt><dd className="text-fg-muted">{a.who}</dd></div>
        <div><dt className="font-medium">Antes de começar</dt><dd className="text-fg-muted">{a.prerequisites}</dd></div>
      </dl>
      <ArticleActions slug={a.slug} />
      <h2 className="mb-2 text-lg font-semibold">Passo a passo</h2>
      <ol className="mb-6 list-decimal space-y-4 pl-5">
        {a.steps.map((s, i) => (
          <li key={s} id={`passo-${i + 1}`}>
            {s}
            {shots.filter((x) => x.step === i + 1).map((x) => (
              <figure key={x.src} className={`mt-2 overflow-hidden rounded-[var(--radius-control)] border border-line ${x.mobile ? "max-w-[260px]" : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- print estático já otimizado pelo script de captura */}
                <img src={x.src} alt={x.caption} loading="lazy" className="w-full" />
                <figcaption className="bg-surface-muted px-3 py-1.5 text-xs text-fg-muted">{x.caption}{x.mobile ? " (celular)" : ""} · tela real da versão {a.version}, dados fictícios</figcaption>
              </figure>
            ))}
          </li>
        ))}
      </ol>
      <div className="mb-6 flex gap-2 rounded-[var(--radius-control)] border border-success/30 bg-success-bg p-3 text-success"><CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0" /><p><strong>Resultado esperado:</strong> {a.expected}</p></div>
      <h2 className="mb-2 text-lg font-semibold">Erros frequentes</h2>
      <dl className="mb-6 space-y-3">{a.errors.map((e) => <div key={e.problem}><dt className="font-medium">{e.problem}</dt><dd className="text-fg-muted">{e.fix}</dd></div>)}</dl>
      {related.length > 0 && (
        <>
          <h2 className="mb-2 text-lg font-semibold">Artigos relacionados</h2>
          <ul className="mb-6 list-disc pl-5">{related.map((r) => <li key={r.slug}><Link className="text-accent underline underline-offset-2" href={`/app/ajuda/${r.slug}`}>{r.title}</Link></li>)}</ul>
        </>
      )}
      <p className="text-xs text-fg-muted">Versão {a.version} · revisado em {a.reviewedOn}{shots.length < a.shots.length ? " · algumas capturas ainda não foram geradas nesta instalação (pnpm capture:help)" : ""}</p>
      <Link href="/app/ajuda" className="btn btn-secondary mt-6">Voltar à central</Link>
    </article>
  );
}
