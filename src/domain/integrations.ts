// Integrações que o PRÓPRIO escritório ativa com a sua chave. Passo a passo verificado nos painéis oficiais
// (nov/2026). "uso" diz o que a LexSion faz com a chave HOJE: guardar e testar não é o mesmo que usar.
export type ProviderId = "gemini" | "asaas" | "mercadopago" | "zapsign" | "infinitepay";
export interface ProviderSpec {
  id: ProviderId;
  name: string;
  field: string; // rótulo do campo da chave
  placeholder: string;
  environments: boolean; // tem produção × teste (sandbox)
  link: string;
  steps: string[];
  uso: string;
  usoAtivo: boolean; // a LexSion já usa a chave em alguma função real
}

export const PROVIDERS: ProviderSpec[] = [
  {
    id: "gemini", name: "Google Gemini (IA)", field: "Chave de API", placeholder: "AIza…", environments: false, link: "https://aistudio.google.com/apikey",
    steps: ["Entre em aistudio.google.com com a conta Google do escritório.", "Menu “Get API key” → “Create API key” e escolha (ou crie) um projeto.", "Para não esbarrar no limite gratuito, ative o faturamento do projeto em “Billing” (o plano pago também impede o uso do conteúdo para treinar modelos).", "Copie a chave (começa com AIza) e cole aqui."],
    uso: "Usada nas respostas da assistente no WhatsApp, no simulador e no Assistente de IA deste escritório, no lugar da chave da LexSion. O custo fica na conta Google do escritório.", usoAtivo: true,
  },
  {
    id: "asaas", name: "Asaas (cobranças)", field: "Chave de API", placeholder: "$aact_…", environments: true, link: "https://www.asaas.com/customerApiKeys/index",
    steps: ["Entre na conta Asaas do escritório (ou no sandbox, para testar).", "Menu do usuário → Integrações → “Chaves de API” → “Gerar chave de API”.", "Copie a chave na hora (o Asaas mostra uma vez só); começa com $aact_prod_ ou $aact_hmlg_ (sandbox).", "Cole aqui e escolha o ambiente correspondente."],
    uso: "Chave guardada e testada. A emissão de cobranças pelo Asaas a partir do Financeiro ainda não está implementada nesta versão.", usoAtivo: false,
  },
  {
    id: "mercadopago", name: "Mercado Pago (cobranças)", field: "Access Token de produção", placeholder: "APP_USR-…", environments: false, link: "https://www.mercadopago.com.br/developers/pt",
    steps: ["Entre em mercadopago.com.br/developers com a conta do escritório.", "“Suas integrações” → “Criar aplicação” (pagamentos on-line, Checkout Pro).", "Na aplicação: “Credenciais de produção” → copie o Access Token (começa com APP_USR-).", "Cole aqui."],
    uso: "Token guardado e testado. A emissão de cobranças pelo Mercado Pago ainda não está implementada nesta versão.", usoAtivo: false,
  },
  {
    id: "zapsign", name: "ZapSign (assinatura eletrônica)", field: "Token de API", placeholder: "token da conta", environments: true, link: "https://app.zapsign.com.br/conta/configuracoes/api",
    steps: ["Entre em app.zapsign.com.br com a conta do escritório (a API exige plano com acesso à API).", "Configurações → “Integração” → “API” → copie o token.", "Para testar sem custo, use o token do sandbox (sandbox.app.zapsign.com.br) e escolha o ambiente “Teste”.", "Cole aqui."],
    uso: "Token guardado e testado. O envio de contratos para assinatura pela ZapSign ainda não está implementado nesta versão.", usoAtivo: false,
  },
  {
    id: "infinitepay", name: "InfinitePay (link de pagamento)", field: "Handle (InfiniteTag)", placeholder: "$nomedoescritorio", environments: false, link: "https://app.infinitepay.io",
    steps: ["Abra o app InfinitePay do escritório.", "No perfil, copie a sua InfiniteTag (ex.: $escritorio-silva), que é a “handle”.", "Cole aqui. Não é uma senha: identifica a conta que recebe."],
    uso: "Handle guardada. A geração de links de pagamento para os clientes do escritório ainda não está implementada nesta versão.", usoAtivo: false,
  },
];
export const providerSpec = (id: string) => PROVIDERS.find((p) => p.id === id);
