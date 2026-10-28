"use client";

import Link from "next/link";
import { use, useState } from "react";
import { ArrowRightLeft, Briefcase, CheckCircle2, Link2, MessagesSquare, UserPlus } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection, useInvalidate, useSession } from "@/components/providers";
import { Badge, Dialog, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { ClientForm } from "@/modules/clients/client-form";
import { CaseForm } from "@/modules/cases/case-form";
import { MoveStageDialog } from "@/modules/crm/lead-dialogs";
import { TriagePanel } from "@/modules/crm/triage-panel";
import { FollowUpPanel } from "@/modules/crm/followup-panel";
import { crmService } from "@/services/mock/crm-repo";
import { formatPhone, STAGE_LABEL, STAGES } from "@/domain/crm";
import { formatInstant } from "@/lib/dates";
import { people as users } from "@/components/people";
import type { AttributionTouch } from "@/domain/types";

const EVIDENCE = { confirmada: { label: "Vínculo confirmado (UTM/clique)", tone: "success" }, declarada: { label: "Declarada pelo contato", tone: "info" }, nao_identificada: { label: "Sem evidência", tone: "neutral" } } as const;

export default function LeadPage({ params }: PageProps<"/app/crm/leads/[id]">) {
  const { id } = use(params);
  const { ctx, org } = useSession();
  const invalidate = useInvalidate();
  const leads = useCollection("leads");
  const clients = useCollection("clients");
  const cases = useCollection("cases");
  const [moving, setMoving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [openingCase, setOpeningCase] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const l = leads.data?.find((x) => x.id === id);
  if (leads.isPending) return <LoadingBlock rows={5} />;
  if (!l) return <EmptyState title="Lead não encontrado" text="Ele pode pertencer a outro escritório." action={<Link href="/app/crm" className="btn btn-secondary">Voltar ao funil</Link>} />;

  const client = clients.data?.find((c) => c.id === l.clientId);
  const clientCases = (cases.data ?? []).filter((k) => k.clientId === l.clientId);
  const team = users.filter((u) => u.organizationId === org?.id && u.role !== "cliente");
  const stageIdx = STAGES.findIndex((s) => s.key === l.stage);

  const linkExisting = async (clientId: string) => {
    if (!ctx) return;
    const r = await crmService.convert(l.id, { existingClientId: clientId }, ctx);
    if (!r.ok) return setError(r.error.message);
    await invalidate("leads", "clients", "conversations", "audit");
    setConverting(false);
  };

  return (
    <Guard area="crm">
      <div className="mx-auto max-w-[1200px]">
        <PageHeader
          breadcrumb={[{ href: "/app/crm", label: "Funil comercial" }]}
          title={l.name}
          description={<>{l.area} · {l.service} · {formatPhone(l.phone)}</>}
          actions={<>
            <button className="btn btn-secondary" onClick={() => setMoving(true)}><ArrowRightLeft aria-hidden className="size-4" /> Mover etapa</button>
            {!l.clientId && <button className="btn btn-primary" onClick={() => setConverting(true)} data-tour="converter-lead"><UserPlus aria-hidden className="size-4" /> Converter em cliente</button>}
          </>}
        />

        {/* Etapas: progresso visível (texto, não só cor) */}
        <ol aria-label="Etapa no funil" className="mb-6 flex flex-wrap gap-1">
          {STAGES.filter((s) => s.key !== "perdido").map((s, i) => (
            <li key={s.key} aria-current={s.key === l.stage ? "step" : undefined} className={`shrink-0 rounded-full border px-3 py-1 text-xs ${s.key === l.stage ? "border-brand bg-selection font-semibold text-fg" : i < stageIdx && l.stage !== "perdido" ? "border-line text-fg" : "border-line text-fg-muted"}`}>
              {i < stageIdx && l.stage !== "perdido" ? "✓ " : ""}{s.label}
            </li>
          ))}
          {l.stage === "perdido" && <li aria-current="step" className="shrink-0 rounded-full border border-danger/40 bg-danger-bg px-3 py-1 text-xs font-semibold text-danger">Perdido · {l.lostReason}</li>}
        </ol>

        {error && <p role="alert" className="mb-4 text-sm text-danger">{error}</p>}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            {client ? (
              <section className="panel p-4" aria-labelledby="cli-t">
                <h2 id="cli-t" className="mb-2 flex items-center gap-2 font-semibold"><CheckCircle2 aria-hidden className="size-4 text-success" /> Convertido em cliente</h2>
                <p className="text-sm">
                  <Link href={`/app/clientes/${client.id}`} className="font-medium text-accent underline underline-offset-2">{client.name}</Link>
                  <span className="text-fg-muted"> · o lead e sua origem continuam registrados.</span>
                </p>
                <h3 className="mb-2 mt-4 text-sm font-medium">Casos do cliente</h3>
                {clientCases.length ? (
                  <ul className="space-y-1 text-sm">{clientCases.map((k) => <li key={k.id} className="flex items-center gap-2"><Briefcase aria-hidden className="size-4 text-fg-muted" />{k.title} <Badge icon={false}>{k.area}</Badge></li>)}</ul>
                ) : <p className="text-sm text-fg-muted">Nenhum caso aberto ainda.</p>}
                <button className="btn btn-primary mt-3" onClick={() => setOpeningCase(true)} data-tour="abrir-caso"><Briefcase aria-hidden className="size-4" /> Abrir caso</button>
              </section>
            ) : (
              <section className="panel p-4 text-sm">
                <p>Ainda não é cliente. Ao converter, o sistema verifica se a pessoa já está cadastrada para não duplicar.</p>
              </section>
            )}

            {!l.clientId && <TriagePanel key={l.id} lead={l} />}

            <section className="panel p-4" aria-labelledby="att-t">
              <h2 id="att-t" className="mb-3 font-semibold">Origem (atribuição)</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <Touch title="Primeiro contato" t={l.firstTouch} />
                <Touch title="Último contato" t={l.lastTouch} />
              </div>
              <p className="mt-3 text-xs text-fg-muted">Sem UTM ou identificador de clique, a origem não é inferida pelo telefone.</p>
            </section>

            <section className="panel p-4" aria-labelledby="hist-t">
              <h2 id="hist-t" className="mb-3 font-semibold">Histórico</h2>
              <ol className="relative space-y-3 border-l border-line pl-5 text-sm">
                {[...l.history].reverse().map((h, i) => (
                  <li key={i} className="relative">
                    <span aria-hidden className="absolute -left-[25px] top-1.5 size-2.5 rounded-full border-2 border-canvas bg-brand" />
                    <p className="num text-xs text-fg-muted">{formatInstant(h.at)} · {users.find((u) => u.id === h.actorId)?.name ?? "Sistema"}</p>
                    <p>
                      {h.from ? `${STAGE_LABEL[h.from]} → ${STAGE_LABEL[h.to]}` : i === l.history.length - 1 ? "Lead criado" : h.note?.startsWith("envio:") ? "Novo envio pela campanha" : "Registro"}
                      {h.note && !h.note.startsWith("envio:") ? ` · ${h.note}` : ""}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="panel space-y-3 p-4 text-sm">
              <label className="block">
                <span className="label">Responsável</span>
                <select className="field" value={l.ownerId ?? ""} onChange={async (e) => { if (!ctx) return; await crmService.update(l.id, { ownerId: e.target.value || undefined }, ctx); await invalidate("leads"); }}>
                  <option value="">Sem responsável</option>
                  {team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </label>
              <NextAction key={l.nextAction} value={l.nextAction ?? ""} onSave={async (v) => { if (!ctx) return; await crmService.update(l.id, { nextAction: v }, ctx); await invalidate("leads"); }} />
              <p className="text-fg-muted">Contato autorizado: <strong className="text-fg">{l.consentContact ? "sim" : "não — sem follow-up automático"}</strong></p>
              {l.conversationId && <Link href={`/app/atendimento/${l.conversationId}`} className="btn btn-secondary w-full"><MessagesSquare aria-hidden className="size-4" /> Abrir conversa</Link>}
            </section>
            <FollowUpPanel l={l} />
          </aside>
        </div>
      </div>

      {moving && <MoveStageDialog lead={l} onClose={() => setMoving(false)} />}

      <Dialog open={converting} onClose={() => setConverting(false)} title="Converter em cliente" wide>
        <p className="mb-4 flex items-start gap-2 text-sm text-fg-muted"><Link2 aria-hidden className="mt-0.5 size-4 shrink-0" /> Se a pessoa já for cliente, use o cadastro existente: o lead é vinculado e nada é duplicado.</p>
        <ClientForm
          defaults={{ name: l.name.startsWith("Contato +") ? "" : l.name, phone: formatPhone(l.phone), email: l.email, city: l.city, uf: l.uf, ownerId: l.ownerId }}
          submitLabel="Criar cliente e vincular"
          onCancel={() => setConverting(false)}
          onPickExisting={linkExisting}
          onSubmit={async (input) => {
            if (!ctx) return "Sessão expirada.";
            const r = await crmService.convert(l.id, { client: input }, ctx);
            if (!r.ok) return r.error.message;
            await invalidate("leads", "clients", "conversations", "audit");
            setConverting(false);
            return null;
          }}
        />
      </Dialog>

      {client && (
        <Dialog open={openingCase} onClose={() => setOpeningCase(false)} title={`Abrir caso para ${client.name}`} wide>
          <CaseForm clientId={client.id} defaults={{ area: l.area, service: l.service, title: `${l.service} — ${client.name.split(" ")[0]}` }} onCancel={() => setOpeningCase(false)} onDone={() => setOpeningCase(false)} />
        </Dialog>
      )}
    </Guard>
  );
}

function Touch({ title, t }: { title: string; t: AttributionTouch }) {
  return (
    <div className="rounded-[var(--radius-control)] border border-line p-3 text-sm">
      <p className="text-xs uppercase tracking-wider text-fg-muted">{title}</p>
      <p className="mt-1 font-medium">{t.origin}</p>
      {t.campaign && <p className="text-fg-muted">Campanha: {t.campaign}</p>}
      {t.landingPage && <p className="text-fg-muted">Página: {t.landingPage}</p>}
      {t.utm && Object.keys(t.utm).length > 0 && <p className="mt-1 break-all font-mono text-xs text-fg-muted">{Object.entries(t.utm).map(([k, v]) => `${k}=${v}`).join(" · ")}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2"><Badge tone={EVIDENCE[t.evidence].tone}>{EVIDENCE[t.evidence].label}</Badge><span className="num text-xs text-fg-muted">{formatInstant(t.at)}</span></div>
    </div>
  );
}

function NextAction({ value, onSave }: { value: string; onSave: (v: string) => Promise<void> }) {
  const [v, setV] = useState(value);
  return (
    <label className="block">
      <span className="label">Próxima ação</span>
      <div className="flex gap-2">
        <input className="field" value={v} onChange={(e) => setV(e.target.value)} />
        {v !== value && <button className="btn btn-secondary shrink-0" onClick={() => onSave(v)}>Salvar</button>}
      </div>
    </label>
  );
}
