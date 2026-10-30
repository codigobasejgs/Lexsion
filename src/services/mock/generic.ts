// CRUD genérico do adapter mock: escopo por organização + auditoria sem dados pessoais completos.
import { readAll, writeMany, type CollectionName, type Row } from "./db";
import type { RequestContext, Result } from "../contracts";
import type { AuditEvent } from "@/domain/types";

export const cid = () => crypto.randomUUID().slice(0, 8);
export const nowIso = () => new Date().toISOString();
export const ok = <T,>(data: T): Result<T> => ({ ok: true, data, correlationId: cid() });
export const fail = (code: string, message: string, retryable = false): Result<never> => ({ ok: false, error: { code, message, retryable }, correlationId: cid() });

export function auditRow(ctx: RequestContext, action: string, entity: string, entityId: string, detail: string): AuditEvent {
  // id do evento com UUID completo: a gravação só-acréscimo deduplica por id, então colisão (8 chars) faria perder evento.
  return { id: `ev-${crypto.randomUUID()}`, organizationId: ctx.organizationId, at: nowIso(), actorId: ctx.actorId, action, entity, entityId, detail };
}

type OrgRow = { id: string; organizationId: string };

export async function createRow<C extends CollectionName>(name: C, row: Omit<Row<C>, "organizationId" | "id"> & { id?: string }, ctx: RequestContext, auditText: string): Promise<Result<Row<C>>> {
  const [rows, audit] = await Promise.all([readAll(name), readAll("audit")]);
  const id = row.id ?? (ctx.idempotencyKey ? `${name}-${ctx.idempotencyKey}` : `${name}-${cid()}`);
  const existing = rows.find((r) => r.id === id);
  if (existing) return ok(existing); // idempotente
  const full = { ...row, id, organizationId: ctx.organizationId } as unknown as Row<C>;
  await writeMany({ [name]: [...rows, full], audit: [...audit, auditRow(ctx, `${name}.created`, name, id, auditText)] } as never);
  return ok(full);
}

export async function updateRow<C extends CollectionName>(name: C, id: string, ctx: RequestContext, patch: (r: Row<C>) => Row<C> | string, auditText?: string): Promise<Result<Row<C>>> {
  const [rows, audit] = await Promise.all([readAll(name), readAll("audit")]);
  const idx = rows.findIndex((r) => r.id === id && (r as unknown as OrgRow).organizationId === ctx.organizationId);
  if (idx < 0) return fail("not_found", "Registro não encontrado neste escritório.");
  const next = patch(rows[idx]);
  if (typeof next === "string") return fail("invalid", next);
  const copy = [...rows];
  copy[idx] = next;
  await writeMany({ [name]: copy, ...(auditText ? { audit: [...audit, auditRow(ctx, `${name}.updated`, name, id, auditText)] } : {}) } as never);
  return ok(next);
}

export async function removeRow<C extends CollectionName>(name: C, id: string, ctx: RequestContext, auditText: string): Promise<Result<true>> {
  const [rows, audit] = await Promise.all([readAll(name), readAll("audit")]);
  if (!rows.some((r) => r.id === id && (r as unknown as OrgRow).organizationId === ctx.organizationId)) return fail("not_found", "Registro não encontrado.");
  await writeMany({ [name]: rows.filter((r) => r.id !== id), audit: [...audit, auditRow(ctx, `${name}.removed`, name, id, auditText)] } as never);
  return ok(true);
}
