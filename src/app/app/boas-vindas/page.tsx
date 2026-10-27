"use client";

import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { useCollection, useSession } from "@/components/providers";
import { PageHeader } from "@/components/ui";
import { Feedback, useAction } from "@/modules/shared";
import { updateRow } from "@/services/mock/generic";
import { useTour } from "@/tours/runner";
import type { OrgSettings } from "@/domain/types";

// Onboarding do escritório: cadastro inicial está em Configurações; aqui o checklist guiado.
const CHECKLIST = [
  { key: "configurar", label: "Revisar nome, áreas, horários e fuso", href: "/app/configuracoes?aba=escritorio" },
  { key: "identidade", label: "Colocar o logotipo e as cores do escritório", href: "/app/configuracoes/branding" },
  { key: "equipe", label: "Convidar a equipe", href: "/app/equipe" },
  { key: "aplicativo", label: "Instalar o aplicativo do escritório no celular", href: "/app/configuracoes/branding" },
  { key: "cliente", label: "Cadastrar o primeiro cliente", href: "/app/clientes/novo" },
  { key: "atendimento", label: "Revisar o fluxo de atendimento", href: "/app/atendimento" },
  { key: "agenda", label: "Configurar a agenda e feriados", href: "/app/configuracoes?aba=calendario" },
  { key: "financeiro", label: "Conhecer o financeiro", href: "/app/financeiro" },
  { key: "tour", label: "Concluir o tour de primeiro acesso", tour: "primeiro-acesso" },
] as const;

export default function BoasVindasPage() {
  const { org, user } = useSession();
  const settings = useCollection("settings");
  const s = settings.data?.[0];
  const act = useAction("settings");
  const tour = useTour();
  const done = new Set(s?.onboardingDone ?? []);
  const toggle = (k: string) => s && act.run((ctx) => updateRow("settings", s.id, ctx, (x: OrgSettings) => ({ ...x, onboardingDone: x.onboardingDone.includes(k) ? x.onboardingDone.filter((y) => y !== k) : [...x.onboardingDone, k] }), "Checklist de boas-vindas"));
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={`Boas-vindas, ${user?.name.split(" ")[0] ?? ""}`} description={`Primeiros passos do ${org?.name ?? "escritório"}. ${done.size} de ${CHECKLIST.length} concluídos.`} />
      <progress className="mb-5 h-2 w-full accent-[var(--brand)]" max={CHECKLIST.length} value={done.size} aria-label="Progresso do checklist" />
      <ul className="panel divide-y divide-line">
        {CHECKLIST.map((c) => (
          <li key={c.key} className="flex flex-wrap items-center gap-3 p-4 text-sm">
            <button className="shrink-0" role="checkbox" aria-checked={done.has(c.key)} aria-label={c.label} onClick={() => toggle(c.key)}>{done.has(c.key) ? <CheckCircle2 aria-hidden className="size-6 text-success" /> : <Circle aria-hidden className="size-6 text-fg-muted" />}</button>
            <span className={`min-w-0 flex-1 ${done.has(c.key) ? "text-fg-muted line-through" : ""}`}>{c.label}</span>
            {"href" in c ? <Link href={c.href} className="btn btn-secondary min-h-9">Abrir</Link> : <button className="btn btn-secondary min-h-9" onClick={() => tour.start(c.tour)}>Iniciar tour</button>}
          </li>
        ))}
      </ul>
      <Feedback error={act.error} notice={act.notice} />
      <p className="mt-4 text-sm text-fg-muted">Convites de equipe ficam em <Link className="text-accent underline underline-offset-2" href="/app/equipe">Equipe</Link> (simulados nesta fase).</p>
    </div>
  );
}
