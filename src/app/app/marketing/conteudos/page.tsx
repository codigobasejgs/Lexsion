"use client";

import { useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection, useSession } from "@/components/providers";
import { Badge, EmptyState, LoadingBlock, PageHeader, SimulatedBadge } from "@/components/ui";
import { Feedback, useAction } from "@/modules/shared";
import { MarketingNav } from "@/modules/marketing/subnav";
import { createRow, updateRow } from "@/services/mock/generic";
import { canApprove } from "@/domain/permissions";
import { formatCivil } from "@/lib/dates";
import type { ContentPiece } from "@/domain/types";

const COLS: ContentPiece["status"][] = ["rascunho", "revisao", "aprovado", "agendado"];
const LBL = { rascunho: "Rascunho", revisao: "Revisão", aprovado: "Aprovado", agendado: "Agendado" };

export default function ConteudosPage() {
  const { user } = useSession();
  const items = useCollection("contents");
  const act = useAction("contents");
  const [title, setTitle] = useState("");
  const next = (c: ContentPiece): ContentPiece["status"] | null => (c.status === "rascunho" ? "revisao" : c.status === "revisao" && user && canApprove(user.role) ? "aprovado" : c.status === "aprovado" ? "agendado" : null);
  return (
    <Guard area="marketing">
      <div className="mx-auto max-w-[1300px]">
        <PageHeader title="Conteúdos" description="Rascunho → revisão → aprovado → agendado. Sugestões da IA são demonstração e passam por revisão humana. Nada é publicado de verdade." />
        <MarketingNav />
        <div className="mb-4 flex flex-wrap gap-2">
          <input className="field max-w-sm" aria-label="Título do conteúdo" placeholder="Título do conteúdo" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button className="btn btn-secondary" disabled={!title.trim()} onClick={async () => { if (await act.run((ctx) => createRow("contents", { title: title.trim(), channel: "Instagram", body: "", status: "rascunho", aiSuggested: false }, ctx, "Conteúdo criado"))) setTitle(""); }}><Plus aria-hidden className="size-4" /> Criar</button>
          <button className="btn btn-ghost" disabled={!title.trim()} onClick={async () => { if (await act.run((ctx) => createRow("contents", { title: title.trim(), channel: "Instagram", body: `Texto sugerido (demonstração) sobre “${title.trim()}”: linguagem simples, sem promessa de resultado, com convite para tirar dúvidas.`, status: "rascunho", aiSuggested: true }, ctx, "Conteúdo sugerido"))) setTitle(""); }}><Sparkles aria-hidden className="size-4" /> Sugerir com IA</button>
          <SimulatedBadge />
        </div>
        <Feedback error={act.error} />
        {items.isPending ? <LoadingBlock /> : !items.data?.length ? <EmptyState title="Sem conteúdos" text="" /> : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {COLS.map((s) => (
              <section key={s} aria-label={LBL[s]} className="rounded-[var(--radius-panel)] border border-line bg-surface p-2">
                <h2 className="px-1 py-1 text-sm font-semibold">{LBL[s]}</h2>
                <ul className="space-y-2">
                  {items.data.filter((c) => c.status === s).map((c) => {
                    const n = next(c);
                    return (
                      <li key={c.id} className="rounded border border-line bg-surface-raised p-2 text-sm">
                        <p className="font-medium">{c.title}</p>
                        <p className="text-xs text-fg-muted">{c.channel}{c.scheduledFor ? ` · ${formatCivil(c.scheduledFor)}` : ""}</p>
                        {c.aiSuggested && <Badge tone="ai">Sugerido por IA</Badge>}
                        {c.body && <p className="mt-1 text-xs">{c.body}</p>}
                        {n && <button className="btn btn-ghost mt-1 min-h-8 text-xs" onClick={() => act.run((ctx) => updateRow("contents", c.id, ctx, (x: ContentPiece) => ({ ...x, status: n, scheduledFor: n === "agendado" ? "2026-11-05" : x.scheduledFor }), `Conteúdo → ${n}`))}>Mover para {LBL[n]}</button>}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </Guard>
  );
}
