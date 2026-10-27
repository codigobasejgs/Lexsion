// Adapter mock do CRM, clientes e casos. Operações encadeadas gravam numa única transação.
import { readAll, writeAll, writeMany } from "./db";
import type { RequestContext, Result } from "../contracts";
import type { AuditEvent, Case, Client, Conversation, Lead, Message, StageKey } from "@/domain/types";
import { applyStageChange, buildTouch, findClientMatches, formatPhone, normalizePhone, STAGE_ERROR_MSG } from "@/domain/crm";
import type { ClientInput, LeadInput, CaseInput, CampaignLeadInput } from "@/domain/schemas";
import { triageChecklist, triageMissing, triageScript } from "@/domain/triage";
import { tenantRepo } from "./tenant-repo";
import { checkQuota } from "@/domain/quotas";

const cid = () => crypto.randomUUID().slice(0, 8);
const ok = <T,>(data: T): Result<T> => ({ ok: true, data, correlationId: cid() });
const fail = (code: string, message: string): Result<never> => ({ ok: false, error: { code, message, retryable: false }, correlationId: cid() });
const now = () => new Date().toISOString();
const auditRow = (ctx: RequestContext, action: string, entity: string, entityId: string, detail: string): AuditEvent => ({
  id: cid(), organizationId: ctx.organizationId, at: now(), actorId: ctx.actorId, action, entity, entityId, detail,
});

function newLead(ctx: RequestContext, input: LeadInput, touch: Lead["firstTouch"], id = `l-${cid()}`): Lead {
  const at = now();
  return {
    id, organizationId: ctx.organizationId, name: input.name.trim(), phone: normalizePhone(input.phone), email: input.email || undefined,
    city: input.city || undefined, uf: input.uf || undefined, area: input.area, service: input.service.trim(), stage: "novo", stageEnteredAt: at,
    firstTouch: touch, lastTouch: touch, ownerId: input.ownerId || undefined, consentContact: input.consentContact, tags: [], nextAction: "Primeiro contato",
    history: [{ at, to: "novo", actorId: ctx.actorId }], createdAt: at,
  };
}

export const crmService = {
  /** Cadastro manual pela equipe. Telefone já existente em lead aberto → recusa e aponta o existente. */
  createLead: async (input: LeadInput, ctx: RequestContext): Promise<Result<Lead>> => {
    const leads = await readAll("leads");
    const phone = normalizePhone(input.phone);
    const dup = leads.find((l) => l.organizationId === ctx.organizationId && l.phone === phone && l.stage !== "perdido" && l.stage !== "contratado");
    if (dup) return fail("duplicate", `Já existe um lead aberto com este telefone: ${dup.name}.`);
    const touch = buildTouch({ at: now(), declaredOrigin: input.declaredOrigin || undefined });
    const lead = newLead(ctx, input, touch);
    await writeMany({ leads: [...leads, lead], audit: [...(await readAll("audit")), auditRow(ctx, "lead.created", "Lead", lead.id, "Lead cadastrado manualmente")] });
    return ok(lead);
  },

  /**
   * Formulário de landing page (simulado). Mesmo telefone com lead aberto ⇒ atualiza só o last touch
   * (first touch preservado). Idempotente pela chave do envio. Cria conversa demonstrativa.
   */
  captureFromCampaign: async (input: CampaignLeadInput, ctx: RequestContext): Promise<Result<{ lead: Lead; created: boolean }>> => {
    const [leads, convs, msgs, audit] = await Promise.all([readAll("leads"), readAll("conversations"), readAll("messages"), readAll("audit")]);
    const submissionId = ctx.idempotencyKey ?? cid();
    const already = leads.find((l) => l.history.some((h) => h.note === `envio:${submissionId}`));
    if (already) return ok({ lead: already, created: false });
    const at = now();
    const touch = buildTouch({ at, utm: input.utm, clickId: input.clickId, landingPage: input.landingPage, campaign: input.campaign });
    const phone = normalizePhone(input.phone);
    const open = leads.find((l) => l.organizationId === ctx.organizationId && l.phone === phone && l.stage !== "perdido");
    if (open) {
      const updated: Lead = { ...open, lastTouch: touch, history: [...open.history, { at, to: open.stage, actorId: ctx.actorId, note: `envio:${submissionId}` }] };
      await writeMany({ leads: leads.map((l) => (l.id === open.id ? updated : l)), audit: [...audit, auditRow(ctx, "lead.touched", "Lead", open.id, `Novo contato pela campanha ${touch.campaign ?? touch.origin}`)] });
      return ok({ lead: updated, created: false });
    }
    const lead = newLead(ctx, { ...input, ownerId: "", declaredOrigin: "", consentContact: input.consentContact }, touch);
    lead.history[0].note = `envio:${submissionId}`;
    const conv: Conversation = {
      id: `cv-${cid()}`, organizationId: ctx.organizationId, contactName: lead.name, phone: formatPhone(lead.phone), leadId: lead.id, channel: "whatsapp",
      status: "ia", aiActive: true, unread: 1, lastMessageAt: at, campaign: touch.campaign, tags: [lead.service, "Campanha"],
      summary: `Novo contato pela campanha. Interesse: ${lead.service}. Assistente em acolhimento inicial.`, missingDocs: [],
    };
    lead.conversationId = conv.id;
    const welcome: Message = {
      id: `m-${cid()}`, organizationId: ctx.organizationId, conversationId: conv.id, author: "ia", at, status: "fila", simulated: true,
      text: `Olá, ${lead.name.split(" ")[0]}! Sou a assistente virtual do escritório. Recebemos seu contato sobre ${lead.service}. Posso fazer algumas perguntas para a equipe avaliar? Quem analisa se há direito é a advogada responsável.`,
    };
    await writeMany({
      leads: [...leads, lead], conversations: [...convs, conv], messages: [...msgs, welcome],
      audit: [...audit, auditRow(ctx, "lead.created", "Lead", lead.id, `Lead criado pela campanha ${touch.campaign ?? touch.origin} (${touch.evidence})`)],
    });
    return ok({ lead, created: true });
  },

  moveStage: async (id: string, to: StageKey, ctx: RequestContext, note?: string): Promise<Result<Lead>> => {
    const leads = await readAll("leads");
    const lead = leads.find((l) => l.id === id && l.organizationId === ctx.organizationId);
    if (!lead) return fail("not_found", "Lead não encontrado.");
    const r = applyStageChange(lead, to, ctx.actorId, now(), note);
    if (!r.ok) return fail(r.error, STAGE_ERROR_MSG[r.error]);
    await writeMany({ leads: leads.map((l) => (l.id === id ? r.lead : l)), audit: [...(await readAll("audit")), auditRow(ctx, "lead.stageChanged", "Lead", id, `${lead.stage} → ${to}`)] });
    return ok(r.lead);
  },

  /** Triagem (FLUXO A): registra respostas, gera checklist, atribui responsável e leva o lead à etapa Triagem. */
  triage: async (id: string, area: string, answers: Record<string, string>, routedTo: string, ctx: RequestContext): Promise<Result<Lead>> => {
    const [leads, audit] = await Promise.all([readAll("leads"), readAll("audit")]);
    const lead = leads.find((l) => l.id === id && l.organizationId === ctx.organizationId);
    if (!lead) return fail("not_found", "Lead não encontrado.");
    const script = triageScript(area);
    const missing = triageMissing(script, answers);
    if (missing.length) return fail("missing", `Responda antes de encaminhar: ${missing[0]}`);
    if (!routedTo) return fail("owner", "Escolha para quem encaminhar.");
    const at = now();
    let next: Lead = { ...lead, area, ownerId: routedTo, triage: { area, answers, checklist: triageChecklist(script, answers), at, actorId: ctx.actorId, routedTo }, nextAction: "Revisão profissional da triagem" };
    if (lead.stage === "novo" || lead.stage === "atendimento") {
      const r = applyStageChange(next, "triagem", ctx.actorId, at, "Triagem registrada");
      if (r.ok) next = r.lead;
    }
    await writeMany({ leads: leads.map((l) => (l.id === id ? next : l)), audit: [...audit, auditRow(ctx, "lead.triaged", "Lead", id, `Triagem ${area}`)] });
    return ok(next);
  },

  update: async (id: string, patch: Partial<Pick<Lead, "ownerId" | "nextAction" | "tags">>, ctx: RequestContext): Promise<Result<Lead>> => {
    const leads = await readAll("leads");
    const lead = leads.find((l) => l.id === id && l.organizationId === ctx.organizationId);
    if (!lead) return fail("not_found", "Lead não encontrado.");
    const next = { ...lead, ...patch };
    await writeAll("leads", leads.map((l) => (l.id === id ? next : l)));
    return ok(next);
  },

  /**
   * Converte lead em cliente (A04). Se `existingClientId` for informado, vincula sem criar pessoa nova.
   * O lead permanece (com clientId) e a atribuição é copiada para a origem do cliente. Idempotente.
   */
  convert: async (leadId: string, input: { existingClientId?: string; client?: ClientInput }, ctx: RequestContext): Promise<Result<Client>> => {
    const [leads, clients, convs, audit] = await Promise.all([readAll("leads"), readAll("clients"), readAll("conversations"), readAll("audit")]);
    const lead = leads.find((l) => l.id === leadId && l.organizationId === ctx.organizationId);
    if (!lead) return fail("not_found", "Lead não encontrado.");
    if (lead.clientId) {
      const c = clients.find((x) => x.id === lead.clientId);
      if (c) return ok(c);
    }
    let client: Client;
    let nextClients = clients;
    if (input.existingClientId) {
      const c = clients.find((x) => x.id === input.existingClientId && x.organizationId === ctx.organizationId);
      if (!c) return fail("not_found", "Cliente escolhido não existe neste escritório.");
      client = c;
    } else {
      if (!input.client) return fail("invalid", "Dados do cliente ausentes.");
      const orgClients = clients.filter((c) => c.organizationId === ctx.organizationId);
      const byDoc = findClientMatches(orgClients, { document: input.client.document }).find((m) => m.by === "documento");
      if (byDoc) return fail("duplicate_document", `Já existe cliente com este documento: ${byDoc.client.name}. Vincule ao cadastro existente.`);
      client = buildClient(ctx, input.client, { leadId: lead.id, origin: `${lead.firstTouch.origin}${lead.firstTouch.campaign ? ` — ${lead.firstTouch.campaign}` : ""}` });
      nextClients = [...clients, client];
    }
    const at = now();
    const updatedLead: Lead = { ...lead, clientId: client.id, history: [...lead.history, { at, to: lead.stage, actorId: ctx.actorId, note: `Convertido em cliente ${client.name}` }] };
    await writeMany({
      clients: nextClients,
      leads: leads.map((l) => (l.id === lead.id ? updatedLead : l)),
      conversations: convs.map((c) => (c.leadId === lead.id || c.id === lead.conversationId ? { ...c, clientId: client.id, contactName: client.name } : c)),
      audit: [...audit, auditRow(ctx, "lead.converted", "Lead", lead.id, input.existingClientId ? "Vinculado a cliente existente" : "Cliente criado a partir do lead")],
    });
    return ok(client);
  },
};

function buildClient(ctx: RequestContext, input: ClientInput, extra: Partial<Client> = {}): Client {
  return {
    id: `c-${cid()}`, organizationId: ctx.organizationId, kind: input.kind, name: input.name.trim(), socialName: input.socialName || undefined,
    document: input.document.trim(), birthDate: input.birthDate || undefined, phone: formatPhone(input.phone), email: input.email || undefined,
    city: input.city.trim(), uf: input.uf.toUpperCase(), profession: input.profession || undefined, ownerId: input.ownerId,
    origin: input.origin || "Cadastro manual", status: "ativo", createdAt: now(), ...extra,
  };
}

export const clientService = {
  create: async (input: ClientInput, ctx: RequestContext): Promise<Result<Client>> => {
    // Valida quota do tenant (demo)
    const tenant = await tenantRepo.getById(ctx.organizationId);
    if (tenant) {
      const usage = await tenantRepo.getUsage(tenant.id);
      if (usage) {
        const check = checkQuota(tenant, usage, "clients");
        if (!check.allowed) return fail("quota_exceeded", check.reason ?? "Limite atingido.");
      }
    }

    const clients = await readAll("clients");
    const orgClients = clients.filter((c) => c.organizationId === ctx.organizationId);
    const byDoc = findClientMatches(orgClients, { document: input.document }).find((m) => m.by === "documento");
    if (byDoc) return fail("duplicate_document", `Já existe cliente com este documento: ${byDoc.client.name}.`);
    if (ctx.idempotencyKey) {
      const again = clients.find((c) => c.id === `c-${ctx.idempotencyKey}`);
      if (again) return ok(again);
    }
    const client = buildClient(ctx, input, ctx.idempotencyKey ? { id: `c-${ctx.idempotencyKey}` } : {});
    await writeMany({ clients: [...clients, client], audit: [...(await readAll("audit")), auditRow(ctx, "client.created", "Client", client.id, "Cliente cadastrado")] });
    return ok(client);
  },
};

export const caseService = {
  create: async (input: CaseInput, ctx: RequestContext): Promise<Result<Case>> => {
    const [cases, clients] = await Promise.all([readAll("cases"), readAll("clients")]);
    if (!clients.some((c) => c.id === input.clientId && c.organizationId === ctx.organizationId)) return fail("not_found", "Cliente não encontrado.");
    if (ctx.idempotencyKey) {
      const again = cases.find((k) => k.id === `k-${ctx.idempotencyKey}`);
      if (again) return ok(again);
    }
    const k: Case = {
      id: `k-${ctx.idempotencyKey ?? cid()}`, organizationId: ctx.organizationId, clientId: input.clientId, title: input.title.trim(), area: input.area,
      service: input.service.trim(), kind: input.kind, phase: "triagem", priority: input.priority, ownerId: input.ownerId, confidential: input.confidential,
      portalStatus: "Recebemos seu caso e estamos fazendo a primeira análise.", portalNextStep: "Aguarde o contato da equipe.",
    };
    await writeMany({ cases: [...cases, k], audit: [...(await readAll("audit")), auditRow(ctx, "case.created", "Case", k.id, `Caso aberto: ${k.title}`)] });
    return ok(k);
  },
};
