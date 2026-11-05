// Regras previdenciárias VERSIONADAS e com fonte. Código determinístico; nenhuma regra decide sozinha:
// cada resultado sai com a fonte, a vigência usada e o status de validação jurídica da versão.
// Status "aguarda_validacao": transcrita da norma, ainda não aprovada pela advogada responsável (decisão 05/11/2026).
import type { CivilDate } from "@/lib/dates";

export const RULES_VERSION = "prev-2026.11-1";
export type RuleStatus = "aguarda_validacao" | "validada";
export interface Source { label: string; url: string }
export const SOURCES = {
  ec103: { label: "EC 103/2019, art. 25, §2º (conversão de tempo especial até a entrada em vigor)", url: "https://www2.camara.leg.br/legin/fed/emecon/2019/emendaconstitucional-103-12-novembro-2019-789412-norma-pl.html" },
  dec3048art70: { label: "Decreto 3.048/1999, art. 70 (fatores de conversão; redação do Decreto 4.827/2003)", url: "https://www.planalto.gov.br/ccivil_03/decreto/d3048.htm" },
  lei9032: { label: "Lei 9.032/1995 (fim do enquadramento por categoria profissional em 28/04/1995)", url: "https://www.planalto.gov.br/ccivil_03/leis/l9032.htm" },
  dec2172: { label: "Decreto 2.172/1997 (laudo técnico exigido a partir de 06/03/1997)", url: "https://www.planalto.gov.br/ccivil_03/decreto/d2172.htm" },
  dec4882: { label: "Decreto 4.882/2003 (ruído acima de 85 dB(A) a partir de 19/11/2003)", url: "https://www.planalto.gov.br/ccivil_03/decreto/2003/d4882.htm" },
  dec53831: { label: "Decreto 53.831/1964 e Decreto 83.080/1979 (anexos de categorias e agentes)", url: "https://www.planalto.gov.br/ccivil_03/decreto/1950-1969/d53831.htm" },
  in128: { label: "IN PRES/INSS 128/2022 (versão consolidada e alterações)", url: "https://www.gov.br/inss/pt-br/centrais-de-conteudo/legislacao/instrucao-normativa/2022" },
  lei8213art15: { label: "Lei 8.213/1991, art. 15 (qualidade de segurado e período de graça)", url: "https://www.planalto.gov.br/ccivil_03/leis/l8213cons.htm" },
  lei8213art86: { label: "Lei 8.213/1991, art. 86 e art. 18, §1º (auxílio-acidente: quem tem direito)", url: "https://www.planalto.gov.br/ccivil_03/leis/l8213cons.htm" },
  inssAuxAcidente: { label: "INSS — Auxílio-acidente", url: "https://www.gov.br/inss/pt-br/direitos-e-deveres/beneficios-por-incapacidade/auxilio-acidente" },
  inssIncapacidade: { label: "INSS — Auxílio por incapacidade temporária", url: "https://www.gov.br/inss/pt-br/direitos-e-deveres/beneficios-por-incapacidade/auxilio-por-incapacidade-temporaria" },
  linach: { label: "Portaria Interministerial MTE/MS/MPS 9/2014 (LINACH — agentes cancerígenos)", url: "https://www.gov.br/trabalho-e-emprego/pt-br" },
} satisfies Record<string, Source>;

const day = (d: CivilDate) => Math.floor(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))) / 86_400_000);
const fromDay = (n: number): CivilDate => new Date(n * 86_400_000).toISOString().slice(0, 10) as CivilDate;
export const EC103_DATE: CivilDate = "2019-11-13"; // último dia em que o tempo especial ainda pode ser convertido
export const CATEGORY_END: CivilDate = "1995-04-28"; // último dia do enquadramento por categoria profissional

/** Dias corridos de [a, b] (inclusive). */
export const daysIncl = (a: CivilDate, b: CivilDate) => day(b) - day(a) + 1;
/** União de intervalos em dias (concomitância conta uma vez). */
export function unionDays(periods: { start: CivilDate; end: CivilDate }[]): number {
  const iv = periods.filter((p) => p.end >= p.start).map((p) => [day(p.start), day(p.end)] as const).sort((a, b) => a[0] - b[0]);
  let total = 0, ce = -Infinity;
  for (const [s, e] of iv) {
    const from = Math.max(s, ce + 1);
    if (e >= from) { total += e - from + 1; ce = e; }
  }
  return total;
}
/** Dias → anos/meses/dias no padrão de 365 e 30 dias (convenção declarada na memória). */
export function ymd(days: number) {
  const y = Math.floor(days / 365), rest = days - y * 365, m = Math.floor(rest / 30), d = rest - m * 30;
  return { y, m, d, text: `${y} ano(s), ${m} mes(es) e ${d} dia(s)` };
}

// ---------- Conversão de tempo especial em comum ----------
export type SpecialKind = 15 | 20 | 25;
export type Sex = "M" | "F";
/** Decreto 3.048/1999, art. 70: tempo-alvo 35 (homem) ou 30 (mulher) dividido pelo tempo especial da atividade. */
export const CONVERSION_FACTOR: Record<SpecialKind, Record<Sex, number>> = { 15: { M: 2.33, F: 2.0 }, 20: { M: 1.75, F: 1.5 }, 25: { M: 1.4, F: 1.2 } };
export interface SpecialPeriod { id: string; label: string; start: CivilDate; end: CivilDate; kind: SpecialKind }
export interface ConversionLine { id: string; label: string; start: CivilDate; end: CivilDate; days: number; convertibleDays: number; notConvertibleDays: number; factor: number; addedDays: number; memo: string }
/**
 * Converte só a parte cumprida ATÉ 13/11/2019 (EC 103, art. 25, §2º). O que vier depois conta como tempo comum
 * simples (sem acréscimo) e continua contando como especial apenas para aposentadoria especial.
 */
export function convertSpecial(periods: SpecialPeriod[], sex: Sex) {
  const lines: ConversionLine[] = periods.map((p) => {
    const days = p.end >= p.start ? daysIncl(p.start, p.end) : 0;
    const cut = p.end <= EC103_DATE ? p.end : p.start <= EC103_DATE ? EC103_DATE : null;
    const convertibleDays = cut ? daysIncl(p.start, cut) : 0;
    const factor = CONVERSION_FACTOR[p.kind][sex];
    const addedDays = Math.floor(convertibleDays * (factor - 1)); // acréscimo arredondado para baixo (nunca a favor de dia não cumprido)
    return {
      id: p.id, label: p.label, start: p.start, end: p.end, days, convertibleDays, notConvertibleDays: days - convertibleDays, factor, addedDays,
      memo: `${p.label}: ${days} dia(s) especiais (${p.kind} anos). Até ${EC103_DATE.split("-").reverse().join("/")}: ${convertibleDays} dia(s) × (${factor.toFixed(2)} − 1) = +${addedDays} dia(s) de acréscimo. ${days - convertibleDays > 0 ? `Depois da EC 103: ${days - convertibleDays} dia(s) sem conversão.` : ""}`.trim(),
    };
  });
  return { lines, addedDays: lines.reduce((s, l) => s + l.addedDays, 0), sources: [SOURCES.dec3048art70, SOURCES.ec103], status: "aguarda_validacao" as RuleStatus, version: RULES_VERSION };
}

// ---------- Atividade especial por período (PPP/agentes) ----------
export type Classification = "consistente" | "incompleta" | "divergencia" | "exige_complementacao" | "possivel_enquadramento" | "insuficiente";
export const CLASSIFICATION_LABEL: Record<Classification, string> = {
  consistente: "Informação consistente",
  incompleta: "Informação incompleta",
  divergencia: "Divergência identificada",
  exige_complementacao: "Documento que exige complementação",
  possivel_enquadramento: "Possível enquadramento, sujeito à revisão do advogado",
  insuficiente: "Informação insuficiente para conclusão",
};
/** Documentação exigida pela época da atividade (IN 128/2022 e decretos de regência). */
export function documentationFor(start: CivilDate): { text: string; source: Source } {
  if (start <= CATEGORY_END) return { text: "Até 28/04/1995: categoria profissional comprovada (CTPS/registro) ou formulário de exposição (SB-40/DSS-8030); laudo só para ruído e calor.", source: SOURCES.lei9032 };
  if (start < "1997-03-06") return { text: "29/04/1995 a 05/03/1997: comprovação da exposição efetiva por formulário (SB-40/DSS-8030); laudo para ruído e calor.", source: SOURCES.lei9032 };
  if (start < "2004-01-01") return { text: "06/03/1997 a 31/12/2003: formulário de exposição acompanhado de laudo técnico (LTCAT).", source: SOURCES.dec2172 };
  return { text: "A partir de 01/01/2004: PPP emitido com base no LTCAT, com responsável técnico pelos registros ambientais.", source: SOURCES.in128 };
}
/** Limite de ruído (dB(A)) vigente na data. */
export function noiseLimit(date: CivilDate): { db: number; source: Source } {
  if (date < "1997-03-06") return { db: 80, source: SOURCES.dec53831 };
  if (date < "2003-11-19") return { db: 90, source: SOURCES.dec2172 };
  return { db: 85, source: SOURCES.dec4882 };
}
/** Enquadramento por categoria profissional (soldagem e outras dos anexos): só para dias até 28/04/1995. */
export function categoryWindow(start: CivilDate, end: CivilDate): { start: CivilDate; end: CivilDate } | null {
  if (start > CATEGORY_END) return null;
  return { start, end: end < CATEGORY_END ? end : CATEGORY_END };
}

export interface PppInput {
  id: string;
  start: CivilDate | null;
  end: CivilDate | null;
  employer: string;
  role: string; // função/cargo como no documento
  activities: string; // descrição das atividades
  agents: { kind: "ruido" | "quimico" | "biologico" | "fisico_outro"; name: string; intensity: number | null; unit: string; technique: string; carcinogenic: boolean }[];
  epiEffective: "sim" | "nao" | "nao_informado";
  technicalResponsible: boolean;
  signed: boolean;
  categoryClaim: string | null; // ex.: "Soldador — código 2.5.3 do Decreto 53.831/64", informado pelo advogado
}
export interface PppFinding { classification: Classification; text: string; source?: Source }
/** Checklist técnico de um período do PPP. Não "valida" o PPP; aponta o que sustenta ou falta. */
export function assessPpp(p: PppInput): { findings: PppFinding[]; overall: Classification; status: RuleStatus; version: string } {
  const f: PppFinding[] = [];
  if (!p.start || !p.end) f.push({ classification: "incompleta", text: "Período sem data de início ou de fim no PPP." });
  if (p.start && p.end && p.end < p.start) f.push({ classification: "divergencia", text: "Data de fim anterior ao início." });
  if (!p.role.trim()) f.push({ classification: "incompleta", text: "Função/cargo não informado." });
  if (!p.activities.trim()) f.push({ classification: "incompleta", text: "Descrição das atividades ausente: sem ela não há como relacionar a exposição ao trabalho." });
  if (!p.signed) f.push({ classification: "exige_complementacao", text: "PPP sem assinatura/identificação do representante da empresa." });
  if (p.start && p.start >= "2004-01-01" && !p.technicalResponsible) f.push({ classification: "exige_complementacao", text: "Sem responsável técnico pelos registros ambientais no período (exigido a partir de 2004).", source: SOURCES.in128 });
  if (p.start) f.push({ classification: "consistente", text: `Documentação exigida para a época: ${documentationFor(p.start).text}`, source: documentationFor(p.start).source });
  if (!p.agents.length && !p.categoryClaim) f.push({ classification: "insuficiente", text: "Nenhum agente nocivo informado e nenhuma categoria profissional indicada." });
  for (const a of p.agents) {
    if (a.kind === "ruido") {
      if (a.intensity == null) { f.push({ classification: "incompleta", text: `Ruído sem intensidade informada (${a.name || "agente sem nome"}).` }); continue; }
      if (p.start && p.end) {
        // Verifica cada sub-período de limite.
        for (const [s, e] of [[p.start, "1997-03-05"], ["1997-03-06", "2003-11-18"], ["2003-11-19", p.end]] as const) {
          const a0 = s > p.start ? s : p.start, b0 = e < p.end ? e : p.end;
          if (a0 > b0) continue;
          const lim = noiseLimit(a0 as CivilDate);
          f.push({ classification: a.intensity > lim.db ? "possivel_enquadramento" : "insuficiente", text: `Ruído ${a.intensity} ${a.unit || "dB(A)"} de ${a0.split("-").reverse().join("/")} a ${b0.split("-").reverse().join("/")}: limite da época ${lim.db} dB(A) — ${a.intensity > lim.db ? "acima do limite" : "não supera o limite"}.`, source: lim.source });
        }
      }
      if (!a.technique.trim() && p.start && p.start >= "2004-01-01") f.push({ classification: "exige_complementacao", text: "Técnica de medição do ruído não informada (a partir de 2004 o PPP deve indicá-la).", source: SOURCES.in128 });
    } else if (a.kind === "quimico") {
      if (!a.name.trim()) f.push({ classification: "incompleta", text: "Agente químico sem identificação." });
      else if (a.carcinogenic) f.push({ classification: "possivel_enquadramento", text: `Agente químico "${a.name}" informado como cancerígeno: avaliação qualitativa (presença no ambiente), conferir se consta da LINACH com registro CAS; EPI não afasta automaticamente. Sujeito à revisão.`, source: SOURCES.linach });
      else if (a.intensity == null) f.push({ classification: "exige_complementacao", text: `Agente químico "${a.name}" sem concentração: verificar se o anexo da época exige avaliação quantitativa.`, source: SOURCES.in128 });
      else f.push({ classification: "possivel_enquadramento", text: `Agente químico "${a.name}" com concentração informada (${a.intensity} ${a.unit}): comparar com o limite de tolerância do anexo vigente.`, source: SOURCES.in128 });
    } else if (a.kind === "biologico") {
      f.push({ classification: "possivel_enquadramento", text: `Agente biológico "${a.name || "não identificado"}": avaliação qualitativa conforme a atividade descrita.`, source: SOURCES.in128 });
    } else f.push({ classification: "exige_complementacao", text: `Agente físico "${a.name}": conferir critério específico do anexo vigente.`, source: SOURCES.in128 });
  }
  if (p.epiEffective === "sim" && p.agents.some((a) => a.kind !== "ruido" && !a.carcinogenic)) f.push({ classification: "divergencia", text: "PPP informa EPI eficaz: para agentes não cancerígenos, isso pode afastar o enquadramento a partir de 03/12/1998 — ponto controvertido para revisão." , source: SOURCES.in128 });
  if (p.categoryClaim && p.start && p.end) {
    const w = categoryWindow(p.start, p.end);
    f.push(w
      ? { classification: "possivel_enquadramento", text: `Categoria profissional (${p.categoryClaim}) só alcança ${w.start.split("-").reverse().join("/")} a ${w.end.split("-").reverse().join("/")} (até 28/04/1995). Exige prova da atividade efetivamente exercida, não só o nome do cargo.`, source: SOURCES.lei9032 }
      : { classification: "insuficiente", text: `Categoria profissional (${p.categoryClaim}) não se aplica: o período começa depois de 28/04/1995. É preciso comprovar exposição a agente nocivo.`, source: SOURCES.lei9032 });
  }
  const rank: Classification[] = ["divergencia", "incompleta", "exige_complementacao", "insuficiente", "possivel_enquadramento", "consistente"];
  const overall = rank.find((c) => f.some((x) => x.classification === c)) ?? "insuficiente";
  return { findings: f, overall, status: "aguarda_validacao", version: RULES_VERSION };
}

// ---------- Qualidade de segurado ----------
/** Data-limite estimada da qualidade de segurado após a última contribuição (art. 15). Prazos adicionais dependem de prova. */
export function gracePeriod(lastContributionEnd: CivilDate, opts: { over120: boolean; unemployedProof: boolean }) {
  const months = 12 + (opts.over120 ? 12 : 0) + (opts.unemployedProof ? 12 : 0);
  const d = new Date(`${lastContributionEnd}T00:00:00Z`);
  // Perda no dia seguinte ao vencimento (dia 15) da contribuição do mês seguinte ao fim do prazo (art. 15, §4º).
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months + 2, 15));
  const until = end.toISOString().slice(0, 10) as CivilDate;
  return { months, until, memo: `${months} meses de período de graça (12${opts.over120 ? " + 12 por mais de 120 contribuições sem perda" : ""}${opts.unemployedProof ? " + 12 por desemprego comprovado" : ""}); qualidade mantida até ${until.split("-").reverse().join("/")} e perdida no dia seguinte. Conferir o vencimento aplicável à categoria.`, source: SOURCES.lei8213art15, status: "aguarda_validacao" as RuleStatus };
}

// ---------- Auxílio-acidente ----------
export type BondKindAtAccident = "empregado" | "domestico" | "avulso" | "segurado_especial" | "contribuinte_individual" | "facultativo" | "sem_vinculo" | "desconhecido";
export interface AccidentInput {
  accidentDate: CivilDate | null;
  kindAtAccident: BondKindAtAccident;
  insuredAtAccident: boolean | null; // qualidade de segurado na data (apurada ou informada)
  sequelaDescribed: boolean;
  sequelaPermanent: "sim" | "nao" | "nao_sabe";
  reducedCapacityHabitual: "sim" | "nao" | "nao_sabe";
  habitualActivity: string;
  medicalDocs: number; // documentos médicos anexados
  previousBenefit: boolean; // recebeu auxílio por incapacidade temporária antes
}
export function assessAccidentAid(i: AccidentInput) {
  const sustain: string[] = [], weaken: string[] = [], missing: string[] = [];
  const covered = ["empregado", "domestico", "avulso", "segurado_especial"].includes(i.kindAtAccident);
  if (i.kindAtAccident === "desconhecido" || i.kindAtAccident === "sem_vinculo") missing.push("Categoria do segurado na data do acidente.");
  else if (covered) sustain.push(`Categoria na data do acidente (${i.kindAtAccident.replace("_", " ")}) está entre as que têm direito ao auxílio-acidente.`);
  else weaken.push(`Categoria na data do acidente (${i.kindAtAccident.replace("_", " ")}) NÃO está entre as que têm direito ao auxílio-acidente (art. 18, §1º, Lei 8.213).`);
  if (!i.accidentDate) missing.push("Data do acidente.");
  if (i.insuredAtAccident === true) sustain.push("Qualidade de segurado na data do acidente.");
  else if (i.insuredAtAccident === false) weaken.push("Sem qualidade de segurado na data do acidente.");
  else missing.push("Qualidade de segurado na data do acidente (conferir CNIS e período de graça).");
  if (!i.sequelaDescribed) missing.push("Descrição da sequela.");
  if (i.sequelaPermanent === "sim") sustain.push("Sequela consolidada (permanente) informada."); else if (i.sequelaPermanent === "nao") weaken.push("Sequela não é permanente: o caso pode ser de auxílio por incapacidade temporária, não de auxílio-acidente."); else missing.push("Prova de que a sequela é permanente (consolidada).");
  if (i.reducedCapacityHabitual === "sim") sustain.push("Redução da capacidade para o trabalho habitual informada."); else if (i.reducedCapacityHabitual === "nao") weaken.push("Sem redução da capacidade para o trabalho habitual: requisito central não atendido."); else missing.push("Prova da redução da capacidade para a atividade habitual (laudo descrevendo limitações).");
  if (!i.habitualActivity.trim()) missing.push("Atividade habitual exercida na época.");
  if (i.medicalDocs === 0) missing.push("Documentos médicos (laudos, exames, relatórios, CAT quando houver).");
  else sustain.push(`${i.medicalDocs} documento(s) médico(s) anexado(s) — conferir se descrevem sequela e limitação.`);
  if (i.previousBenefit) sustain.push("Houve auxílio por incapacidade temporária antes: o auxílio-acidente começa no dia seguinte à cessação, se preenchidos os requisitos.");
  missing.push("Perícia médica do INSS ou judicial: a ferramenta não substitui avaliação médica.");
  return { sustain, weaken, missing, noCarencia: "Independe de carência (art. 26, I, Lei 8.213).", sources: [SOURCES.lei8213art86, SOURCES.inssAuxAcidente], status: "aguarda_validacao" as RuleStatus, version: RULES_VERSION };
}

// ---------- Possibilidades de benefício (quadro de requisitos) ----------
export type ReqState = "atendido" | "pendente" | "nao_verificavel";
export interface Requirement { text: string; state: ReqState; detail: string }
export interface BenefitAssessment { id: string; name: string; requirements: Requirement[]; note: string; sources: Source[] }
const age = (birth: CivilDate, on: CivilDate) => { const b = new Date(`${birth}T00:00:00Z`), o = new Date(`${on}T00:00:00Z`); let a = o.getUTCFullYear() - b.getUTCFullYear(); if (o.getUTCMonth() < b.getUTCMonth() || (o.getUTCMonth() === b.getUTCMonth() && o.getUTCDate() < b.getUTCDate())) a--; return a; };
export function assessBenefits(i: { birthDate: CivilDate | null; sex: Sex | null; on: CivilDate; commonDays: number; carencyMonths: number | null; specialDays: number; specialKinds: SpecialKind[]; insured: boolean | null }): BenefitAssessment[] {
  const out: BenefitAssessment[] = [];
  const a = i.birthDate ? age(i.birthDate, i.on) : null;
  const yrs = Math.floor(i.commonDays / 365);
  // Aposentadoria por idade (regra permanente/transição art. 18 EC 103): mulher 62, homem 65, 15/20 anos, 180 meses de carência.
  const ageReq = i.sex === "F" ? 62 : i.sex === "M" ? 65 : null;
  out.push({
    id: "idade", name: "Aposentadoria por idade (urbana)", sources: [SOURCES.ec103, SOURCES.in128],
    note: "Para quem se filiou antes de 13/11/2019 vale a transição do art. 18 da EC 103 (homem 15 anos de contribuição); filiados depois: homem 20 anos. Conferir a data de filiação.",
    requirements: [
      { text: `Idade mínima${ageReq ? ` (${ageReq} anos)` : ""}`, state: a == null || ageReq == null ? "nao_verificavel" : a >= ageReq ? "atendido" : "pendente", detail: a == null ? "Data de nascimento ou sexo não informados." : `Idade em ${i.on.split("-").reverse().join("/")}: ${a} anos.` },
      { text: "Carência de 180 contribuições", state: i.carencyMonths == null ? "nao_verificavel" : i.carencyMonths >= 180 ? "atendido" : "pendente", detail: i.carencyMonths == null ? "Competências do CNIS não lidas." : `${i.carencyMonths} competência(s) com contribuição identificada(s) no CNIS (sem descontar abaixo do mínimo pendente).` },
      { text: `Tempo de contribuição mínimo (${i.sex === "F" ? "15" : "15 ou 20"} anos)`, state: yrs >= 15 ? (i.sex === "M" ? "nao_verificavel" : "atendido") : "pendente", detail: `${ymd(i.commonDays).text} apurados.` },
    ],
  });
  // Aposentadoria especial (art. 19/21 EC 103): 15/20/25 anos de atividade especial + idade mínima ou pontos.
  const minSpecial = i.specialKinds.length ? Math.min(...i.specialKinds) : 25;
  out.push({
    id: "especial", name: "Aposentadoria especial", sources: [SOURCES.ec103, SOURCES.in128],
    note: "Após a EC 103 exige também idade mínima (55/58/60) ou pontuação na transição (art. 21). Tempo especial depende do reconhecimento dos períodos.",
    requirements: [
      { text: `Tempo de atividade especial (${minSpecial} anos)`, state: i.specialDays === 0 ? "nao_verificavel" : i.specialDays >= minSpecial * 365 ? "atendido" : "pendente", detail: i.specialDays ? `${ymd(i.specialDays).text} marcados como especiais (sujeito a reconhecimento).` : "Nenhum período marcado como especial." },
      { text: "Idade mínima ou pontos (transição)", state: "nao_verificavel", detail: "Cálculo de pontos da transição na Fase 2." },
    ],
  });
  // Tempo de contribuição: extinta para novos filiados; transições exigem cálculo de pedágio/pontos (Fase 2).
  out.push({
    id: "tempo", name: "Aposentadoria por tempo de contribuição (regras de transição)", sources: [SOURCES.ec103],
    note: "Extinta como regra permanente pela EC 103. Só por transição (pontos, idade progressiva, pedágio 50% ou 100%) para quem se filiou antes de 13/11/2019 — cálculo na Fase 2.",
    requirements: [{ text: "Tempo de contribuição apurado", state: "nao_verificavel", detail: `${ymd(i.commonDays).text} (com acréscimos de conversão até 13/11/2019, se houver).` }],
  });
  out.push({
    id: "incapacidade", name: "Auxílio por incapacidade temporária / aposentadoria por incapacidade permanente", sources: [SOURCES.inssIncapacidade, SOURCES.lei8213art15],
    note: "São análises diferentes do auxílio-acidente. Dependem de perícia; a ferramenta só confere os requisitos administrativos.",
    requirements: [
      { text: "Qualidade de segurado", state: i.insured == null ? "nao_verificavel" : i.insured ? "atendido" : "pendente", detail: i.insured == null ? "Sem data de início da incapacidade informada." : i.insured ? "Dentro do período de graça estimado." : "Fora do período de graça estimado." },
      { text: "Carência de 12 contribuições (salvo acidente de qualquer natureza ou doença da lista)", state: i.carencyMonths == null ? "nao_verificavel" : i.carencyMonths >= 12 ? "atendido" : "pendente", detail: i.carencyMonths == null ? "Competências não lidas." : `${i.carencyMonths} competência(s) identificadas.` },
      { text: "Incapacidade comprovada por perícia", state: "nao_verificavel", detail: "Depende de perícia médica." },
    ],
  });
  return out;
}
export { fromDay };
