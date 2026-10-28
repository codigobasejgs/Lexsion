// Workflows por tipo de caso (paridade TI-02/03/04): etapas encadeadas, prazo em dias úteis a partir da
// etapa anterior. Modelos ORIGINAIS da LexSion (não copiam material de terceiros). Aplicar ao caso gera tarefas
// com dependência, usando a contagem demonstrativa de src/domain/deadlines.ts e os feriados do escritório.
import { countDeadline, type Holiday } from "./deadlines";
import type { CivilDate } from "@/lib/dates";

export interface WorkflowStep { title: string; days: number; role: "advogado" | "atendimento" | "controladoria" | "financeiro" | "estagiario"; checklist?: string[] }
export interface WorkflowTemplate { id: string; area: string; name: string; steps: WorkflowStep[] }

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  { id: "wf-bpc", area: "Previdenciário", name: "BPC/LOAS — requerimento administrativo", steps: [
    { title: "Triagem e composição familiar", days: 2, role: "atendimento", checklist: ["Idade ou deficiência", "Pessoas da casa e renda de cada uma"] },
    { title: "Conferir CadÚnico e documentos de todos", days: 3, role: "estagiario", checklist: ["CadÚnico atualizado", "Identidade de todos", "Comprovante de residência"] },
    { title: "Análise do advogado(a) e requerimento", days: 5, role: "advogado" },
    { title: "Protocolo e acompanhamento", days: 2, role: "controladoria" },
  ] },
  { id: "wf-especial", area: "Previdenciário", name: "Aposentadoria com tempo especial", steps: [
    { title: "Pedir PPP e LTCAT aos empregadores", days: 5, role: "atendimento" },
    { title: "Conferir PPP por período e agente", days: 5, role: "estagiario", checklist: ["Agente e intensidade", "EPI", "Responsável técnico"] },
    { title: "Análise de enquadramento e cenários", days: 5, role: "advogado" },
    { title: "Requerimento ou petição", days: 5, role: "advogado" },
  ] },
  { id: "wf-pericia", area: "Previdenciário", name: "Perícia médica judicial", steps: [
    { title: "Reunir laudos e exames atualizados", days: 5, role: "atendimento" },
    { title: "Formular quesitos", days: 3, role: "advogado" },
    { title: "Orientar o cliente sobre a perícia", days: 2, role: "atendimento" },
    { title: "Analisar laudo e manifestar", days: 10, role: "advogado" },
  ] },
  { id: "wf-trabalhista", area: "Trabalhista", name: "Reclamação trabalhista", steps: [
    { title: "Entrevista e documentos (CTPS, holerites, ponto)", days: 3, role: "atendimento" },
    { title: "Cálculo de verbas (demonstrativo) e revisão", days: 5, role: "advogado" },
    { title: "Petição inicial", days: 5, role: "advogado" },
    { title: "Preparar audiência e testemunhas", days: 10, role: "advogado" },
  ] },
  { id: "wf-divorcio", area: "Família", name: "Divórcio consensual", steps: [
    { title: "Reunir certidões e lista de bens", days: 3, role: "atendimento", checklist: ["Certidão de casamento", "Documentos dos filhos", "Bens e dívidas"] },
    { title: "Minuta do acordo (guarda, alimentos, partilha)", days: 5, role: "advogado" },
    { title: "Revisão e assinatura das partes", days: 5, role: "advogado" },
    { title: "Distribuição ou escritura", days: 3, role: "controladoria" },
  ] },
];

/** Datas de cada etapa: a etapa N começa quando a N−1 vence (encadeamento), contando só dias úteis. */
export function scheduleWorkflow(t: WorkflowTemplate, start: CivilDate, holidays: Holiday[]): { step: WorkflowStep; due: CivilDate }[] {
  let from = start;
  return t.steps.map((step) => {
    const due = countDeadline(from, step.days, "uteis", holidays).end;
    from = due;
    return { step, due };
  });
}
