// Dados DEMONSTRATIVOS da plataforma LexSion: planos, faturas SaaS, provedores e chamados. Valores fictícios.
import { PLAN_LABEL, PLAN_PRICES, PLAN_QUOTAS, type PlanId } from "@/domain/tenancy";
import type { PlanConfig, PlatformProvider, SaasInvoice, SupportTicket } from "@/domain/saas";

const MODULES: Record<PlanId, string[]> = {
  trial: ["Atendimento", "CRM", "Clientes", "Casos", "Agenda", "Financeiro"],
  essencial: ["Atendimento", "CRM", "Clientes", "Casos", "Agenda", "Prazos", "Financeiro", "Portal do cliente"],
  profissional: ["Tudo do Essencial", "Previdenciário", "Cálculos", "Minutas e DOCX", "Automações", "Relatórios"],
  avancado: ["Tudo do Profissional", "IA assistiva (quando conectada)", "Marketing", "Integrações"],
  enterprise: ["Tudo do Avançado", "Domínio próprio", "Suporte dedicado", "Contrato sob medida"],
};

export const plans: PlanConfig[] = (Object.keys(PLAN_LABEL) as PlanId[]).map((id) => ({
  id, label: PLAN_LABEL[id], prices: { ...PLAN_PRICES[id] }, quotas: { ...PLAN_QUOTAS[id] },
  trialDays: id === "trial" ? 15 : 0, modules: MODULES[id], whiteLabel: id !== "trial", customDomain: id === "avancado" || id === "enterprise",
}));

const inv = (id: string, org: string, plan: PlanId, cycle: SaasInvoice["cycle"], start: string, end: string, due: string, status: SaasInvoice["status"], paidAt?: string): SaasInvoice => ({
  id, organizationId: org, billingAccountOwner: "platform", plan, cycle, periodStart: start, periodEnd: end, due, amount: PLAN_PRICES[plan][cycle],
  status, provider: null, paidAt, processedEvents: [], history: [{ at: `${start}T08:00:00-03:00`, text: "Fatura gerada (demonstração)" }],
});

export const saasInvoices: SaasInvoice[] = [
  inv("fs-aurora-2026", "org-aurora", "profissional", "anual", "2026-01-15", "2027-01-14", "2026-01-20", "paga", "2026-01-18T10:00:00-03:00"),
  inv("fs-atlas-2026-09", "org-boreal", "essencial", "mensal", "2026-09-22", "2026-10-21", "2026-09-27", "paga", "2026-09-25T09:00:00-03:00"),
  inv("fs-atlas-2026-10", "org-boreal", "essencial", "mensal", "2026-10-22", "2026-11-21", "2026-10-27", "pendente"),
];

export const platformProviders: PlatformProvider[] = [
  { id: "asaas", name: "Asaas", status: "requires_credentials", environment: "sandbox", enabled: false, priority: 1, methods: { Pix: "suportado (documentação)", Boleto: "suportado (documentação)", "Cartão recorrente": "suportado (documentação)", Split: "a confirmar" }, notes: "Credenciais ficam só no servidor (fase backend)." },
  { id: "infinitepay", name: "InfinitePay", status: "planned", environment: "sandbox", enabled: false, priority: 2, methods: { "Link de pagamento": "a confirmar", Pix: "a confirmar", Recorrência: "a confirmar" }, notes: "Capacidades a confirmar na documentação oficial vigente." },
  { id: "mercadopago", name: "Mercado Pago", status: "planned", environment: "sandbox", enabled: false, priority: 3, methods: { Checkout: "suportado (documentação)", Pix: "suportado (documentação)", Assinaturas: "suportado (documentação)", Split: "a confirmar" }, notes: "Alternativa; webhooks com validação de assinatura no servidor." },
];

export const supportTickets: SupportTicket[] = [
  { id: "tk-1", organizationId: "org-boreal", subject: "Como importar clientes de planilha", priority: "normal", status: "aberto", slaHours: 24, createdAt: "2026-10-26T09:10:00-03:00", notes: [{ at: "2026-10-26T09:10:00-03:00", author: "Otávio Reis", text: "Temos 80 clientes em Excel.", internal: false }] },
  { id: "tk-2", organizationId: "org-novo", subject: "Dúvida sobre fim do período de teste", priority: "baixa", status: "aguardando_escritorio", slaHours: 48, createdAt: "2026-10-25T14:00:00-03:00", notes: [{ at: "2026-10-25T14:00:00-03:00", author: "Carlos Exemplo", text: "O que acontece depois do teste?", internal: false }, { at: "2026-10-25T15:00:00-03:00", author: "Suporte LexSion", text: "Explicado; aguardando escolha de plano.", internal: false }] },
];
