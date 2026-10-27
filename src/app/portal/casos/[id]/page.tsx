"use client";

import Link from "next/link";
import { use } from "react";
import { usePortalData } from "@/modules/portal/data";
import { EmptyState } from "@/components/ui";
import { civilFromInstant, formatCivilLong, formatTime } from "@/lib/dates";

const STEPS = ["Recebemos seu caso", "Reunindo documentos", "Análise da equipe", "Pedido ou processo em andamento", "Conclusão"];
const PHASE_STEP: Record<string, number> = { triagem: 0, documentacao: 1, analise: 2, administrativo: 3, judicial: 3, cumprimento: 4, encerrado: 4 };

export default function PortalCasoPage({ params }: PageProps<"/portal/casos/[id]">) {
  const { id } = use(params);
  const d = usePortalData();
  const k = d.cases.find((x) => x.id === id);
  if (!k) return <EmptyState title="Caso não encontrado" text="Você só vê os casos liberados para você." action={<Link href="/portal" className="btn btn-secondary">Voltar</Link>} />;
  const step = PHASE_STEP[k.phase] ?? 0;
  return (
    <div className="space-y-5">
      <Link href="/portal" className="text-sm text-accent underline underline-offset-2">← Início</Link>
      <h1 className="font-serif text-2xl">{k.title}</h1>
      <ol className="space-y-2" aria-label="Etapas do seu caso">
        {STEPS.map((s, i) => <li key={s} aria-current={i === step ? "step" : undefined} className={`flex items-center gap-3 rounded-[var(--radius-control)] border p-3 ${i === step ? "border-brand bg-selection font-medium" : i < step ? "border-line" : "border-line text-fg-muted"}`}><span className="num inline-flex size-7 items-center justify-center rounded-full border border-line text-sm">{i < step ? "✓" : i + 1}</span>{s}</li>)}
      </ol>
      <section className="panel p-5"><p>{k.portalStatus}</p><p className="mt-3 font-medium">Próximo passo: {k.portalNextStep}</p><p className="mt-3 text-sm text-fg-muted">As etapas são informativas e não garantem resultado nem prazo.</p></section>
      {(k.portalUpdates ?? []).some((u) => u.publishedAt) && (
        <section className="panel p-5" aria-labelledby="hist-t">
          <h2 id="hist-t" className="mb-2 font-medium">Atualizações do escritório</h2>
          <ol className="space-y-2">{(k.portalUpdates ?? []).filter((u) => u.publishedAt).reverse().map((u) => <li key={u.id}><p className="text-sm text-fg-muted">{formatCivilLong(civilFromInstant(u.publishedAt!))}</p><p>{u.text}</p></li>)}</ol>
        </section>
      )}
      {d.events.filter((e) => e.caseId === k.id).map((e) => <section key={e.id} className="panel p-5"><p className="font-medium">{e.title}</p><p className="text-fg-muted">{formatCivilLong(civilFromInstant(e.start))}, às {formatTime(e.start)} · {e.location}</p></section>)}
    </div>
  );
}
