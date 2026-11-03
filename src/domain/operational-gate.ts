// Operação REAL: telas cujo funcionamento depende de provedor ainda não contratado/credenciado ficam BLOQUEADAS,
// com o motivo objetivo. Proibido simular na operação (a simulação continua só em /demonstracao).
// Liberar uma tela = integração comprovada em produção + remover a entrada daqui.
export interface Blocked { title: string; reason: string; needs: string }

const AI_RUNS: Blocked = { title: "Execuções da assistente", reason: "Na operação real, o histórico detalhado de execuções ainda não é registrado nesta tela.", needs: "Acompanhe as respostas em Conversas (cada mensagem da assistente fica na conversa) e os encaminhamentos no sino de notificações." };
const PAY: Blocked = { title: "Cobranças online", reason: "Nenhum provedor de pagamento (Asaas, InfinitePay ou Mercado Pago) está credenciado. Nenhuma cobrança é emitida.", needs: "Conta do escritório no provedor, chaves de API e segredo de webhook." };
const SIGN: Blocked = { title: "Assinatura eletrônica", reason: "A assinatura eletrônica (ZapSign) não está credenciada; registrar assinatura sem provedor não tem validade.", needs: "Token da conta ZapSign e webhook de conclusão." };
const ADS: Blocked = { title: "Marketing e anúncios", reason: "As contas de anúncios (Meta/Google) e a publicação de páginas não estão conectadas.", needs: "OAuth das contas do escritório e aprovação do app." };
const RESEARCH: Blocked = { title: "Pesquisa de jurisprudência", reason: "Nenhuma base de jurisprudência licenciada está conectada.", needs: "Licença de base (ex.: Jusbrasil) ou parecer sobre uso do DataJud." };
const AUTOMATION: Blocked = { title: "Automações", reason: "As automações disparam mensagens por WhatsApp/e-mail, que ainda não estão configurados para clientes.", needs: "WhatsApp e e-mail transacional a clientes habilitados." };

export const BLOCKED_ROUTES: [prefix: string, b: Blocked][] = [
  // Atendimento, agentes e simulador: telas liberadas; o uso real depende do gate do servidor (AI_ENABLED /
  // WHATSAPP_ENABLED, avisado na tela) e do consentimento do titular do escritório (organizations.ai_enabled_at).
  ["/app/ia/execucoes", AI_RUNS],
  ["/app/automacoes", AUTOMATION],
  ["/app/pagamentos", PAY],
  ["/app/assinaturas", SIGN],
  ["/app/marketing", ADS],
  ["/app/crm/captura", ADS],
  ["/app/pesquisa", RESEARCH],
];

export function blockedFor(path: string): Blocked | null {
  return BLOCKED_ROUTES.find(([p]) => path === p || path.startsWith(`${p}/`))?.[1] ?? null;
}
