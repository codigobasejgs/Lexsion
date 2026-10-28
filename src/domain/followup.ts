// Follow-up comercial ético (paridade CRM; E2E-23): decide se um lembrete SIMULADO pode sair.
// Nada é enviado: o resultado só registra a decisão. Regras: consentimento, opt-out, horário do escritório,
// limite de tentativas e parada quando o lead respondeu ou já é cliente.
export interface FollowUpInput {
  consentContact: boolean;
  optOutAt?: string;
  attempts: number;
  maxAttempts: number;
  hour: number; // 0–23, horário local
  window: [number, number]; // ex.: [9, 18)
  replied: boolean;
  isClient: boolean;
}

export type FollowUpDecision = { allowed: true } | { allowed: false; reason: string };

export function canFollowUp(i: FollowUpInput): FollowUpDecision {
  if (i.optOutAt) return { allowed: false, reason: "Pediu para não receber mensagens (opt-out): nenhum envio." };
  if (!i.consentContact) return { allowed: false, reason: "Sem autorização de contato: nenhum envio automático." };
  if (i.isClient) return { allowed: false, reason: "Já é cliente: follow-up comercial encerrado." };
  if (i.replied) return { allowed: false, reason: "Lead respondeu: segue atendimento humano." };
  if (i.attempts >= i.maxAttempts) return { allowed: false, reason: `Limite de ${i.maxAttempts} tentativas atingido.` };
  if (i.hour < i.window[0] || i.hour >= i.window[1]) return { allowed: false, reason: `Fora do horário do escritório (${i.window[0]}h–${i.window[1]}h): fica para o próximo horário.` };
  return { allowed: true };
}
