// Camada de adaptadores para provedores externos. Nesta fase TODOS rodam em modo "demo" ou "not_configured":
// nenhum faz chamada de rede, nenhum guarda segredo no navegador. A fase backend troca a implementação
// (rotas de servidor + credenciais em variáveis de ambiente), mantendo estes contratos e as telas.
import type { Cents } from "@/lib/money";
import type { Result } from "./contracts";
import type { IntegrationStatus } from "@/domain/saas";

export type AdapterMode = "demo" | "not_configured" | "real";

export interface ProviderInfo {
  id: string;
  name: string;
  category: "dados" | "mensagens" | "email" | "pagamentos" | "assinatura" | "armazenamento" | "juridico" | "ia" | "indices" | "anuncios";
  mode: AdapterMode;
  status: IntegrationStatus; // "active" é impossível sem backend (testado)
  owner: "platform" | "tenant"; // quem contrata e configura
  requires: string[]; // NOMES das credenciais/variáveis necessárias (nunca valores)
  notes: string;
}

// ---- DTOs de pagamento (PaymentProviderAdapter) ----
export type BillingAccountOwner = "platform" | "tenant";
export interface CreateCheckout { billingAccountOwner: BillingAccountOwner; organizationId: string; amount: Cents; description: string; methods: ("pix" | "boleto" | "cartao")[]; idempotencyKey: string; dueDate?: string }
export interface Charge { id: string; externalId: string | null; status: "pendente" | "paga" | "vencida" | "falhou" | "estornada" | "cancelada"; amount: Cents; simulated: true }
export interface Subscription { id: string; organizationId: string; plan: string; cycle: "mensal" | "trimestral" | "anual"; status: "trial" | "ativa" | "inadimplente" | "cancelada" }
export interface Invoice { id: string; subscriptionId: string; amount: Cents; due: string; status: Charge["status"] }
export interface Refund { chargeId: string; amount: Cents; reason: string }
export interface WebhookEvent { id: string; provider: string; type: string; receivedAt: string; signatureValid: boolean | "not_checked_in_demo"; payload: unknown }
export interface Payout { id: string; amount: Cents; scheduledFor: string }
export interface ProviderStatus { provider: string; status: IntegrationStatus; checkedAt: string; detail: string }

export interface PaymentProviderAdapter {
  info: ProviderInfo;
  createCheckout(input: CreateCheckout): Promise<Result<Charge>>;
  getCharge(id: string): Promise<Result<Charge>>;
  refund(input: Refund): Promise<Result<Charge>>;
  /** Na fase backend: validar assinatura do provedor NO SERVIDOR antes de aplicar (nunca no navegador). */
  parseWebhook(raw: unknown): Promise<Result<WebhookEvent>>;
  status(): Promise<ProviderStatus>;
}

export interface MessagingAdapter { info: ProviderInfo; send(input: { to: string; text: string; consent: boolean }): Promise<Result<{ id: string; simulated: true }>> }
export interface EmailAdapter { info: ProviderInfo; send(input: { to: string; subject: string; html: string; organizationId: string }): Promise<Result<{ id: string; simulated: true }>> }
export interface SignatureAdapter { info: ProviderInfo; createEnvelope(input: { documentName: string; signers: { name: string; email: string }[] }): Promise<Result<{ envelopeId: string; simulated: true }>> }
export interface LegalDataAdapter { info: ProviderInfo; search(input: { cnj: string }): Promise<Result<{ found: false; reason: string }>> }
export interface ObjectStorageAdapter { info: ProviderInfo; signedUploadUrl(input: { key: string; contentType: string }): Promise<Result<never>> }
/** Índices de correção (série mensal). Hoje a série é INFORMADA pelo usuário na central de cálculos. */
export interface IndexSourceAdapter { info: ProviderInfo; series(input: { index: string; from: string; to: string }): Promise<Result<{ month: string; rate: number }[]>> }
export interface AIProviderAdapter { info: ProviderInfo; suggest(input: { prompt: string }): Promise<Result<{ text: string; requiresHumanReview: true }>> }

const cid = () => crypto.randomUUID().slice(0, 8);
const notConfigured = (name: string): Result<never> => ({ ok: false, error: { code: "not_configured", message: `${name} não está configurado nesta versão. Nada foi enviado, cobrado ou assinado.`, retryable: false }, correlationId: cid() });
const now = () => new Date().toISOString();

function payment(id: string, name: string, notes: string): PaymentProviderAdapter {
  const info: ProviderInfo = { id, name, category: "pagamentos", mode: "demo", status: "requires_credentials", owner: "platform", requires: [`${id.toUpperCase()}_API_KEY`, `${id.toUpperCase()}_WEBHOOK_SECRET`], notes };
  return {
    info,
    // Demo: cobrança simulada local, explicitamente marcada; nenhum provedor é chamado.
    createCheckout: async (input) => input.amount <= 0 ? { ok: false, error: { code: "valor_invalido", message: "Valor deve ser maior que zero.", retryable: false }, correlationId: cid() } : { ok: true, data: { id: `sim-${input.idempotencyKey}`, externalId: null, status: "pendente", amount: input.amount, simulated: true }, correlationId: cid() },
    getCharge: async () => notConfigured(name),
    refund: async () => notConfigured(name),
    parseWebhook: async (raw) => ({ ok: true, data: { id: `evt-${cid()}`, provider: id, type: "simulado", receivedAt: now(), signatureValid: "not_checked_in_demo", payload: raw }, correlationId: cid() }),
    status: async () => ({ provider: id, status: info.status, checkedAt: now(), detail: "Sem credenciais: apenas simulação local." }),
  };
}

export const paymentAdapters = {
  asaas: payment("asaas", "Asaas", "Pix, boleto e cartão; split a confirmar com o provedor."),
  infinitepay: payment("infinitepay", "InfinitePay", "Capacidades a confirmar na documentação oficial vigente."),
  mercadopago: payment("mercadopago", "Mercado Pago", "Checkout e assinaturas; webhooks validados no servidor."),
};

export const messagingAdapter: MessagingAdapter = {
  info: { id: "evolution", name: "Evolution API (WhatsApp)", category: "mensagens", mode: "demo", status: "requires_credentials", owner: "tenant", requires: ["EVOLUTION_API_URL", "EVOLUTION_API_KEY"], notes: "Sessão persistente exige servidor próprio; opt-in e opt-out obrigatórios." },
  send: async (input) => input.consent ? { ok: true, data: { id: `sim-${cid()}`, simulated: true }, correlationId: cid() } : { ok: false, error: { code: "sem_consentimento", message: "Sem consentimento registrado do destinatário.", retryable: false }, correlationId: cid() },
};
export const emailAdapter: EmailAdapter = {
  info: { id: "resend", name: "Resend (e-mail)", category: "email", mode: "demo", status: "requires_credentials", owner: "platform", requires: ["RESEND_API_KEY"], notes: "Domínio remetente precisa estar verificado (SPF/DKIM) antes do envio real." },
  send: async () => ({ ok: true, data: { id: `sim-${cid()}`, simulated: true }, correlationId: cid() }),
};
export const signatureAdapter: SignatureAdapter = {
  info: { id: "zapsign", name: "ZapSign (assinatura)", category: "assinatura", mode: "demo", status: "requires_credentials", owner: "tenant", requires: ["ZAPSIGN_API_TOKEN"], notes: "Assinatura simulada não tem validade jurídica." },
  createEnvelope: async () => ({ ok: true, data: { envelopeId: `sim-${cid()}`, simulated: true }, correlationId: cid() }),
};
export const legalDataAdapter: LegalDataAdapter = {
  info: { id: "datajud", name: "CNJ DataJud e tribunais", category: "juridico", mode: "not_configured", status: "planned", owner: "platform", requires: ["DATAJUD_API_KEY (chave pública do CNJ, pode mudar)"], notes: "Só metadados públicos (capa e movimentações); sem partes, inteiro teor ou sigilosos. Termos do CNJ restringem uso comercial: avaliar antes de conectar." },
  search: async () => ({ ok: true, data: { found: false, reason: "Consulta processual ainda não conectada. Cadastre o andamento manualmente." }, correlationId: cid() }),
};
export const storageAdapter: ObjectStorageAdapter = {
  info: { id: "storage", name: "Armazenamento de arquivos (Supabase Storage ou Cloudflare R2)", category: "armazenamento", mode: "not_configured", status: "planned", owner: "platform", requires: ["SUPABASE_SECRET_KEY ou R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY"], notes: "Arquivos privados por escritório com URLs assinadas de curta duração." },
  signedUploadUrl: async () => notConfigured("O armazenamento de arquivos"),
};
export const aiAdapter: AIProviderAdapter = {
  info: { id: "ia", name: "Assistente de IA", category: "ia", mode: "demo", status: "planned", owner: "platform", requires: ["provedor e contrato a definir"], notes: "Respostas fixas na demonstração; revisão humana obrigatória." },
  suggest: async () => ({ ok: true, data: { text: "Sugestão de demonstração (texto fixo). Revise antes de usar.", requiresHumanReview: true }, correlationId: cid() }),
};
export const indexSourceAdapter: IndexSourceAdapter = {
  info: { id: "cj-indices", name: "API de índices (Cálculo Jurídico)", category: "indices", mode: "not_configured", status: "planned", owner: "platform", requires: ["CJ_API_KEY (cabeçalho X-CJ-API-KEY, só servidor)"], notes: "Produto comercial só de índices (tribunais, compostos, IPCA/INPC/SELIC etc.); não inclui as calculadoras. Chave por contato comercial; limites por plano." },
  series: async () => notConfigured("A fonte de índices"),
};
export const legalKnowledgeInfo: ProviderInfo = { id: "jusbrasil", name: "Jusbrasil Soluções (API)", category: "juridico", mode: "not_configured", status: "planned", owner: "platform", requires: ["contrato e credencial a definir"], notes: "Documentação pública não acessível em 28/10/2026 (bloqueio anti-bot). Não presumir API do Jus IA; avaliar produto e licença com o fornecedor." };
export const adsInfo: ProviderInfo[] = [
  { id: "meta-ads", name: "Meta Ads (campanhas e leads)", category: "anuncios", mode: "not_configured", status: "planned", owner: "tenant", requires: ["OAuth da conta do escritório (servidor)"], notes: "Importa leads com UTM; nunca dispara campanha nesta fase. Publicidade conforme Provimento OAB 205/2021." },
  { id: "google-ads", name: "Google Ads (campanhas e conversões)", category: "anuncios", mode: "not_configured", status: "planned", owner: "tenant", requires: ["OAuth da conta do escritório (servidor)"], notes: "Leitura de métricas e conversões; sem disparo nesta fase." },
];
export const authAdapterInfo: ProviderInfo = { id: "supabase", name: "Supabase (login, banco e regras de acesso)", category: "dados", mode: "not_configured", status: "requires_credentials", owner: "platform", requires: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY (só servidor)"], notes: "Fase 2: autenticação, separação por escritório no banco (RLS) e auditoria." };

export const ALL_PROVIDERS: ProviderInfo[] = [authAdapterInfo, emailAdapter.info, messagingAdapter.info, ...Object.values(paymentAdapters).map((a) => a.info), signatureAdapter.info, storageAdapter.info, legalDataAdapter.info, aiAdapter.info, indexSourceAdapter.info, legalKnowledgeInfo, ...adsInfo];
