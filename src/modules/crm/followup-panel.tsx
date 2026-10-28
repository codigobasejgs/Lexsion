"use client";

import { BellOff, Send } from "lucide-react";
import { Badge } from "@/components/ui";
import { Feedback, useAction, useLive } from "@/modules/shared";
import { nowIso, updateRow } from "@/services/mock/generic";
import { canFollowUp } from "@/domain/followup";
import { formatInstant } from "@/lib/dates";
import type { Lead } from "@/domain/types";

const MAX = 2;
const WINDOW: [number, number] = [9, 18];

/** Follow-up comercial SIMULADO: cada tentativa só registra a decisão. Opt-out é definitivo até nova autorização. */
export function FollowUpPanel({ l }: { l: Lead }) {
  const live = useLive();
  const act = useAction("leads");
  const tries = l.followUps ?? [];
  const decision = canFollowUp({ consentContact: l.consentContact, optOutAt: l.optOutAt, attempts: tries.filter((t) => t.sent).length, maxAttempts: MAX, hour: new Date().getHours(), window: WINDOW, replied: l.stage !== "novo", isClient: !!l.clientId || l.stage === "contratado" }); // ponytail: "respondeu" = saiu de Novo; com WhatsApp real, usar a última mensagem recebida
  const record = () => act.run((ctx) => updateRow("leads", l.id, ctx, (x: Lead) => ({ ...x, followUps: [...(x.followUps ?? []), { at: nowIso(), sent: decision.allowed, note: decision.allowed ? (live ? "Contato feito pela equipe (registro manual)" : "Lembrete simulado registrado (nada foi enviado)") : decision.reason }] }), "Follow-up avaliado"), decision.allowed ? "Lembrete simulado registrado. Nada foi enviado." : `Não enviado: ${"reason" in decision ? decision.reason : ""}`);
  return (
    <section className="panel space-y-2 p-4 text-sm" aria-labelledby="fu-t" data-testid="follow-up">
      <h2 id="fu-t" className="font-semibold">{live ? "Follow-up" : "Follow-up (simulação)"}</h2>
      {l.optOutAt ? <Badge tone="danger">Opt-out em {formatInstant(l.optOutAt)}</Badge> : <Badge tone={decision.allowed ? "success" : "warning"}>{decision.allowed ? "Pode receber lembrete" : "Lembrete bloqueado"}</Badge>}
      {"reason" in decision && <p className="text-fg-muted">{decision.reason}</p>}
      <p className="text-xs text-fg-muted">Regras fixas: consentimento, opt-out, {WINDOW[0]}h–{WINDOW[1]}h, até {MAX} tentativas, para ao virar cliente. Linguagem sem pressão nem promessa de resultado.</p>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-secondary min-h-9" onClick={record}><Send aria-hidden className="size-4" /> {live ? "Registrar contato feito" : "Simular follow-up"}</button>
        {!l.optOutAt && <button className="btn btn-ghost min-h-9" onClick={() => act.run((ctx) => updateRow("leads", l.id, ctx, (x: Lead) => ({ ...x, optOutAt: nowIso(), consentContact: false }), "Opt-out registrado"), "Opt-out registrado: nenhum follow-up será simulado.")}><BellOff aria-hidden className="size-4" /> Registrar opt-out</button>}
      </div>
      {tries.length > 0 && <ol className="space-y-1 text-xs text-fg-muted">{tries.map((t, i) => <li key={i}>{formatInstant(t.at)} · {t.sent ? "registrado" : "bloqueado"} — {t.note}</li>)}</ol>}
      <Feedback error={act.error} notice={act.notice} />
    </section>
  );
}
