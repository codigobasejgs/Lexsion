// Textos comerciais da LexSion. Regra: nada de números, depoimentos, clientes, preços ou certificações inventados.
// Recurso que depende do backend aparece como "em preparação".
export const MODULES = [
  { id: "atendimento", title: "Atendimento e CRM", text: "Funil de leads por etapa, triagem por área do Direito com perguntas próprias, propostas de honorários e conversão em cliente e caso sem retrabalho.", examples: ["Lead de campanha com origem registrada", "Triagem previdenciária com checklist de documentos", "Motivo de perda para revisar a captação"], shot: "crm" },
  { id: "processos", title: "Casos e processos", text: "Ficha completa do caso: partes, número CNJ, fase, responsável, documentos, prazos, custos e linha do tempo. Atualização ao cliente só depois de revisada por advogado(a).", examples: ["Linha do tempo do processo", "Publicação no portal com aprovação", "Casos sigilosos com acesso restrito"], shot: "caso" },
  { id: "prazos", title: "Agenda, audiências e prazos", text: "Compromissos, audiências, perícias e tarefas por responsável. Prazo proposto pela equipe e confirmado por advogado(a), com feriados do escritório.", examples: ["Calendário por pessoa", "Exportação .ics para o celular", "Contagem com memória de cálculo para revisão"], shot: "agenda" },
  { id: "documentos", title: "Documentos e minutas", text: "Solicitação de documentos ao cliente, revisão, modelos de peça com campos obrigatórios e exportação em Word com a marca do escritório.", examples: ["Minuta só aprova com campos preenchidos", "Download .docx com cabeçalho do escritório", "Histórico de versões"], shot: "minuta" },
  { id: "previdenciario", title: "Previdenciário em profundidade", text: "Análises por etapas com vínculos, pendências e comparação de cenários, RPV e precatórios — sem deixar de atender as demais áreas do Direito.", examples: ["CNIS e vínculos com pendências", "Comparação de cenários para revisão", "Acompanhamento de RPV"], shot: "previdenciario" },
  { id: "financeiro", title: "Honorários e financeiro", text: "Contratos de honorários, entrada e parcelas, baixas parciais com estorno, contas a pagar, caixa por mês, conciliação e recibos.", examples: ["Baixa parcial sem perder histórico", "Caixa com saldo inicial do mês", "Recibo do pagamento"], shot: "financeiro" },
  { id: "portal", title: "Portal do cliente", text: "O cliente acompanha o caso em linguagem simples, envia documentos pedidos e vê pagamentos — apenas o que o escritório publicou.", examples: ["Andamento traduzido para leigos", "Envio de documento pelo celular", "Nenhum rascunho interno aparece"], shot: "portal" },
  { id: "marca", title: "Sua marca e seu aplicativo", text: "Cada escritório com logotipo, cores e nome próprios no sistema, no portal, nos documentos e no aplicativo instalado.", examples: ["Cores com contraste verificado", "Ícone do aplicativo do escritório", "QR Code para instalar"], shot: "identidade" },
] as const;

export const AREAS = [
  "Previdenciário", "Trabalhista", "Família e Sucessões", "Civil", "Consumidor", "Bancário", "Empresarial", "Tributário",
  "Imobiliário", "Penal", "Administrativo", "Saúde", "Digital e Proteção de Dados", "Pessoa com Deficiência",
];

export const FLOW = [
  ["Contato", "O lead chega pelo atendimento ou campanha, com a origem registrada."],
  ["Qualificação", "Triagem por área com perguntas e checklist de documentos."],
  ["Proposta e contrato", "Proposta de honorários, aprovação e contrato para assinatura (assinatura eletrônica em preparação)."],
  ["Cliente e caso", "Conversão sem redigitar: cliente, caso e responsável definidos."],
  ["Documentos e prazos", "Pedidos de documentos, minutas e prazos confirmados por advogado(a)."],
  ["Acompanhamento", "Atualizações revisadas publicadas no portal do cliente."],
  ["Honorários", "Parcelas, baixas, recibos e caixa do escritório."],
  ["Encerramento", "Histórico preservado e relatórios do período."],
] as const;

export const FAQ = [
  ["O que é a LexSion?", "Um sistema de gestão (ERP) para escritórios de advocacia: atendimento, casos, prazos, documentos, honorários e portal do cliente em um só lugar. A LexSion é software — não presta serviços jurídicos."],
  ["Para quem serve?", "Advocacia individual, escritórios pequenos e médios e equipes com várias funções (advogados, atendimento, controladoria, financeiro, estagiários)."],
  ["Funciona no celular?", "Sim. As telas se adaptam a celular, tablet e computador, e o sistema pode ser instalado como aplicativo (PWA) nos navegadores compatíveis."],
  ["Posso usar a marca do meu escritório?", "Sim. Logotipo, cores e nome do escritório aparecem no sistema, no portal do cliente, nos documentos e no aplicativo instalado."],
  ["Consigo trazer minhas planilhas?", "Há importação de CSV com prévia antes de gravar. A migração assistida de planilhas maiores é combinada na implantação."],
  ["Como fica a segurança dos dados?", "A versão em produção terá autenticação, separação de dados por escritório no servidor e controle de acesso por função. A demonstração pública usa somente dados fictícios guardados no seu navegador."],
  ["Há integração com WhatsApp, e-mail, pagamentos e tribunais?", "As telas e conexões estão preparadas; as integrações reais são ativadas na implantação, conforme os provedores escolhidos. Nada é enviado ou cobrado na demonstração."],
  ["Posso testar antes?", "Sim: a demonstração interativa mostra o sistema com perfis fictícios. Para conhecer condições de contratação, solicite uma apresentação."],
  ["Existe período de teste?", "As condições de teste e contratação são apresentadas no contato comercial."],
  ["Como é o suporte?", "Atendimento à equipe do escritório e central de ajuda dentro do sistema, com artigos, tours guiados e prints reais de cada tela."],
] as const;
