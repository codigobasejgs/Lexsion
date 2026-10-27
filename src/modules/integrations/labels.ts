export const INT_STATUS = {
  nao_configurado: { label: "Não configurado", tone: "neutral" },
  aguardando_autorizacao: { label: "Aguardando autorização", tone: "warning" },
  em_teste: { label: "Em teste (demo)", tone: "info" },
  operacional: { label: "Operacional (demo)", tone: "success" },
  degradado: { label: "Degradado", tone: "warning" },
  desconectado: { label: "Desconectado", tone: "danger" },
  indisponivel: { label: "Indisponível", tone: "danger" },
  planejado: { label: "Planejado", tone: "neutral" },
} as const;
