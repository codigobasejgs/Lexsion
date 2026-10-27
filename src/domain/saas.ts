// Cobrança da PLATAFORMA (LexSion → escritório). Totalmente separada dos honorários (escritório → cliente final).
import type { Cents } from "@/lib/money";
import type { BillingCycle, PlanId, PlanQuotas } from "./tenancy";

export type ProviderId = "asaas" | "infinitepay" | "mercadopago";
/** Estados honestos de integração. "active" exige backend com credenciais no servidor: proibido nesta fase. */
export type IntegrationStatus = "planned" | "demo" | "requires_credentials" | "configured" | "testing" | "active" | "error" | "disabled";
export const INTEGRATION_STATUS_LABEL: Record<IntegrationStatus, string> = {
  planned: "Planejado", demo: "Demonstração", requires_credentials: "Requer credenciais", configured: "Configurado",
  testing: "Em teste", active: "Ativo", error: "Com erro", disabled: "Desativado",
};

export type InvoiceStatus = "pendente" | "paga" | "vencida" | "falhou" | "reembolsada" | "estornada" | "disputada" | "cancelada";
export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  pendente: "Pendente", paga: "Paga", vencida: "Vencida", falhou: "Falhou", reembolsada: "Reembolsada", estornada: "Estornada", disputada: "Em disputa", cancelada: "Cancelada",
};

export interface SaasInvoice {
  id: string;
  organizationId: string; // escritório pagador (lido só pela plataforma e, em modo leitura, pelo próprio escritório)
  billingAccountOwner: "platform";
  plan: PlanId;
  cycle: BillingCycle;
  periodStart: string; // AAAA-MM-DD
  periodEnd: string;
  due: string;
  amount: Cents;
  status: InvoiceStatus;
  provider: ProviderId | null;
  paidAt?: string;
  processedEvents: string[]; // ids de webhook já aplicados (idempotência)
  history: { at: string; text: string }[];
}

export interface PlatformProvider {
  id: ProviderId;
  name: string;
  status: IntegrationStatus;
  environment: "sandbox" | "live";
  enabled: boolean;
  priority: number;
  methods: Record<string, "a confirmar" | "suportado (documentação)" | "não suportado">;
  notes: string;
}

export interface PlanConfig {
  id: PlanId;
  label: string;
  prices: Record<BillingCycle, Cents>;
  quotas: PlanQuotas;
  trialDays: 7 | 15 | 30 | 0;
  modules: string[];
  whiteLabel: boolean;
  customDomain: boolean;
}

export interface SupportTicket {
  id: string;
  organizationId: string;
  subject: string;
  priority: "baixa" | "normal" | "alta" | "urgente";
  status: "aberto" | "em_andamento" | "aguardando_escritorio" | "resolvido";
  slaHours: number;
  createdAt: string;
  notes: { at: string; author: string; text: string; internal: boolean }[];
}

/**
 * Prorrata SIMULADA de troca de plano no meio do ciclo (centavos).
 * crédito = valor não usado do plano atual; cobrança = parte restante do novo. Positivo = escritório paga a diferença.
 */
export function prorata(currentPeriodPrice: Cents, newPeriodPrice: Cents, daysLeft: number, daysInPeriod: number): { credit: Cents; charge: Cents; difference: Cents } {
  if (daysInPeriod <= 0 || daysLeft < 0 || daysLeft > daysInPeriod) throw new Error("Período inválido");
  const credit = Math.round((currentPeriodPrice * daysLeft) / daysInPeriod);
  const charge = Math.round((newPeriodPrice * daysLeft) / daysInPeriod);
  return { credit, charge, difference: charge - credit };
}

/** Aplica um evento de webhook (simulado) uma única vez. Retorna null se já processado ou transição inválida. */
export function applyInvoiceEvent(inv: SaasInvoice, ev: { id: string; type: "pagamento_confirmado" | "pagamento_falhou" | "estorno" | "disputa"; at: string }): SaasInvoice | null {
  if (inv.processedEvents.includes(ev.id)) return null;
  const allowed: Record<typeof ev.type, InvoiceStatus[]> = {
    pagamento_confirmado: ["pendente", "vencida", "falhou"],
    pagamento_falhou: ["pendente", "vencida"],
    estorno: ["paga"],
    disputa: ["paga"],
  };
  if (!allowed[ev.type].includes(inv.status)) return null;
  const to: InvoiceStatus = { pagamento_confirmado: "paga", pagamento_falhou: "falhou", estorno: "estornada", disputa: "disputada" }[ev.type] as InvoiceStatus;
  return {
    ...inv, status: to, paidAt: to === "paga" ? ev.at : inv.paidAt, processedEvents: [...inv.processedEvents, ev.id],
    history: [...inv.history, { at: ev.at, text: `Evento simulado “${ev.type}” aplicado (${ev.id})` }],
  };
}
