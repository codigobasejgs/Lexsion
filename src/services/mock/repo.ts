// Adapter mock: lê/escreve no IndexedDB, filtra por organização e registra auditoria.
import { readAll, writeAll, writeMany, type CollectionName, type Row } from "./db";
import type { RequestContext, Result } from "../contracts";
import type { Conversation, Installment, Message, Payment, PensionAnalysis, Task } from "@/domain/types";
import { preparePayment, prepareReversal, recompute } from "@/domain/finance";
import { DEMO_TODAY } from "@/mocks/clock";
import { nextOccurrence } from "@/domain/recurrence";
import { scheduleWorkflow, WORKFLOW_TEMPLATES } from "@/domain/workflows";

const cid = () => crypto.randomUUID().slice(0, 8);
const ok = <T,>(data: T): Result<T> => ({ ok: true, data, correlationId: cid() });
const fail = (code: string, message: string, retryable = false): Result<never> => ({ ok: false, error: { code, message, retryable }, correlationId: cid() });

type OrgRow = { organizationId: string };

export async function list<C extends CollectionName>(name: C, orgId: string | null): Promise<Row<C>[]> {
  const rows = await readAll(name);
  if (orgId === null) return rows;
  return rows.filter((r) => !("organizationId" in (r as object)) || (r as OrgRow).organizationId === orgId);
}

async function audit(ctx: RequestContext, action: string, entity: string, entityId: string, detail: string) {
  const rows = await readAll("audit");
  await writeAll("audit", [...rows, { id: cid(), organizationId: ctx.organizationId, at: new Date().toISOString(), actorId: ctx.actorId, action, entity, entityId, detail }]);
}

async function update<C extends "tasks" | "conversations" | "pensionAnalyses">(
  name: C, id: string, ctx: RequestContext, patch: (r: Row<C>) => Row<C>,
): Promise<Result<Row<C>>> {
  const rows = await readAll(name);
  const idx = rows.findIndex((r) => r.id === id && (r as OrgRow).organizationId === ctx.organizationId);
  if (idx < 0) return fail("not_found", "Registro não encontrado neste escritório.");
  const next = patch(rows[idx]);
  const copy = [...rows];
  copy[idx] = next;
  await writeAll(name, copy as Row<C>[]);
  return ok(next);
}

export const tasksService = {
  toggle: (id: string, ctx: RequestContext) => tasksService.setStatus(id, "toggle", ctx),
  /**
   * Muda o estado da tarefa. Concluir uma ocorrência de série recorrente cria a próxima (uma só vez:
   * reabrir e concluir de novo não duplica). Tudo numa única gravação.
   */
  setStatus: async (id: string, to: "a_fazer" | "andamento" | "concluida" | "toggle", ctx: RequestContext): Promise<Result<Task>> => {
    const rows = await readAll("tasks");
    const t = rows.find((r) => r.id === id && r.organizationId === ctx.organizationId);
    if (!t) return fail("not_found", "Registro não encontrado neste escritório.");
    const done = to === "toggle" ? !t.done : to === "concluida";
    const next: Task = { ...t, done, inProgress: to === "andamento" };
    let created: Task | null = null;
    if (done && !t.done && t.recurrence) {
      const due = nextOccurrence(t.due, t.recurrence, t.anchorDay);
      const nextId = `${t.seriesId ?? t.id}-${due}`;
      if (due && !rows.some((r) => r.id === nextId)) {
        created = { ...t, id: nextId, due, done: false, inProgress: false, seriesId: t.seriesId ?? t.id, checklist: t.checklist?.map((c) => ({ ...c, done: false })), comments: [] };
      }
    }
    await writeAll("tasks", [...rows.map((r) => (r.id === id ? next : r)), ...(created ? [created] : [])]);
    if (created) await audit(ctx, "task.recurred", "Task", created.id, `Próxima ocorrência criada para ${created.due}`);
    return ok(next);
  },
  /**
   * Aplica um modelo de workflow ao caso: uma tarefa por etapa, cada uma dependente da anterior, prazos em dias úteis
   * com os feriados do escritório. Idempotente: ids determinísticos por caso+modelo (aplicar de novo não duplica).
   */
  applyWorkflow: async (templateId: string, caseId: string, assignees: Record<string, string>, ctx: RequestContext): Promise<Result<{ created: number; existing: number }>> => {
    const t = WORKFLOW_TEMPLATES.find((x) => x.id === templateId);
    if (!t) return fail("not_found", "Modelo de workflow não encontrado.");
    const [rows, cases, settings] = await Promise.all([readAll("tasks"), readAll("cases"), readAll("settings")]);
    const k = cases.find((c) => c.id === caseId && c.organizationId === ctx.organizationId);
    if (!k) return fail("not_found", "Caso não encontrado neste escritório.");
    const holidays = settings.find((s) => s.organizationId === ctx.organizationId)?.holidays ?? [];
    const plan = scheduleWorkflow(t, DEMO_TODAY, holidays);
    const ids = plan.map((_, i) => `wf-${caseId}-${t.id}-${i + 1}`);
    const fresh: Task[] = plan.flatMap(({ step, due }, i) => rows.some((r) => r.id === ids[i]) ? [] : [{
      id: ids[i], organizationId: ctx.organizationId, title: `${i + 1}/${plan.length} · ${step.title}`, caseId, clientId: k.clientId, assigneeId: assignees[step.role] ?? k.ownerId,
      due, priority: "normal" as const, done: false, dependsOn: i ? [ids[i - 1]] : undefined, checklist: step.checklist?.map((c, j) => ({ id: `${ids[i]}-c${j}`, text: c, done: false })),
      comments: [{ at: new Date().toISOString(), actorId: ctx.actorId, text: `Criada pelo workflow “${t.name}”` }],
    }]);
    if (fresh.length) {
      await writeAll("tasks", [...rows, ...fresh]);
      await audit(ctx, "workflow.applied", "Case", caseId, `${t.name}: ${fresh.length} tarefa(s)`);
    }
    return ok({ created: fresh.length, existing: plan.length - fresh.length });
  },
};

export const inboxService = {
  /** Assumir pausa a IA (A05). */
  takeOver: async (id: string, ctx: RequestContext) => {
    const r = await update("conversations", id, ctx, (c: Conversation) => ({ ...c, aiActive: false, assigneeId: ctx.actorId, status: "aguardando_equipe" }));
    if (r.ok) await audit(ctx, "conversation.assigned", "Conversation", id, "Atendimento assumido; IA pausada");
    return r;
  },
  resumeAi: async (id: string, ctx: RequestContext) => {
    const r = await update("conversations", id, ctx, (c: Conversation) => ({ ...c, aiActive: true, status: "ia" }));
    if (r.ok) await audit(ctx, "conversation.aiResumed", "Conversation", id, "IA retomada explicitamente");
    return r;
  },
  markRead: (id: string, ctx: RequestContext) => update("conversations", id, ctx, (c: Conversation) => ({ ...c, unread: 0 })),
  setStatus: (id: string, status: Conversation["status"], ctx: RequestContext) =>
    update("conversations", id, ctx, (c: Conversation) => ({ ...c, status, aiActive: status === "encerrada" ? false : c.aiActive })),
  updateSummary: (id: string, summary: string, ctx: RequestContext) => update("conversations", id, ctx, (c: Conversation) => ({ ...c, summary })),
  /** Humano só envia com a IA pausada — evita resposta simultânea humano/robô. */
  send: async (conversationId: string, text: string, kind: "equipe" | "nota", ctx: RequestContext): Promise<Result<Message>> => {
    const convs = await readAll("conversations");
    const conv = convs.find((c) => c.id === conversationId && c.organizationId === ctx.organizationId);
    if (!conv) return fail("not_found", "Conversa não encontrada.");
    if (kind === "equipe" && conv.aiActive) return fail("ai_active", "Assuma o atendimento antes de responder: a assistente virtual está ativa nesta conversa.");
    const trimmed = text.trim();
    if (!trimmed) return fail("empty", "Escreva uma mensagem.");
    const [msgs, ints, outbox] = await Promise.all([readAll("messages"), readAll("integrations"), readAll("outbox")]);
    if (ctx.idempotencyKey && msgs.some((m) => m.id === ctx.idempotencyKey)) return ok(msgs.find((m) => m.id === ctx.idempotencyKey)!);
    // WhatsApp desconectado ⇒ mensagem fica pendente na fila (cenário 5); enviada uma vez ao reconectar.
    const connected = ints.find((i) => i.provider === "evolution" && i.organizationId === ctx.organizationId)?.status === "operacional";
    const msg: Message = {
      id: ctx.idempotencyKey ?? cid(), organizationId: ctx.organizationId, conversationId, author: kind, authorId: ctx.actorId,
      text: trimmed, at: new Date().toISOString(), status: kind === "equipe" ? "fila" : undefined, simulated: kind === "equipe",
    };
    if (kind === "equipe" && !connected) {
      await writeMany({ messages: [...msgs, msg], outbox: [...outbox, { id: `ob-${msg.id}`, organizationId: ctx.organizationId, conversationId, messageId: msg.id, idempotencyKey: `msg:${msg.id}`, status: "pendente", attempts: 0 }] });
    } else await writeAll("messages", [...msgs, msg]);
    await update("conversations", conversationId, ctx, (c: Conversation) => ({ ...c, lastMessageAt: msg.at, status: kind === "equipe" ? "aguardando_cliente" : c.status }));
    return ok(msg);
  },
};

export const financeService = {
  registerPayment: async (input: Omit<Payment, "id" | "organizationId" | "reversalOf">, ctx: RequestContext): Promise<Result<{ payment: Payment; duplicate: boolean }>> => {
    const [insts, pays] = await Promise.all([readAll("installments"), readAll("payments")]);
    const inst = insts.find((i) => i.id === input.installmentId && i.organizationId === ctx.organizationId);
    const r = preparePayment(inst, pays, input, cid());
    if (!r.ok) {
      const msg = { valor_invalido: "Informe um valor maior que zero.", excede_saldo: "O valor é maior que o saldo da parcela.", parcela_inexistente: "Parcela não encontrada.", parcela_cancelada: "Parcela cancelada não recebe pagamentos." }[r.error];
      return fail(r.error, msg);
    }
    if (!r.duplicate) {
      const nextPays = [...pays, r.payment];
      await writeAll("payments", nextPays);
      await writeAll("installments", recompute(insts as Installment[], nextPays));
      await audit(ctx, "payment.registered", "Installment", input.installmentId, `Baixa ${input.source} registrada`);
    }
    return ok({ payment: r.payment, duplicate: r.duplicate });
  },
  reverse: async (paymentId: string, note: string, ctx: RequestContext): Promise<Result<Payment>> => {
    const [insts, pays] = await Promise.all([readAll("installments"), readAll("payments")]);
    const original = pays.find((p) => p.id === paymentId && p.organizationId === ctx.organizationId);
    if (!original) return fail("not_found", "Pagamento não encontrado.");
    if (!note.trim()) return fail("note_required", "Informe o motivo do estorno.");
    const rev = prepareReversal(original, pays, cid(), note.trim(), DEMO_TODAY);
    if (!rev) return fail("already_reversed", "Este pagamento já foi estornado.");
    const nextPays = [...pays, rev];
    await writeAll("payments", nextPays);
    await writeAll("installments", recompute(insts as Installment[], nextPays));
    await audit(ctx, "payment.reversed", "Payment", paymentId, "Estorno registrado");
    return ok(rev);
  },
};

export const pensionService = {
  togglePending: (id: string, pendingId: string, ctx: RequestContext) =>
    update("pensionAnalyses", id, ctx, (a: PensionAnalysis) => ({
      ...a,
      inputsVersion: a.inputsVersion + 1, // alterar entrada invalida resultado anterior (A07)
      pending: a.pending.map((p) => (p.id === pendingId ? { ...p, resolved: !p.resolved } : p)),
    })),
  setStep: (id: string, step: number, ctx: RequestContext) => update("pensionAnalyses", id, ctx, (a: PensionAnalysis) => ({ ...a, step })),
  /** Demo: "recalcular" só re-marca os resultados fixos como atuais; não existe motor de cálculo. */
  acceptDemoResults: (id: string, ctx: RequestContext) =>
    update("pensionAnalyses", id, ctx, (a: PensionAnalysis) => ({ ...a, resultsVersion: a.inputsVersion })),
};
