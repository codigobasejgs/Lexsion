// Operação REAL: telas cujo funcionamento depende de provedor ainda não contratado/credenciado ficam BLOQUEADAS,
// com o motivo objetivo. Proibido simular na operação (a simulação continua só em /demonstracao).
// Liberar uma tela = integração comprovada em produção + remover a entrada daqui.
export interface Blocked { title: string; reason: string; needs: string }

const AI: Blocked = { title: "Agentes autônomos de IA", reason: "Agentes que respondem sozinhos ao cliente não estão liberados: toda resposta de IA passa por revisão humana.", needs: "Use o Assistente de IA (sugestões com revisão). Agentes autônomos exigem política de uso aprovada pelo escritório." };
const PAY: Blocked = { title: "Cobranças online", reason: "Nenhum provedor de pagamento (Asaas, InfinitePay ou Mercado Pago) está credenciado. Nenhuma cobrança é emitida.", needs: "Conta do escritório no provedor, chaves de API e segredo de webhook." };
const SIGN: Blocked = { title: "Assinatura eletrônica", reason: "A assinatura eletrônica (ZapSign) não está credenciada; registrar assinatura sem provedor não tem validade.", needs: "Token da conta ZapSign e webhook de conclusão." };
const ADS: Blocked = { title: "Marketing e anúncios", reason: "As contas de anúncios (Meta/Google) e a publicação de páginas não estão conectadas.", needs: "OAuth das contas do escritório e aprovação do app." };
const NEWS: Blocked = { title: "Jornal do Advogado", reason: "A coleta de notícias e normas de fontes oficiais ainda não está ativa.", needs: "Rotina de coleta das fontes oficiais com verificação de licença." };
const RESEARCH: Blocked = { title: "Pesquisa de jurisprudência", reason: "Nenhuma base de jurisprudência licenciada está conectada.", needs: "Licença de base (ex.: Jusbrasil) ou parecer sobre uso do DataJud." };
const AUTOMATION: Blocked = { title: "Automações", reason: "As automações disparam mensagens por WhatsApp/e-mail, que ainda não estão configurados para clientes.", needs: "WhatsApp e e-mail transacional a clientes habilitados." };

export const BLOCKED_ROUTES: [prefix: string, b: Blocked][] = [
  // Atendimento (WhatsApp/Evolution) e Assistente de IA (Gemini) estão LIBERADOS: integrações reais no servidor.
  ["/app/ia/agentes", AI],
  ["/app/ia/simulador", AI],
  ["/app/ia/execucoes", AI],
  ["/app/automacoes", AUTOMATION],
  ["/app/pagamentos", PAY],
  ["/app/assinaturas", SIGN],
  ["/app/marketing", ADS],
  ["/app/crm/captura", ADS],
  ["/app/jornal", NEWS],
  ["/app/pesquisa", RESEARCH],
];

export function blockedFor(path: string): Blocked | null {
  return BLOCKED_ROUTES.find(([p]) => path === p || path.startsWith(`${p}/`))?.[1] ?? null;
}
