export const PHASE_LABEL: Record<string, string> = { triagem: "Triagem", documentacao: "Documentação", analise: "Análise", administrativo: "Administrativo", judicial: "Judicial", cumprimento: "Cumprimento", encerrado: "Encerrado" };

export const DOC_STATUS: Record<string, { label: string; tone: "neutral" | "success" | "warning" | "danger" | "info" }> = {
  solicitado: { label: "Solicitado", tone: "warning" },
  recebido: { label: "Recebido", tone: "info" },
  em_leitura: { label: "Em leitura", tone: "info" },
  precisa_revisar: { label: "Precisa revisar", tone: "warning" },
  validado: { label: "Validado", tone: "success" },
  rejeitado: { label: "Rejeitado", tone: "danger" },
};

export const EVENT_TYPE = { audiencia: { label: "Audiência", tone: "danger" }, pericia: { label: "Perícia", tone: "danger" }, reuniao: { label: "Reunião", tone: "neutral" }, atendimento: { label: "Atendimento", tone: "info" } } as const;
