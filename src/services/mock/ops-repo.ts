// Serviços com regras encadeadas (E3–E7). Cada operação grava as coleções afetadas numa só transação.
import { readAll, writeMany } from "./db";
import { checkCitations } from "@/domain/citations";
import { auditRow, cid, fail, nowIso, ok } from "./generic";
import type { RequestContext, Result } from "../contracts";
import type {
  BankLine, CalendarEvent, Case, Charge, ChargeStatus, Contract, Deadline, DocumentItem, ExtractedField, Installment, LegalDraft, Message,
  Payment, PortalUpdate, Proposal, Publication, Receipt, StoredFile,
} from "@/domain/types";
import { applyChargeEvent, applySignature, installmentsFromContract, isActiveCharge, scheduleTotal } from "@/domain/commercial";
import { recompute } from "@/domain/finance";
import { countDeadline } from "@/domain/deadlines";
import { textHash } from "@/domain/metrics";
import { DEMO_TODAY } from "@/mocks/clock";
import { allowed } from "@/domain/permissions";

// ---------------- Documentos (M09, A06) ----------------
// HEIC: só na demonstração (o Storage real aceita PDF/JPG/PNG/WEBP; iPhone converte para JPG ao enviar pelo navegador).
export const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"];
export const REAL_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
export const MAX_BYTES = 15 * 1024 * 1024;

export const docService = {
  /** Upload local. Nunca gera extração para arquivo novo. HTML/scripts recusados. Original imutável (nova versão = novo arquivo). */
  upload: async (input: { docId?: string; clientId: string; caseId?: string; type: DocumentItem["type"]; file: File; origin?: DocumentItem["origin"] }, ctx: RequestContext): Promise<Result<DocumentItem>> => {
    const f = input.file;
    if (!ALLOWED_MIME.includes(f.type)) return fail("type", "Tipo de arquivo não aceito. Envie PDF ou imagem (JPG, PNG, WEBP, HEIC).");
    if (f.size > MAX_BYTES) return fail("size", "Arquivo maior que 15 MB.");
    if (f.size === 0) return fail("empty", "Arquivo vazio.");
    const [docs, files, audit] = await Promise.all([readAll("documents"), readAll("files"), readAll("audit")]);
    const at = nowIso();
    const stored: StoredFile = { id: `file-${cid()}`, organizationId: ctx.organizationId, name: f.name, mime: f.type, size: f.size, blob: f, createdAt: at };
    const version = { id: `v-${cid()}`, at, actorId: ctx.actorId, fileId: stored.id, size: f.size, mime: f.type, note: input.origin === "portal" ? "Enviado pelo cliente no portal" : "Upload local" };
    let doc: DocumentItem;
    let nextDocs: DocumentItem[];
    const existing = input.docId ? docs.find((d) => d.id === input.docId && d.organizationId === ctx.organizationId) : undefined;
    if (existing) {
      doc = {
        ...existing, name: existing.receivedAt ? existing.name : f.name, status: "recebido", receivedAt: at, sharedWithClient: existing.sharedWithClient,
        versions: [...(existing.versions ?? []), version], hasFixtureExtraction: existing.hasFixtureExtraction && !existing.receivedAt ? false : existing.hasFixtureExtraction,
        history: [...(existing.history ?? []), { at, actorId: ctx.actorId, text: existing.receivedAt ? "Nova versão enviada (original preservado)" : "Documento solicitado foi recebido" }],
      };
      nextDocs = docs.map((d) => (d.id === doc.id ? doc : d));
    } else {
      doc = {
        id: `doc-${cid()}`, organizationId: ctx.organizationId, clientId: input.clientId, caseId: input.caseId, name: f.name, type: input.type, status: "recebido",
        sharedWithClient: false, hasFixtureExtraction: false, receivedAt: at, versions: [version], origin: input.origin ?? "equipe",
        history: [{ at, actorId: ctx.actorId, text: "Recebido localmente; análise automática depende da próxima fase" }],
      };
      nextDocs = [...docs, doc];
    }
    await writeMany({ documents: nextDocs, files: [...files, stored], audit: [...audit, auditRow(ctx, "document.received", "Document", doc.id, `Arquivo recebido (${f.type}, ${f.size} bytes)`)] });
    return ok(doc);
  },

  request: async (input: { clientId: string; caseId?: string; name: string; type: DocumentItem["type"]; note?: string }, ctx: RequestContext): Promise<Result<DocumentItem>> => {
    const [docs, audit] = await Promise.all([readAll("documents"), readAll("audit")]);
    const at = nowIso();
    const doc: DocumentItem = { id: `doc-${cid()}`, organizationId: ctx.organizationId, clientId: input.clientId, caseId: input.caseId, name: input.name, type: input.type, status: "solicitado", sharedWithClient: true, hasFixtureExtraction: false, requestedAt: at, requestNote: input.note, history: [{ at, actorId: ctx.actorId, text: "Documento solicitado ao cliente" }] };
    await writeMany({ documents: [...docs, doc], audit: [...audit, auditRow(ctx, "document.requested", "Document", doc.id, "Solicitação criada")] });
    return ok(doc);
  },

  setStatus: async (id: string, status: DocumentItem["status"], ctx: RequestContext, reason?: string): Promise<Result<DocumentItem>> => {
    const [docs, audit] = await Promise.all([readAll("documents"), readAll("audit")]);
    const d = docs.find((x) => x.id === id && x.organizationId === ctx.organizationId);
    if (!d) return fail("not_found", "Documento não encontrado.");
    if (status === "rejeitado" && !reason?.trim()) return fail("reason", "Informe o motivo da rejeição.");
    if ((status === "validado" || status === "rejeitado") && !d.receivedAt) return fail("not_received", "Documento ainda não foi recebido.");
    const at = nowIso();
    const next: DocumentItem = { ...d, status, rejectReason: status === "rejeitado" ? reason : d.rejectReason, history: [...(d.history ?? []), { at, actorId: ctx.actorId, text: `Status: ${status}${reason ? ` — ${reason}` : ""}` }] };
    await writeMany({ documents: docs.map((x) => (x.id === id ? next : x)), audit: [...audit, auditRow(ctx, "document.reviewed", "Document", id, `Status ${status}`)] });
    return ok(next);
  },

  /** Revisão de campo extraído: guarda correção e revisor, sem alterar o valor original extraído. */
  reviewField: async (docId: string, fieldId: string, correction: string | undefined, ctx: RequestContext): Promise<Result<DocumentItem>> => {
    const docs = await readAll("documents");
    const d = docs.find((x) => x.id === docId && x.organizationId === ctx.organizationId);
    if (!d?.extraction) return fail("not_found", "Extração não encontrada.");
    const at = nowIso();
    const extraction: ExtractedField[] = d.extraction.map((f) => (f.id === fieldId ? { ...f, correction: correction?.trim() || undefined, reviewerId: ctx.actorId, reviewedAt: at } : f));
    const allReviewed = extraction.every((f) => f.reviewerId);
    const next: DocumentItem = { ...d, extraction, status: allReviewed && d.status === "precisa_revisar" ? "validado" : d.status, history: [...(d.history ?? []), { at, actorId: ctx.actorId, text: `Campo revisado${correction ? " com correção" : ""}` }] };
    await writeMany({ documents: docs.map((x) => (x.id === docId ? next : x)) });
    return ok(next);
  },

  share: async (id: string, shared: boolean, ctx: RequestContext) => {
    const docs = await readAll("documents");
    const d = docs.find((x) => x.id === id && x.organizationId === ctx.organizationId);
    if (!d) return fail("not_found", "Documento não encontrado.");
    if (shared && (d.type === "Laudo" || d.type === "Exame")) return fail("health", "Dados de saúde não são compartilhados pelo portal nesta demo.");
    const next = { ...d, sharedWithClient: shared, history: [...(d.history ?? []), { at: nowIso(), actorId: ctx.actorId, text: shared ? "Compartilhado no portal (simulado)" : "Compartilhamento removido" }] };
    await writeMany({ documents: docs.map((x) => (x.id === id ? next : x)) });
    return ok(next);
  },

  remove: async (id: string, ctx: RequestContext): Promise<Result<true>> => {
    const [docs, files, audit] = await Promise.all([readAll("documents"), readAll("files"), readAll("audit")]);
    const d = docs.find((x) => x.id === id && x.organizationId === ctx.organizationId);
    if (!d) return fail("not_found", "Documento não encontrado.");
    if (d.status === "validado") return fail("validated", "Documento validado não pode ser excluído; arquive ou envie nova versão.");
    const fileIds = new Set((d.versions ?? []).map((v) => v.fileId));
    await writeMany({ documents: docs.filter((x) => x.id !== id), files: files.filter((f) => !fileIds.has(f.id)), audit: [...audit, auditRow(ctx, "document.removed", "Document", id, "Documento removido")] });
    return ok(true);
  },
};

// ---------------- Prazos e publicações (M07/M08, A08) ----------------
export const deadlineService = {
  propose: async (input: { caseId: string; title: string; eventType: string; start: string; days: number; counting: "uteis" | "corridos"; court: string; publicationId?: string }, ctx: RequestContext): Promise<Result<Deadline>> => {
    const [deadlines, settings, pubs, audit] = await Promise.all([readAll("deadlines"), readAll("settings"), readAll("publications"), readAll("audit")]);
    const s = settings.find((x) => x.organizationId === ctx.organizationId);
    let end: string;
    try {
      end = countDeadline(input.start, input.days, input.counting, s?.holidays ?? []).end;
    } catch (e) {
      return fail("invalid", (e as Error).message);
    }
    const d: Deadline = { id: `d-${cid()}`, organizationId: ctx.organizationId, ...input, calendarVersion: s?.calendarVersion, proposedEnd: end, status: "proposto" };
    const nextPubs = input.publicationId ? pubs.map((p) => (p.id === input.publicationId ? { ...p, status: "prazo_criado" as const, triageNote: `Prazo proposto: ${d.title}` } : p)) : pubs;
    await writeMany({ deadlines: [...deadlines, d], publications: nextPubs, audit: [...audit, auditRow(ctx, "deadline.proposed", "Deadline", d.id, "Prazo proposto (aguarda confirmação)")] });
    return ok(d);
  },
  /** Só advogado/admin confirma; confirmação gera compromisso na agenda (cenário 3). */
  confirm: async (id: string, confirmedEnd: string, justification: string, ctx: RequestContext): Promise<Result<Deadline>> => {
    const [deadlines, events, cases, audit] = await Promise.all([readAll("deadlines"), readAll("events"), readAll("cases"), readAll("audit")]);
    const d = deadlines.find((x) => x.id === id && x.organizationId === ctx.organizationId);
    if (!d) return fail("not_found", "Prazo não encontrado.");
    if (confirmedEnd !== d.proposedEnd && !justification.trim()) return fail("justify", "Data diferente da proposta exige justificativa.");
    const k = cases.find((c) => c.id === d.caseId);
    const next: Deadline = { ...d, confirmedEnd, reviewerId: ctx.actorId, justification: justification.trim() || "Contagem conferida", status: "confirmado" };
    const evId = `ev-dl-${d.id}`;
    const ev: CalendarEvent = { id: evId, organizationId: ctx.organizationId, title: `Prazo: ${d.title}`, type: "reuniao", start: `${confirmedEnd}T12:00:00-03:00`, end: `${confirmedEnd}T12:30:00-03:00`, location: "Prazo (vencimento)", caseId: d.caseId, clientId: k?.clientId, ownerId: k?.ownerId ?? ctx.actorId, visibleToClient: false, notes: "Gerado ao confirmar o prazo" };
    await writeMany({
      deadlines: deadlines.map((x) => (x.id === id ? next : x)),
      events: [...events.filter((e) => e.id !== evId), ev],
      audit: [...audit, auditRow(ctx, "deadline.confirmed", "Deadline", id, `Prazo confirmado para ${confirmedEnd}`)],
    });
    return ok(next);
  },
  complete: async (id: string, ctx: RequestContext) => {
    const deadlines = await readAll("deadlines");
    const d = deadlines.find((x) => x.id === id && x.organizationId === ctx.organizationId);
    if (!d) return fail("not_found", "Prazo não encontrado.");
    if (d.status !== "confirmado") return fail("not_confirmed", "Confirme o prazo antes de marcá-lo como cumprido.");
    const next = { ...d, status: "cumprido" as const };
    await writeMany({ deadlines: deadlines.map((x) => (x.id === id ? next : x)) });
    return ok(next);
  },
  triage: async (pubId: string, status: Publication["status"], note: string, ctx: RequestContext) => {
    const pubs = await readAll("publications");
    const p = pubs.find((x) => x.id === pubId && x.organizationId === ctx.organizationId);
    if (!p) return fail("not_found", "Publicação não encontrada.");
    if (status === "descartada" && !note.trim()) return fail("note", "Informe por que a publicação foi descartada.");
    const next = { ...p, status, triageNote: note };
    await writeMany({ publications: pubs.map((x) => (x.id === pubId ? next : x)) });
    return ok(next);
  },
};

// ---------------- Agenda (M08) ----------------
export function overlaps(a: { start: string; end: string; ownerId: string }, b: { start: string; end: string; ownerId: string }) {
  return a.ownerId === b.ownerId && a.start < b.end && b.start < a.end;
}

export const eventService = {
  save: async (ev: Omit<CalendarEvent, "organizationId" | "id"> & { id?: string }, reason: string | undefined, ctx: RequestContext): Promise<Result<CalendarEvent>> => {
    if (ev.end <= ev.start) return fail("range", "O término deve ser depois do início.");
    const [events, audit] = await Promise.all([readAll("events"), readAll("audit")]);
    const at = nowIso();
    const prev = ev.id ? events.find((e) => e.id === ev.id && e.organizationId === ctx.organizationId) : undefined;
    const rescheduled = prev && (prev.start !== ev.start || prev.end !== ev.end);
    if (rescheduled && !reason?.trim()) return fail("reason", "Informe o motivo do reagendamento.");
    const full: CalendarEvent = {
      ...ev, id: ev.id ?? `e-${cid()}`, organizationId: ctx.organizationId,
      history: [...(prev?.history ?? []), { at, actorId: ctx.actorId, text: prev ? (rescheduled ? `Reagendado de ${prev.start.slice(0, 16)} — ${reason}. Lembretes antigos cancelados.` : "Editado") : "Criado" }],
    };
    await writeMany({ events: prev ? events.map((e) => (e.id === full.id ? full : e)) : [...events, full], audit: [...audit, auditRow(ctx, prev ? "event.updated" : "event.created", "CalendarEvent", full.id, full.title)] });
    return ok(full);
  },
};

// ---------------- Propostas, contratos, assinatura (M14, A09) ----------------
export const commercialService = {
  saveProposal: async (p: Omit<Proposal, "organizationId" | "id" | "version" | "history" | "status"> & { id?: string }, ctx: RequestContext): Promise<Result<Proposal>> => {
    if (scheduleTotal(p.schedule) !== p.total) return fail("total", "A soma das parcelas precisa ser igual ao total.");
    if (p.feeKind === "exito" || p.feeKind === "combinado") {
      if (!p.successPercent || p.successPercent <= 0 || p.successPercent > 100 || !p.successBase?.trim()) return fail("success", "Honorários de êxito exigem percentual e base explícitos.");
    }
    const [props, audit] = await Promise.all([readAll("proposals"), readAll("audit")]);
    const at = nowIso();
    const prev = p.id ? props.find((x) => x.id === p.id && x.organizationId === ctx.organizationId) : undefined;
    if (prev && (prev.status === "aceita" || prev.contractId)) return fail("locked", "Proposta aceita não pode ser alterada; crie nova versão.");
    const full: Proposal = { ...p, id: prev?.id ?? `pp-${cid()}`, organizationId: ctx.organizationId, version: (prev?.version ?? 0) + 1, status: "rascunho", history: [...(prev?.history ?? []), { at, actorId: ctx.actorId, text: prev ? `Versão ${prev.version + 1} salva` : "Proposta criada" }] };
    await writeMany({ proposals: prev ? props.map((x) => (x.id === full.id ? full : x)) : [...props, full], audit: [...audit, auditRow(ctx, "proposal.saved", "Proposal", full.id, `v${full.version}`)] });
    return ok(full);
  },
  setProposalStatus: async (id: string, status: Proposal["status"], ctx: RequestContext) => {
    const props = await readAll("proposals");
    const p = props.find((x) => x.id === id && x.organizationId === ctx.organizationId);
    if (!p) return fail("not_found", "Proposta não encontrada.");
    if (status === "enviada" && p.status !== "aprovada") return fail("not_approved", "Aprove a proposta antes de enviar.");
    if (status === "aprovada" && !allowed((await readAll("users")).find((u) => u.id === ctx.actorId)?.role, "aprovar_proposta")) return fail("forbidden", "Somente advogado(a) ou administrador aprova propostas.");
    if (status === "aceita" && p.status !== "enviada") return fail("not_sent", "Só proposta enviada pode ser aceita.");
    const next = { ...p, status, history: [...p.history, { at: nowIso(), actorId: ctx.actorId, text: `Status: ${status}${status === "enviada" ? " (simulação — nada foi enviado)" : ""}` }] };
    await writeMany({ proposals: props.map((x) => (x.id === id ? next : x)) });
    return ok(next);
  },
  /** Proposta aceita → contrato com snapshot (dados congelados) e signatários. Idempotente. */
  createContract: async (proposalId: string, clientId: string, ctx: RequestContext): Promise<Result<Contract>> => {
    const [props, contracts, clients, users, audit] = await Promise.all([readAll("proposals"), readAll("contracts"), readAll("clients"), readAll("users"), readAll("audit")]);
    const p = props.find((x) => x.id === proposalId && x.organizationId === ctx.organizationId);
    if (!p) return fail("not_found", "Proposta não encontrada.");
    if (p.status !== "aceita") return fail("not_accepted", "Gere o contrato a partir de proposta aceita.");
    if (p.contractId) {
      const c = contracts.find((x) => x.id === p.contractId);
      if (c) return ok(c);
    }
    const client = clients.find((c) => c.id === clientId && c.organizationId === ctx.organizationId);
    if (!client) return fail("client", "Escolha o cliente contratante (converta o lead antes).");
    const lawyer = users.find((u) => u.id === ctx.actorId);
    const at = nowIso();
    const c: Contract = {
      id: `ct-${cid()}`, organizationId: ctx.organizationId, clientId, leadId: p.leadId, proposalId: p.id, title: p.title, total: p.total, status: "rascunho", version: 1,
      snapshot: { clientName: client.name, document: client.document, service: p.service, feeText: feeText(p), schedule: p.schedule },
      signers: [
        { id: `sg-${cid()}`, name: client.name, role: "Contratante", required: true, order: 1, status: "pendente" },
        { id: `sg-${cid()}`, name: lawyer?.name ?? "Advogado(a)", role: "Contratada", required: true, order: 2, status: "pendente" },
      ],
      history: [{ at, actorId: ctx.actorId, text: `Contrato gerado da proposta v${p.version} (dados congelados)` }],
    };
    await writeMany({ contracts: [...contracts, c], proposals: props.map((x) => (x.id === p.id ? { ...x, contractId: c.id, clientId } : x)), audit: [...audit, auditRow(ctx, "contract.created", "Contract", c.id, "Contrato gerado")] });
    return ok(c);
  },
  sendForSignature: async (id: string, ctx: RequestContext) => {
    const contracts = await readAll("contracts");
    const c = contracts.find((x) => x.id === id && x.organizationId === ctx.organizationId);
    if (!c) return fail("not_found", "Contrato não encontrado.");
    if (c.status !== "rascunho") return fail("state", "Somente rascunho pode ser enviado.");
    const next: Contract = { ...c, status: "enviado", history: [...(c.history ?? []), { at: nowIso(), actorId: ctx.actorId, text: "Enviado para assinatura (simulação, sem validade jurídica)" }] };
    await writeMany({ contracts: contracts.map((x) => (x.id === id ? next : x)) });
    return ok(next);
  },
  /**
   * Simula assinatura de um signatário (A09). Ao concluir: parcelas criadas uma vez, lead → contratado,
   * caso → documentação. Reenviar o mesmo evento não cria nada novo.
   */
  sign: async (contractId: string, signerId: string, ctx: RequestContext): Promise<Result<{ contract: Contract; created: number }>> => {
    const [contracts, insts, leads, cases, audit] = await Promise.all([readAll("contracts"), readAll("installments"), readAll("leads"), readAll("cases"), readAll("audit")]);
    const c = contracts.find((x) => x.id === contractId && x.organizationId === ctx.organizationId);
    if (!c) return fail("not_found", "Contrato não encontrado.");
    const at = nowIso();
    const r = applySignature(c, signerId, at, ctx.actorId);
    if (r.contract === c) return ok({ contract: c, created: 0 });
    let contract = r.contract;
    let newInsts: Installment[] = [];
    let nextLeads = leads;
    let nextCases = cases;
    if (r.completedNow) {
      newInsts = installmentsFromContract(contract, (i) => `in-${contract.id}-${i}`).filter((n) => !insts.some((x) => x.id === n.id));
      contract = { ...contract, installmentsGenerated: true };
      if (contract.leadId) nextLeads = leads.map((l) => (l.id === contract.leadId && l.stage !== "contratado" ? { ...l, stage: "contratado" as const, stageEnteredAt: at, history: [...l.history, { at, from: l.stage, to: "contratado" as const, actorId: ctx.actorId, note: "Contrato concluído" }] } : l));
      if (contract.caseId) nextCases = cases.map((k) => (k.id === contract.caseId && k.phase === "triagem" ? { ...k, phase: "documentacao" as const } : k));
    }
    await writeMany({
      contracts: contracts.map((x) => (x.id === contractId ? contract : x)), installments: [...insts, ...newInsts], leads: nextLeads, cases: nextCases,
      audit: [...audit, auditRow(ctx, r.completedNow ? "contract.completed" : "contract.signed", "Contract", contractId, r.completedNow ? `Concluído; ${newInsts.length} parcela(s) gerada(s)` : "Assinatura parcial (simulada)")],
    });
    return ok({ contract, created: newInsts.length });
  },
  /** Recusa/expiração; correção gera nova versão sem apagar a anterior. */
  reject: async (id: string, kind: "recusado" | "expirado", ctx: RequestContext) => {
    const contracts = await readAll("contracts");
    const c = contracts.find((x) => x.id === id && x.organizationId === ctx.organizationId);
    if (!c) return fail("not_found", "Contrato não encontrado.");
    if (c.status === "concluido") return fail("done", "Contrato concluído não pode ser recusado.");
    const next: Contract = { ...c, status: kind, history: [...(c.history ?? []), { at: nowIso(), actorId: ctx.actorId, text: kind === "recusado" ? "Recusado pelo signatário (simulação)" : "Prazo de assinatura expirado (simulação)" }] };
    await writeMany({ contracts: contracts.map((x) => (x.id === id ? next : x)) });
    return ok(next);
  },
  /** Cancela o envio (simulação): registra motivo na trilha. Assinaturas já feitas ficam no histórico; nenhuma parcela é criada. */
  cancel: async (id: string, reason: string, ctx: RequestContext): Promise<Result<Contract>> => {
    if (reason.trim().length < 5) return fail("reason", "Informe o motivo do cancelamento (mínimo 5 caracteres).");
    const [contracts, audit] = await Promise.all([readAll("contracts"), readAll("audit")]);
    const c = contracts.find((x) => x.id === id && x.organizationId === ctx.organizationId);
    if (!c) return fail("not_found", "Contrato não encontrado.");
    if (c.status !== "enviado" && c.status !== "parcial") return fail("state", "Só é possível cancelar um envio em andamento.");
    const next: Contract = { ...c, status: "cancelado", history: [...(c.history ?? []), { at: nowIso(), actorId: ctx.actorId, text: `Envio cancelado (simulação): ${reason.trim()}` }] };
    await writeMany({ contracts: contracts.map((x) => (x.id === id ? next : x)), audit: [...audit, auditRow(ctx, "contract.cancelled", "Contract", id, reason.trim())] });
    return ok(next);
  },
  newVersion: async (id: string, ctx: RequestContext): Promise<Result<Contract>> => {
    const contracts = await readAll("contracts");
    const c = contracts.find((x) => x.id === id && x.organizationId === ctx.organizationId);
    if (!c) return fail("not_found", "Contrato não encontrado.");
    if (c.status !== "recusado" && c.status !== "expirado" && c.status !== "cancelado") return fail("state", "Nova versão só após recusa, expiração ou cancelamento.");
    const v: Contract = { ...c, id: `ct-${cid()}`, status: "rascunho", version: (c.version ?? 1) + 1, previousVersionId: c.id, installmentsGenerated: false, signers: c.signers?.map((s) => ({ ...s, status: "pendente", signedAt: undefined })), history: [{ at: nowIso(), actorId: ctx.actorId, text: `Versão ${(c.version ?? 1) + 1} criada a partir da anterior (preservada)` }] };
    await writeMany({ contracts: [...contracts, v] });
    return ok(v);
  },
};

function feeText(p: Proposal): string {
  const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const base = `${brl(p.total)} (${p.schedule.length} pagamento(s))`;
  if (p.feeKind === "exito") return `Somente êxito: ${p.successPercent}% sobre ${p.successBase}.`;
  if (p.feeKind === "combinado") return `${base} + êxito de ${p.successPercent}% sobre ${p.successBase}.`;
  return base;
}

// ---------------- Financeiro avançado (M15) ----------------
export const financeOps = {
  /** Renegociação: parcelas antigas ficam canceladas (preservadas) e ligadas às novas. Saldo total conserva-se. */
  renegotiate: async (ids: string[], schedule: { label: string; amount: number; due: string }[], note: string, ctx: RequestContext): Promise<Result<Installment[]>> => {
    const [insts, audit] = await Promise.all([readAll("installments"), readAll("audit")]);
    const old = insts.filter((i) => ids.includes(i.id) && i.organizationId === ctx.organizationId);
    if (old.length !== ids.length || !old.length) return fail("not_found", "Parcelas não encontradas.");
    if (old.some((i) => i.status === "paga" || i.status === "cancelada")) return fail("state", "Só parcelas em aberto ou parciais entram na renegociação.");
    if (!note.trim()) return fail("note", "Descreva o acordo.");
    const balance = old.reduce((s, i) => s + (i.amount - i.paid), 0);
    if (scheduleTotal(schedule) !== balance) return fail("total", `As novas parcelas devem somar o saldo renegociado (${(balance / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}).`);
    const base = old[0];
    const created: Installment[] = schedule.map((s, i) => ({ id: `in-rn-${cid()}-${i}`, organizationId: ctx.organizationId, contractId: base.contractId, clientId: base.clientId, caseId: base.caseId, label: `${s.label} (acordo)`, amount: s.amount, paid: 0, due: s.due, status: "aberta", renegotiatedFrom: ids, note }));
    // Parcela parcialmente paga: mantém o pago e reduz o valor ao pago (fica "paga"); o saldo migra para o acordo.
    const next = insts.map((i) => (ids.includes(i.id) ? { ...i, amount: i.paid > 0 ? i.paid : i.amount, status: i.paid > 0 ? ("paga" as const) : ("cancelada" as const), replacedBy: created.map((c) => c.id), note: `Renegociada: ${note}` } : i));
    await writeMany({ installments: [...next, ...created], audit: [...audit, auditRow(ctx, "installments.renegotiated", "Installment", ids.join(","), `Acordo com ${created.length} parcela(s)`)] });
    return ok(created);
  },
  remind: async (id: string, ctx: RequestContext) => {
    const insts = await readAll("installments");
    const i = insts.find((x) => x.id === id && x.organizationId === ctx.organizationId);
    if (!i) return fail("not_found", "Parcela não encontrada.");
    const next = { ...i, lastReminderAt: nowIso() };
    await writeMany({ installments: insts.map((x) => (x.id === id ? next : x)) });
    return ok(next);
  },
  issueReceipt: async (paymentId: string, place: string, ctx: RequestContext): Promise<Result<Receipt>> => {
    const [receipts, pays, insts, clients, orgs] = await Promise.all([readAll("receipts"), readAll("payments"), readAll("installments"), readAll("clients"), readAll("organizations")]);
    const existing = receipts.find((r) => r.paymentId === paymentId && r.organizationId === ctx.organizationId);
    if (existing) return ok(existing);
    const p = pays.find((x) => x.id === paymentId && x.organizationId === ctx.organizationId);
    if (!p || p.amount <= 0) return fail("not_found", "Pagamento não encontrado.");
    if (pays.some((x) => x.reversalOf === p.id)) return fail("reversed", "Pagamento estornado não gera recibo.");
    const inst = insts.find((i) => i.id === p.installmentId);
    const client = clients.find((c) => c.id === inst?.clientId);
    const org = orgs.find((o) => o.id === ctx.organizationId);
    const number = receipts.filter((r) => r.organizationId === ctx.organizationId).reduce((m, r) => Math.max(m, r.number), 0) + 1;
    const r: Receipt = { id: `rc-${cid()}`, organizationId: ctx.organizationId, number, paymentId, payer: client?.name ?? "—", payerDoc: client?.document ?? "—", beneficiary: org?.name ?? "—", reference: `${inst?.label ?? "Pagamento"} — honorários advocatícios`, amount: p.amount, date: p.date, place, createdAt: nowIso() };
    await writeMany({ receipts: [...receipts, r] });
    return ok(r);
  },
  /** Conciliação exige decisão explícita: vincular a pagamento existente, registrar novo pagamento ou ignorar com motivo. */
  reconcile: async (lineId: string, decision: { kind: "vincular"; paymentId: string } | { kind: "registrar"; installmentId: string } | { kind: "ignorar" }, note: string, ctx: RequestContext): Promise<Result<BankLine>> => {
    const [lines, pays, insts, audit] = await Promise.all([readAll("bankLines"), readAll("payments"), readAll("installments"), readAll("audit")]);
    const l = lines.find((x) => x.id === lineId && x.organizationId === ctx.organizationId);
    if (!l) return fail("not_found", "Lançamento não encontrado.");
    if (l.status !== "pendente") return fail("done", "Lançamento já conciliado.");
    if (!note.trim()) return fail("note", "Registre a justificativa da decisão.");
    let nextPays = pays;
    let nextInsts = insts;
    let matched: string | undefined;
    if (decision.kind === "vincular") {
      if (lines.some((x) => x.matchedPaymentId === decision.paymentId)) return fail("dup", "Este pagamento já está vinculado a outro lançamento (possível duplicidade).");
      matched = decision.paymentId;
    } else if (decision.kind === "registrar") {
      const inst = insts.find((i) => i.id === decision.installmentId && i.organizationId === ctx.organizationId);
      if (!inst) return fail("not_found", "Parcela não encontrada.");
      const gross = l.amount + (l.fee ?? 0); // tarifa é despesa, não reduz o pagamento do cliente
      if (gross > inst.amount - inst.paid) return fail("excede", "Valor maior que o saldo da parcela.");
      const p: Payment = { id: `p-${cid()}`, organizationId: ctx.organizationId, installmentId: inst.id, amount: gross, date: l.date, method: "transferencia", source: "manual", note: `Conciliação: ${note}`, idempotencyKey: `bank:${l.id}` };
      nextPays = [...pays, p];
      nextInsts = recompute(insts, nextPays);
      matched = p.id;
    }
    const next: BankLine = { ...l, status: decision.kind === "ignorar" ? "ignorado" : "conciliado", matchedPaymentId: matched, decisionNote: note };
    await writeMany({ bankLines: lines.map((x) => (x.id === lineId ? next : x)), payments: nextPays, installments: nextInsts, audit: [...audit, auditRow(ctx, "bank.reconciled", "BankLine", lineId, decision.kind)] });
    return ok(next);
  },
};

// ---------------- Cobranças (M16) ----------------
export const chargeService = {
  /** Cria cobrança simulada. Mesma chave = mesma cobrança. Troca de provedor exige cancelar a ativa. */
  create: async (input: { installmentId: string; provider: Charge["provider"]; method: Charge["method"] }, ctx: RequestContext & { idempotencyKey: string }): Promise<Result<Charge>> => {
    const [charges, insts, events] = await Promise.all([readAll("charges"), readAll("installments"), readAll("integrationEvents")]);
    const dup = charges.find((c) => c.idempotencyKey === ctx.idempotencyKey);
    if (dup) return ok(dup);
    const inst = insts.find((i) => i.id === input.installmentId && i.organizationId === ctx.organizationId);
    if (!inst) return fail("not_found", "Parcela não encontrada.");
    const balance = inst.amount - inst.paid;
    if (balance <= 0) return fail("paid", "Parcela sem saldo.");
    const active = charges.find((c) => c.installmentId === inst.id && isActiveCharge(c));
    if (active) return fail("active", `Já existe cobrança ativa (${active.provider}). Cancele-a antes de emitir outra.`);
    const at = nowIso();
    const ext = `demo_${input.provider}_${cid()}`;
    const c: Charge = { id: `chg-${cid()}`, organizationId: ctx.organizationId, installmentId: inst.id, provider: input.provider, method: input.method, amount: balance, due: inst.due, status: "pendente", externalId: ext, link: `https://exemplo.invalid/cobranca/${ext}`, idempotencyKey: ctx.idempotencyKey, events: [{ id: `ev-${cid()}`, at, type: "CHARGE_CREATED (simulado)", note: "Nenhuma cobrança real foi emitida" }] };
    await writeMany({ charges: [...charges, c], integrationEvents: [...events, { id: `ie-${cid()}`, organizationId: ctx.organizationId, provider: input.provider, correlationId: `corr-${cid()}`, type: "CHARGE_CREATED", attempt: 1, at, status: "sucesso", detail: `Cobrança ${ext} (simulada)` }] });
    return ok(c);
  },
  /** Evento simulado do provedor. Pagamento confirmado gera baixa uma única vez (chave por evento). */
  simulate: async (chargeId: string, kind: "confirmar" | "confirmar_duplicado" | "expirar" | "erro" | "estornar" | "cancelar" | "retorno_checkout", ctx: RequestContext): Promise<Result<{ charge: Charge; note: string }>> => {
    const [charges, insts, pays, audit] = await Promise.all([readAll("charges"), readAll("installments"), readAll("payments"), readAll("audit")]);
    const c = charges.find((x) => x.id === chargeId && x.organizationId === ctx.organizationId);
    if (!c) return fail("not_found", "Cobrança não encontrada.");
    const at = nowIso();
    if (kind === "retorno_checkout") return ok({ charge: c, note: "Retorno do navegador ao site não quita a cobrança: aguardando confirmação do provedor." });
    const map: Record<Exclude<typeof kind, "retorno_checkout">, { id: string; to: ChargeStatus; type: string }> = {
      confirmar: { id: `${c.id}:paid`, to: "paga", type: "PAYMENT_CONFIRMED (simulado)" },
      confirmar_duplicado: { id: `${c.id}:paid`, to: "paga", type: "PAYMENT_CONFIRMED (simulado, repetido)" },
      expirar: { id: `${c.id}:overdue`, to: "vencida", type: "PAYMENT_OVERDUE (simulado)" },
      erro: { id: `${c.id}:error:${cid()}`, to: "erro", type: "CHARGE_ERROR (simulado)" },
      estornar: { id: `${c.id}:refund`, to: "reembolsada", type: "PAYMENT_REFUNDED (simulado)" },
      cancelar: { id: `${c.id}:cancel`, to: "cancelada", type: "CHARGE_CANCELLED" },
    };
    const ev = map[kind];
    const r = applyChargeEvent(c, { ...ev, at, note: "" });
    let nextPays = pays;
    let note = r.applied ? `Evento aplicado: ${ev.type}` : "Evento ignorado (duplicado ou transição inválida). Nada mudou no financeiro.";
    if (r.applied && ev.to === "paga") {
      const key = `charge:${c.id}`;
      if (!pays.some((p) => p.idempotencyKey === key)) nextPays = [...pays, { id: `p-${cid()}`, organizationId: c.organizationId, installmentId: c.installmentId, amount: c.amount, date: DEMO_TODAY, method: c.method === "boleto" ? "boleto" : c.method === "cartao" ? "cartao" : "pix", source: "provedor_simulado", note: `Confirmação ${c.provider} (simulada)`, idempotencyKey: key }];
    }
    if (r.applied && ev.to === "reembolsada") {
      const orig = pays.find((p) => p.idempotencyKey === `charge:${c.id}`);
      if (orig && !pays.some((p) => p.reversalOf === orig.id)) nextPays = [...pays, { ...orig, id: `p-${cid()}`, amount: -orig.amount, reversalOf: orig.id, note: "Estorno pelo provedor (simulado)", idempotencyKey: `reversal:${orig.id}`, date: DEMO_TODAY }];
      note += " Estorno lançado como reverso.";
    }
    await writeMany({ charges: charges.map((x) => (x.id === chargeId ? r.charge : x)), payments: nextPays, installments: recompute(insts, nextPays), audit: [...audit, auditRow(ctx, "charge.event", "Charge", chargeId, ev.type)] });
    return ok({ charge: r.charge, note });
  },
};

// ---------------- Minutas (M13) ----------------
/** Campos de modelo não preenchidos: `[campo — não preenchido]` (gerado por fillTemplate). */
export const missingFields = (body: string) => [...body.matchAll(/\[([\w.]+) — não preenchido\]/g)].map((m) => m[1]);

export const draftService = {
  save: async (id: string, body: string, ctx: RequestContext): Promise<Result<LegalDraft>> => {
    const drafts = await readAll("drafts");
    const d = drafts.find((x) => x.id === id && x.organizationId === ctx.organizationId);
    if (!d) return fail("not_found", "Minuta não encontrada.");
    const at = nowIso();
    const materialChange = d.approvedHash && textHash(body) !== d.approvedHash;
    const next: LegalDraft = {
      ...d, body, updatedAt: at,
      versions: d.body === body ? d.versions : [...(d.versions ?? []), { n: (d.versions?.length ?? 0) + 1, at, actorId: ctx.actorId, body: d.body }].slice(-20),
      status: materialChange ? "ajustes" : d.status, approvedHash: materialChange ? undefined : d.approvedHash,
      history: [...d.history, { at, actorId: ctx.actorId, text: materialChange ? "Alteração após aprovação — aprovação invalidada" : "Texto salvo" }],
    };
    await writeMany({ drafts: drafts.map((x) => (x.id === id ? next : x)) });
    return ok(next);
  },
  setStatus: async (id: string, status: LegalDraft["status"], ctx: RequestContext) => {
    const [drafts, users] = await Promise.all([readAll("drafts"), readAll("users")]);
    const d = drafts.find((x) => x.id === id && x.organizationId === ctx.organizationId);
    if (!d) return fail("not_found", "Minuta não encontrada.");
    const role = users.find((u) => u.id === ctx.actorId)?.role;
    if (status === "aprovado" && !allowed(role, "aprovar_peca")) return fail("forbidden", "Somente advogado(a) ou administrador aprova peças.");
    if (status === "aprovado" && missingFields(d.body).length) return fail("missing", `Preencha antes de aprovar: ${missingFields(d.body).join(", ")}.`);
    if (status === "aprovado") {
      const blocking = checkCitations(d.body, (await readAll("legalSources")).filter((s) => s.organizationId === ctx.organizationId)).blocking;
      if (blocking.length) return fail("unverified_citation", `Citação sem fonte verificada: ${blocking.map((b) => b.citation).join(", ")}.`);
    }
    if (status === "exportado" && d.status !== "aprovado" && d.status !== "exportado") return fail("not_approved", "Aprove a minuta antes de exportar.");
    const next: LegalDraft = { ...d, status, approvedHash: status === "aprovado" ? textHash(d.body) : d.approvedHash, history: [...d.history, { at: nowIso(), actorId: ctx.actorId, text: `Status: ${status}` }] };
    await writeMany({ drafts: drafts.map((x) => (x.id === id ? next : x)) });
    return ok(next);
  },
};

// ---------------- WhatsApp: desconexão e outbox (cenário 5) ----------------
export const messagingService = {
  setConnection: async (status: "operacional" | "desconectado", ctx: RequestContext) => {
    const [ints, events] = await Promise.all([readAll("integrations"), readAll("integrationEvents")]);
    const at = nowIso();
    await writeMany({
      integrations: ints.map((i) => (i.provider === "evolution" && i.organizationId === ctx.organizationId ? { ...i, status, lastError: status === "desconectado" ? "Sessão do WhatsApp desconectada (simulação)" : undefined, lastSync: at } : i)),
      integrationEvents: [...events, { id: `ie-${cid()}`, organizationId: ctx.organizationId, provider: "evolution", correlationId: `corr-${cid()}`, type: status === "desconectado" ? "connection.close" : "connection.open", attempt: 1, at, status: status === "desconectado" ? "falha" : "sucesso", detail: status === "desconectado" ? "Instância desconectada (simulação)" : "Reconectada (simulação)" }],
    });
    return ok(true);
  },
  isConnected: async (orgId: string) => (await readAll("integrations")).find((i) => i.provider === "evolution" && i.organizationId === orgId)?.status === "operacional",
  /** Reenvia pendentes uma única vez por chave; mensagens enviadas não duplicam. */
  flush: async (ctx: RequestContext): Promise<Result<number>> => {
    const [outbox, msgs, events] = await Promise.all([readAll("outbox"), readAll("messages"), readAll("integrationEvents")]);
    const pend = outbox.filter((o) => o.organizationId === ctx.organizationId && o.status === "pendente");
    if (!pend.length) return ok(0);
    const at = nowIso();
    const sent = new Set(pend.map((o) => o.messageId));
    await writeMany({
      outbox: outbox.map((o) => (sent.has(o.messageId) && o.status === "pendente" ? { ...o, status: "enviada" as const, attempts: o.attempts + 1 } : o)),
      messages: msgs.map((m): Message => (sent.has(m.id) ? { ...m, status: "enviada" } : m)),
      integrationEvents: [...events, ...pend.map((o) => ({ id: `ie-${cid()}`, organizationId: ctx.organizationId, provider: "evolution", correlationId: o.idempotencyKey, type: "messages.send (retry)", attempt: o.attempts + 1, at, status: "reprocessado" as const, detail: "Mensagem pendente enviada após reconexão (simulação)" }))],
    });
    return ok(pend.length);
  },
};

// ---------------- Atualizações do portal (FLUXO G, PORT-02) ----------------
/** Rascunho interno → publicação explícita. Só o publicado vira status do portal. */
export const portalService = {
  draft: async (caseId: string, text: string, nextStep: string, ctx: RequestContext): Promise<Result<Case>> => {
    if (text.trim().length < 10) return fail("text", "Escreva a atualização em linguagem simples (mínimo 10 caracteres).");
    if (!nextStep.trim()) return fail("next", "Informe o próximo passo para o cliente.");
    const [cases, audit] = await Promise.all([readAll("cases"), readAll("audit")]);
    const k = cases.find((c) => c.id === caseId && c.organizationId === ctx.organizationId);
    if (!k) return fail("not_found", "Caso não encontrado.");
    const u: PortalUpdate = { id: `pu-${cid()}`, text: text.trim(), nextStep: nextStep.trim(), createdAt: nowIso(), authorId: ctx.actorId };
    const next: Case = { ...k, portalUpdates: [...(k.portalUpdates ?? []), u] };
    await writeMany({ cases: cases.map((c) => (c.id === caseId ? next : c)), audit: [...audit, auditRow(ctx, "portal.update_drafted", "Case", caseId, "Atualização do portal em rascunho")] });
    return ok(next);
  },
  publish: async (caseId: string, updateId: string, ctx: RequestContext): Promise<Result<Case>> => {
    const [cases, users, audit] = await Promise.all([readAll("cases"), readAll("users"), readAll("audit")]);
    const role = users.find((u) => u.id === ctx.actorId)?.role;
    if (!allowed(role, "publicar_portal")) return fail("forbidden", "Somente advogado(a) ou administrador publica no portal.");
    const k = cases.find((c) => c.id === caseId && c.organizationId === ctx.organizationId);
    const u = k?.portalUpdates?.find((x) => x.id === updateId);
    if (!k || !u) return fail("not_found", "Atualização não encontrada.");
    if (u.publishedAt) return ok(k); // idempotente
    const at = nowIso();
    const next: Case = { ...k, portalStatus: u.text, portalNextStep: u.nextStep, portalUpdates: k.portalUpdates!.map((x) => (x.id === updateId ? { ...x, publishedAt: at, publishedBy: ctx.actorId } : x)) };
    await writeMany({ cases: cases.map((c) => (c.id === caseId ? next : c)), audit: [...audit, auditRow(ctx, "portal.update_published", "Case", caseId, "Atualização publicada no portal")] });
    return ok(next);
  },
};
