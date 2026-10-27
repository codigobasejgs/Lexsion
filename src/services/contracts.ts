// Contratos de serviço (seção 8). Telas dependem só destas interfaces; o adapter mock é trocável por um remoto.
// IDs de organização vindos do cliente NÃO são autorização: o backend futuro valida sessão e vínculo.
import type { Charge, ChargeStatus, Message } from "@/domain/types";
import type { Cents } from "@/lib/money";
import type { CivilDate } from "@/lib/dates";

export type Result<T> =
  | { ok: true; data: T; correlationId: string }
  | { ok: false; error: { code: string; message: string; retryable: boolean }; correlationId: string };

export interface RequestContext {
  organizationId: string;
  actorId: string;
  idempotencyKey?: string;
}

export type CapabilityState = "supported" | "unsupported" | "pending_validation";
export type IntegrationMode = "demo" | "sandbox" | "production";

export interface CreateChargeInput {
  installmentId: string;
  amount: Cents;
  due: CivilDate;
  method: Charge["method"];
  payer: { name: string; document: string; email?: string };
}

export interface PaymentProvider {
  capabilities(): Record<string, CapabilityState>;
  createCharge(input: CreateChargeInput, ctx: RequestContext): Promise<Result<Charge>>;
  getCharge(id: string, ctx: RequestContext): Promise<Result<Charge>>;
  cancelCharge(id: string, ctx: RequestContext): Promise<Result<Charge>>;
  /** Webhook validado no servidor conforme o mecanismo do provedor (não inventar HMAC). */
  parseEvent?(raw: unknown): { id: string; chargeExternalId: string; to: ChargeStatus } | null;
}

export interface MessagingProvider {
  capabilities(): Record<string, CapabilityState>;
  send(input: { conversationId: string; to: string; text: string }, ctx: RequestContext): Promise<Result<Message>>;
  connectionStatus(ctx: RequestContext): Promise<Result<"open" | "close" | "connecting">>;
}

export interface EmailProvider {
  send(input: { to: string; subject: string; html: string; templateId?: string }, ctx: RequestContext): Promise<Result<{ id: string }>>;
}

export interface SignatureProvider {
  createEnvelope(input: { contractId: string; pdf: Blob; signers: { name: string; email?: string; phone?: string; order: number }[] }, ctx: RequestContext): Promise<Result<{ envelopeId: string }>>;
  getStatus(envelopeId: string, ctx: RequestContext): Promise<Result<{ status: "preparado" | "enviado" | "parcial" | "concluido" | "recusado" | "expirado" | "cancelado" | "erro" }>>;
}

export interface LegalDataProvider {
  coverage(): { source: string; scope: string; realtime: boolean }[];
  fetchMovements(processNumber: string, ctx: RequestContext): Promise<Result<{ externalId: string; at: string; text: string }[]>>;
}

export interface AIProvider {
  suggest(input: { purpose: "resposta" | "resumo" | "minuta"; context: string; sources: string[] }, ctx: RequestContext): Promise<Result<{ text: string; sources: string[] }>>;
}

export interface StorageProvider {
  put(file: Blob, meta: { name: string; mime: string }, ctx: RequestContext): Promise<Result<{ fileId: string }>>;
  signedUrl(fileId: string, ctx: RequestContext): Promise<Result<{ url: string; expiresAt: string }>>;
}

export interface AdvertisingProvider {
  campaigns(ctx: RequestContext): Promise<Result<{ id: string; name: string; spent: Cents | null }[]>>;
}
