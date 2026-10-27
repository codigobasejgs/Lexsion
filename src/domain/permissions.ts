// Autorização DEMONSTRATIVA (UX). Não protege dados em produção: exigirá RLS no Supabase + checagem no servidor.
// Matriz papel × área (o que aparece) e papel × ação (o que pode fazer). 12 papéis do produto.
import type { Role } from "./types";

export type Area =
  | "inicio" | "atendimento" | "crm" | "ia" | "automacoes" | "marketing"
  | "clientes" | "casos" | "documentos" | "previdenciario" | "calculos" | "requisitorios" | "pesquisa" | "minutas"
  | "agenda" | "tarefas" | "prazos"
  | "propostas" | "financeiro" | "pagamentos"
  | "jornal" | "relatorios" | "integracoes" | "importacoes" | "equipe" | "configuracoes"
  | "ajuda" | "admin";

/** Ações sensíveis, verificadas também nos serviços mock (e no servidor na fase backend). */
export type Action = "aprovar_peca" | "publicar_portal" | "aprovar_proposta" | "exportar" | "gerir_equipe" | "gerir_marca" | "gerir_assinatura_saas" | "ver_honorarios" | "operar_plataforma" | "ver_casos_sigilosos";

const ALL_OFFICE: Area[] = [
  "inicio", "atendimento", "crm", "ia", "automacoes", "marketing", "clientes", "casos", "documentos", "previdenciario", "calculos", "requisitorios",
  "pesquisa", "minutas", "agenda", "tarefas", "prazos", "propostas", "financeiro", "pagamentos", "jornal", "relatorios", "integracoes", "importacoes",
  "equipe", "configuracoes", "ajuda",
];

const ACCESS: Record<Role, readonly Area[]> = {
  superadmin: ["admin", "ajuda"],
  platform_admin: ["admin", "ajuda"],
  platform_support: ["admin", "ajuda"],
  admin: ALL_OFFICE,
  // Gestor operacional: tudo do escritório, exceto marca, integrações e assinatura (ficam com o titular).
  tenant_admin: ALL_OFFICE.filter((a) => a !== "integracoes"),
  advogado: ["inicio", "atendimento", "crm", "ia", "clientes", "casos", "documentos", "previdenciario", "calculos", "requisitorios", "pesquisa", "minutas", "agenda", "tarefas", "prazos", "propostas", "jornal", "relatorios", "ajuda"],
  atendimento: ["inicio", "atendimento", "crm", "marketing", "clientes", "agenda", "tarefas", "documentos", "ajuda"],
  // Controladoria: prazos, publicações, agenda e tarefas; registra e confere, mas não aprova peças.
  controladoria: ["inicio", "clientes", "casos", "prazos", "agenda", "tarefas", "documentos", "requisitorios", "relatorios", "ajuda"],
  financeiro: ["inicio", "clientes", "propostas", "financeiro", "pagamentos", "relatorios", "ajuda"],
  estagiario: ["inicio", "casos", "clientes", "agenda", "tarefas", "prazos", "documentos", "previdenciario", "pesquisa", "minutas", "jornal", "ajuda"],
  // Correspondente/parceiro: só casos, documentos, agenda e tarefas que lhe forem atribuídos (filtro por vínculo na fase backend).
  external_collaborator: ["inicio", "casos", "documentos", "agenda", "tarefas", "ajuda"],
  cliente: [],
};

const ACTIONS: Record<Role, readonly Action[]> = {
  superadmin: ["operar_plataforma", "gerir_assinatura_saas", "exportar"],
  platform_admin: ["operar_plataforma", "gerir_assinatura_saas"],
  platform_support: [], // lê dados agregados; acesso assistido a escritório exige consentimento (fase backend)
  admin: ["aprovar_peca", "publicar_portal", "aprovar_proposta", "exportar", "gerir_equipe", "gerir_marca", "ver_honorarios", "ver_casos_sigilosos"],
  tenant_admin: ["exportar", "gerir_equipe", "ver_honorarios"],
  advogado: ["aprovar_peca", "publicar_portal", "aprovar_proposta", "exportar", "ver_honorarios", "ver_casos_sigilosos"],
  controladoria: ["exportar"],
  financeiro: ["exportar", "ver_honorarios"],
  atendimento: [],
  estagiario: [],
  external_collaborator: [],
  cliente: [],
};

export function can(role: Role, area: Area): boolean {
  return ACCESS[role].includes(area);
}
export function allowed(role: Role | undefined, action: Action): boolean {
  return !!role && ACTIONS[role].includes(action);
}

export const ROLE_LABEL: Record<Role, string> = {
  superadmin: "Superadmin SaaS",
  platform_admin: "Administrador da plataforma",
  platform_support: "Suporte da plataforma",
  admin: "Administrador do escritório",
  tenant_admin: "Gestor(a) operacional",
  advogado: "Advogado(a)",
  controladoria: "Controladoria jurídica",
  financeiro: "Financeiro",
  atendimento: "Atendimento/comercial",
  estagiario: "Estagiário(a)/colaborador(a)",
  external_collaborator: "Correspondente/parceiro externo",
  cliente: "Cliente (portal)",
};

/** Correspondência com os 12 papéis da especificação do produto (nome técnico futuro no backend). */
export const ROLE_PRODUCT: Record<Role, string> = {
  superadmin: "platform_owner", platform_admin: "platform_admin", platform_support: "platform_support",
  admin: "tenant_owner", tenant_admin: "tenant_admin", advogado: "lawyer", controladoria: "controller", financeiro: "finance",
  atendimento: "assistant", estagiario: "intern", cliente: "tenant_client", external_collaborator: "external_collaborator",
};

export const PLATFORM_ROLES: Role[] = ["superadmin", "platform_admin", "platform_support"];
export const isPlatformRole = (r: Role | undefined) => !!r && PLATFORM_ROLES.includes(r);
export const ALL_ROLES = Object.keys(ROLE_LABEL) as Role[];
export const ACTION_LABEL: Record<Action, string> = {
  aprovar_peca: "Aprovar peças", publicar_portal: "Publicar no portal", aprovar_proposta: "Aprovar propostas", exportar: "Exportar dados",
  gerir_equipe: "Gerir equipe", gerir_marca: "Alterar identidade visual", gerir_assinatura_saas: "Gerir assinaturas SaaS", ver_honorarios: "Ver honorários",
  operar_plataforma: "Operar a plataforma", ver_casos_sigilosos: "Ver casos sigilosos",
};

/** Perfis que podem ver valores de honorários no painel de atendimento. */
export function canSeeFees(role: Role): boolean {
  return allowed(role, "ver_honorarios");
}

/** Aprovação de peças e propostas; autorização de pagamentos. */
export function canApprove(role: Role): boolean {
  return allowed(role, "aprovar_peca");
}
