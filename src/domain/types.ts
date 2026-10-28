// Entidades de domínio (seção 8). Vínculos sempre por ID; toda entidade de escritório tem organizationId.
import type { Cents } from "@/lib/money";
import type { CivilDate } from "@/lib/dates";

export type ID = string;

// 12 papéis do produto (ver ROLE_PRODUCT em permissions.ts). Identificadores legados preservados para não migrar dados.
export type Role =
  | "superadmin" | "platform_admin" | "platform_support" // plataforma LexSion
  | "admin" | "tenant_admin" | "advogado" | "controladoria" | "financeiro" | "atendimento" | "estagiario" // escritório
  | "cliente" | "external_collaborator"; // externos ao escritório

export interface Organization {
  id: ID;
  name: string;
  city: string;
  focus: string;
}

export interface User {
  id: ID;
  name: string;
  role: Role;
  organizationId: ID | null; // superadmin não pertence a um escritório
  clientId?: ID; // perfil cliente do portal
}

interface OrgEntity {
  id: ID;
  organizationId: ID;
}

export interface Client extends OrgEntity {
  kind: "PF" | "PJ";
  name: string;
  leadId?: ID; // vínculo com o lead de origem (atribuição preservada)
  socialName?: string;
  document: string; // CPF/CNPJ sintético — string, nunca chave
  birthDate?: CivilDate;
  phone: string;
  email?: string;
  city: string;
  uf: string;
  profession?: string;
  ownerId: ID;
  origin: string;
  status: "ativo" | "arquivado";
  createdAt: string;
}

export type CasePhase = "triagem" | "documentacao" | "analise" | "administrativo" | "judicial" | "cumprimento" | "encerrado";

export interface Case extends OrgEntity {
  clientId: ID;
  title: string;
  area: string;
  service: string;
  kind: "consultivo" | "administrativo" | "judicial";
  phase: CasePhase;
  priority: "baixa" | "normal" | "alta";
  ownerId: ID;
  processNumber?: string;
  confidential: boolean;
  portalStatus: string; // texto leigo liberado ao cliente
  portalNextStep: string;
  /** Atualizações para o portal: só as publicadas aparecem ao cliente. */
  portalUpdates?: PortalUpdate[];
}

export interface PortalUpdate {
  id: ID;
  text: string;
  nextStep: string;
  createdAt: string;
  authorId: ID;
  publishedAt?: string;
  publishedBy?: ID;
}

export interface Task extends OrgEntity {
  title: string;
  caseId?: ID;
  clientId?: ID;
  assigneeId: ID;
  due: CivilDate;
  priority: "baixa" | "normal" | "alta";
  done: boolean;
  inProgress?: boolean;
  checklist?: { id: ID; text: string; done: boolean }[];
  comments?: { at: string; actorId: ID; text: string }[];
  dependsOn?: ID[];
  /** Tarefa recorrente: ao concluir, cria a próxima ocorrência (série identificada por seriesId). */
  recurrence?: { every: "semana" | "quinzena" | "mes" | "ano"; until?: CivilDate; paused?: boolean };
  seriesId?: ID;
  anchorDay?: number; // dia original (31) preservado ao passar por meses curtos
}

export interface Deadline extends OrgEntity {
  caseId: ID;
  title: string;
  eventType?: string; // "Intimação", "Citação", "Exigência INSS"…
  start: CivilDate; // marco inicial
  days: number;
  counting: "uteis" | "corridos";
  court?: string;
  calendarVersion?: string;
  proposedEnd: CivilDate;
  confirmedEnd?: CivilDate;
  reviewerId?: ID;
  justification?: string;
  publicationId?: ID;
  status: "proposto" | "confirmado" | "cumprido";
}

export interface CalendarEvent extends OrgEntity {
  title: string;
  type: "audiencia" | "pericia" | "reuniao" | "atendimento";
  start: string; // instante ISO
  end: string;
  location: string;
  caseId?: ID;
  clientId?: ID;
  ownerId: ID;
  visibleToClient: boolean;
  participants?: string[];
  requiredDocs?: string[];
  notes?: string;
  attendance?: "pendente" | "compareceu" | "ausente" | "cancelado";
  result?: string;
  history?: { at: string; actorId: ID; text: string }[];
}

export interface CourtProcess extends OrgEntity {
  caseId: ID;
  cnj?: string; // número CNJ (validado) quando judicial
  adminNumber?: string; // número administrativo (INSS etc.), formato livre
  court: string; // TRF1, INSS…
  system: string; // PJe, eproc, Meu INSS…
  instance: string;
  venue: string; // vara/comarca/APS
  className: string;
  subject: string;
  filedOn?: CivilDate;
  lastSync?: string;
  syncStatus: "manual" | "importado" | "conector_planejado";
}

export interface CaseEvent extends OrgEntity {
  caseId: ID;
  processId?: ID;
  at: string; // data do evento
  collectedAt: string;
  source: string;
  externalId?: string;
  text: string;
  reviewed: boolean;
}

export interface Publication extends OrgEntity {
  processId?: ID;
  caseId?: ID;
  source: string;
  publishedOn: CivilDate;
  text: string;
  status: "nova" | "triada" | "prazo_criado" | "descartada";
  triageNote?: string;
}

export type ConversationStatus = "ia" | "aguardando_equipe" | "aguardando_cliente" | "encerrada";

export interface Conversation extends OrgEntity {
  contactName: string;
  phone: string;
  clientId?: ID;
  leadId?: ID;
  caseId?: ID;
  channel: "whatsapp";
  status: ConversationStatus;
  aiActive: boolean;
  assigneeId?: ID;
  unread: number;
  lastMessageAt: string;
  campaign?: string;
  summary: string;
  missingDocs: string[];
  tags: string[];
}

export type MessageAuthor = "contato" | "ia" | "equipe" | "nota";
export type MessageStatus = "rascunho" | "fila" | "enviada" | "entregue" | "lida" | "falhou" | "cancelada";

export interface Message extends OrgEntity {
  conversationId: ID;
  author: MessageAuthor;
  authorId?: ID;
  text: string;
  at: string;
  status?: MessageStatus;
  simulated?: boolean;
}

export type StageKey = "novo" | "atendimento" | "triagem" | "documentos" | "analise" | "proposta" | "assinatura" | "contratado" | "perdido";

export interface AttributionTouch {
  at: string;
  evidence: "confirmada" | "declarada" | "nao_identificada";
  origin: string; // "Meta Ads", "Indicação", "Origem não identificada"…
  campaign?: string;
  utm?: Record<string, string>;
  clickId?: string;
  landingPage?: string;
}

export interface Lead extends OrgEntity {
  name: string;
  phone: string; // normalizado: só dígitos com 55
  email?: string;
  city?: string;
  uf?: string;
  area: string;
  service: string;
  stage: StageKey;
  stageEnteredAt: string;
  firstTouch: AttributionTouch;
  lastTouch: AttributionTouch;
  ownerId?: ID;
  clientId?: ID; // preenchido na conversão; o lead não é apagado
  conversationId?: ID;
  nextAction?: string;
  lostReason?: string;
  consentContact: boolean;
  tags: string[];
  history: { at: string; from?: StageKey; to: StageKey; actorId: ID; note?: string }[];
  createdAt: string;
  triage?: { area: string; answers: Record<string, string>; checklist: string[]; at: string; actorId: ID; routedTo: ID };
}

export type DocType = "CNIS" | "CTPS" | "PPP" | "Laudo" | "Exame" | "HISCRE" | "Documento pessoal" | "Contrato" | "Comprovante" | "Carta de concessão" | "Peça" | "Outro";

export interface ExtractedField {
  id: ID;
  field: string;
  value: string;
  page: number;
  excerpt: string;
  confidence: "alta" | "media" | "baixa"; // indicativa
  correction?: string;
  reviewerId?: ID;
  reviewedAt?: string;
}

export interface DocumentItem extends OrgEntity {
  clientId: ID;
  caseId?: ID;
  name: string;
  type: DocType;
  status: "solicitado" | "recebido" | "em_leitura" | "precisa_revisar" | "validado" | "rejeitado";
  sharedWithClient: boolean;
  hasFixtureExtraction: boolean;
  receivedAt?: string;
  tags?: string[];
  versions?: { id: ID; at: string; actorId: ID; fileId?: ID; size?: number; mime?: string; note: string }[];
  extraction?: ExtractedField[];
  history?: { at: string; actorId: ID; text: string }[];
  requestedAt?: string;
  requestNote?: string;
  rejectReason?: string;
  origin?: "equipe" | "portal" | "whatsapp";
}

/** Arquivo local da demo (Blob no IndexedDB). Original é imutável. */
export interface StoredFile extends OrgEntity {
  name: string;
  mime: string;
  size: number;
  blob: Blob;
  createdAt: string;
}

export interface Installment extends OrgEntity {
  contractId: ID;
  clientId: ID;
  caseId?: ID;
  label: string; // "Entrada", "Parcela 2/7"
  amount: Cents;
  paid: Cents;
  due: CivilDate;
  status: "aberta" | "parcial" | "paga" | "cancelada";
  renegotiatedFrom?: ID[]; // parcelas anteriores substituídas (preservadas como canceladas)
  replacedBy?: ID[];
  lastReminderAt?: string;
  note?: string;
}

export interface LearningProgress {
  id: ID; // `${userId}:${kind}:${key}`
  userId: ID;
  kind: "tour" | "lesson";
  key: string;
  role?: Role;
  version: string;
  step: number;
  done: boolean;
  updatedAt: string;
}

export interface Objection extends OrgEntity {
  service: string;
  topic: "preço" | "confiança" | "documentos" | "prazo" | "atendimento remoto" | "conversar com familiar";
  goal: string;
  suggested: string;
  limits: string;
  ownerId: ID;
  version: number;
  approved: boolean;
  uses: number;
}

export interface OrgSettings extends OrgEntity {
  hours: string;
  timezone: string;
  areas: string[];
  financeCategories: string[];
  retentionYears: number;
  notificationPrefs: Record<string, { app: boolean; email: boolean; whatsapp: boolean }>;
  stageLabels: Record<string, string>;
  brandColor?: string;
  onboardingDone: string[];
  holidays: { date: CivilDate; name: string; scope: string }[];
  calendarVersion: string;
  dataRequests: { id: ID; at: string; kind: "exportacao" | "eliminacao"; subject: string; status: "em_revisao" | "concluida"; note: string }[];
}

export interface Payment extends OrgEntity {
  installmentId: ID;
  amount: Cents;
  date: CivilDate;
  method: "pix" | "boleto" | "cartao" | "dinheiro" | "transferencia";
  source: "manual" | "provedor_simulado";
  note: string;
  reversalOf?: ID;
  idempotencyKey: string;
}

export interface Contract extends OrgEntity {
  clientId: ID;
  caseId?: ID;
  title: string;
  total: Cents;
  status: "rascunho" | "enviado" | "parcial" | "concluido" | "recusado" | "expirado" | "cancelado";
  proposalId?: ID;
  leadId?: ID;
  version?: number;
  previousVersionId?: ID;
  snapshot?: { clientName: string; document: string; service: string; feeText: string; schedule: { label: string; amount: Cents; due: CivilDate }[] };
  signers?: { id: ID; name: string; role: string; required: boolean; order: number; status: "pendente" | "assinado" | "recusado"; signedAt?: string }[];
  installmentsGenerated?: boolean;
  history?: { at: string; actorId: ID; text: string }[];
}

export type FeeKind = "fixo" | "parcelado" | "recorrente" | "exito" | "combinado";

export interface Proposal extends OrgEntity {
  clientId?: ID;
  leadId?: ID;
  title: string;
  service: string;
  scope: string;
  feeKind: FeeKind;
  total: Cents;
  successPercent?: number; // honorários de êxito
  successBase?: string;
  schedule: { label: string; amount: Cents; due: CivilDate }[];
  validUntil: CivilDate;
  version: number;
  status: "rascunho" | "em_revisao" | "aprovada" | "enviada" | "aceita" | "recusada" | "expirada";
  contractId?: ID;
  history: { at: string; actorId: ID; text: string }[];
}

export interface Expense extends OrgEntity {
  description: string;
  category: string;
  costCenter: string;
  amount: Cents;
  due: CivilDate;
  paidOn?: CivilDate;
  caseId?: ID;
  note?: string;
}

export interface Receipt extends OrgEntity {
  number: number;
  paymentId: ID;
  payer: string;
  payerDoc: string;
  beneficiary: string;
  reference: string;
  amount: Cents;
  date: CivilDate;
  place: string;
  createdAt: string;
}

export interface BankLine extends OrgEntity {
  date: CivilDate;
  description: string;
  amount: Cents; // positivo entrada, negativo tarifa/saída
  fee?: Cents;
  status: "pendente" | "conciliado" | "ignorado";
  matchedPaymentId?: ID;
  decisionNote?: string;
}

export type ChargeStatus = "rascunho" | "aguardando_emissao" | "pendente" | "parcialmente_paga" | "paga" | "vencida" | "cancelada" | "reembolsada" | "contestada" | "erro";

export interface Charge extends OrgEntity {
  installmentId: ID;
  provider: "asaas" | "infinitepay" | "mercadopago";
  method: "pix" | "boleto" | "cartao" | "link";
  amount: Cents;
  due: CivilDate;
  status: ChargeStatus;
  externalId?: string;
  link?: string;
  idempotencyKey: string;
  events: { id: ID; at: string; type: string; note: string }[];
}

export interface Requisition extends OrgEntity {
  kind: "RPV" | "Precatório";
  clientId: ID;
  caseId?: ID;
  court: string;
  debtor: string;
  number: string;
  originProcess: string;
  nature: "alimentar" | "comum";
  fiscalYear?: number;
  informedAmount: Cents;
  priority?: string;
  fees: Cents;
  status: "em_preparacao" | "expedido" | "aguardando_processamento" | "previsao_informada" | "deposito_identificado" | "conferencia" | "liberado" | "encerrado";
  forecast?: string;
  lastCheck?: string;
  source: string;
  history: { at: string; actorId: ID; status: string; note: string }[];
}

export interface Calculation extends OrgEntity {
  area: string;
  model: string;
  title: string;
  caseId?: ID;
  inputs: Record<string, string>;
  baseDate?: CivilDate;
  rulesVersion?: string;
  status: "rascunho" | "aguardando_revisao" | "revisado";
  result?: { label: string; value: string }[];
  memory?: string[];
  inputsVersion: number;
  resultsVersion: number | null;
  reviewerId?: ID;
}

export interface LegalDraft extends OrgEntity {
  title: string;
  kind: string;
  caseId?: ID;
  templateId?: ID;
  body: string;
  status: "rascunho" | "revisao" | "ajustes" | "aprovado" | "exportado";
  approvedHash?: string;
  references: ID[];
  comments: { at: string; actorId: ID; text: string }[];
  history: { at: string; actorId: ID; text: string }[];
  updatedAt: string;
  /** Versões anteriores do texto (a cada salvamento). Opcional: minutas antigas não têm. */
  versions?: { n: number; at: string; actorId: ID; body: string }[];
}

export interface Template extends OrgEntity {
  name: string;
  kind: string;
  body: string; // com {{variaveis}}
}

export interface AgentConfig extends OrgEntity {
  name: string;
  objective: string;
  tone: string;
  rules: string[];
  steps: string[];
  faq: { q: string; a: string }[];
  requestedDocs: string[];
  tools: string[];
  hours: string;
  handoff: string[];
  areas: string[];
  approvalRequired: string[];
  status: "rascunho" | "publicado" | "pausado";
  version: number;
  publishedVersion?: number;
  versions: { version: number; at: string; actorId: ID; note: string }[];
  usage: { conversations: number; handoffs: number };
}

export interface AgentRun extends OrgEntity {
  agentId: ID;
  at: string;
  persona: string;
  steps: { step: string; detail: string }[];
  captured: Record<string, string>;
  outcome: string;
  sources: string[];
}

export interface Automation extends OrgEntity {
  name: string;
  trigger: string;
  conditions: string[];
  waitHours: number;
  action: string;
  stopWhen: string[];
  status: "ativa" | "pausada" | "rascunho";
  maxAttempts: number;
  version: number;
}

export interface AutomationRun extends OrgEntity {
  automationId: ID;
  at: string;
  target: string;
  result: "executada" | "ignorada" | "erro" | "teste";
  detail: string;
  dedupeKey: string;
}

export interface Campaign extends OrgEntity {
  name: string;
  platform: "Meta" | "Google";
  area: string;
  service: string;
  objective: string;
  budget: Cents;
  spent: Cents | null;
  start: CivilDate;
  end: CivilDate;
  utmCampaign: string;
  status: "planejada" | "em_revisao" | "aprovada" | "encerrada";
}

export interface LandingPage extends OrgEntity {
  title: string;
  slug: string;
  campaignId?: ID;
  blocks: { id: ID; kind: "apresentacao" | "servico" | "duvidas" | "formulario" | "privacidade" | "contato"; text: string }[];
  status: "rascunho" | "revisao" | "aprovada";
}

export interface ContentPiece extends OrgEntity {
  title: string;
  channel: string;
  body: string;
  status: "rascunho" | "revisao" | "aprovado" | "agendado";
  scheduledFor?: CivilDate;
  aiSuggested: boolean;
}

export interface NewsItem {
  id: ID;
  title: string;
  source: string;
  url: string;
  kind: "projeto_de_lei" | "norma_publicada" | "norma_vigente" | "decisao" | "comentario";
  areas: string[];
  originalDate: CivilDate;
  collectedAt: string;
  summary: string;
  sample: true; // amostra de demonstração
}

export interface IntegrationConnection extends OrgEntity {
  provider: string;
  name: string;
  purpose: string;
  capabilities: Record<string, "supported" | "unsupported" | "pending_validation">;
  limitations: string[];
  requirements: string[];
  mode: "demo" | "sandbox" | "production";
  status: "nao_configurado" | "aguardando_autorizacao" | "em_teste" | "operacional" | "degradado" | "desconectado" | "indisponivel" | "planejado";
  maskedConfig: Record<string, string>;
  lastSync?: string;
  lastError?: string;
}

export interface IntegrationEvent extends OrgEntity {
  provider: string;
  correlationId: string;
  type: string;
  attempt: number;
  at: string;
  status: "sucesso" | "falha" | "pendente" | "reprocessado";
  detail: string;
}

export interface OutboxMessage extends OrgEntity {
  conversationId: ID;
  messageId: ID;
  idempotencyKey: string;
  status: "pendente" | "enviada" | "falhou";
  attempts: number;
}

export interface ImportBatch extends OrgEntity {
  source: "CSV" | "Tícius (CSV exportado)";
  fileName: string;
  at: string;
  actorId: ID;
  mapping: Record<string, string>;
  created: ID[];
  updated: ID[];
  skipped: number;
  rejected: { row: number; reason: string }[];
  status: "concluido" | "revertido";
}

export interface AppNotification extends OrgEntity {
  at: string;
  userId?: ID;
  severity: "info" | "atencao" | "urgente";
  text: string;
  href: string;
  read: boolean;
}

export interface ContributionPeriod {
  id: ID;
  employer: string;
  start: CivilDate;
  end: CivilDate;
  category: "empregado" | "contribuinte_individual" | "facultativo" | "rural" | "especial";
  source: "CNIS" | "CTPS" | "PPP";
  flag?: "lacuna_depois" | "concomitante" | "divergencia_remuneracao" | "sem_data_fim";
  evidence: { documentId: ID; page: number; excerpt: string };
}

export interface PensionScenario {
  id: ID;
  label: string;
  rule: string;
  eligibleOn: CivilDate | null;
  estimatedBenefit: Cents | null;
  assumptions: string[];
  pending: string[];
}

export interface PensionAnalysis extends OrgEntity {
  clientId: ID;
  caseId: ID;
  regime: "RGPS" | "RPPS";
  benefit: string;
  modality: "planejamento" | "concessao" | "revisao";
  step: number; // 0..6
  periods: ContributionPeriod[];
  pending: { id: ID; text: string; resolved: boolean }[];
  scenarios: PensionScenario[];
  inputsVersion: number;
  resultsVersion: number | null; // diferente de inputsVersion ⇒ resultado invalidado
  reviewerId?: ID;
}

export interface AuditEvent extends OrgEntity {
  at: string;
  actorId: ID;
  action: string;
  entity: string;
  entityId: ID;
  detail: string;
}

/** Análise especializada ligada ao caso (paridade: BPC/LOAS, PPP/atividade especial, perícia). Resultado é sempre revisável. */
export interface Assessment extends OrgEntity {
  kind: "bpc" | "ppp";
  caseId: ID;
  clientId: ID;
  title: string;
  status: "rascunho" | "aguardando_revisao" | "revisado";
  data: Record<string, unknown>;
  inputsVersion: number;
  reviewedVersion: number | null;
  reviewerId?: ID;
  history: { at: string; actorId: ID; text: string }[];
}
