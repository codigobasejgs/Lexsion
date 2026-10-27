import type { Role } from "@/domain/types";

// Academia (M23): trilhas por função, lições textuais ligadas a artigos e tours, exercícios no ambiente demo.
// Sem vídeo: só quando existir arquivo real.
export interface Lesson {
  key: string;
  title: string;
  minutes: number;
  article?: string; // slug da central de ajuda
  tour?: string; // id do tour
  exercise?: { text: string; href: string };
}
export interface Track {
  id: string;
  title: string;
  level: "Iniciante" | "Intermediário";
  roles: Role[];
  lessons: Lesson[];
}

export const TRACKS: Track[] = [
  {
    id: "comecando", title: "Começando na SIWILTEC", level: "Iniciante", roles: ["admin", "advogado", "atendimento", "financeiro", "estagiario"],
    lessons: [
      { key: "modo-demo", title: "O que é real e o que é simulado", minutes: 3, article: "entender-modo-demo" },
      { key: "primeiro-acesso", title: "Primeiro acesso e busca", minutes: 4, article: "primeiro-acesso", tour: "primeiro-acesso" },
      { key: "meu-dia", title: "Organizar o Meu dia", minutes: 4, tour: "meu-dia", exercise: { text: "Filtre só os prazos jurídicos.", href: "/app/inicio?tipo=juridico" } },
      { key: "celular", title: "Usar no celular", minutes: 3, article: "operar-no-celular" },
    ],
  },
  {
    id: "atendimento", title: "Atendimento e funil", level: "Iniciante", roles: ["admin", "advogado", "atendimento"],
    lessons: [
      { key: "assumir", title: "Assumir conversa e pausar a assistente", minutes: 5, article: "assumir-conversa", tour: "atendimento" },
      { key: "lead", title: "Organizar lead no funil", minutes: 5, article: "organizar-lead", tour: "primeiro-lead", exercise: { text: "Mova um lead de “Novo” para “Em atendimento”.", href: "/app/crm" } },
      { key: "converter", title: "Converter lead em cliente", minutes: 5, article: "converter-lead" },
      { key: "cliente", title: "Cadastrar cliente", minutes: 4, article: "cadastrar-cliente", exercise: { text: "Cadastre um cliente fictício.", href: "/app/clientes/novo" } },
    ],
  },
  {
    id: "juridico", title: "Operação jurídica", level: "Intermediário", roles: ["admin", "advogado", "estagiario"],
    lessons: [
      { key: "caso", title: "Abrir caso", minutes: 4, article: "abrir-caso", tour: "caso" },
      { key: "prazo", title: "Registrar e confirmar prazo", minutes: 6, article: "registrar-prazo", exercise: { text: "Confira e confirme o prazo de quesitos periciais.", href: "/app/prazos" } },
      { key: "pericia", title: "Agendar perícia", minutes: 4, article: "agendar-pericia", tour: "agenda" },
      { key: "docs", title: "Solicitar e revisar documentos", minutes: 6, article: "revisar-extracao", tour: "documentos" },
      { key: "prev", title: "Comparar cenários previdenciários", minutes: 8, article: "comparar-cenarios", tour: "previdenciario" },
      { key: "minuta", title: "Revisar minuta", minutes: 5, article: "revisar-minuta" },
    ],
  },
  {
    id: "financeiro", title: "Financeiro do escritório", level: "Intermediário", roles: ["admin", "financeiro"],
    lessons: [
      { key: "proposta", title: "Enviar proposta (simulação)", minutes: 6, article: "enviar-proposta", tour: "proposta-assinatura" },
      { key: "parcelas", title: "Entrada e parcelas com datas próprias", minutes: 5, article: "entrada-e-parcelas" },
      { key: "baixa", title: "Baixa parcial", minutes: 4, article: "baixa-parcial", tour: "cobranca", exercise: { text: "Registre R$ 100,00 em uma parcela em aberto.", href: "/app/financeiro/receber" } },
      { key: "recibo", title: "Emitir recibo", minutes: 3, article: "emitir-recibo" },
      { key: "conciliacao", title: "Conciliação", minutes: 6, article: "conciliacao", tour: "conciliacao" },
    ],
  },
  {
    id: "gestao", title: "Gestão e integrações", level: "Intermediário", roles: ["admin"],
    lessons: [
      { key: "importar", title: "Importar planilha CSV", minutes: 8, article: "importar-csv", exercise: { text: "Importe o CSV fictício de exemplo.", href: "/app/importacoes" } },
      { key: "notificacoes", title: "Configurar notificações", minutes: 3, article: "configurar-notificacoes" },
      { key: "whatsapp", title: "Conexão do WhatsApp (etapa futura)", minutes: 4, article: "conectar-whatsapp", tour: "integracoes" },
      { key: "erros", title: "Recuperar erros e pedir ajuda", minutes: 3, article: "recuperar-erros" },
    ],
  },
];

// Livros citados pela cliente: só entram quando ela enviar o material. Nada é resumido ou inventado.
export const BOOKS = [
  "O segredo do empreendedorismo jurídico na era da tecnologia",
  "A saga do advogado-vendedor",
];
