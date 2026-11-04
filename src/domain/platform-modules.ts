// Módulos do painel da PLATAFORMA (/admin). O Super Admin restringe por pessoa quais ela vê. Conteúdo jurídico dos
// escritórios não é módulo aqui: nenhum papel da plataforma o acessa (contrato, Anexo III.5).
// Mantida em sincronia com public.platform_modules() (migração 20261104170000).
export const PLATFORM_MODULES = [
  { id: "painel", label: "Painel geral", href: "/admin" },
  { id: "contratantes", label: "Contratantes", href: "/admin/organizacoes" },
  { id: "planos", label: "Planos e assinaturas", href: "/admin/planos" },
  { id: "financeiro", label: "Financeiro da plataforma", href: "/admin/faturamento" },
  { id: "contratos", label: "Contratos SaaS", href: "/admin/contratos" },
  { id: "integracoes", label: "Integrações", href: "/admin/integracoes" },
  { id: "suporte", label: "Suporte", href: "/admin/suporte" },
  { id: "dados", label: "Dados e LGPD", href: "/admin/dados" },
  { id: "auditoria", label: "Auditoria", href: "/admin/auditoria" },
  { id: "equipe", label: "Equipe da plataforma", href: "/admin/equipe" },
] as const;
export type PlatformModule = (typeof PLATFORM_MODULES)[number]["id"];

/** Módulo da rota /admin… (o mais específico). */
export const moduleForPath = (path: string): PlatformModule => (PLATFORM_MODULES.filter((m) => m.href !== "/admin" && (path === m.href || path.startsWith(`${m.href}/`)))[0]?.id ?? "painel");

/** A pessoa vê o módulo? Equipe da plataforma é exclusiva do Super Admin. */
export const canSeeModule = (role: string | undefined, denied: readonly string[], m: PlatformModule) => (m === "equipe" ? role === "superadmin" : !denied.includes(m));

export const PLATFORM_ROLE_HELP: Record<string, string> = {
  superadmin: "Tudo, inclusive gerenciar a equipe da plataforma e excluir dados de escritórios encerrados.",
  platform_admin: "Operação: contratantes, planos, contratos, integrações e suporte.",
  platform_support: "Atendimento aos escritórios (suporte), sem valores financeiros.",
  platform_finance: "Financeiro da plataforma e assinaturas.",
  platform_auditor: "Somente leitura de auditoria e indicadores.",
};
