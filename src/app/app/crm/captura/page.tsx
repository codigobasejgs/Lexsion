"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { Guard } from "@/components/guard";
import { useInvalidate, useSession } from "@/components/providers";
import { PageHeader, SimulatedBadge } from "@/components/ui";
import { Field, focusFirstError, formToObject } from "@/components/form";
import { crmService } from "@/services/mock/crm-repo";
import { campaignLeadSchema, fieldErrors } from "@/domain/schemas";
import type { Lead } from "@/domain/types";

// Cenário 1 do prompt mestre: formulário BPC fictício com UTM cria lead com atribuição confirmada.
const CAMPAIGNS: { key: "bpc" | "rural" | "sem"; name: string; service: string; utm: Record<string, string> }[] = [
  { key: "bpc", name: "BPC Idoso — Meta (out/2026)", service: "BPC/LOAS", utm: { utm_source: "meta", utm_medium: "paid_social", utm_campaign: "bpc-idoso-out26", utm_content: "video-depoimento" } },
  { key: "rural", name: "Aposentadoria Rural — Google", service: "Aposentadoria rural", utm: { utm_source: "google", utm_medium: "cpc", utm_campaign: "rural-out26", utm_term: "aposentadoria rural" } },
  { key: "sem", name: "Acesso direto (sem UTM)", service: "Atendimento previdenciário", utm: {} },
];

export default function CapturaPage() {
  const { ctx } = useSession();
  const invalidate = useInvalidate();
  const [camp, setCamp] = useState<"bpc" | "rural" | "sem">("bpc");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ lead: Lead; created: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const submission = useRef(crypto.randomUUID());
  const c = CAMPAIGNS.find((x) => x.key === camp)!;
  const hasUtm = Object.keys(c.utm).length > 0;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy || !ctx) return;
    const raw = formToObject(e.currentTarget);
    const parsed = campaignLeadSchema.safeParse({
      ...raw, area: "Previdenciário", service: c.service, campaign: hasUtm ? c.name : undefined,
      landingPage: `/lp/${hasUtm ? c.utm.utm_campaign : "inicio"}`, utm: c.utm,
    });
    if (!parsed.success) {
      const errs = fieldErrors(parsed.error);
      setErrors(errs);
      focusFirstError(errs);
      return;
    }
    setErrors({});
    setBusy(true);
    const r = await crmService.captureFromCampaign(parsed.data, { ...ctx, idempotencyKey: submission.current });
    setBusy(false);
    if (r.ok) {
      setResult(r.data);
      await invalidate("leads", "conversations", "messages", "audit");
    }
  };

  return (
    <Guard area="crm">
      <div className="mx-auto max-w-5xl">
        <PageHeader breadcrumb={[{ href: "/app/crm", label: "Funil comercial" }]} title="Simular formulário de campanha" description="Preenche como um visitante da landing page. Nenhum anúncio, pixel ou mensagem real é acionado." actions={<SimulatedBadge />} />

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className="panel p-4 text-sm">
            <label className="block">
              <span className="label">Visitante chega por</span>
              <select className="field" value={camp} onChange={(e) => { setCamp(e.target.value as typeof camp); setResult(null); submission.current = crypto.randomUUID(); }}>
                {CAMPAIGNS.map((x) => <option key={x.key} value={x.key}>{x.name}</option>)}
              </select>
            </label>
            <p className="mt-3 text-fg-muted">Parâmetros na URL da landing page:</p>
            <p className="mt-1 break-all rounded-[var(--radius-control)] bg-surface-muted p-2 font-mono text-xs">{hasUtm ? `?${new URLSearchParams(c.utm)}` : "(nenhum)"}</p>
            <p className="mt-3 text-fg-muted">{hasUtm ? "Com UTM, a origem fica como vínculo confirmado." : "Sem UTM, a origem fica “não identificada” — o sistema não adivinha."}</p>
            <p className="mt-3 flex items-start gap-2 text-fg-muted"><ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0" /> Nenhum dado de saúde, CPF ou documento é coletado neste formulário nem enviado a plataformas de anúncio.</p>
          </section>

          {/* Pré-visualização da landing page (identidade do escritório, não da plataforma) */}
          <section aria-label="Landing page simulada" className="overflow-hidden rounded-[var(--radius-panel)] border border-line bg-[#fbf8f2] text-[#211a10]">
            <div className="bg-[#15120e] px-5 py-4 text-[#f7f1e6]">
              <p className="text-xs tracking-[0.2em] text-[#d6ae62]">AURORA ADVOCACIA PREVIDENCIÁRIA (FICTÍCIA)</p>
              <h2 className="mt-1 font-serif text-xl">{c.service}: entenda seus direitos</h2>
            </div>
            {result ? (
              <div className="space-y-3 p-5" role="status">
                <p className="flex items-center gap-2 font-medium text-[#1e6b3a]"><CheckCircle2 aria-hidden className="size-5" /> Recebemos seu contato.</p>
                <p className="text-sm">A assistente virtual do escritório vai falar com você pelo WhatsApp (simulado).</p>
                <div className="rounded border border-[#d9cdb8] bg-white p-3 text-sm">
                  <p className="font-medium">{result.created ? "Lead criado no funil" : "Contato já existia: só o último contato foi atualizado"}</p>
                  <p className="text-[#655744]">Origem: {result.lead.lastTouch.origin}{result.lead.lastTouch.campaign ? ` · ${result.lead.lastTouch.campaign}` : ""}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/app/crm/leads/${result.lead.id}`} className="btn btn-primary">Ver lead</Link>
                  {result.lead.conversationId && <Link href={`/app/atendimento/${result.lead.conversationId}`} className="btn border border-[#b7a684] bg-white text-[#211a10]">Ver conversa</Link>}
                </div>
              </div>
            ) : (
              <form onSubmit={submit} noValidate className="space-y-3 p-5 [&_.field]:border-[#d9cdb8] [&_.field]:bg-white [&_.field]:text-[#211a10] [&_.label]:text-[#211a10]">
                <Field name="name" label="Seu nome" error={errors.name}>{(p) => <input {...p} name="name" className="field" autoComplete="name" />}</Field>
                <Field name="phone" label="WhatsApp com DDD" error={errors.phone}>{(p) => <input {...p} name="phone" type="tel" inputMode="tel" className="field" autoComplete="tel" />}</Field>
                <Field name="city" label="Cidade" optional error={errors.city}>{(p) => <input {...p} name="city" className="field" />}</Field>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="consentContact" id="f-consentContact" className="mt-0.5 size-4" aria-describedby={errors.consentContact ? "consent-err" : undefined} />
                  <span>Autorizo o escritório a entrar em contato pelo WhatsApp sobre minha solicitação.</span>
                </label>
                {errors.consentContact && <p id="consent-err" className="text-sm text-[#a3261b]">{errors.consentContact}</p>}
                <button className="btn w-full bg-[#765414] text-white hover:bg-[#5f430f]" disabled={busy}>{busy ? "Enviando…" : "Quero ser atendido"}</button>
                <p className="text-xs text-[#655744]">Seus dados são usados apenas para responder a esta solicitação. Sem promessa de resultado.</p>
              </form>
            )}
          </section>
        </div>
      </div>
    </Guard>
  );
}
