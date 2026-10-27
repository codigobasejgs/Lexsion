// Dados 100% FICTÍCIOS. Nomes, telefones e documentos sintéticos (CPF com prefixo 000 = inválido de propósito).
// Nenhum dado dos anexos reais foi usado.
import type {
  AttributionTouch, CalendarEvent, Case, Client, Contract, Conversation, Deadline, DocumentItem, Installment,
  Lead, Message, Organization, PensionAnalysis, Payment, Task, User, AuditEvent,
} from "@/domain/types";
import { at } from "./clock";
import { CNJ_JOSE, CNJ_SONIA } from "./fixtures-ops";

export const FIXTURE_VERSION = 4;

const A = "org-aurora";
const B = "org-boreal";
const N = "org-novo";

export const organizations: Organization[] = [
  { id: A, name: "Aurora Advocacia Previdenciária", city: "Salvador/BA", focus: "Previdenciário (TRF1)" },
  { id: B, name: "Atlas Jurídico Associados", city: "Feira de Santana/BA", focus: "Trabalhista e Família" },
  { id: N, name: "Novo Escritório (trial)", city: "Salvador/BA", focus: "Geral" },
];

export const users: User[] = [
  { id: "u-helena", name: "Helena Prado", role: "admin", organizationId: A },
  { id: "u-rafael", name: "Rafael Nunes", role: "advogado", organizationId: A },
  { id: "u-bia", name: "Beatriz Lima", role: "atendimento", organizationId: A },
  { id: "u-caio", name: "Caio Martins", role: "financeiro", organizationId: A },
  { id: "u-lia", name: "Lia Torres", role: "estagiario", organizationId: A },
  { id: "u-dora", name: "Dora Sampaio", role: "controladoria", organizationId: A },
  { id: "u-otavio", name: "Otávio Reis", role: "admin", organizationId: B },
  { id: "u-trial", name: "Carlos Exemplo", role: "admin", organizationId: N },
  { id: "u-portal-maria", name: "Maria das Graças Exemplo", role: "cliente", organizationId: A, clientId: "c-maria" },
  { id: "u-super", name: "Suporte SIWILTEC", role: "superadmin", organizationId: null },
];

// Documento sintético começando com "000." — inválido de propósito, nunca confundível com CPF real.
const client = (id: string, organizationId: string, name: string, suffix: string, extra: Partial<Client> = {}): Client => ({
  id, organizationId, name, kind: "PF", document: `000.000.${suffix.slice(0, 3)}-${suffix.slice(2, 4)}`,
  phone: `(71) 90000-${suffix}`, city: "Salvador", uf: "BA",
  ownerId: "u-rafael", origin: "Indicação", status: "ativo", createdAt: at(-90, "10:00"), ...extra,
});

export const clients: Client[] = [
  client("c-maria", A, "Maria das Graças Exemplo", "1333", { birthDate: "1964-03-12", profession: "Costureira", origin: "Meta Ads — BPC Idoso", email: "maria.exemplo@exemplo.test", leadId: "l-maria" }),
  client("c-joao", A, "João Batista Fictício", "1222", { birthDate: "1961-07-02", profession: "Pedreiro", origin: "WhatsApp orgânico", leadId: "l-joao" }),
  client("c-ana", A, "Ana Cláudia Demonstração", "1101", { birthDate: "1979-11-23", profession: "Professora (RPPS municipal)", origin: "Indicação" }),
  client("c-jose", A, "José Carlos de Teste", "1102", { birthDate: "1958-01-30", profession: "Lavrador", city: "Irecê", origin: "Landing page Rural" }),
  client("c-sonia", A, "Sônia Regina Simulada", "1103", { birthDate: "1970-05-08", profession: "Auxiliar de enfermagem", origin: "Origem não identificada" }),
  client("c-pedro", A, "Pedro Henrique Amostra", "1555", { birthDate: "1985-09-14", profession: "Motorista", origin: "Google Ads — Incapacidade", leadId: "l-pedro" }),
  client("c-lucia", A, "Lúcia Fernanda Modelo", "1444", { birthDate: "1968-12-01", profession: "Diarista", origin: "Indicação" }),
  client("c-antonio", A, "Antônio Marcos Protótipo", "1104", { birthDate: "1955-04-19", profession: "Comerciante", origin: "WhatsApp orgânico" }),
  client("c-padaria", A, "Padaria Pão Dourado Ltda. (fictícia)", "1105", { kind: "PJ", document: "00.000.000/0001-00", origin: "Indicação" }),
  client("c-rita", B, "Rita de Cássia Exemplar", "1666", { birthDate: "1982-02-17", profession: "Operadora de caixa", city: "Feira de Santana", ownerId: "u-otavio", phone: "(75) 90000-1555" }),
  client("c-marcos", B, "Marcos Vinícius Ensaio", "1667", { birthDate: "1990-06-25", profession: "Vigilante", city: "Feira de Santana", ownerId: "u-otavio", phone: "(75) 90000-1667" }),
  client("c-carla", B, "Carla Beatriz Rascunho", "1668", { birthDate: "1987-10-03", profession: "Vendedora", city: "Feira de Santana", ownerId: "u-otavio", phone: "(75) 90000-1668" }),
  client("c-ronaldo", A, "Ronaldo Freitas Teste", "2017", { birthDate: "1979-08-08", profession: "Taxista", origin: "Indicação de parceiro", ownerId: "u-helena", leadId: "l-17" }),
];

export const cases: Case[] = [
  { id: "k-maria-bpc", organizationId: A, clientId: "c-maria", title: "BPC/LOAS — pessoa idosa", area: "Previdenciário", service: "Concessão BPC", kind: "administrativo", phase: "documentacao", priority: "alta", ownerId: "u-rafael", confidential: false, portalStatus: "Estamos reunindo os documentos para o pedido no INSS.", portalNextStep: "Enviar comprovante de residência atualizado." },
  { id: "k-joao-apos", organizationId: A, clientId: "c-joao", title: "Planejamento de aposentadoria", area: "Previdenciário", service: "Planejamento RGPS", kind: "consultivo", phase: "analise", priority: "normal", ownerId: "u-rafael", confidential: false, portalStatus: "Seu histórico de contribuições está em análise pela equipe.", portalNextStep: "Aguardar contato da equipe com os cenários." },
  { id: "k-ana-rpps", organizationId: A, clientId: "c-ana", title: "Aposentadoria RPPS municipal", area: "Previdenciário", service: "Concessão RPPS", kind: "administrativo", phase: "analise", priority: "normal", ownerId: "u-helena", confidential: false, portalStatus: "Análise das regras do regime próprio do município.", portalNextStep: "Nenhuma ação sua no momento." },
  { id: "k-jose-rural", organizationId: A, clientId: "c-jose", title: "Aposentadoria por idade rural", area: "Previdenciário", service: "Concessão rural", kind: "judicial", phase: "judicial", priority: "alta", processNumber: CNJ_JOSE, ownerId: "u-rafael", confidential: false, portalStatus: "Processo em andamento na Justiça Federal.", portalNextStep: "Comparecer à audiência agendada." },
  { id: "k-sonia-incap", organizationId: A, clientId: "c-sonia", title: "Restabelecimento de auxílio por incapacidade", area: "Previdenciário", service: "Restabelecimento", kind: "judicial", phase: "judicial", priority: "alta", processNumber: CNJ_SONIA, ownerId: "u-rafael", confidential: true, portalStatus: "Aguardando perícia médica judicial.", portalNextStep: "Levar exames e laudos no dia da perícia." },
  { id: "k-pedro-acid", organizationId: A, clientId: "c-pedro", title: "Auxílio-acidente", area: "Previdenciário", service: "Concessão", kind: "administrativo", phase: "triagem", priority: "normal", ownerId: "u-lia", confidential: false, portalStatus: "Primeira análise do seu caso.", portalNextStep: "Enviar CAT e laudos." },
  { id: "k-lucia-pensao", organizationId: A, clientId: "c-lucia", title: "Pensão por morte", area: "Previdenciário", service: "Concessão", kind: "administrativo", phase: "administrativo", priority: "normal", ownerId: "u-helena", confidential: false, portalStatus: "Pedido protocolado no INSS, aguardando análise.", portalNextStep: "Nenhuma ação sua no momento." },
  { id: "k-antonio-rev", organizationId: A, clientId: "c-antonio", title: "Revisão de benefício", area: "Previdenciário", service: "Revisão", kind: "consultivo", phase: "analise", priority: "baixa", ownerId: "u-rafael", confidential: false, portalStatus: "Conferência da carta de concessão.", portalNextStep: "Nenhuma ação sua no momento." },
  { id: "k-padaria-trab", organizationId: A, clientId: "c-padaria", title: "Consultoria trabalhista preventiva", area: "Trabalhista", service: "Consultivo", kind: "consultivo", phase: "analise", priority: "baixa", ownerId: "u-helena", confidential: false, portalStatus: "Revisão de rotinas trabalhistas.", portalNextStep: "Enviar folha de pagamento do último mês." },
  { id: "k-rita-trab", organizationId: B, clientId: "c-rita", title: "Reclamação trabalhista — horas extras", area: "Trabalhista", service: "Reclamatória", kind: "judicial", phase: "judicial", priority: "normal", ownerId: "u-otavio", confidential: false, portalStatus: "Processo em andamento.", portalNextStep: "Nenhuma ação sua no momento." },
  { id: "k-ronaldo-banc", organizationId: A, clientId: "c-ronaldo", title: "Revisão de contrato bancário", area: "Bancário", service: "Revisão contratual", kind: "consultivo", phase: "triagem", priority: "normal", ownerId: "u-helena", confidential: false, portalStatus: "Aguardando assinatura do contrato de honorários.", portalNextStep: "Assinar o contrato enviado." },
  { id: "k-maria-cons", organizationId: A, clientId: "c-maria", title: "Cobrança indevida em conta de energia", area: "Consumidor", service: "Consultivo", kind: "consultivo", phase: "triagem", priority: "baixa", ownerId: "u-lia", confidential: false, portalStatus: "Primeira análise.", portalNextStep: "Enviar fatura contestada." },
  { id: "k-carla-fam", organizationId: B, clientId: "c-carla", title: "Divórcio consensual", area: "Família", service: "Divórcio", kind: "judicial", phase: "documentacao", priority: "normal", ownerId: "u-otavio", confidential: true, portalStatus: "Reunindo documentos.", portalNextStep: "Enviar certidão de casamento." },
  { id: "k-marcos-fam", organizationId: B, clientId: "c-marcos", title: "Revisão de alimentos", area: "Família", service: "Revisional", kind: "judicial", phase: "judicial", priority: "normal", ownerId: "u-otavio", confidential: true, portalStatus: "Processo em andamento.", portalNextStep: "Nenhuma ação sua no momento." },
];

export const tasks: Task[] = [
  { id: "t1", organizationId: A, title: "Conferir CNIS × CTPS do João (concomitância 2008)", caseId: "k-joao-apos", clientId: "c-joao", assigneeId: "u-rafael", due: "2026-10-26", priority: "alta", done: false },
  { id: "t2", organizationId: A, title: "Pedir comprovante de residência à Maria", caseId: "k-maria-bpc", clientId: "c-maria", assigneeId: "u-bia", due: "2026-10-26", priority: "normal", done: false },
  { id: "t3", organizationId: A, title: "Preparar quesitos para perícia da Sônia", caseId: "k-sonia-incap", clientId: "c-sonia", assigneeId: "u-rafael", due: "2026-10-27", priority: "alta", done: false, checklist: [{ id: "c1", text: "Ler laudo ortopédico", done: true }, { id: "c2", text: "Listar limitações funcionais", done: false }, { id: "c3", text: "Redigir quesitos", done: false }], dependsOn: ["t12"] },
  { id: "t4", organizationId: A, title: "Revisar minuta de requerimento — pensão Lúcia", caseId: "k-lucia-pensao", clientId: "c-lucia", assigneeId: "u-helena", due: "2026-10-28", priority: "normal", done: false },
  { id: "t5", organizationId: A, title: "Ligar para Pedro sobre a CAT", caseId: "k-pedro-acid", clientId: "c-pedro", assigneeId: "u-lia", due: "2026-10-24", priority: "normal", done: false },
  { id: "t6", organizationId: A, title: "Atualizar carta de concessão do Antônio", caseId: "k-antonio-rev", clientId: "c-antonio", assigneeId: "u-lia", due: "2026-10-30", priority: "baixa", done: false },
  { id: "t7", organizationId: A, title: "Enviar resumo do atendimento inicial — José", caseId: "k-jose-rural", clientId: "c-jose", assigneeId: "u-rafael", due: "2026-10-22", priority: "normal", done: true },
  { id: "t8", organizationId: B, title: "Calcular horas extras demonstrativas — Rita", caseId: "k-rita-trab", clientId: "c-rita", assigneeId: "u-otavio", due: "2026-10-26", priority: "alta", done: false },
  { id: "t9", organizationId: A, title: "Solicitar CadÚnico atualizado", caseId: "k-maria-bpc", clientId: "c-maria", assigneeId: "u-bia", due: "2026-10-27", priority: "normal", done: false },
  { id: "t10", organizationId: A, title: "Revisar PPP do Paulo (lead em proposta)", assigneeId: "u-rafael", due: "2026-10-28", priority: "normal", done: false },
  { id: "t11", organizationId: A, title: "Organizar provas de atividade rural — José", caseId: "k-jose-rural", clientId: "c-jose", assigneeId: "u-lia", due: "2026-10-29", priority: "alta", done: false },
  { id: "t12", organizationId: A, title: "Separar exames recentes da Sônia", caseId: "k-sonia-incap", clientId: "c-sonia", assigneeId: "u-lia", due: "2026-10-27", priority: "alta", done: false },
  { id: "t13", organizationId: A, title: "Conferir regras do RPPS municipal — Ana", caseId: "k-ana-rpps", clientId: "c-ana", assigneeId: "u-helena", due: "2026-10-30", priority: "normal", done: false },
  { id: "t14", organizationId: A, title: "Agendar retorno com Antônio", caseId: "k-antonio-rev", clientId: "c-antonio", assigneeId: "u-bia", due: "2026-10-28", priority: "baixa", done: false },
  { id: "t15", organizationId: A, title: "Enviar contrato para Ronaldo assinar", caseId: "k-ronaldo-banc", clientId: "c-ronaldo", assigneeId: "u-helena", due: "2026-10-26", priority: "alta", done: false },
  { id: "t16", organizationId: A, title: "Revisar rotina de ponto da Padaria", caseId: "k-padaria-trab", clientId: "c-padaria", assigneeId: "u-helena", due: "2026-11-01", priority: "baixa", done: false },
  { id: "t17", organizationId: A, title: "Atualizar status do portal — Lúcia", caseId: "k-lucia-pensao", clientId: "c-lucia", assigneeId: "u-lia", due: "2026-10-27", priority: "baixa", done: false },
  { id: "t18", organizationId: A, title: "Ligar para Francisca (lead)", assigneeId: "u-bia", due: "2026-10-26", priority: "normal", done: false },
  { id: "t19", organizationId: A, title: "Ligar para Gilberto (lead)", assigneeId: "u-bia", due: "2026-10-27", priority: "normal", done: false },
  { id: "t20", organizationId: A, title: "Revisar extração do CNIS — João", caseId: "k-joao-apos", clientId: "c-joao", assigneeId: "u-rafael", due: "2026-10-26", priority: "alta", done: false },
  { id: "t21", organizationId: A, title: "Preparar apresentação de cenários — João", caseId: "k-joao-apos", clientId: "c-joao", assigneeId: "u-rafael", due: "2026-10-27", priority: "alta", done: false, checklist: [{ id: "c1", text: "Ler laudo ortopédico", done: true }, { id: "c2", text: "Listar limitações funcionais", done: false }, { id: "c3", text: "Redigir quesitos", done: false }], dependsOn: ["t12"] },
  { id: "t22", organizationId: A, title: "Conferir homônimo em publicação", caseId: "k-jose-rural", clientId: "c-jose", assigneeId: "u-lia", due: "2026-10-26", priority: "normal", done: false },
  { id: "t23", organizationId: A, title: "Atualizar previsão da RPV — Antônio", caseId: "k-antonio-rev", clientId: "c-antonio", assigneeId: "u-rafael", due: "2026-10-31", priority: "baixa", done: false },
  { id: "t24", organizationId: A, title: "Revisar cobrança indevida — Maria", caseId: "k-maria-cons", clientId: "c-maria", assigneeId: "u-lia", due: "2026-11-02", priority: "baixa", done: false },
  { id: "t25", organizationId: A, title: "Conciliar extrato de outubro", assigneeId: "u-caio", due: "2026-10-28", priority: "normal", done: false },
  { id: "t26", organizationId: A, title: "Cobrar mensalidade da Padaria", caseId: "k-padaria-trab", clientId: "c-padaria", assigneeId: "u-caio", due: "2026-10-26", priority: "alta", done: false },
  { id: "t27", organizationId: A, title: "Emitir recibo da entrada — João", caseId: "k-joao-apos", clientId: "c-joao", assigneeId: "u-caio", due: "2026-10-16", priority: "baixa", done: true },
  { id: "t28", organizationId: A, title: "Revisar biblioteca de objeções", assigneeId: "u-helena", due: "2026-11-03", priority: "baixa", done: false },
  { id: "t29", organizationId: A, title: "Testar agente trabalhista no simulador", assigneeId: "u-helena", due: "2026-10-29", priority: "normal", done: false },
  { id: "t30", organizationId: A, title: "Revisar landing page BPC", assigneeId: "u-bia", due: "2026-10-30", priority: "normal", done: false },
  { id: "t31", organizationId: A, title: "Preparar réplica — José", caseId: "k-jose-rural", clientId: "c-jose", assigneeId: "u-rafael", due: "2026-10-31", priority: "alta", done: false },
  { id: "t32", organizationId: A, title: "Separar documentos para audiência — José", caseId: "k-jose-rural", clientId: "c-jose", assigneeId: "u-lia", due: "2026-11-02", priority: "alta", done: false },
  { id: "t33", organizationId: A, title: "Revisar minuta da procuração — Ronaldo", caseId: "k-ronaldo-banc", clientId: "c-ronaldo", assigneeId: "u-helena", due: "2026-10-28", priority: "normal", done: false },
  { id: "t34", organizationId: A, title: "Pedir CAT à empresa do Pedro", caseId: "k-pedro-acid", clientId: "c-pedro", assigneeId: "u-lia", due: "2026-10-25", priority: "normal", done: false },
  { id: "t35", organizationId: A, title: "Treinar equipe no portal do cliente", assigneeId: "u-helena", due: "2026-11-05", priority: "baixa", done: false },
  { id: "t36", organizationId: A, title: "Fechar relatório mensal", assigneeId: "u-caio", due: "2026-10-31", priority: "normal", done: false },
  { id: "t37", organizationId: A, title: "Revisar notícias do Jornal (semana)", assigneeId: "u-rafael", due: "2026-10-29", priority: "baixa", done: false },
  { id: "t40", organizationId: B, title: "Juntar certidão de casamento — Carla", caseId: "k-carla-fam", clientId: "c-carla", assigneeId: "u-otavio", due: "2026-10-29", priority: "normal", done: false },
];

export const deadlines: Deadline[] = [
  { id: "d1", organizationId: A, caseId: "k-jose-rural", title: "Réplica à contestação do INSS", eventType: "Intimação", court: "TRF1 — Irecê/BA", calendarVersion: "2026.2-demo", publicationId: "pub2", justification: "Conferido com o calendário do tribunal.", start: "2026-10-13", days: 15, counting: "uteis", proposedEnd: "2026-11-04", confirmedEnd: "2026-11-04", reviewerId: "u-rafael", status: "confirmado" },
  { id: "d2", organizationId: A, caseId: "k-sonia-incap", title: "Apresentar quesitos periciais", eventType: "Intimação", court: "JEF Salvador", calendarVersion: "2026.2-demo", publicationId: "pub1", start: "2026-10-21", days: 5, counting: "uteis", proposedEnd: "2026-10-28", status: "proposto" },
  { id: "d3", organizationId: A, caseId: "k-lucia-pensao", title: "Cumprir exigência do INSS", eventType: "Exigência administrativa", court: "INSS", calendarVersion: "2026.2-demo", start: "2026-10-01", days: 30, counting: "corridos", proposedEnd: "2026-10-31", confirmedEnd: "2026-10-31", reviewerId: "u-helena", status: "confirmado" },
  { id: "d4", organizationId: B, caseId: "k-rita-trab", title: "Manifestação sobre laudo contábil", start: "2026-10-19", days: 8, counting: "uteis", proposedEnd: "2026-10-29", status: "proposto" },
];

export const events: CalendarEvent[] = [
  { id: "e1", organizationId: A, title: "Atendimento inicial — Maria (BPC)", type: "atendimento", start: at(0, "14:00"), end: at(0, "14:45"), location: "Videochamada", caseId: "k-maria-bpc", clientId: "c-maria", ownerId: "u-rafael", visibleToClient: true },
  { id: "e2", organizationId: A, title: "Perícia médica judicial — Sônia", type: "pericia", start: at(3, "09:30"), end: at(3, "10:30"), location: "JEF Salvador — sala de perícias", caseId: "k-sonia-incap", clientId: "c-sonia", ownerId: "u-rafael", visibleToClient: true, participants: ["Sônia Regina Simulada", "Assistente técnico (a confirmar)"], requiredDocs: ["Documento com foto", "Laudos e exames recentes", "Receitas"], attendance: "pendente" },
  { id: "e3", organizationId: A, title: "Audiência de instrução — José (rural)", type: "audiencia", start: at(9, "13:30"), end: at(9, "15:00"), location: "Vara Federal — Irecê/BA", caseId: "k-jose-rural", clientId: "c-jose", ownerId: "u-rafael", visibleToClient: true },
  { id: "e4", organizationId: A, title: "Reunião de equipe — distribuição semanal", type: "reuniao", start: at(0, "17:00"), end: at(0, "17:30"), location: "Escritório", ownerId: "u-helena", visibleToClient: false },
  { id: "e5", organizationId: A, title: "Apresentar cenários — João", type: "atendimento", start: at(1, "10:00"), end: at(1, "11:00"), location: "Escritório", caseId: "k-joao-apos", clientId: "c-joao", ownerId: "u-rafael", visibleToClient: true },
  { id: "e7", organizationId: A, title: "Retorno com Antônio (conflito de exemplo)", type: "atendimento", start: at(1, "10:30"), end: at(1, "11:15"), location: "Videochamada", caseId: "k-antonio-rev", clientId: "c-antonio", ownerId: "u-rafael", visibleToClient: true },
  { id: "e8", organizationId: A, title: "Reunião de assinatura — Ronaldo", type: "atendimento", start: at(2, "15:00"), end: at(2, "15:30"), location: "Escritório", caseId: "k-ronaldo-banc", clientId: "c-ronaldo", ownerId: "u-helena", visibleToClient: true },
  { id: "e9", organizationId: A, title: "Perícia administrativa INSS — Pedro", type: "pericia", start: at(6, "08:00"), end: at(6, "09:00"), location: "APS Salvador (exemplo)", caseId: "k-pedro-acid", clientId: "c-pedro", ownerId: "u-lia", visibleToClient: true, requiredDocs: ["Documento com foto", "CAT", "Laudos e exames"], attendance: "pendente" },
  { id: "e10", organizationId: A, title: "Reunião de equipe — distribuição semanal", type: "reuniao", start: at(7, "17:00"), end: at(7, "17:30"), location: "Escritório", ownerId: "u-helena", visibleToClient: false },
  { id: "e11", organizationId: A, title: "Atendimento — Ana (regras RPPS)", type: "atendimento", start: at(4, "14:00"), end: at(4, "15:00"), location: "Videochamada", caseId: "k-ana-rpps", clientId: "c-ana", ownerId: "u-helena", visibleToClient: true },
  { id: "e12", organizationId: A, title: "Audiência de conciliação (encerrada)", type: "audiencia", start: at(-7, "10:00"), end: at(-7, "11:00"), location: "Vara Federal — Salvador", caseId: "k-sonia-incap", clientId: "c-sonia", ownerId: "u-rafael", visibleToClient: true, attendance: "compareceu", result: "Sem acordo; designada perícia." },
  { id: "e13", organizationId: A, title: "Retorno — Lúcia", type: "atendimento", start: at(12, "09:00"), end: at(12, "09:30"), location: "Telefone", caseId: "k-lucia-pensao", clientId: "c-lucia", ownerId: "u-helena", visibleToClient: true },
  { id: "e14", organizationId: A, title: "Treinamento interno — portal do cliente", type: "reuniao", start: at(10, "16:00"), end: at(10, "17:00"), location: "Escritório", ownerId: "u-helena", visibleToClient: false },
  { id: "e15", organizationId: B, title: "Atendimento — Carla", type: "atendimento", start: at(1, "09:00"), end: at(1, "09:45"), location: "Escritório", caseId: "k-carla-fam", clientId: "c-carla", ownerId: "u-otavio", visibleToClient: true },
  { id: "e6", organizationId: B, title: "Audiência — Rita", type: "audiencia", start: at(2, "10:00"), end: at(2, "11:00"), location: "Vara do Trabalho", caseId: "k-rita-trab", clientId: "c-rita", ownerId: "u-otavio", visibleToClient: true },
];

export const conversations: Conversation[] = [
  { id: "cv-maria", organizationId: A, contactName: "Maria das Graças Exemplo", phone: "(71) 90000-1333", leadId: "l-maria", clientId: "c-maria", caseId: "k-maria-bpc", channel: "whatsapp", status: "aguardando_equipe", aiActive: true, unread: 2, lastMessageAt: at(0, "09:42"), campaign: "BPC Idoso — Meta (out/2026)", summary: "Idosa, 62 anos informados, mora com o filho. Busca BPC. Já enviou RG e CPF; falta comprovante de residência e CadÚnico atualizado.", missingDocs: ["Comprovante de residência", "Folha resumo do CadÚnico"], tags: ["BPC", "Campanha"] },
  { id: "cv-pedro", organizationId: A, contactName: "Pedro Henrique Amostra", phone: "(71) 90000-1555", clientId: "c-pedro", caseId: "k-pedro-acid", channel: "whatsapp", status: "aguardando_cliente", aiActive: false, assigneeId: "u-lia", unread: 0, lastMessageAt: at(-1, "16:10"), summary: "Acidente de trânsito em 2025, afastado 4 meses. Pedimos CAT e laudos.", missingDocs: ["CAT", "Laudo ortopédico"], tags: ["Acidente"] },
  { id: "cv-novo", organizationId: A, contactName: "Contato +55 71 90000-0099", phone: "(71) 90000-0099", leadId: "l-novo", channel: "whatsapp", status: "ia", aiActive: true, unread: 1, lastMessageAt: at(0, "11:05"), campaign: "Aposentadoria Rural — Google", summary: "Novo contato perguntando sobre aposentadoria rural. Assistente em triagem.", missingDocs: [], tags: ["Rural", "Novo"] },
  { id: "cv-lucia", organizationId: A, contactName: "Lúcia Fernanda Modelo", phone: "(71) 90000-1444", clientId: "c-lucia", caseId: "k-lucia-pensao", channel: "whatsapp", status: "encerrada", aiActive: false, assigneeId: "u-helena", unread: 0, lastMessageAt: at(-3, "15:20"), summary: "Informada sobre exigência do INSS. Documentos entregues.", missingDocs: [], tags: ["Pensão"] },
  { id: "cv-rita", organizationId: B, contactName: "Rita de Cássia Exemplar", phone: "(75) 90000-1555", clientId: "c-rita", channel: "whatsapp", status: "aguardando_equipe", aiActive: false, assigneeId: "u-otavio", unread: 1, lastMessageAt: at(0, "08:15"), summary: "Pergunta sobre data da audiência.", missingDocs: [], tags: [] },
];

export const messages: Message[] = [
  { id: "m1", organizationId: A, conversationId: "cv-maria", author: "contato", text: "Bom dia! Vi o anúncio sobre o benefício para idoso. Como funciona?", at: at(-1, "08:55") },
  { id: "m2", organizationId: A, conversationId: "cv-maria", author: "ia", text: "Bom dia, Maria! Sou a assistente virtual do escritório Aurora. Posso fazer algumas perguntas para entender sua situação e passar para a nossa equipe. Tudo bem?", at: at(-1, "08:55"), status: "lida", simulated: true },
  { id: "m3", organizationId: A, conversationId: "cv-maria", author: "contato", text: "Pode sim. Moro com meu filho, ele ganha pouco.", at: at(-1, "09:01") },
  { id: "m4", organizationId: A, conversationId: "cv-maria", author: "ia", text: "Obrigada por contar. Para a equipe avaliar, vamos precisar de alguns documentos: RG, CPF, comprovante de residência e a folha resumo do CadÚnico. Quem decide se há direito é a advogada responsável, depois de analisar tudo.", at: at(-1, "09:02"), status: "lida", simulated: true },
  { id: "m5", organizationId: A, conversationId: "cv-maria", author: "contato", text: "Mandei RG e CPF agora. O comprovante está no nome do meu filho, serve?", at: at(0, "09:40") },
  { id: "m6", organizationId: A, conversationId: "cv-maria", author: "nota", authorId: "u-bia", text: "Pergunta sobre comprovante em nome de terceiro — precisa de orientação de advogado. Não responder pela IA.", at: at(0, "09:41") },
  { id: "m7", organizationId: A, conversationId: "cv-maria", author: "contato", text: "Alô?", at: at(0, "09:42") },
  { id: "m8", organizationId: A, conversationId: "cv-pedro", author: "equipe", authorId: "u-lia", text: "Pedro, conseguiu localizar a CAT com a empresa? Assim que enviar, a Dra. Helena revisa.", at: at(-1, "16:10"), status: "entregue" },
  { id: "m9", organizationId: A, conversationId: "cv-novo", author: "contato", text: "Oi, trabalhei na roça a vida toda, consigo aposentar?", at: at(0, "11:04") },
  { id: "m10", organizationId: A, conversationId: "cv-novo", author: "ia", text: "Olá! Sou a assistente virtual do escritório Aurora. Posso fazer algumas perguntas sobre seu trabalho no campo para a equipe analisar. Qual a sua idade?", at: at(0, "11:05"), status: "entregue", simulated: true },
  { id: "m11", organizationId: A, conversationId: "cv-lucia", author: "equipe", authorId: "u-helena", text: "Lúcia, recebemos tudo. Vamos acompanhar a análise do INSS e avisamos qualquer novidade.", at: at(-3, "15:20"), status: "lida" },
  { id: "m12", organizationId: B, conversationId: "cv-rita", author: "contato", text: "Doutor, a audiência é quarta mesmo?", at: at(0, "08:15") },
];

// Leads: telefones sintéticos (90000-xxxx), origem só "confirmada" quando há UTM/clique.
const meta = (campaign: string, slug: string, day: number): AttributionTouch => ({ at: at(day, "09:00"), evidence: "confirmada", origin: "Meta Ads", campaign, utm: { utm_source: "meta", utm_medium: "paid_social", utm_campaign: slug }, landingPage: `/lp/${slug}` });
const google = (campaign: string, slug: string, day: number): AttributionTouch => ({ at: at(day, "10:00"), evidence: "confirmada", origin: "Google Ads", campaign, utm: { utm_source: "google", utm_medium: "cpc", utm_campaign: slug }, landingPage: `/lp/${slug}` });
const declared = (origin: string, day: number): AttributionTouch => ({ at: at(day, "11:00"), evidence: "declarada", origin });
const unknown = (day: number): AttributionTouch => ({ at: at(day, "12:00"), evidence: "nao_identificada", origin: "Origem não identificada" });

const lead = (id: string, name: string, phoneSuffix: string, area: string, service: string, stage: Lead["stage"], touch: AttributionTouch, day: number, extra: Partial<Lead> = {}): Lead => ({
  id, organizationId: A, name, phone: `557190000${phoneSuffix}`, area, service, stage, stageEnteredAt: at(day + 1, "09:00"),
  firstTouch: touch, lastTouch: touch, consentContact: true, tags: [], createdAt: touch.at,
  history: [{ at: touch.at, to: "novo", actorId: "u-bia" }, ...(stage !== "novo" ? [{ at: at(day + 1, "09:00"), from: "novo" as const, to: stage, actorId: "u-bia" }] : [])],
  ...extra,
});

export const leads: Lead[] = [
  lead("l-novo", "Contato +55 71 90000-0099", "0099", "Previdenciário", "Aposentadoria rural", "atendimento", google("Aposentadoria Rural — Google", "rural-out26", 0), 0, { conversationId: "cv-novo", nextAction: "Concluir triagem rural" }),
  lead("l-maria", "Maria das Graças Exemplo", "1333", "Previdenciário", "BPC/LOAS", "documentos", meta("BPC Idoso — Meta (out/2026)", "bpc-idoso-out26", -1), -1, { ownerId: "u-bia", clientId: "c-maria", conversationId: "cv-maria", nextAction: "Receber comprovante de residência" }),
  lead("l-01", "Joana Batista Teste", "2001", "Previdenciário", "BPC/LOAS", "novo", meta("BPC Idoso — Meta (out/2026)", "bpc-idoso-out26", -1), -1, { nextAction: "Primeiro contato" }),
  lead("l-02", "Raimundo Nonato Ficção", "2002", "Previdenciário", "Aposentadoria rural", "novo", google("Aposentadoria Rural — Google", "rural-out26", -2), -2),
  lead("l-03", "Cláudia Regina Mock", "2003", "Previdenciário", "Incapacidade", "novo", unknown(-1), -1),
  lead("l-04", "Edson Luís Amostral", "2004", "Trabalhista", "Verbas rescisórias", "novo", declared("Indicação de cliente", -3), -3),
  lead("l-05", "Francisca Helena Demo", "2005", "Previdenciário", "BPC/LOAS", "atendimento", meta("BPC Idoso — Meta (out/2026)", "bpc-idoso-out26", -4), -4, { ownerId: "u-bia" }),
  lead("l-06", "Gilberto Souza Ensaio", "2006", "Previdenciário", "Pensão por morte", "atendimento", declared("Instagram orgânico", -3), -3, { ownerId: "u-bia" }),
  lead("l-07", "Heloísa Martins Teste", "2007", "Família", "Pensão alimentícia", "atendimento", unknown(-5), -5, { ownerId: "u-bia" }),
  lead("l-08", "Ivone Carvalho Simulada", "2008", "Previdenciário", "Aposentadoria por idade", "triagem", google("Aposentadoria Rural — Google", "rural-out26", -6), -6, { ownerId: "u-rafael" }),
  lead("l-09", "Jailson Rocha Protótipo", "2009", "Previdenciário", "Auxílio por incapacidade", "triagem", meta("Incapacidade — Meta", "incap-out26", -7), -7, { ownerId: "u-rafael" }),
  lead("l-10", "Kátia Moura Fictícia", "2010", "Consumidor", "Cobrança indevida", "triagem", declared("Indicação de parceiro", -5), -5, { ownerId: "u-helena" }),
  lead("l-11", "Leandro Pires Exemplo", "2011", "Previdenciário", "BPC/LOAS — PcD", "documentos", meta("BPC Idoso — Meta (out/2026)", "bpc-idoso-out26", -9), -9, { ownerId: "u-bia" }),
  lead("l-12", "Marlene Dias Amostra", "2012", "Previdenciário", "Revisão de benefício", "documentos", declared("Indicação de cliente", -10), -10, { ownerId: "u-lia" }),
  lead("l-13", "Nelson Araújo Modelo", "2013", "Previdenciário", "Planejamento", "analise", google("Planejamento — Google", "planej-out26", -12), -12, { ownerId: "u-rafael" }),
  lead("l-14", "Olívia Teixeira Rascunho", "2014", "Médico e Saúde", "Negativa de plano de saúde", "analise", declared("Site do escritório", -8), -8, { ownerId: "u-helena" }),
  lead("l-15", "Paulo César Ensaio", "2015", "Previdenciário", "Aposentadoria especial", "proposta", google("Planejamento — Google", "planej-out26", -14), -14, { ownerId: "u-rafael", nextAction: "Aguardar retorno da proposta" }),
  lead("l-16", "Quitéria Alves Demo", "2016", "Previdenciário", "BPC/LOAS", "proposta", meta("BPC Idoso — Meta (out/2026)", "bpc-idoso-out26", -13), -13, { ownerId: "u-bia" }),
  lead("l-17", "Ronaldo Freitas Teste", "2017", "Bancário", "Revisão de contrato", "assinatura", declared("Indicação de parceiro", -15), -15, { ownerId: "u-helena", clientId: "c-ronaldo" }),
  lead("l-joao", "João Batista Fictício", "1222", "Previdenciário", "Planejamento", "contratado", declared("WhatsApp orgânico", -95), -95, { ownerId: "u-rafael", clientId: "c-joao" }),
  lead("l-pedro", "Pedro Henrique Amostra", "1555", "Previdenciário", "Auxílio-acidente", "contratado", google("Incapacidade — Google", "incap-g-ago26", -60), -60, { ownerId: "u-lia", clientId: "c-pedro" }),
  lead("l-18", "Sebastião Lima Ficção", "2018", "Previdenciário", "Aposentadoria rural", "perdido", google("Aposentadoria Rural — Google", "rural-out26", -20), -20, { lostReason: "Sem retorno do contato" }),
  lead("l-19", "Tereza Cristina Mock", "2019", "Previdenciário", "BPC/LOAS", "perdido", meta("BPC Idoso — Meta (out/2026)", "bpc-idoso-out26", -18), -18, { lostReason: "Sem direito aparente após triagem" }),
  lead("l-20", "Ubirajara Costa Exemplo", "2020", "Trabalhista", "Horas extras", "perdido", unknown(-25), -25, { lostReason: "Optou por outro escritório" }),
  { ...lead("l-b1", "Vanessa Ribeiro Simulada", "3001", "Trabalhista", "Assédio moral", "triagem", declared("Indicação de cliente", -4), -4), organizationId: B, phone: "557590003001", ownerId: "u-otavio" },
  { ...lead("l-b2", "Wagner Nunes Protótipo", "3002", "Família", "Divórcio", "novo", unknown(-1), -1), organizationId: B, phone: "557590003002" },
  { ...lead("l-b3", "Ximena Duarte Teste", "3003", "Trabalhista", "Verbas rescisórias", "proposta", declared("Site do escritório", -9), -9), organizationId: B, phone: "557590003003", ownerId: "u-otavio" },
];

export const documents: DocumentItem[] = [
  {
    id: "doc-cnis-joao", organizationId: A, clientId: "c-joao", caseId: "k-joao-apos", name: "CNIS — João (fixture de teste).pdf", type: "CNIS", status: "precisa_revisar", sharedWithClient: false, hasFixtureExtraction: true, receivedAt: at(-6, "10:00"),
    tags: ["previdenciário"], versions: [{ id: "v1", at: at(-6, "10:00"), actorId: "u-bia", note: "Original recebido por WhatsApp (fixture)" }],
    extraction: [
      { id: "x1", field: "Nome do segurado", value: "JOAO BATISTA FICTICIO", page: 1, excerpt: "Nome: JOAO BATISTA FICTICIO", confidence: "alta" },
      { id: "x2", field: "NIT", value: "000.00000.00-0 (sintético)", page: 1, excerpt: "NIT: 000.00000.00-0", confidence: "alta" },
      { id: "x3", field: "Vínculo 1 — início", value: "01/02/1983", page: 1, excerpt: "Seq. 1 — CONSTRUTORA ALFA — 02/1983", confidence: "alta" },
      { id: "x4", field: "Vínculo 1 — fim", value: "30/06/1991", page: 1, excerpt: "a 06/1991", confidence: "media" },
      { id: "x5", field: "Vínculo 2 — fim", value: "31/12/2008", page: 1, excerpt: "OBRAS BETA — 03/1994 a 12/2008", confidence: "media" },
      { id: "x6", field: "Remuneração 03/2019", value: "R$ 1.998,00", page: 2, excerpt: "03/2019 ... 1.998,00", confidence: "baixa" },
    ],
    history: [{ at: at(-6, "10:00"), actorId: "u-bia", text: "Recebido" }, { at: at(-6, "10:02"), actorId: "u-bia", text: "Extração demonstrativa preparada (fixture)" }],
  },
  { id: "doc-ctps-joao", organizationId: A, clientId: "c-joao", caseId: "k-joao-apos", name: "CTPS — João (fixture de teste).pdf", type: "CTPS", status: "validado", sharedWithClient: false, hasFixtureExtraction: true, receivedAt: at(-6, "10:05") },
  { id: "doc-rg-maria", organizationId: A, clientId: "c-maria", caseId: "k-maria-bpc", name: "RG — Maria (fictício).jpg", type: "Documento pessoal", status: "recebido", sharedWithClient: true, hasFixtureExtraction: false, receivedAt: at(0, "09:40") },
  { id: "doc-res-maria", organizationId: A, clientId: "c-maria", caseId: "k-maria-bpc", name: "Comprovante de residência", type: "Comprovante", status: "solicitado", sharedWithClient: true, hasFixtureExtraction: false },
  { id: "doc-contrato-maria", organizationId: A, clientId: "c-maria", caseId: "k-maria-bpc", name: "Contrato de honorários — Maria (demonstrativo).pdf", type: "Contrato", status: "validado", sharedWithClient: true, hasFixtureExtraction: false, receivedAt: at(-1, "15:00") },
  { id: "doc-laudo-sonia", organizationId: A, clientId: "c-sonia", caseId: "k-sonia-incap", name: "Laudo ortopédico (fictício).pdf", type: "Laudo", status: "validado", sharedWithClient: false, hasFixtureExtraction: false, receivedAt: at(-20, "10:00") },
  ...([
    ["doc-cadunico-maria", "c-maria", "k-maria-bpc", "Folha resumo do CadÚnico", "Comprovante", "solicitado", null],
    ["doc-cpf-maria", "c-maria", "k-maria-bpc", "CPF — Maria (fictício).jpg", "Documento pessoal", "validado", -1],
    ["doc-ppp-joao", "c-joao", "k-joao-apos", "PPP — Reformas Gama (fictício).pdf", "PPP", "em_leitura", -4],
    ["doc-carta-antonio", "c-antonio", "k-antonio-rev", "Carta de concessão — Antônio (fictício).pdf", "Carta de concessão", "recebido", -8],
    ["doc-hiscre-antonio", "c-antonio", "k-antonio-rev", "HISCRE — Antônio (fictício).pdf", "HISCRE", "validado", -8],
    ["doc-exame-sonia", "c-sonia", "k-sonia-incap", "Ressonância de coluna (fictícia).pdf", "Exame", "validado", -18],
    ["doc-exame-sonia2", "c-sonia", "k-sonia-incap", "Exames recentes", "Exame", "solicitado", null],
    ["doc-cat-pedro", "c-pedro", "k-pedro-acid", "CAT — Comunicação de acidente", "Comprovante", "solicitado", null],
    ["doc-laudo-pedro", "c-pedro", "k-pedro-acid", "Laudo ortopédico — Pedro", "Laudo", "solicitado", null],
    ["doc-rg-jose", "c-jose", "k-jose-rural", "RG — José (fictício).jpg", "Documento pessoal", "validado", -90],
    ["doc-rural-jose", "c-jose", "k-jose-rural", "Declaração de sindicato rural (fictícia).pdf", "Comprovante", "precisa_revisar", -30],
    ["doc-obito-lucia", "c-lucia", "k-lucia-pensao", "Certidão de óbito (fictícia).pdf", "Documento pessoal", "rejeitado", -26],
    ["doc-obito-lucia2", "c-lucia", "k-lucia-pensao", "Certidão de óbito atualizada (fictícia).pdf", "Documento pessoal", "validado", -10],
    ["doc-contracheque-ana", "c-ana", "k-ana-rpps", "Contracheque — Ana (fictício).pdf", "Comprovante", "recebido", -3],
    ["doc-peticao-jose", "c-jose", "k-jose-rural", "Petição inicial — José (minuta aprovada).pdf", "Peça", "validado", -140],
    ["doc-contrato-ronaldo", "c-ronaldo", "k-ronaldo-banc", "Contrato bancário a revisar (fictício).pdf", "Contrato", "recebido", -5],
    ["doc-folha-padaria", "c-padaria", "k-padaria-trab", "Folha de pagamento — set/2026 (fictícia).pdf", "Comprovante", "solicitado", null],
  ] as const).map(([id, clientId, caseId, name, type, status, day]): DocumentItem => ({
    id, organizationId: A, clientId, caseId, name, type, status, sharedWithClient: status === "solicitado", hasFixtureExtraction: false,
    receivedAt: day === null ? undefined : at(day, "10:00"), requestedAt: status === "solicitado" ? at(-2, "09:00") : undefined,
    rejectReason: status === "rejeitado" ? "Documento ilegível; pedir nova via" : undefined, origin: "equipe",
  })),
  { id: "doc-cert-carla", organizationId: B, clientId: "c-carla", caseId: "k-carla-fam", name: "Certidão de casamento", type: "Documento pessoal", status: "solicitado", sharedWithClient: true, hasFixtureExtraction: false, requestedAt: at(-1, "09:00") },
];

export const contracts: Contract[] = [
  { id: "ct-maria", organizationId: A, clientId: "c-maria", caseId: "k-maria-bpc", title: "Honorários BPC — Maria", total: 280000, status: "concluido" },
  { id: "ct-joao", organizationId: A, clientId: "c-joao", caseId: "k-joao-apos", title: "Planejamento previdenciário — João", total: 360000, status: "concluido" },
  { id: "ct-padaria", organizationId: A, clientId: "c-padaria", caseId: "k-padaria-trab", title: "Consultoria trabalhista mensal", total: 150000, status: "concluido" },
  { id: "ct-rita", organizationId: B, clientId: "c-rita", caseId: "k-rita-trab", title: "Reclamatória — Rita", total: 200000, status: "concluido" },
];

// João: entrada + 7 parcelas com intervalos variados (cenário 4 do mestre — não mensal fixo).
const joaoDues = ["2026-08-05", "2026-08-20", "2026-09-15", "2026-10-05", "2026-10-20", "2026-11-10", "2026-12-10", "2027-01-15"];
export const installments: Installment[] = [
  ...joaoDues.map((due, i): Installment => ({
    id: `in-joao-${i}`, organizationId: A, contractId: "ct-joao", clientId: "c-joao", caseId: "k-joao-apos",
    label: i === 0 ? "Entrada" : `Parcela ${i}/7`, amount: i === 0 ? 80000 : 40000, paid: 0, due, status: "aberta",
  })),
  { id: "in-maria-0", organizationId: A, contractId: "ct-maria", clientId: "c-maria", caseId: "k-maria-bpc", label: "Entrada", amount: 40000, paid: 0, due: "2026-10-28", status: "aberta" },
  { id: "in-maria-1", organizationId: A, contractId: "ct-maria", clientId: "c-maria", caseId: "k-maria-bpc", label: "Parcela 1/4", amount: 60000, paid: 0, due: "2026-11-28", status: "aberta" },
  { id: "in-maria-2", organizationId: A, contractId: "ct-maria", clientId: "c-maria", caseId: "k-maria-bpc", label: "Parcela 2/4", amount: 60000, paid: 0, due: "2026-12-28", status: "aberta" },
  { id: "in-maria-3", organizationId: A, contractId: "ct-maria", clientId: "c-maria", caseId: "k-maria-bpc", label: "Parcela 3/4", amount: 60000, paid: 0, due: "2027-01-28", status: "aberta" },
  { id: "in-maria-4", organizationId: A, contractId: "ct-maria", clientId: "c-maria", caseId: "k-maria-bpc", label: "Parcela 4/4", amount: 60000, paid: 0, due: "2027-02-28", status: "aberta" },
  { id: "in-pad-0", organizationId: A, contractId: "ct-padaria", clientId: "c-padaria", caseId: "k-padaria-trab", label: "Mensalidade out/2026", amount: 150000, paid: 0, due: "2026-10-10", status: "aberta" },
  { id: "in-rita-0", organizationId: B, contractId: "ct-rita", clientId: "c-rita", caseId: "k-rita-trab", label: "Entrada", amount: 50000, paid: 0, due: "2026-10-20", status: "aberta" },
];

// Pagamentos já registrados; saldos das parcelas são derivados deles no seed.
export const payments: Payment[] = [
  { id: "p1", organizationId: A, installmentId: "in-joao-0", amount: 80000, date: "2026-08-05", method: "pix", source: "manual", note: "Entrada paga no escritório", idempotencyKey: "seed-p1" },
  { id: "p2", organizationId: A, installmentId: "in-joao-1", amount: 40000, date: "2026-08-21", method: "pix", source: "manual", note: "", idempotencyKey: "seed-p2" },
  { id: "p3", organizationId: A, installmentId: "in-joao-2", amount: 40000, date: "2026-09-15", method: "boleto", source: "manual", note: "", idempotencyKey: "seed-p3" },
  { id: "p4", organizationId: A, installmentId: "in-joao-3", amount: 25000, date: "2026-10-06", method: "pix", source: "manual", note: "Pagamento parcial; cliente pagará o restante com a próxima", idempotencyKey: "seed-p4" },
  { id: "p5", organizationId: B, installmentId: "in-rita-0", amount: 50000, date: "2026-10-20", method: "pix", source: "manual", note: "", idempotencyKey: "seed-p5" },
];

export const pensionAnalyses: PensionAnalysis[] = [
  {
    id: "pa-joao", organizationId: A, clientId: "c-joao", caseId: "k-joao-apos", regime: "RGPS", benefit: "Aposentadoria programada", modality: "planejamento", step: 3,
    periods: [
      { id: "v1", employer: "Construtora Alfa (fictícia)", start: "1983-02-01", end: "1991-06-30", category: "empregado", source: "CNIS", flag: "lacuna_depois", evidence: { documentId: "doc-cnis-joao", page: 1, excerpt: "Seq. 1 — CONSTRUTORA ALFA — 02/1983 a 06/1991" } },
      { id: "v2", employer: "Obras Beta (fictícia)", start: "1994-03-01", end: "2008-12-31", category: "empregado", source: "CNIS", flag: "concomitante", evidence: { documentId: "doc-cnis-joao", page: 1, excerpt: "Seq. 2 — OBRAS BETA — 03/1994 a 12/2008" } },
      { id: "v3", employer: "Contribuinte individual", start: "2008-06-01", end: "2015-04-30", category: "contribuinte_individual", source: "CNIS", flag: "concomitante", evidence: { documentId: "doc-cnis-joao", page: 2, excerpt: "Seq. 3 — CI — 06/2008 a 04/2015" } },
      { id: "v4", employer: "Reformas Gama (fictícia)", start: "2015-05-01", end: "2023-08-31", category: "empregado", source: "CTPS", flag: "divergencia_remuneracao", evidence: { documentId: "doc-ctps-joao", page: 14, excerpt: "Admissão 01/05/2015 — salário anotado difere do CNIS em 03/2019" } },
      { id: "v5", employer: "Contribuinte individual", start: "2023-09-01", end: "2026-09-30", category: "contribuinte_individual", source: "CNIS", evidence: { documentId: "doc-cnis-joao", page: 2, excerpt: "Seq. 5 — CI — 09/2023 a 09/2026" } },
    ],
    pending: [
      { id: "pd1", text: "Lacuna 07/1991 a 02/1994 — verificar CTPS ou outra prova", resolved: false },
      { id: "pd2", text: "Concomitância 06/2008 a 12/2008 — conferir recolhimentos CI", resolved: false },
      { id: "pd3", text: "Remuneração 03/2019 diverge entre CTPS e CNIS", resolved: false },
    ],
    scenarios: [
      { id: "s1", label: "Cenário A — regra de transição por pontos", rule: "Transição (exemplo)", eligibleOn: "2027-07-01", estimatedBenefit: 245000, assumptions: ["Mantém contribuição mensal como CI", "Lacuna de 1991–1994 não reconhecida"], pending: ["pd1"] },
      { id: "s2", label: "Cenário B — com reconhecimento da lacuna", rule: "Transição (exemplo)", eligibleOn: "2026-12-01", estimatedBenefit: 262000, assumptions: ["Lacuna reconhecida por prova documental", "Mantém contribuição mensal como CI"], pending: [] },
      { id: "s3", label: "Cenário C — aguardar regra por idade", rule: "Programada (exemplo)", eligibleOn: "2026-07-02", estimatedBenefit: null, assumptions: ["Idade mínima atingida", "Valor depende de motor de cálculo futuro"], pending: ["pd3"] },
    ],
    inputsVersion: 1, resultsVersion: 1,
  },
];

export const audit: AuditEvent[] = [];
