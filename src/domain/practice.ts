// Perfil de atuação do escritório (fase 1 do ERP adaptativo): especialidades (principal + secundárias), subespecialidades,
// modelo de atuação, estrutura, posição profissional, rotina e módulos de interesse. Grava em org_practice_profiles
// (RLS: membros leem; titular/gestor alteram; o banco confere o catálogo). Escolher uma especialidade NÃO libera
// recurso que não exista: os módulos vêm do catálogo real (MODULES, com "disponível" só para o que existe hoje).
export const SPECIALTIES = [
  { id: "civil", label: "Direito Civil", subs: ["Responsabilidade civil e indenizações", "Contratos e obrigações", "Cobranças", "Cumprimento de sentença"] },
  { id: "familia", label: "Família e Sucessões", subs: ["Divórcio", "Guarda", "Pensão alimentícia", "Inventário", "Partilha", "União estável", "Planejamento sucessório"] },
  { id: "criminal", label: "Direito Criminal", subs: ["Inquérito e investigação", "Audiência de custódia", "Habeas corpus", "Tribunal do Júri", "Execução penal"] },
  { id: "trabalhista", label: "Direito Trabalhista", subs: ["Reclamante", "Reclamada", "Acidente de trabalho", "Verbas rescisórias", "Horas extras", "Vínculo empregatício", "Assédio", "Execução trabalhista"] },
  { id: "tributario", label: "Direito Tributário", subs: ["Planejamento tributário", "Processo administrativo fiscal", "Execução fiscal", "Parcelamentos e regularização"] },
  { id: "empresarial", label: "Empresarial e Societário", subs: ["Constituição e alterações societárias", "Contratos comerciais", "Due diligence", "Recuperação judicial e falência", "Governança e compliance"] },
  { id: "consumidor", label: "Direito do Consumidor", subs: ["Defesa do consumidor", "Defesa de fornecedores", "Negociação e acordos"] },
  { id: "previdenciario", label: "Direito Previdenciário", subs: ["Aposentadoria por idade", "Aposentadoria por tempo de contribuição", "Aposentadoria especial", "Aposentadoria rural", "Benefício por incapacidade", "BPC/LOAS", "Pensão por morte", "Revisões previdenciárias", "Planejamento previdenciário"] },
  { id: "ambiental", label: "Direito Ambiental", subs: ["Licenciamento", "Autos de infração e defesa", "Termos de ajustamento de conduta"] },
  { id: "digital", label: "Direito Digital e Proteção de Dados", subs: ["Adequação à LGPD", "Incidentes de segurança", "Contencioso digital"] },
  { id: "eleitoral", label: "Direito Eleitoral", subs: ["Registro de candidatura", "Prestação de contas", "Representações e recursos"] },
  { id: "imobiliario", label: "Direito Imobiliário", subs: ["Compra e venda", "Locação e despejo", "Usucapião", "Regularização", "Condomínios"] },
  { id: "propriedade_intelectual", label: "Propriedade Intelectual", subs: ["Registro de marcas", "Patentes", "Direitos autorais", "Oposições e recursos"] },
] as const;
export type SpecialtyId = (typeof SPECIALTIES)[number]["id"];

export const PRACTICE_MODELS = ["Consultivo", "Contencioso", "Preventivo", "Extrajudicial", "Administrativo", "Judicial", "Assessoria jurídica empresarial", "Atuação pública", "Advocacia autônoma", "Escritório próprio", "Departamento jurídico"];
export const STRUCTURES = ["Advogado(a) individual", "Escritório individual", "Sociedade de advogados", "Escritório com sócios", "Escritório com equipe", "Departamento jurídico empresarial", "Procuradoria ou estrutura jurídica pública"];
export const POSITIONS = ["Sócio(a) proprietário(a)", "Sócio(a) administrador(a)", "Advogado(a) associado(a)", "Advogado(a) empregado(a)", "Advogado(a) autônomo(a)", "Advogado(a) público(a)", "Advogado(a) colaborador(a)"];
export const ROUTINE = [
  ["pf", "Atende pessoas físicas"], ["pj", "Atende empresas"], ["judicial", "Processos judiciais"], ["administrativo", "Procedimentos administrativos"],
  ["consultoria", "Consultoria e pareceres"], ["contratos", "Contratos"], ["calculos", "Cálculos jurídicos"], ["honorarios", "Controle de honorários"],
  ["exito", "Honorários de êxito"], ["equipe", "Tem equipe"], ["portal", "Portal para clientes"],
] as const;

// Módulos do catálogo real. "disponivel": existe e funciona hoje na operação real; "auditoria": existe, mas desligado
// para dados de clientes; "futuro": não existe — aparece como planejado, nunca como contratável.
export const MODULES: { id: string; label: string; group: string; status: "disponivel" | "auditoria" | "futuro"; href?: string }[] = [
  { id: "crm", label: "CRM e funil de atendimento", group: "Gestão e relacionamento", status: "disponivel", href: "/app/crm" },
  { id: "clientes", label: "Cadastro de clientes", group: "Gestão e relacionamento", status: "disponivel", href: "/app/clientes" },
  { id: "portal", label: "Portal do cliente", group: "Gestão e relacionamento", status: "disponivel", href: "/app/configuracoes/branding" },
  { id: "casos", label: "Casos e processos", group: "Gestão jurídica", status: "disponivel", href: "/app/casos" },
  { id: "prazos", label: "Prazos, agenda e audiências", group: "Gestão jurídica", status: "disponivel", href: "/app/prazos" },
  { id: "tarefas", label: "Tarefas e workflows", group: "Gestão jurídica", status: "disponivel", href: "/app/workflows" },
  { id: "documentos", label: "Documentos e procurações", group: "Gestão jurídica", status: "disponivel", href: "/app/documentos" },
  { id: "minutas", label: "Minutas e modelos", group: "Gestão jurídica", status: "disponivel", href: "/app/minutas" },
  { id: "contratos", label: "Propostas e contratos de honorários", group: "Gestão jurídica", status: "disponivel", href: "/app/contratos" },
  { id: "previdenciario", label: "Previdenciário (análises e cálculos demonstrativos)", group: "Cálculos e inteligência", status: "disponivel", href: "/app/previdenciario" },
  { id: "monitoramento", label: "Monitoramento legislativo (Câmara e Senado)", group: "Cálculos e inteligência", status: "disponivel", href: "/app/jornal" },
  { id: "ia", label: "Assistente de IA", group: "Cálculos e inteligência", status: "auditoria" },
  { id: "jurisprudencia", label: "Pesquisa de jurisprudência em tribunais", group: "Cálculos e inteligência", status: "futuro" },
  { id: "financeiro", label: "Honorários, contas e fluxo de caixa", group: "Financeiro", status: "disponivel", href: "/app/financeiro" },
  { id: "cobranca_online", label: "Cobrança online de honorários", group: "Financeiro", status: "futuro" },
  { id: "whatsapp", label: "WhatsApp", group: "Comunicação e automação", status: "auditoria" },
  { id: "email", label: "E-mails transacionais (convites e avisos)", group: "Comunicação e automação", status: "disponivel" },
  { id: "automacoes", label: "Automações e envio em massa", group: "Comunicação e automação", status: "futuro" },
  { id: "equipe", label: "Equipe, papéis e permissões", group: "Administração", status: "disponivel", href: "/app/equipe" },
  { id: "auditoria", label: "Relatórios e auditoria", group: "Administração", status: "disponivel", href: "/app/relatorios" },
  { id: "marca", label: "Marca própria e aplicativo (PWA)", group: "Administração", status: "disponivel", href: "/app/configuracoes/branding" },
];

export type PracticeProfile = {
  primary_area: SpecialtyId | null; areas: SpecialtyId[]; subareas: string[]; custom_areas: string[]; practice_models: string[];
  structure: string | null; position: string | null; routine: Record<string, boolean>; modules: string[]; completed_at: string | null;
};
export const EMPTY_PROFILE: PracticeProfile = { primary_area: null, areas: [], subareas: [], custom_areas: [], practice_models: [], structure: null, position: null, routine: {}, modules: [], completed_at: null };

/** Validação (mesma regra do gatilho opp_guard no banco). Retorna mensagem ou null. */
export function validateProfile(p: PracticeProfile): string | null {
  const ids = new Set<string>(SPECIALTIES.map((s) => s.id));
  if (!p.areas.length) return "Escolha ao menos uma especialidade.";
  if (p.areas.some((a) => !ids.has(a))) return "Especialidade fora do catálogo.";
  if (!p.primary_area || !p.areas.includes(p.primary_area)) return "Marque qual é a especialidade principal.";
  if (p.custom_areas.length > 20 || p.custom_areas.some((c) => c.trim().length < 2 || c.length > 60)) return "Áreas personalizadas: até 20, com 2 a 60 caracteres.";
  if (p.modules.some((m) => MODULES.find((x) => x.id === m)?.status === "futuro")) return "Módulo ainda não disponível não pode ser selecionado.";
  return null;
}

/** Atalhos do painel conforme a especialidade principal (só módulos disponíveis). */
export function suggestedModules(p: Pick<PracticeProfile, "areas" | "routine">): string[] {
  const s = new Set(["clientes", "casos", "prazos", "tarefas", "documentos", "financeiro"]);
  if (p.areas.includes("previdenciario")) s.add("previdenciario");
  if (p.routine.portal) s.add("portal");
  if (p.routine.contratos || p.routine.honorarios) s.add("contratos");
  if (p.routine.pf || p.routine.pj) s.add("crm");
  if (p.routine.equipe) s.add("equipe");
  return [...s].filter((id) => MODULES.find((m) => m.id === id)?.status === "disponivel");
}
