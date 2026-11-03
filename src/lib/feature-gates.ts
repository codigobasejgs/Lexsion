import "server-only";

// Integrações que enviam dados de clientes a terceiros: DESLIGADAS em produção até a auditoria do operador e dos
// termos (decisão do proprietário, 03/11/2026; Anexo III 2026.11-1). Ligar exige AI_ENABLED=1 / WHATSAPP_ENABLED=1 no
// servidor E nova versão do contrato. O código, as chaves e os testes ficam preservados.
export const aiEnabled = () => process.env.AI_ENABLED === "1";
export const whatsappEnabled = () => process.env.WHATSAPP_ENABLED === "1";
export const GATE_MESSAGE = {
  ai: "Assistente de IA indisponível para dados de clientes: a integração está em auditoria (termos e tratamento de dados) antes da liberação.",
  whatsapp: "WhatsApp indisponível para dados de clientes: a infraestrutura do provedor está em auditoria antes da liberação.",
};
