export const REQ_STATUS = {
  em_preparacao: { label: "Em preparação", tone: "neutral" },
  expedido: { label: "Expedido", tone: "info" },
  aguardando_processamento: { label: "Aguardando processamento", tone: "info" },
  previsao_informada: { label: "Previsão informada", tone: "warning" },
  deposito_identificado: { label: "Depósito identificado", tone: "info" },
  conferencia: { label: "Em conferência", tone: "warning" },
  liberado: { label: "Liberado", tone: "success" },
  encerrado: { label: "Encerrado", tone: "neutral" },
} as const;

export const REQ_ORDER = Object.keys(REQ_STATUS) as (keyof typeof REQ_STATUS)[];
