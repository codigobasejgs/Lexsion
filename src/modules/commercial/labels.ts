export const PROPOSAL_STATUS = {
  rascunho: { label: "Rascunho", tone: "neutral" },
  em_revisao: { label: "Em revisão", tone: "warning" },
  aprovada: { label: "Aprovada", tone: "info" },
  enviada: { label: "Enviada (simulação)", tone: "info" },
  aceita: { label: "Aceita", tone: "success" },
  recusada: { label: "Recusada", tone: "danger" },
  expirada: { label: "Expirada", tone: "neutral" },
} as const;

export const CONTRACT_STATUS = {
  rascunho: { label: "Rascunho", tone: "neutral" },
  enviado: { label: "Enviado para assinatura", tone: "info" },
  parcial: { label: "Parcialmente assinado", tone: "warning" },
  concluido: { label: "Concluído", tone: "success" },
  recusado: { label: "Recusado", tone: "danger" },
  expirado: { label: "Expirado", tone: "neutral" },
  cancelado: { label: "Cancelado", tone: "neutral" },
} as const;

export const FEE_KIND = { fixo: "Fixo", parcelado: "Parcelado", recorrente: "Recorrente", exito: "Êxito", combinado: "Combinado (fixo + êxito)" } as const;

export const CHARGE_STATUS = {
  rascunho: { label: "Rascunho", tone: "neutral" },
  aguardando_emissao: { label: "Aguardando emissão", tone: "neutral" },
  pendente: { label: "Pendente", tone: "warning" },
  parcialmente_paga: { label: "Parcialmente paga", tone: "warning" },
  paga: { label: "Paga", tone: "success" },
  vencida: { label: "Vencida", tone: "danger" },
  cancelada: { label: "Cancelada", tone: "neutral" },
  reembolsada: { label: "Reembolsada", tone: "info" },
  contestada: { label: "Contestada", tone: "danger" },
  erro: { label: "Erro", tone: "danger" },
} as const;
