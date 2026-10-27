import type { Area } from "@/domain/permissions";

// Tours guiados (M23). Seletores: somente `data-tour` estáveis — nunca texto ou posição.
// `target` aceita alternativas: usa a primeira visível (sidebar no desktop × conteúdo no celular).
export interface TourStep {
  route: string;
  target: string | string[];
  title: string;
  body: string;
}
export interface Tour {
  id: string;
  title: string;
  summary: string;
  area: Area | "portal";
  version: string;
  steps: TourStep[];
}

export const TOUR_VERSION = "0.1.0";

export const TOURS: Tour[] = [
  {
    id: "primeiro-acesso", title: "Primeiro acesso", summary: "Busca, notificações e onde começar o dia.", area: "inicio", version: TOUR_VERSION,
    steps: [
      { route: "/app/inicio", target: "busca-global", title: "Busca e atalhos", body: "Encontre clientes, casos, conversas e artigos de ajuda. No computador, use Ctrl + K." },
      { route: "/app/inicio", target: "notificacoes", title: "Notificações", body: "Avisos do escritório aparecem aqui, mesmo sem notificação no celular." },
      { route: "/app/inicio", target: "meu-dia-lista", title: "O que precisa da sua atenção", body: "Itens ordenados por urgência. Prazo jurídico vem antes de prioridade comercial." },
    ],
  },
  {
    id: "meu-dia", title: "Meu dia", summary: "Filtrar e agir nos itens do dia.", area: "inicio", version: TOUR_VERSION,
    steps: [
      { route: "/app/inicio", target: "filtros-meu-dia", title: "Filtros", body: "Mostre só prazos, tarefas, atendimento, comercial ou financeiro." },
      { route: "/app/inicio", target: "meu-dia-lista", title: "Cada item explica o motivo", body: "Toque no item para abrir exatamente os registros que o compõem." },
    ],
  },
  {
    id: "primeiro-lead", title: "Primeiro lead", summary: "Cadastrar, mover no funil e converter.", area: "crm", version: TOUR_VERSION,
    steps: [
      { route: "/app/crm", target: "novo-lead", title: "Novo lead", body: "Cadastre um interessado. O sistema avisa se o telefone já existe." },
      { route: "/app/crm", target: "funil", title: "Funil comercial", body: "Cada coluna é uma etapa comercial — não é a fase jurídica do caso." },
      { route: "/app/crm/leads/l-novo", target: "converter-lead", title: "Converter em cliente", body: "Quando fechar, converta sem duplicar: o sistema procura cadastros parecidos." },
    ],
  },
  {
    id: "atendimento", title: "Atendimento humano e assistente virtual", summary: "Assumir a conversa e pausar a assistente.", area: "atendimento", version: TOUR_VERSION,
    steps: [
      { route: "/app/atendimento/cv-novo", target: "estado-ia", title: "Quem está respondendo", body: "Esta faixa mostra se a assistente virtual ou uma pessoa está no atendimento." },
      { route: "/app/atendimento/cv-novo", target: "assumir", title: "Assumir atendimento", body: "Ao assumir, a assistente pausa e só você responde." },
    ],
  },
  {
    id: "cliente", title: "Ficha do cliente", summary: "Tudo do cliente em um lugar.", area: "clientes", version: TOUR_VERSION,
    steps: [
      { route: "/app/clientes/c-maria", target: ["abas-cliente", "abrir-caso"], title: "Seções do cliente", body: "Casos, atendimentos, documentos, financeiro e histórico do mesmo cliente." },
      { route: "/app/clientes/c-maria", target: "abrir-caso", title: "Abrir caso", body: "Crie o caso jurídico a partir daqui." },
    ],
  },
  {
    id: "caso", title: "Caso e prazos", summary: "Resumo do caso e confirmação de prazo.", area: "casos", version: TOUR_VERSION,
    steps: [
      { route: "/app/casos/k-maria-bpc", target: "resumo-caso", title: "Resumo do caso", body: "Fase, responsável e próximos passos do caso." },
      { route: "/app/prazos", target: "confirmar-prazo", title: "Conferir e confirmar", body: "Prazo calculado é proposta. Só vale depois de conferido por advogado(a)." },
    ],
  },
  {
    id: "documentos", title: "Documentos", summary: "Enviar, solicitar e revisar.", area: "documentos", version: TOUR_VERSION,
    steps: [
      { route: "/app/documentos", target: "enviar-documento", title: "Enviar documento", body: "PDF ou imagem até 15 MB. O original é preservado." },
      { route: "/app/documentos/solicitacoes", target: "nova-solicitacao", title: "Solicitar ao cliente", body: "O pedido aparece no portal do cliente." },
    ],
  },
  {
    id: "previdenciario", title: "Análise previdenciária", summary: "Etapas e comparação de cenários.", area: "previdenciario", version: TOUR_VERSION,
    steps: [
      { route: "/app/previdenciario/analises/pa-joao", target: "etapas-analise", title: "Etapas", body: "Documentos → vínculos → pendências → cenários → relatório." },
      { route: "/app/previdenciario/analises/pa-joao", target: "cenarios", title: "Cenários comparados", body: "Valores demonstrativos com premissas. Sempre exigem revisão profissional." },
    ],
  },
  {
    id: "agenda", title: "Agenda", summary: "Compromissos, audiências e perícias.", area: "agenda", version: TOUR_VERSION,
    steps: [{ route: "/app/agenda", target: "novo-compromisso", title: "Novo compromisso", body: "Audiência, perícia, atendimento ou reunião. Conflitos de horário são avisados." }],
  },
  {
    id: "proposta-assinatura", title: "Proposta e assinatura", summary: "Do envio simulado ao contrato.", area: "propostas", version: TOUR_VERSION,
    steps: [
      { route: "/app/propostas/pp-paulo", target: "fluxo-proposta", title: "Fluxo da proposta", body: "Revisão, aprovação, envio (simulação) e resposta do cliente." },
      { route: "/app/contratos/ct-ronaldo", target: "signatarios", title: "Signatários", body: "O contrato só é concluído quando todos os signatários obrigatórios assinam." },
    ],
  },
  {
    id: "minutas", title: "Minutas e exportação Word", summary: "Revisar, aprovar e baixar .docx.", area: "minutas", version: TOUR_VERSION,
    steps: [
      { route: "/app/minutas/dr-lucia", target: "editor-minuta", title: "Texto da minuta", body: "Edite e salve. Campos “não preenchido” bloqueiam a aprovação." },
      { route: "/app/minutas/dr-lucia", target: "exportar-docx", title: "Exportar em Word", body: "Depois de aprovada, baixe o .docx. Ele sai marcado como rascunho demonstrativo." },
    ],
  },
  {
    id: "financeiro-perfil", title: "Primeiro dia no financeiro", summary: "Receber, conciliar e emitir recibo.", area: "financeiro", version: TOUR_VERSION,
    steps: [
      { route: "/app/financeiro/receber", target: "registrar-pagamento", title: "Dar baixa", body: "Registre o valor recebido. Pagamento parcial mantém o saldo." },
      { route: "/app/financeiro/conciliacao", target: "extrato", title: "Conferir o extrato", body: "Cada linha pendente precisa de uma decisão com justificativa." },
    ],
  },
  {
    id: "cobranca", title: "Cobrança e baixa", summary: "Registrar pagamento parcial ou total.", area: "financeiro", version: TOUR_VERSION,
    steps: [{ route: "/app/financeiro/receber", target: "registrar-pagamento", title: "Registrar pagamento", body: "Informe valor, data e forma. Pagamento parcial mantém o saldo correto." }],
  },
  {
    id: "conciliacao", title: "Conciliação", summary: "Extrato × pagamentos registrados.", area: "financeiro", version: TOUR_VERSION,
    steps: [{ route: "/app/financeiro/conciliacao", target: "extrato", title: "Linhas do extrato", body: "Cada linha pendente exige decisão explícita com justificativa." }],
  },
  {
    id: "integracoes", title: "Integrações", summary: "Conexão simulada do WhatsApp e fila de saída.", area: "integracoes", version: TOUR_VERSION,
    steps: [{ route: "/app/integracoes/evolution", target: "conexao-whatsapp", title: "Conexão WhatsApp (simulação)", body: "Se desconectar, mensagens ficam na fila e são reenviadas sem duplicar." }],
  },
  {
    id: "portal", title: "Área do cliente", summary: "Caso, documentos e pagamentos.", area: "portal", version: TOUR_VERSION,
    steps: [
      { route: "/portal", target: "portal-inicio", title: "Seu caso", body: "Em que etapa está seu caso e qual o próximo passo." },
      { route: "/portal", target: "portal-docs", title: "Documentos", body: "Veja o que precisa enviar e mande foto ou PDF." },
      { route: "/portal", target: "portal-pagar", title: "Pagamentos", body: "Valores e vencimentos. Pagamento online virá numa próxima fase." },
    ],
  },
  {
    id: "identidade", title: "Marca e aplicativo do escritório", summary: "Logotipo, cores legíveis e QR para instalar.", area: "configuracoes", version: TOUR_VERSION,
    steps: [
      { route: "/app/configuracoes/branding", target: "wl-logo", title: "Logotipo", body: "Envie PNG, JPEG ou WebP. O arquivo é conferido e convertido com segurança." },
      { route: "/app/configuracoes/branding", target: "wl-cores", title: "Cores", body: "Se a cor ficar difícil de ler, o sistema avisa e usa uma variação legível, sem perder sua escolha." },
      { route: "/app/configuracoes/branding", target: "wl-app", title: "Meu aplicativo", body: "Mostre o QR Code para a equipe e os clientes instalarem o aplicativo do escritório." },
    ],
  },
  {
    id: "super-admin", title: "Gestão da plataforma (Super Admin)", summary: "Indicadores, escritórios, planos e faturas.", area: "admin", version: TOUR_VERSION,
    steps: [
      { route: "/admin", target: "sa-indicadores", title: "Indicadores", body: "Receita, escritórios em teste e faturas em aberto, calculados a partir dos dados — honorários dos escritórios não entram." },
      { route: "/admin/organizacoes", target: "sa-novo", title: "Novo escritório", body: "Cadastre em 5 etapas. O endereço é validado e nomes reservados são recusados." },
      { route: "/admin/faturamento", target: "sa-faturas", title: "Faturas da assinatura", body: "Simule eventos do provedor; repetir o mesmo evento não altera a fatura duas vezes." },
    ],
  },
];
