// Autorização DEMONSTRATIVA. Não protege dados em produção: exigirá RLS no Supabase + checagem no servidor.
import type { Role } from "./types";

export type Area =
  | "inicio" | "atendimento" | "crm" | "ia" | "automacoes" | "marketing"
  | "clientes" | "casos" | "documentos" | "previdenciario" | "calculos" | "requisitorios" | "pesquisa" | "minutas"
  | "agenda" | "tarefas" | "prazos"
  | "propostas" | "financeiro" | "pagamentos"
  | "jornal" | "relatorios" | "integracoes" | "importacoes" | "equipe" | "configuracoes"
  | "ajuda" | "admin";

const ALL_OFFICE: Area[] = [
  "inicio", "atendimento", "crm", "ia", "automacoes", "marketing", "clientes", "casos", "documentos", "previdenciario", "calculos", "requisitorios",
  "pesquisa", "minutas", "agenda", "tarefas", "prazos", "propostas", "financeiro", "pagamentos", "jornal", "relatorios", "integracoes", "importacoes",
  "equipe", "configuracoes", "ajuda",
];

const ACCESS: Record<Role, readonly Area[]> = {
  admin: ALL_OFFICE,
  advogado: ["inicio", "atendimento", "crm", "ia", "clientes", "casos", "documentos", "previdenciario", "calculos", "requisitorios", "pesquisa", "minutas", "agenda", "tarefas", "prazos", "propostas", "jornal", "relatorios", "ajuda"],
  atendimento: ["inicio", "atendimento", "crm", "marketing", "clientes", "agenda", "tarefas", "documentos", "ajuda"],
  // Controladoria: prazos, publicações, agenda e tarefas; registra e confere, mas não aprova peças.
  controladoria: ["inicio", "clientes", "casos", "prazos", "agenda", "tarefas", "documentos", "requisitorios", "relatorios", "ajuda"],
  financeiro: ["inicio", "clientes", "propostas", "financeiro", "pagamentos", "relatorios", "ajuda"],
  estagiario: ["inicio", "casos", "clientes", "agenda", "tarefas", "prazos", "documentos", "previdenciario", "pesquisa", "minutas", "jornal", "ajuda"],
  cliente: [],
  superadmin: ["admin", "ajuda"],
};

export function can(role: Role, area: Area): boolean {
  return ACCESS[role].includes(area);
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador do escritório",
  advogado: "Advogado(a)",
  atendimento: "Atendimento/comercial",
  controladoria: "Controladoria jurídica",
  financeiro: "Financeiro",
  estagiario: "Estagiário(a)/colaborador(a)",
  cliente: "Cliente (portal)",
  superadmin: "Superadmin SaaS",
};

/** Perfis que podem ver valores de honorários no painel de atendimento. */
export function canSeeFees(role: Role): boolean {
  return role === "admin" || role === "advogado" || role === "financeiro";
}

/** Aprovação de peças e propostas; autorização de pagamentos. */
export function canApprove(role: Role): boolean {
  return role === "admin" || role === "advogado";
}
