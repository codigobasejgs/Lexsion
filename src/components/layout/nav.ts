import {
  AlarmClock, Banknote, BarChart3, BookOpen, Bot, Briefcase, Building2, CalendarDays, Calculator, CreditCard, FileSignature, FileText, FolderOpen,
  GraduationCap, Home, KanbanSquare, Landmark, LayoutGrid, ListChecks, Megaphone, MessagesSquare, Newspaper, Palette, Plug, Scale, ScrollText,
  Search, Settings, Upload, Users, UsersRound, Workflow, GitBranch,
} from "lucide-react";
import type { Area } from "@/domain/permissions";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  area: Area;
  tour?: string;
}

// Grupos do prompt mestre (seção 4).
export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  { label: "Meu dia", items: [{ href: "/app/inicio", label: "Meu dia", icon: Home, area: "inicio", tour: "nav-inicio" }] },
  {
    label: "Atendimento e comercial",
    items: [
      { href: "/app/atendimento", label: "Conversas", icon: MessagesSquare, area: "atendimento", tour: "nav-atendimento" },
      { href: "/app/crm", label: "Funil (CRM)", icon: KanbanSquare, area: "crm", tour: "nav-crm" },
      { href: "/app/propostas", label: "Propostas", icon: ScrollText, area: "propostas" },
      { href: "/app/contratos", label: "Contratos", icon: FileSignature, area: "propostas" },
      { href: "/app/marketing/campanhas", label: "Marketing", icon: Megaphone, area: "marketing" },
    ],
  },
  {
    label: "Clientes e jurídico",
    items: [
      { href: "/app/clientes", label: "Clientes", icon: Users, area: "clientes" },
      { href: "/app/casos", label: "Casos", icon: Briefcase, area: "casos" },
      { href: "/app/processos", label: "Processos", icon: Landmark, area: "casos" },
      { href: "/app/documentos", label: "Documentos", icon: FolderOpen, area: "documentos" },
      { href: "/app/previdenciario", label: "Previdenciário", icon: Scale, area: "previdenciario" },
      { href: "/app/calculos", label: "Cálculos", icon: Calculator, area: "calculos" },
      { href: "/app/requisitorios", label: "RPV e precatórios", icon: Landmark, area: "requisitorios" },
      { href: "/app/minutas", label: "Minutas e modelos", icon: FileText, area: "minutas" },
      { href: "/app/pesquisa", label: "Pesquisa jurídica", icon: Search, area: "pesquisa" },
    ],
  },
  {
    label: "Operação",
    items: [
      { href: "/app/agenda", label: "Agenda", icon: CalendarDays, area: "agenda" },
      { href: "/app/tarefas", label: "Tarefas", icon: ListChecks, area: "tarefas" },
      { href: "/app/workflows", label: "Workflows", icon: GitBranch, area: "tarefas" },
      { href: "/app/prazos", label: "Prazos e publicações", icon: AlarmClock, area: "prazos" },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { href: "/app/financeiro", label: "Financeiro", icon: Banknote, area: "financeiro" },
      { href: "/app/pagamentos", label: "Pagamentos", icon: CreditCard, area: "pagamentos" },
    ],
  },
  {
    label: "Inteligência e conteúdo",
    items: [
      { href: "/app/ia/assistente", label: "Assistente de IA", icon: Bot, area: "ia" },
      { href: "/app/ia/agentes", label: "Agentes de IA", icon: Bot, area: "ia" },
      { href: "/app/automacoes", label: "Automações", icon: Workflow, area: "automacoes" },
      { href: "/app/jornal", label: "Jornal do Advogado", icon: Newspaper, area: "jornal" },
      { href: "/app/relatorios", label: "Relatórios", icon: BarChart3, area: "relatorios" },
    ],
  },
  {
    label: "Administração",
    items: [
      { href: "/app/equipe", label: "Equipe", icon: UsersRound, area: "equipe" },
      { href: "/app/integracoes", label: "Integrações", icon: Plug, area: "integracoes" },
      { href: "/app/importacoes", label: "Importações", icon: Upload, area: "importacoes" },
      { href: "/app/configuracoes", label: "Configurações", icon: Settings, area: "configuracoes" },
      { href: "/admin", label: "Super Admin LexSion", icon: Building2, area: "admin" },
    ],
  },
  {
    label: "Aprender e obter ajuda",
    items: [
      { href: "/app/boas-vindas", label: "Primeiros passos", icon: ListChecks, area: "configuracoes" },
      { href: "/app/academia", label: "Academia", icon: GraduationCap, area: "ajuda", tour: "nav-academia" },
      { href: "/app/ajuda", label: "Central de ajuda", icon: BookOpen, area: "ajuda" },
      { href: "/design-system", label: "Design system", icon: Palette, area: "configuracoes" },
    ],
  },
];

// Barra inferior no celular: Meu dia, Conversas, Agenda e Mais.
export const MOBILE_TABS: NavItem[] = [
  { href: "/app/inicio", label: "Meu dia", icon: Home, area: "inicio" },
  { href: "/app/atendimento", label: "Conversas", icon: MessagesSquare, area: "atendimento" },
  { href: "/app/agenda", label: "Agenda", icon: CalendarDays, area: "agenda" },
];
export const MORE_ICON = LayoutGrid;
