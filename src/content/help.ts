// Central de ajuda (M23). Linguagem para leigos. Nomes de botões iguais aos da tela (verificados em teste).
// Prints: gerados por `pnpm capture:help` a partir de `shots` (manifesto em scripts/help-manifest.json).
export interface HelpShot {
  step: number; // passo ao qual a imagem se refere (1-based)
  caption: string;
  mobile?: boolean;
}
export interface HelpArticle {
  slug: string;
  title: string;
  category: string;
  goal: string;
  prerequisites: string;
  who: string;
  steps: string[];
  buttons: string[]; // rótulos exatos citados nos passos
  expected: string;
  errors: { problem: string; fix: string }[];
  related: string[];
  keywords?: string[]; // sinônimos usados pela busca (ex.: "boleto", "comprovante")
  shots: HelpShot[];
  version: string;
  reviewedOn: string;
}

export const HELP_VERSION = "0.1.0";
const R = { version: HELP_VERSION, reviewedOn: "26/10/2026" };

export const HELP_ARTICLES: HelpArticle[] = [
  // Primeiros passos
  {
    slug: "entender-modo-demo", title: "Entender o ambiente demonstrativo", category: "Primeiros passos",
    goal: "Saber o que é real e o que é simulado nesta versão.", prerequisites: "Nenhum.", who: "Todos os perfis.",
    steps: [
      "Observe a faixa “Ambiente demonstrativo — dados fictícios” no topo de todas as telas.",
      "Resultados com o selo “Simulação” não foram enviados a nenhum serviço externo.",
      "Cadastros e alterações ficam guardados apenas neste navegador.",
      "Para voltar ao estado inicial, abra Configurações → Dados e LGPD e toque em “Restaurar demonstração”.",
    ],
    buttons: ["Restaurar demonstração"],
    expected: "Você distingue com segurança o que é demonstração do que seria uma operação real.",
    errors: [{ problem: "Os dados sumiram depois de limpar o navegador.", fix: "É esperado: a demo guarda dados só neste dispositivo. Entre novamente para recarregar os dados fictícios." }],
    related: ["primeiro-acesso", "recuperar-erros"], shots: [{ step: 1, caption: "Faixa de ambiente demonstrativo no Meu dia" }], ...R,
  },
  {
    slug: "primeiro-acesso", title: "Primeiro acesso", category: "Primeiros passos",
    goal: "Entrar na demonstração com o perfil adequado.", prerequisites: "Navegador atualizado.", who: "Todos os perfis.",
    steps: [
      "Abra a tela Entrar.",
      "Escolha um perfil de demonstração, por exemplo “Advogado(a)”.",
      "Toque em “Entrar como …”.",
      "Você chega ao Meu dia do escritório. Use a busca no topo para achar qualquer cliente ou artigo.",
    ],
    buttons: ["Entrar como"],
    expected: "O Meu dia mostra prazos, tarefas, conversas e parcelas do escritório escolhido.",
    errors: [{ problem: "Não vejo o menu Financeiro.", fix: "Seu perfil não tem acesso. Entre como Administrador ou Financeiro." }],
    related: ["entender-modo-demo", "operar-no-celular"], shots: [{ step: 2, caption: "Escolha do perfil de demonstração" }, { step: 4, caption: "Meu dia após entrar" }, { step: 4, caption: "Meu dia no celular", mobile: true }], ...R,
  },
  {
    slug: "operar-no-celular", title: "Operar no celular e instalar o aplicativo", category: "Primeiros passos",
    goal: "Usar a SIWILTEC pelo celular, como um aplicativo.", prerequisites: "Chrome, Edge ou Safari atualizados.", who: "Todos os perfis.",
    steps: [
      "No celular, a barra inferior leva a Meu dia, Conversas, Agenda e “Mais”. O botão central “+” abre busca e atalhos.",
      "Android ou computador (Chrome/Edge): toque em “Instalar aplicativo” no Meu dia ou em Configurações → Dispositivo.",
      "iPhone/iPad (Safari): toque em Compartilhar e depois em “Adicionar à Tela de Início”.",
      "Abra o aplicativo pelo novo ícone. Sem internet, telas já abertas continuam disponíveis e uma faixa avisa “Sem conexão”.",
    ],
    buttons: ["Mais", "Instalar aplicativo"],
    expected: "A SIWILTEC abre em tela cheia, sem a barra do navegador.",
    errors: [
      { problem: "Não aparece a opção de instalar.", fix: "Alguns navegadores não oferecem instalação. A plataforma continua funcionando no navegador." },
      { problem: "Apareceu “Nova versão disponível”.", fix: "Termine o que está digitando e toque em “Atualizar agora”. Nada é atualizado sozinho no meio de um formulário." },
    ],
    related: ["primeiro-acesso"], shots: [{ step: 1, caption: "Navegação inferior no celular", mobile: true }, { step: 2, caption: "Configurações → Dispositivo" }], ...R,
  },
  {
    slug: "recuperar-erros", title: "Recuperar erros e pedir ajuda", category: "Primeiros passos",
    goal: "Saber o que fazer quando algo não sai como esperado.", prerequisites: "Nenhum.", who: "Todos os perfis.",
    steps: [
      "Leia a mensagem em vermelho: ela diz o que corrigir (por exemplo, um campo obrigatório).",
      "Se aparecer “Tentar novamente”, toque nele: seus dados continuam neste dispositivo.",
      "Para lançamentos financeiros errados use “Estornar”; nada é apagado.",
      "Busque o assunto na Central de ajuda ou faça o tour correspondente na Academia.",
    ],
    buttons: ["Tentar novamente", "Estornar"],
    expected: "Você corrige o problema sem perder informação.",
    errors: [{ problem: "A tela ficou em branco.", fix: "Recarregue a página. Se persistir, em Configurações → Dados e LGPD use “Restaurar demonstração”." }],
    related: ["entender-modo-demo", "baixa-parcial"], shots: [{ step: 4, caption: "Central de ajuda com busca" }], ...R,
  },

  // Atendimento e comercial
  {
    slug: "assumir-conversa", title: "Assumir uma conversa e pausar a assistente virtual", category: "Atendimento e comercial",
    goal: "Responder pessoalmente sem que a assistente virtual responda ao mesmo tempo.", prerequisites: "Uma conversa com a assistente ativa.", who: "Administrador, Advogado(a) e Atendimento.",
    steps: [
      "Abra Conversas e escolha a conversa.",
      "Na faixa do topo, toque em “Assumir atendimento”. O estado muda para “Humano no atendimento — assistente pausada”.",
      "Escreva sua resposta e toque em “Enviar”.",
      "Para devolver à assistente, toque em “Retomar assistente virtual”.",
    ],
    buttons: ["Assumir atendimento", "Enviar", "Retomar assistente virtual"],
    expected: "Somente você responde enquanto a conversa estiver assumida.",
    errors: [{ problem: "O botão Enviar está desativado.", fix: "Toque primeiro em “Assumir atendimento”: a assistente virtual está ativa." }],
    related: ["organizar-lead", "conectar-whatsapp"], keywords: ["whatsapp", "mensagem", "robô", "atendimento"], shots: [{ step: 2, caption: "Faixa com a assistente ativa e o botão Assumir atendimento" }, { step: 2, caption: "Conversa no celular", mobile: true }], ...R,
  },
  {
    slug: "organizar-lead", title: "Organizar um lead no funil", category: "Atendimento e comercial",
    goal: "Mover interessados entre etapas e registrar perdas com motivo.", prerequisites: "Um lead cadastrado.", who: "Administrador, Advogado(a) e Atendimento.",
    steps: [
      "Abra Funil (CRM). Use “Quadro” para ver colunas ou “Lista” para uma tabela.",
      "No cartão do lead, toque em “Mover” e escolha a nova etapa. No computador também é possível arrastar o cartão.",
      "Para “Perdido/Arquivado”, escolha o motivo antes de confirmar.",
      "Para reabrir um lead perdido, marque “Mostrar perdidos” e mova-o para outra etapa.",
    ],
    buttons: ["Quadro", "Lista", "Mover", "Mostrar perdidos", "Novo lead"],
    expected: "O lead aparece na nova coluna e a mudança fica registrada no histórico.",
    errors: [{ problem: "Não consigo mover para “Contratado”.", fix: "Converta o lead em cliente primeiro, na ficha do lead." }],
    related: ["converter-lead", "assumir-conversa"], shots: [{ step: 1, caption: "Funil em quadro" }, { step: 1, caption: "Funil no celular", mobile: true }], ...R,
  },
  {
    slug: "converter-lead", title: "Converter lead em cliente sem duplicar cadastro", category: "Atendimento e comercial",
    goal: "Transformar um interessado em cliente mantendo a origem da campanha.", prerequisites: "Lead ainda não convertido.", who: "Administrador, Advogado(a) e Atendimento.",
    steps: [
      "Abra a ficha do lead e toque em “Converter em cliente”.",
      "Preencha CPF ou CNPJ, cidade e responsável.",
      "Se aparecer “Possível cadastro existente”, confira e toque em “Usar este cadastro” quando for a mesma pessoa.",
      "Caso contrário, toque em “Criar cliente e vincular”.",
    ],
    buttons: ["Converter em cliente", "Usar este cadastro", "Criar cliente e vincular"],
    expected: "O lead mostra “Convertido em cliente” e o cliente traz a origem do primeiro contato.",
    errors: [{ problem: "Mensagem “Já existe cliente com este documento”.", fix: "Use o cadastro existente: a pessoa já é cliente." }],
    related: ["cadastrar-cliente", "abrir-caso"], shots: [{ step: 1, caption: "Ficha do lead com o botão Converter em cliente" }], ...R,
  },
  {
    slug: "enviar-proposta", title: "Enviar proposta (simulação)", category: "Atendimento e comercial",
    goal: "Montar honorários, aprovar e registrar o envio sem mandar nada de verdade.", prerequisites: "Lead ou cliente cadastrado.", who: "Administrador e Advogado(a); aprovação por Administrador.",
    steps: [
      "Abra Propostas e toque em “Nova proposta”.",
      "Preencha título, serviço, escopo, tipo de honorários e validade. No cronograma, informe entrada e parcelas e toque em “Gerar”.",
      "Confira se a soma bate com o total e toque em “Criar proposta”.",
      "Na proposta, use “Enviar para revisão”, depois “Aprovar” e “Enviar ao cliente (simulação)”.",
    ],
    buttons: ["Nova proposta", "Gerar", "Criar proposta", "Enviar para revisão", "Aprovar", "Enviar ao cliente (simulação)"],
    expected: "A proposta fica “Enviada” e aparece no Meu dia como aguardando retorno.",
    errors: [{ problem: "A soma aparece em vermelho.", fix: "Ajuste o valor de alguma parcela até a soma ser igual ao total." }],
    related: ["assinatura", "entrada-e-parcelas"], keywords: ["honorários", "orçamento", "proposta"], shots: [{ step: 2, caption: "Formulário de nova proposta" }, { step: 4, caption: "Fluxo da proposta" }], ...R,
  },
  {
    slug: "assinatura", title: "Contrato e assinatura (simulação)", category: "Atendimento e comercial",
    goal: "Gerar o contrato da proposta aceita e registrar as assinaturas.", prerequisites: "Proposta aceita e lead convertido em cliente.", who: "Administrador e Advogado(a).",
    steps: [
      "Na proposta aceita, toque em “Gerar contrato”.",
      "No contrato, confira os dados congelados e os signatários.",
      "Toque em “Enviar para assinatura (simulação)”.",
      "Use “Simular assinatura” para cada signatário. O contrato só conclui com todos os obrigatórios.",
    ],
    buttons: ["Gerar contrato", "Enviar para assinatura (simulação)", "Simular assinatura", "Corrigir e gerar nova versão"],
    expected: "Contrato assinado gera as parcelas no financeiro uma única vez.",
    errors: [{ problem: "Dado errado no contrato.", fix: "Use “Corrigir e gerar nova versão”: a versão anterior fica no histórico." }],
    related: ["enviar-proposta", "entrada-e-parcelas"], keywords: ["contrato", "assinar", "zapsign"], shots: [{ step: 2, caption: "Contrato com signatários" }], ...R,
  },

  // Clientes e jurídico
  {
    slug: "cadastrar-cliente", title: "Cadastrar cliente", category: "Clientes e jurídico",
    goal: "Registrar uma pessoa ou empresa atendida pelo escritório.", prerequisites: "Nenhum.", who: "Administrador, Advogado(a) e Atendimento.",
    steps: [
      "Abra Clientes e toque em “Novo cliente”.",
      "Escolha Pessoa física ou Pessoa jurídica.",
      "Preencha nome, CPF/CNPJ, telefone, cidade e responsável. Campos com “(opcional)” podem ficar em branco.",
      "Toque em “Salvar cliente”.",
    ],
    buttons: ["Novo cliente", "Salvar cliente"],
    expected: "A ficha do cliente abre com a sugestão de abrir o primeiro caso.",
    errors: [{ problem: "“CPF inválido (confira os dígitos)”.", fix: "Revise o número; o sistema confere os dígitos verificadores." }],
    related: ["abrir-caso", "converter-lead"], shots: [{ step: 3, caption: "Formulário de novo cliente" }, { step: 3, caption: "Novo cliente no celular", mobile: true }], ...R,
  },
  {
    slug: "abrir-caso", title: "Abrir caso", category: "Clientes e jurídico",
    goal: "Criar o caso jurídico de um cliente.", prerequisites: "Cliente cadastrado.", who: "Administrador, Advogado(a) e Estagiário(a).",
    steps: [
      "Abra a ficha do cliente (ou do lead já convertido).",
      "Toque em “Abrir caso”.",
      "Informe título, área, serviço, tipo, prioridade e responsável.",
      "Toque em “Abrir caso” para confirmar.",
    ],
    buttons: ["Abrir caso"],
    expected: "O caso aparece na aba Casos do cliente, na fase Triagem.",
    errors: [{ problem: "Não vejo o botão “Abrir caso”.", fix: "Perfis Financeiro e Atendimento não abrem casos. Peça a um(a) advogado(a)." }],
    related: ["cadastrar-cliente", "registrar-prazo"], shots: [{ step: 2, caption: "Ficha do cliente com Abrir caso" }], ...R,
  },
  {
    slug: "solicitar-documento", title: "Solicitar documento ao cliente", category: "Clientes e jurídico",
    goal: "Pedir um documento que aparece no portal do cliente.", prerequisites: "Cliente cadastrado.", who: "Administrador, Advogado(a), Atendimento e Estagiário(a).",
    steps: [
      "Abra Documentos e toque em “Solicitações”.",
      "Em Nova solicitação, escolha cliente, caso (opcional), nome e tipo do documento. Use o checklist do serviço, se aparecer.",
      "Toque em “Solicitar documento”.",
      "Quando o cliente enviar, use “Registrar recebimento” na lista de pendentes.",
    ],
    buttons: ["Solicitações", "Solicitar documento", "Registrar recebimento"],
    expected: "O pedido aparece em Pendentes e no portal do cliente.",
    errors: [{ problem: "O botão “Solicitar documento” está desativado.", fix: "Escolha o cliente e escreva o nome do documento." }],
    related: ["revisar-extracao"], shots: [{ step: 2, caption: "Nova solicitação de documento" }], ...R,
  },
  {
    slug: "revisar-extracao", title: "Revisar dados extraídos de um documento", category: "Clientes e jurídico",
    goal: "Conferir a leitura automática e validar o documento.", prerequisites: "Documento recebido com extração (ex.: CNIS de teste).", who: "Administrador, Advogado(a) e Estagiário(a).",
    steps: [
      "Abra Documentos e o documento desejado.",
      "Em Dados extraídos, compare cada valor com o trecho citado.",
      "Se estiver certo, toque em “Confirmar valor”. Se não, digite a correção e toque em “Salvar correção”.",
      "Ao final, toque em “Validar” (ou “Rejeitar” informando o motivo).",
    ],
    buttons: ["Confirmar valor", "Salvar correção", "Validar", "Rejeitar"],
    expected: "O documento fica “Validado” e as correções ficam registradas sem apagar o valor original.",
    errors: [{ problem: "Não aparece nada em Dados extraídos.", fix: "Nesta fase só documentos de teste têm extração demonstrativa." }],
    related: ["solicitar-documento", "comparar-cenarios"], shots: [{ step: 2, caption: "Dados extraídos ao lado do documento" }], ...R,
  },
  {
    slug: "registrar-prazo", title: "Registrar e confirmar um prazo", category: "Clientes e jurídico",
    goal: "Calcular um prazo e confirmá-lo profissionalmente.", prerequisites: "Caso aberto.", who: "Registro: Advogado(a), Estagiário(a) e Administrador. Confirmação: Advogado(a) ou Administrador.",
    steps: [
      "Abra Prazos e publicações e toque em “Novo prazo”.",
      "Escolha o caso, o marco inicial, a quantidade de dias e se a contagem é em dias úteis ou corridos. Confira a memória de cálculo.",
      "Toque em “Registrar prazo proposto”.",
      "Um(a) advogado(a) toca em “Conferir e confirmar”, revisa a data e toca em “Confirmar prazo”.",
    ],
    buttons: ["Novo prazo", "Registrar prazo proposto", "Conferir e confirmar", "Confirmar prazo"],
    expected: "O prazo confirmado entra na agenda e no Meu dia.",
    errors: [{ problem: "Não aparece “Conferir e confirmar”.", fix: "Somente advogado(a) ou administrador confirma prazos." }],
    related: ["abrir-caso", "agendar-pericia"], keywords: ["prazo", "intimação", "vencimento", "controladoria"], shots: [{ step: 4, caption: "Prazo proposto aguardando confirmação" }], ...R,
  },
  {
    slug: "agendar-pericia", title: "Agendar perícia ou audiência", category: "Clientes e jurídico",
    goal: "Marcar o compromisso com documentos a levar.", prerequisites: "Caso aberto.", who: "Administrador, Advogado(a), Atendimento e Estagiário(a).",
    steps: [
      "Abra Agenda e toque em “Novo compromisso”.",
      "Em Tipo, escolha “Perícia” (ou “Audiência”). Preencha data, início, fim, local e caso.",
      "Em “Documentos necessários (um por linha)”, liste o que o cliente deve levar.",
      "Toque em “Salvar”. Se houver conflito de horário, o sistema avisa.",
    ],
    buttons: ["Novo compromisso", "Salvar"],
    expected: "A perícia aparece na Agenda, em Perícias e no portal do cliente.",
    errors: [{ problem: "Pede motivo ao alterar a data.", fix: "Reagendamento exige “Motivo do reagendamento”; ele fica no histórico." }],
    related: ["registrar-prazo"], keywords: ["audiência", "perícia", "compromisso", "agenda"], shots: [{ step: 1, caption: "Agenda com o botão Novo compromisso" }], ...R,
  },
  {
    slug: "comparar-cenarios", title: "Revisar vínculos e comparar cenários previdenciários", category: "Clientes e jurídico",
    goal: "Conferir pendências do CNIS e comparar cenários demonstrativos.", prerequisites: "Análise previdenciária criada.", who: "Administrador, Advogado(a) e Estagiário(a) (sem aprovar).",
    steps: [
      "Abra Previdenciário e a análise do cliente.",
      "Na linha do tempo, toque em um período para ver o trecho do documento que o sustenta.",
      "Em Pendências, marque o que foi resolvido. Isso invalida os resultados anteriores.",
      "Em Cenários comparados, compare datas, premissas e pendências. Use “Próxima etapa” até o relatório.",
    ],
    buttons: ["Próxima etapa", "Etapa anterior", "Marcar exemplo como revisado"],
    expected: "Você vê cada cenário com suas premissas. Os valores são exemplos, não cálculo jurídico validado.",
    errors: [{ problem: "Aparece “Resultado desatualizado”.", fix: "Uma entrada mudou. Revise e toque em “Marcar exemplo como revisado”." }],
    related: ["revisar-extracao"], keywords: ["cnis", "aposentadoria", "inss", "benefício", "tempo de contribuição"], shots: [{ step: 4, caption: "Cenários comparados" }], ...R,
  },
  {
    slug: "revisar-minuta", title: "Revisar e aprovar minuta", category: "Clientes e jurídico",
    goal: "Editar o texto, pedir ajustes ou aprovar.", prerequisites: "Minuta criada.", who: "Edição: Advogado(a) e Estagiário(a). Aprovação: Advogado(a) ou Administrador.",
    steps: [
      "Abra Minutas e modelos e a minuta desejada.",
      "Edite o texto e toque em “Salvar”.",
      "Toque em “Enviar para revisão”. O revisor usa “Pedir ajustes” ou “Aprovar”.",
      "Aprovada, exporte em “Texto (.txt)” ou “Imprimir / PDF”.",
    ],
    buttons: ["Salvar", "Enviar para revisão", "Pedir ajustes", "Aprovar", "Texto (.txt)", "Imprimir / PDF"],
    expected: "A minuta aprovada fica registrada com histórico; nada é protocolado.",
    errors: [{ problem: "A aprovação sumiu.", fix: "O texto mudou depois da aprovação. Revise e aprove novamente." }],
    related: [], keywords: ["petição", "peça", "word", "docx", "minuta"], shots: [{ step: 2, caption: "Editor de minuta" }], ...R,
  },

  // Financeiro
  {
    slug: "entrada-e-parcelas", title: "Entrada e parcelas com datas próprias", category: "Financeiro",
    goal: "Montar um parcelamento com vencimentos diferentes.", prerequisites: "Proposta em edição.", who: "Administrador, Advogado(a) e Financeiro.",
    steps: [
      "Na proposta, em Cronograma (entrada + parcelas), informe Entrada (R$), Parcelas e A cada (dias).",
      "Toque em “Gerar”.",
      "Ajuste a data ou o valor de qualquer parcela individualmente.",
      "Confira a linha “Soma” antes de salvar.",
    ],
    buttons: ["Gerar"],
    expected: "Após a assinatura, cada parcela vira um recebível com a data escolhida.",
    errors: [{ problem: "Centavos a mais ou a menos.", fix: "A última parcela absorve a diferença de arredondamento; confira a soma." }],
    related: ["enviar-proposta", "baixa-parcial"], shots: [{ step: 1, caption: "Cronograma de entrada e parcelas" }], ...R,
  },
  {
    slug: "baixa-parcial", title: "Registrar pagamento parcial de uma parcela", category: "Financeiro",
    goal: "Dar baixa em parte do valor e manter o saldo correto.", prerequisites: "Parcela em aberto.", who: "Administrador e Financeiro.",
    steps: [
      "Abra Financeiro → A receber.",
      "Na parcela desejada, toque em “Registrar pagamento”.",
      "Informe valor, data, forma e a origem/justificativa.",
      "Confira a prévia do novo saldo e toque em “Confirmar baixa”.",
    ],
    buttons: ["Registrar pagamento", "Confirmar baixa", "Estornar", "Renegociar saldo"],
    expected: "A parcela passa a “Parcial” e o saldo restante aparece na lista.",
    errors: [
      { problem: "Mensagem dizendo que o valor é maior que o saldo.", fix: "Informe no máximo o saldo exibido." },
      { problem: "Lancei errado.", fix: "Use “Estornar” no pagamento. O estorno fica registrado; nada é apagado." },
    ],
    related: ["emitir-recibo", "conciliacao"], keywords: ["boleto", "pix", "receber", "pagamento", "quitar", "parcela"], shots: [{ step: 2, caption: "Parcelas a receber" }, { step: 2, caption: "A receber no celular", mobile: true }], ...R,
  },
  {
    slug: "emitir-recibo", title: "Emitir recibo", category: "Financeiro",
    goal: "Gerar recibo de um pagamento registrado.", prerequisites: "Pagamento registrado.", who: "Administrador e Financeiro.",
    steps: [
      "Abra a parcela paga em Financeiro → A receber.",
      "Em Pagamentos e estornos, toque em “Recibo”.",
      "Abra Financeiro → Recibos para ver todos.",
      "Use “Imprimir / PDF”, “Baixar” ou “Compartilhar”.",
    ],
    buttons: ["Recibo", "Imprimir / PDF", "Baixar", "Compartilhar"],
    expected: "O recibo traz valor em reais e por extenso, com a marca de ambiente demonstrativo.",
    errors: [{ problem: "Não aparece “Recibo”.", fix: "O pagamento foi estornado ou ainda não foi registrado." }],
    related: ["baixa-parcial"], keywords: ["comprovante", "recibo", "quitação"], shots: [{ step: 3, caption: "Lista de recibos" }], ...R,
  },
  {
    slug: "conciliacao", title: "Conciliar extrato", category: "Financeiro",
    goal: "Conferir o extrato bancário com os pagamentos registrados.", prerequisites: "Extrato de exemplo carregado.", who: "Administrador e Financeiro.",
    steps: [
      "Abra Financeiro → Conciliação.",
      "Em cada linha pendente, leia os alertas (valor diferente, sem pagamento correspondente).",
      "Toque em “Decidir”, escolha a decisão, o pagamento/parcela e escreva a justificativa.",
      "Toque em “Concluir conciliação”.",
    ],
    buttons: ["Decidir", "Concluir conciliação"],
    expected: "A linha fica “Conciliado” ou “Ignorado”, com a decisão registrada.",
    errors: [{ problem: "Não consigo concluir.", fix: "Justificativa e decisão são obrigatórias." }],
    related: ["baixa-parcial"], keywords: ["extrato", "banco", "conferir"], shots: [{ step: 2, caption: "Extrato com linhas pendentes" }], ...R,
  },

  // Administração
  {
    slug: "importar-csv", title: "Importar planilha CSV", category: "Administração",
    goal: "Trazer clientes de uma planilha sem duplicar.", prerequisites: "Planilha salva como CSV.", who: "Administrador.",
    steps: [
      "Abra Importações. Para testar, toque em “Usar exemplo fictício” (ou “Escolher arquivo CSV”).",
      "Confira o mapeamento das colunas e toque em “Validar”.",
      "Na prévia, revise erros e conflitos por linha e toque em “Revisar conflitos e confirmar”.",
      "Toque em “Confirmar importação”. Se precisar desfazer, abra o lote e use “Reverter lote”.",
    ],
    buttons: ["Usar exemplo fictício", "Escolher arquivo CSV", "Validar", "Revisar conflitos e confirmar", "Confirmar importação", "Reverter lote"],
    expected: "Clientes novos entram; duplicados são apontados; nada vira fórmula ao exportar.",
    errors: [{ problem: "Linha com data estranha (ex.: 21916).", fix: "É data no formato do Excel; o sistema converte e mostra na prévia." }],
    related: [], keywords: ["planilha", "excel", "tícius", "migrar"], shots: [{ step: 3, caption: "Prévia da importação" }], ...R,
  },
  {
    slug: "configurar-notificacoes", title: "Configurar notificações", category: "Administração",
    goal: "Escolher quais avisos chegam e por qual canal.", prerequisites: "Nenhum.", who: "Administrador.",
    steps: [
      "Abra Configurações → Notificações.",
      "Marque, por evento, No app, E-mail (simulado) e WhatsApp (simulado).",
      "Toque em “Salvar preferências”.",
      "Se quiser aviso no aparelho, toque em “Permitir notificações neste aparelho”. Alertas de prazo não dependem disso.",
    ],
    buttons: ["Salvar preferências", "Permitir notificações neste aparelho"],
    expected: "As preferências ficam salvas para o escritório. Avisos no app aparecem no sino.",
    errors: [{ problem: "Permissão negada no navegador.", fix: "Reative nas configurações do navegador; o app funciona sem push." }],
    related: ["conectar-whatsapp"], shots: [{ step: 2, caption: "Preferências por evento e canal" }], ...R,
  },
  {
    slug: "conectar-whatsapp", title: "Conexão do WhatsApp (etapa futura)", category: "Administração",
    goal: "Entender a conexão e o que acontece se ela cair.", prerequisites: "Nenhum. A conexão real será feita na fase de backend.", who: "Administrador.",
    steps: [
      "Abra Integrações e escolha Evolution API (WhatsApp).",
      "Em Conexão WhatsApp (simulação), veja o estado atual e a fila de saída.",
      "Teste a falha com “Simular desconexão”: mensagens enviadas ficam pendentes.",
      "Use “Simular reconexão” e “Reprocessar fila”: cada mensagem sai uma única vez.",
    ],
    buttons: ["Simular desconexão", "Simular reconexão", "Reprocessar fila"],
    expected: "Você entende que nenhuma mensagem é perdida nem duplicada.",
    errors: [{ problem: "Mensagens “na fila” na conversa.", fix: "A conexão caiu. Reconecte e reprocesse a fila." }],
    related: ["assumir-conversa"], shots: [{ step: 2, caption: "Conexão e fila de saída" }], ...R,
  },

  // Novos (cobertura rota → artigo)
  {
    slug: "usar-calculos", title: "Fazer um cálculo demonstrativo", category: "Clientes e jurídico",
    goal: "Registrar entradas, ver a memória de cálculo e pedir revisão.", prerequisites: "Nenhum.", who: "Administrador, Advogado(a) e Estagiário(a).",
    steps: [
      "Abra Cálculos. No catálogo, toque no “+” do modelo desejado (“Novo cálculo”).",
      "Informe o título e toque em “Criar”.",
      "Em Entradas, preencha os campos e toque em “Calcular”. A memória mostra cada conta feita.",
      "Um(a) advogado(a) confere e toca em “Marcar como revisado”. Use “Exportar CSV” ou “Imprimir / PDF” se precisar.",
    ],
    buttons: ["Novo cálculo", "Criar", "Calcular", "Marcar como revisado", "Exportar CSV"],
    expected: "O resultado aparece com memória e o selo “Cálculo demonstrativo”. Mudar uma entrada invalida o resultado anterior.",
    errors: [{ problem: "“Modelo sem motor implementado nesta fase.”", fix: "Esse tipo ainda não calcula sozinho: registre as entradas e anexe a memória feita pelo profissional." }],
    related: ["comparar-cenarios"], keywords: ["cálculo", "conta", "atualização", "juros", "horas extras", "rescisão"], shots: [{ step: 1, caption: "Catálogo de cálculos por área" }, { step: 1, caption: "Cálculos no celular", mobile: true }], ...R,
  },
  {
    slug: "acompanhar-rpv", title: "Acompanhar RPV e precatórios", category: "Clientes e jurídico",
    goal: "Registrar a situação de um requisitório e manter a trilha.", prerequisites: "Requisitório cadastrado.", who: "Administrador, Advogado(a) e Financeiro.",
    steps: [
      "Abra RPV e precatórios e escolha o requisitório.",
      "Em “Atualizar situação”, escolha a nova situação.",
      "Escreva a observação e a fonte consultada.",
      "Toque em “Registrar”. A mudança entra na trilha com data e responsável.",
    ],
    buttons: ["Atualizar situação", "Registrar"],
    expected: "A situação muda e a trilha guarda o histórico. Nenhuma consulta automática a tribunal é feita nesta fase.",
    errors: [{ problem: "Não sei de onde veio a informação.", fix: "Sempre preencha a fonte (ex.: consulta pública do TRF1) na observação." }],
    related: ["abrir-caso"], keywords: ["precatório", "rpv", "requisição", "pagamento judicial"], shots: [{ step: 1, caption: "Lista de requisitórios" }], ...R,
  },
  {
    slug: "usar-jornal-pesquisa", title: "Pesquisa jurídica e Jornal do Advogado", category: "Clientes e jurídico",
    goal: "Encontrar referências, salvar notícias e criar tarefa de revisão no caso.", prerequisites: "Nenhum.", who: "Administrador, Advogado(a) e Estagiário(a).",
    steps: [
      "Em Pesquisa jurídica, use “Buscar nos exemplos” e os filtros. Itens marcados “Exemplos fictícios” não são fonte real; use “Fontes oficiais” para consultar.",
      "No Jornal do Advogado, filtre por Área e Tipo e abra a notícia.",
      "Toque em “Salvar” para guardar. Use “Fonte oficial” para ler o original.",
      "Em casos relacionados, toque em “Criar tarefa de revisão” para o responsável conferir o impacto.",
    ],
    buttons: ["Salvar", "Fonte oficial", "Criar tarefa de revisão"],
    expected: "A tarefa aparece em Tarefas e no caso. Uma notícia nunca altera um caso sozinha.",
    errors: [{ problem: "A notícia parece antiga.", fix: "Nesta fase são amostras com link para a fonte oficial; não há coleta automática." }],
    related: ["abrir-caso"], keywords: ["jurisprudência", "notícia", "lei", "legislação", "súmula", "novidade"], shots: [{ step: 2, caption: "Jornal do Advogado" }], ...R,
  },
  {
    slug: "ler-relatorios", title: "Ler os relatórios do escritório", category: "Administração",
    goal: "Entender funil, carga de trabalho, prazos e recebimentos.", prerequisites: "Nenhum.", who: "Administrador, Advogado(a) e Financeiro.",
    steps: [
      "Abra Relatórios e escolha o relatório no seletor.",
      "Cada gráfico mostra o número ao lado da barra. Toque em “Ver dados” para ver a tabela.",
      "Use “CSV” para baixar os dados do gráfico.",
      "Indicadores sem base suficiente aparecem como “não calculável” — não como zero.",
    ],
    buttons: ["Ver dados", "Ver gráfico", "CSV"],
    expected: "Os números batem com as listas das telas de origem.",
    errors: [{ problem: "O CSV abre com números estranhos no Excel.", fix: "Valores em centavos e datas no formato dd/mm/aaaa; textos iniciados por “=” são protegidos." }],
    related: ["baixa-parcial"], keywords: ["dashboard", "indicador", "gráfico", "kpi", "painel"], shots: [{ step: 2, caption: "Relatório com gráfico e dados" }], ...R,
  },
  {
    slug: "gerir-equipe", title: "Equipe, perfis e convites", category: "Administração",
    goal: "Ver quem faz o quê, a carga de cada pessoa e o que cada perfil acessa.", prerequisites: "Nenhum.", who: "Administrador.",
    steps: [
      "Abra Equipe: cada cartão mostra a pessoa, o perfil e as tarefas abertas.",
      "Na “Matriz de acesso por perfil”, confira quais módulos cada perfil vê.",
      "Para convidar, informe o e-mail e toque em “Enviar convite (simulado)”.",
      "Lembre: nesta demonstração os perfis só escondem telas; a proteção real virá com o servidor.",
    ],
    buttons: ["Enviar convite (simulado)"],
    expected: "O convite fica registrado na tela; nenhum e-mail é enviado.",
    errors: [{ problem: "O botão de convite está desativado.", fix: "Digite um e-mail válido (ex.: nome@exemplo.test)." }],
    related: ["primeiro-acesso"], keywords: ["usuário", "permissão", "acesso", "colaborador", "perfil"], shots: [{ step: 2, caption: "Matriz de acesso por perfil" }], ...R,
  },
];

export const GLOSSARY: [string, string][] = [
  ["Lead", "Pessoa interessada que ainda não é cliente."],
  ["Funil", "Etapas comerciais, do primeiro contato até contratar."],
  ["Caso", "Trabalho jurídico aberto para um cliente."],
  ["Prazo proposto", "Data calculada pelo sistema que ainda precisa ser conferida por advogado(a)."],
  ["CNIS", "Extrato de vínculos e contribuições do INSS."],
  ["Baixa", "Registro de que um valor foi recebido."],
  ["Estorno", "Lançamento que anula um pagamento sem apagar o original."],
  ["Conciliação", "Conferência do extrato bancário com os pagamentos registrados."],
  ["Simulação", "Ação demonstrativa: nada é enviado a serviço externo."],
  ["PWA", "Site que pode ser instalado e aberto como aplicativo."],
];

export const shotPath = (slug: string, s: HelpShot) => `/help/screenshots/${HELP_VERSION}/${slug}-${s.step}${s.mobile ? "-mobile" : ""}.png`;
