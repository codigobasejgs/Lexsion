"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CheckCircle2, Clock, Compass, PlayCircle, RotateCcw } from "lucide-react";
import { useSession } from "@/components/providers";
import { Badge, PageHeader } from "@/components/ui";
import { readAll } from "@/services/mock/db";
import { BOOKS, TRACKS } from "@/content/academy";
import { TOURS } from "@/tours/tours";
import { progressId, saveProgress, tourState } from "@/tours/progress";
import { useTour } from "@/tours/runner";
import { can } from "@/domain/permissions";
import { HELP_VERSION } from "@/content/help";

export default function AcademiaPage() {
  const { user } = useSession();
  const qc = useQueryClient();
  const tour = useTour();
  // Progresso é do usuário (não do escritório).
  const learning = useQuery({ queryKey: ["learning", user?.id], enabled: !!user, queryFn: async () => (await readAll("learning")).filter((r) => r.userId === user?.id) });
  if (!user) return null;
  const tracks = TRACKS.filter((t) => t.roles.includes(user.role));
  const tours = TOURS.filter((t) => t.area !== "portal" && can(user.role, t.area));
  const lessonDone = (k: string) => !!learning.data?.find((r) => r.id === progressId(user.id, "lesson", k))?.done;
  const markLesson = async (k: string, done: boolean) => {
    await saveProgress({ userId: user.id, kind: "lesson", key: k, role: user.role, version: HELP_VERSION, step: 0, done });
    await qc.invalidateQueries({ queryKey: ["learning"] });
  };

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader title="Academia" description="Trilhas por função, tours guiados e exercícios no ambiente demonstrativo. Seu progresso fica salvo neste dispositivo." />

      <section aria-labelledby="tours-t" className="mb-8">
        <h2 id="tours-t" className="mb-3 flex items-center gap-2 text-lg font-semibold"><Compass aria-hidden className="size-5 text-accent" /> Tours guiados</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tours.map((t) => {
            const st = tourState(learning.data, user.id, t.id, t.version, user.role);
            return (
              <li key={t.id} className="panel flex flex-col gap-2 p-4 text-sm" data-testid={`tour-${t.id}`}>
                <div className="flex items-start gap-2"><p className="flex-1 font-medium">{t.title}</p>
                  {st.status === "concluido" ? <Badge tone="success">Concluído</Badge> : st.status === "pausado" ? <Badge tone="warning">Pausado no passo {st.step + 1}</Badge> : st.status === "desatualizado" ? <Badge tone="info">Atualizado — refazer</Badge> : null}
                </div>
                <p className="text-fg-muted">{t.summary} · {t.steps.length} passos</p>
                <div className="mt-auto flex flex-wrap gap-2">
                  {st.status === "pausado" && <button className="btn btn-primary min-h-9" onClick={() => tour.start(t.id, st.step)}><PlayCircle aria-hidden className="size-4" /> Retomar</button>}
                  <button className={`btn min-h-9 ${st.status === "pausado" ? "btn-ghost" : "btn-primary"}`} onClick={() => tour.start(t.id, 0)}>
                    {st.status === "nao_iniciado" ? <><PlayCircle aria-hidden className="size-4" /> Iniciar tour</> : <><RotateCcw aria-hidden className="size-4" /> Reiniciar</>}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {tracks.map((tr) => {
        const done = tr.lessons.filter((l) => lessonDone(l.key)).length;
        const minutes = tr.lessons.reduce((s, l) => s + l.minutes, 0);
        return (
          <section key={tr.id} aria-labelledby={`tr-${tr.id}`} className="panel mb-5 p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h2 id={`tr-${tr.id}`} className="flex-1 text-lg font-semibold">{tr.title}</h2>
              <Badge icon={false}>{tr.level}</Badge>
              <span className="flex items-center gap-1 text-sm text-fg-muted"><Clock aria-hidden className="size-4" /> {minutes} min</span>
            </div>
            <div className="mb-3 flex items-center gap-2 text-sm">
              <progress className="h-2 flex-1 accent-[var(--brand)]" max={tr.lessons.length} value={done} aria-label={`Progresso: ${done} de ${tr.lessons.length} lições`} />
              <span className="num text-fg-muted">{done}/{tr.lessons.length}</span>
            </div>
            <ol className="divide-y divide-line">
              {tr.lessons.map((l, i) => {
                const ok = lessonDone(l.key);
                return (
                  <li key={l.key} className="flex flex-wrap items-center gap-2 py-3 text-sm">
                    <span className={`num inline-flex size-6 items-center justify-center rounded-full text-xs ${ok ? "bg-success-bg text-success" : "bg-surface-muted"}`}>{ok ? "✓" : i + 1}</span>
                    <span className="min-w-0 flex-1"><span className="block font-medium">{l.title}</span>
                      {l.exercise && <span className="block text-fg-muted">Exercício: {l.exercise.text} <Link className="text-accent underline underline-offset-2" href={l.exercise.href}>Ir para a tela</Link></span>}
                    </span>
                    <span className="text-xs text-fg-muted">{l.minutes} min</span>
                    {l.article && <Link className="btn btn-ghost min-h-9" href={`/app/ajuda/${l.article}`}><BookOpen aria-hidden className="size-4" /> Ler</Link>}
                    {l.tour && can(user.role, TOURS.find((t) => t.id === l.tour)?.area as never) && <button className="btn btn-ghost min-h-9" onClick={() => tour.start(l.tour!)}><Compass aria-hidden className="size-4" /> Tour</button>}
                    <button className="btn btn-secondary min-h-9" aria-pressed={ok} onClick={() => markLesson(l.key, !ok)}>{ok ? <><CheckCircle2 aria-hidden className="size-4" /> Concluída</> : "Marcar como concluída"}</button>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}

      <section className="panel p-4 text-sm" aria-labelledby="livros-t">
        <h2 id="livros-t" className="mb-2 font-semibold">Livros da autora</h2>
        <ul className="space-y-1">{BOOKS.map((b) => <li key={b} className="flex flex-wrap items-center gap-2">“{b}” <Badge tone="warning">Aguardando material da autora</Badge></li>)}</ul>
        <p className="mt-2 text-fg-muted">Nenhum conteúdo foi resumido ou criado sem o material original. Vídeos entram somente quando houver arquivo real.</p>
      </section>
    </div>
  );
}
