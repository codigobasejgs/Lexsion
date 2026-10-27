// Triagem por área do Direito, guiada por dados (não um painel por área).
// Perguntas coletam fatos; nunca afirmam direito nem prometem resultado. Decisão final: advogado(a).
import { ALL_AREAS } from "./areas";

export interface TriageQuestion {
  id: string;
  text: string;
  kind: "sim_nao" | "texto" | "data";
  /** Se a resposta for "sim", acrescenta este documento ao checklist. */
  docIfYes?: string;
}
export interface TriageScript {
  area: string;
  questions: TriageQuestion[];
  baseDocs: string[];
  /** Perfil interno para quem o caso é encaminhado após a triagem. */
  routeTo: "advogado" | "controladoria";
}

const GENERIC: Omit<TriageScript, "area"> = {
  questions: [
    { id: "fatos", text: "Em poucas palavras, o que aconteceu?", kind: "texto" },
    { id: "data", text: "Quando aconteceu (aproximadamente)?", kind: "data" },
    { id: "docs", text: "Tem algum documento sobre o assunto?", kind: "sim_nao", docIfYes: "Documentos citados pelo cliente" },
    { id: "processo", text: "Já existe processo ou pedido em andamento?", kind: "sim_nao", docIfYes: "Número do processo ou protocolo" },
  ],
  baseDocs: ["Documento de identificação", "Comprovante de residência"],
  routeTo: "advogado",
};

// Roteiros específicos; demais áreas usam o genérico.
const SPECIFIC: TriageScript[] = [
  {
    area: "Previdenciário",
    questions: [
      { id: "beneficio", text: "Qual benefício a pessoa busca (aposentadoria, BPC, auxílio, pensão)?", kind: "texto" },
      { id: "nasc", text: "Data de nascimento", kind: "data" },
      { id: "negado", text: "Já teve pedido negado pelo INSS?", kind: "sim_nao", docIfYes: "Carta de indeferimento" },
      { id: "rural", text: "Trabalhou no campo em algum período?", kind: "sim_nao", docIfYes: "Provas de atividade rural (sindicato, notas, ITR)" },
      { id: "especial", text: "Trabalhou exposto a ruído, calor ou agentes nocivos?", kind: "sim_nao", docIfYes: "PPP / LTCAT" },
      { id: "saude", text: "Há doença ou incapacidade envolvida?", kind: "sim_nao", docIfYes: "Laudos e exames (dado sensível — acesso restrito)" },
    ],
    baseDocs: ["Documento de identificação", "CPF", "CNIS", "Carteira de trabalho", "Comprovante de residência"],
    routeTo: "advogado",
  },
  {
    area: "Trabalhista",
    questions: [
      { id: "saida", text: "Data de saída da empresa", kind: "data" },
      { id: "registro", text: "Tinha carteira assinada?", kind: "sim_nao", docIfYes: "Carteira de trabalho" },
      { id: "extras", text: "Fazia horas extras com frequência?", kind: "sim_nao", docIfYes: "Controles de ponto ou mensagens que mostrem a jornada" },
      { id: "rescisao", text: "Recebeu as verbas da rescisão?", kind: "sim_nao", docIfYes: "Termo de rescisão (TRCT)" },
    ],
    baseDocs: ["Documento de identificação", "Carteira de trabalho", "Contracheques"],
    routeTo: "advogado",
  },
  {
    area: "Família",
    questions: [
      { id: "filhos", text: "Há filhos menores envolvidos?", kind: "sim_nao", docIfYes: "Certidões de nascimento" },
      { id: "casamento", text: "Houve casamento ou união estável?", kind: "sim_nao", docIfYes: "Certidão de casamento ou prova da união" },
      { id: "urgencia", text: "Há situação de risco ou violência?", kind: "sim_nao" },
    ],
    baseDocs: ["Documento de identificação", "Comprovante de residência", "Comprovante de renda"],
    routeTo: "advogado",
  },
  {
    area: "Consumidor",
    questions: [
      { id: "empresa", text: "Qual empresa está envolvida?", kind: "texto" },
      { id: "cobranca", text: "Recebeu cobrança que não reconhece?", kind: "sim_nao", docIfYes: "Faturas ou cobranças contestadas" },
      { id: "protocolo", text: "Já reclamou com a empresa?", kind: "sim_nao", docIfYes: "Números de protocolo" },
    ],
    baseDocs: ["Documento de identificação", "Comprovante de residência"],
    routeTo: "advogado",
  },
];

export function triageScript(area: string): TriageScript {
  return SPECIFIC.find((s) => s.area === area) ?? { area, ...GENERIC };
}

export const TRIAGE_AREAS = ALL_AREAS;

/** Checklist documental derivado das respostas (só acrescenta; não conclui sobre direito). */
export function triageChecklist(script: TriageScript, answers: Record<string, string>): string[] {
  const extra = script.questions.filter((q) => q.docIfYes && answers[q.id] === "sim").map((q) => q.docIfYes!);
  return [...new Set([...script.baseDocs, ...extra])];
}

/** Respostas mínimas antes de encaminhar: todas as perguntas sim/não respondidas. */
export function triageMissing(script: TriageScript, answers: Record<string, string>): string[] {
  return script.questions.filter((q) => q.kind === "sim_nao" && !answers[q.id]).map((q) => q.text);
}
