// Central de cálculos: SÓ aritmética determinística (centavos inteiros, arredondamento explícito).
// Nenhum resultado aqui é "cálculo jurídico validado": regras jurídicas, índices oficiais e tabelas exigem
// validação profissional. Cada modelo declara seu status e premissas; a memória mostra cada passo.
import type { Cents } from "@/lib/money";
import { formatBRL, parseBRL } from "@/lib/money";

export type CalcStatus = "VALIDADO" | "DEMONSTRATIVO" | "REGRAS_PARCIAIS" | "AGUARDA_TABELA" | "AGUARDA_REVISAO_JURIDICA";
export const CALC_STATUS_LABEL: Record<CalcStatus, string> = {
  VALIDADO: "Validado",
  DEMONSTRATIVO: "Demonstrativo",
  REGRAS_PARCIAIS: "Regras parciais",
  AGUARDA_TABELA: "Aguarda tabela oficial",
  AGUARDA_REVISAO_JURIDICA: "Aguarda revisão jurídica",
};

export interface CalcOutput {
  result: { label: string; value: string }[];
  memory: string[];
  assumptions: string[];
}
export type CalcRun = CalcOutput | { error: string };

const pct = (s: string | undefined): number | null => {
  if (s === undefined || s.trim() === "") return null;
  const n = Number(s.replace("%", "").replace(",", ".").trim());
  return Number.isFinite(n) ? n : null;
};
const int = (s: string | undefined): number | null => {
  const n = Number((s ?? "").trim());
  return Number.isInteger(n) ? n : null;
};
const money = (s: string | undefined): Cents | null => (s && s.trim() ? parseBRL(s) : null);
const round = (x: number): Cents => Math.round(x); // meio para cima (Math.round), em centavos

/** "AAAA-MM;taxa%" por linha (vírgula ou ponto decimal). Rejeita mês repetido, fora de ordem ou taxa inválida. */
export function parseIndexSeries(text: string): { month: string; rate: number }[] | string {
  const rows = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!rows.length) return "Informe ao menos um mês do índice (AAAA-MM;taxa%).";
  const out: { month: string; rate: number }[] = [];
  for (const [i, l] of rows.entries()) {
    const [m, r] = l.split(/[;\t]/).map((x) => x?.trim());
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m ?? "")) return `Linha ${i + 1}: mês inválido (use AAAA-MM).`;
    const rate = pct(r);
    if (rate === null || rate <= -100) return `Linha ${i + 1}: taxa inválida.`;
    if (out.length && m! <= out[out.length - 1].month) return `Linha ${i + 1}: meses devem estar em ordem crescente e sem repetição.`;
    out.push({ month: m!, rate });
  }
  for (let i = 1; i < out.length; i++) {
    const [y0, m0] = out[i - 1].month.split("-").map(Number);
    const [y1, m1] = out[i].month.split("-").map(Number);
    if ((y1 - y0) * 12 + (m1 - m0) !== 1) return `Mês ausente entre ${out[i - 1].month} e ${out[i].month}: série incompleta não é calculada.`;
  }
  return out;
}

/** Correção monetária por série informada (fator acumulado) + juros simples mensais + multa. */
export function monetaryCorrection(i: Record<string, string>): CalcRun {
  const principal = money(i.valorOriginal);
  if (principal === null || principal <= 0) return { error: "Valor original deve ser positivo." };
  const series = parseIndexSeries(i.serie ?? "");
  if (typeof series === "string") return { error: series };
  const juros = pct(i.jurosMes) ?? 0;
  const multa = pct(i.multa) ?? 0;
  if (juros < 0 || multa < 0) return { error: "Juros e multa não podem ser negativos." };
  const factor = series.reduce((f, s) => f * (1 + s.rate / 100), 1);
  const corrected = round(principal * factor);
  const months = series.length;
  const interest = round((corrected * juros * months) / 100);
  const fine = round((corrected * multa) / 100);
  const total = corrected + interest + fine;
  return {
    result: [
      { label: "Valor corrigido", value: formatBRL(corrected) },
      { label: `Juros simples (${months} meses)`, value: formatBRL(interest) },
      { label: "Multa", value: formatBRL(fine) },
      { label: "Total atualizado", value: formatBRL(total) },
    ],
    memory: [
      `Fator acumulado = ${series.map((s) => `(1 + ${s.rate}%)`).join(" × ")} = ${factor.toFixed(8)}`,
      `Corrigido = ${formatBRL(principal)} × ${factor.toFixed(8)} = ${formatBRL(corrected)} (arredondado ao centavo)`,
      `Juros = ${formatBRL(corrected)} × ${juros}% × ${months} = ${formatBRL(interest)}`,
      `Multa = ${formatBRL(corrected)} × ${multa}% = ${formatBRL(fine)}`,
      `Total = ${formatBRL(total)}`,
    ],
    assumptions: [`Série de ${series[0].month} a ${series[months - 1].month} INFORMADA pelo usuário (fonte a registrar)`, "Juros simples sobre o valor corrigido, contados por mês da série", "Não aplica índice oficial automaticamente: escolha do índice e do termo inicial dependem do caso"],
  };
}

/** Tabela Price (parcelas iguais) ou SAC (amortização constante). */
export function amortization(i: Record<string, string>): CalcRun {
  const p = money(i.valorFinanciado);
  const rate = pct(i.taxaContratada);
  const n = int(i.prazo);
  const system = (i.sistema ?? "Price").toUpperCase() === "SAC" ? "SAC" : "PRICE";
  if (p === null || p <= 0) return { error: "Valor financiado deve ser positivo." };
  if (rate === null || rate < 0) return { error: "Taxa mensal inválida." };
  if (n === null || n < 1 || n > 600) return { error: "Prazo deve ser um número inteiro de 1 a 600 meses." };
  const r = rate / 100;
  const rows: { k: number; payment: Cents; interest: Cents; amort: Cents; balance: Cents }[] = [];
  let balance = p;
  const pmt = system === "PRICE" ? (r === 0 ? p / n : (p * r) / (1 - (1 + r) ** -n)) : 0;
  for (let k = 1; k <= n; k++) {
    const interest = round(balance * r);
    let amort = system === "PRICE" ? round(pmt) - interest : round(p / n);
    if (k === n) amort = balance; // última parcela zera o saldo (absorve arredondamentos)
    balance -= amort;
    rows.push({ k, payment: amort + interest, interest, amort, balance });
  }
  const totalInterest = rows.reduce((s, x) => s + x.interest, 0);
  const totalPaid = rows.reduce((s, x) => s + x.payment, 0);
  const show = rows.length <= 6 ? rows : [...rows.slice(0, 3), ...rows.slice(-2)];
  return {
    result: [
      { label: system === "PRICE" ? "Parcela (Price)" : "1ª parcela (SAC)", value: formatBRL(rows[0].payment) },
      ...(system === "SAC" ? [{ label: "Última parcela (SAC)", value: formatBRL(rows[n - 1].payment) }] : []),
      { label: "Total de juros", value: formatBRL(totalInterest) },
      { label: "Total pago", value: formatBRL(totalPaid) },
    ],
    memory: [
      system === "PRICE" ? `PMT = P × i ÷ (1 − (1 + i)^−n) = ${formatBRL(p)} × ${rate}% ÷ (1 − (1 + ${rate}%)^−${n}) = ${formatBRL(round(pmt))}` : `Amortização = ${formatBRL(p)} ÷ ${n} = ${formatBRL(round(p / n))}; juros sobre o saldo devedor`,
      ...show.map((x) => `Parcela ${x.k}: juros ${formatBRL(x.interest)} + amortização ${formatBRL(x.amort)} = ${formatBRL(x.payment)}; saldo ${formatBRL(x.balance)}`),
      "A última parcela absorve a diferença de arredondamento e zera o saldo.",
    ],
    assumptions: ["Juros compostos mensais sobre o saldo devedor", "Não inclui seguros, tarifas, IOF nem capitalização diária", "Não avalia abusividade de taxa: comparação com taxa média exige fonte oficial e análise profissional"],
  };
}

/** Verbas rescisórias simplificadas (dispensa sem justa causa), em avos inteiros informados. */
export function severance(i: Record<string, string>): CalcRun {
  const sal = money(i.salario);
  const days = int(i.diasTrabalhadosMes);
  const m13 = int(i.avos13);
  const mFerias = int(i.avosFerias);
  const years = int(i.anosCompletos) ?? 0;
  const fgts = money(i.saldoFgts) ?? 0;
  if (sal === null || sal <= 0) return { error: "Salário deve ser positivo." };
  if (days === null || days < 0 || days > 31) return { error: "Dias trabalhados no mês: 0 a 31." };
  if (m13 === null || m13 < 0 || m13 > 12 || mFerias === null || mFerias < 0 || mFerias > 12) return { error: "Avos de 13º e de férias: 0 a 12." };
  if (years < 0) return { error: "Anos completos não pode ser negativo." };
  const saldo = round((sal * days) / 30);
  const noticeDays = Math.min(90, 30 + 3 * years);
  const aviso = round((sal * noticeDays) / 30);
  const decimo = round((sal * m13) / 12);
  const ferias = round((sal * mFerias) / 12);
  const terco = round(ferias / 3);
  const multaFgts = round(fgts * 0.4);
  const total = saldo + aviso + decimo + ferias + terco + multaFgts;
  return {
    result: [
      { label: "Saldo de salário", value: formatBRL(saldo) },
      { label: `Aviso prévio indenizado (${noticeDays} dias)`, value: formatBRL(aviso) },
      { label: `13º proporcional (${m13}/12)`, value: formatBRL(decimo) },
      { label: `Férias proporcionais (${mFerias}/12)`, value: formatBRL(ferias) },
      { label: "1/3 de férias", value: formatBRL(terco) },
      { label: "Multa de 40% do FGTS (sobre saldo informado)", value: formatBRL(multaFgts) },
      { label: "Total bruto estimado", value: formatBRL(total) },
    ],
    memory: [
      `Saldo = ${formatBRL(sal)} ÷ 30 × ${days} = ${formatBRL(saldo)}`,
      `Aviso = 30 + 3 × ${years} ano(s), limitado a 90 = ${noticeDays} dias → ${formatBRL(aviso)}`,
      `13º = ${formatBRL(sal)} ÷ 12 × ${m13} = ${formatBRL(decimo)}`,
      `Férias = ${formatBRL(sal)} ÷ 12 × ${mFerias} = ${formatBRL(ferias)}; 1/3 = ${formatBRL(terco)}`,
      `Multa FGTS = ${formatBRL(fgts)} × 40% = ${formatBRL(multaFgts)}`,
    ],
    assumptions: ["Dispensa sem justa causa; avos informados pelo usuário (regra dos 15 dias não aplicada automaticamente)", "Sem descontos (INSS/IRRF), sem reflexos de horas extras/adicionais, sem projeção do aviso nos avos", "Proporção do aviso conforme a Lei 12.506/2011 — conferir enquadramento"],
  };
}

/** Pensão alimentícia: percentual sobre base informada (renda líquida ou salário mínimo informado). */
export function alimony(i: Record<string, string>): CalcRun {
  const base = money(i.baseCalculo);
  const p = pct(i.percentual);
  const months = int(i.mesesAtraso) ?? 0;
  if (base === null || base <= 0) return { error: "Base de cálculo deve ser positiva." };
  if (p === null || p <= 0 || p > 100) return { error: "Percentual entre 0 e 100." };
  if (months < 0 || months > 600) return { error: "Meses em atraso: 0 a 600." };
  const monthly = round((base * p) / 100);
  const arrears = monthly * months;
  return {
    result: [{ label: "Valor mensal", value: formatBRL(monthly) }, { label: `Parcelas em atraso (${months})`, value: formatBRL(arrears) }],
    memory: [`Mensal = ${formatBRL(base)} × ${p}% = ${formatBRL(monthly)}`, `Atraso = ${formatBRL(monthly)} × ${months} = ${formatBRL(arrears)} (sem correção nem juros)`],
    assumptions: ["Percentual e base definidos por decisão/acordo: conferir o título", "Atrasados sem correção e juros — use Correção monetária para atualizar", "13º e férias incidem conforme o título (não incluídos)"],
  };
}

/** Pena de multa (dias-multa): dias × fração do salário mínimo informado × fator de aumento. */
export function penalFine(i: Record<string, string>): CalcRun {
  const dias = int(i.diasMulta);
  const frac = pct(i.fracaoSalario); // em salários mínimos por dia (ex.: 0,0333 = 1/30)
  const sm = money(i.salarioMinimo);
  const fator = pct(i.fatorAumento) ?? 1;
  if (dias === null || dias < 10 || dias > 360) return { error: "Dias-multa: entre 10 e 360 (art. 49 do Código Penal)." };
  if (frac === null || frac < 0.0333 || frac > 5) return { error: "Valor do dia-multa: entre 1/30 (0,0333) e 5 salários mínimos." };
  if (sm === null || sm <= 0) return { error: "Informe o salário mínimo vigente à época do fato." };
  if (fator < 1 || fator > 3) return { error: "Fator de aumento entre 1 e 3." };
  const dayValue = round(sm * frac);
  const total = round(dias * dayValue * fator);
  return {
    result: [{ label: "Valor do dia-multa", value: formatBRL(dayValue) }, { label: "Multa total (sem correção)", value: formatBRL(total) }],
    memory: [`Dia-multa = ${formatBRL(sm)} × ${frac} = ${formatBRL(dayValue)}`, `Total = ${dias} × ${formatBRL(dayValue)} × ${fator} = ${formatBRL(total)}`],
    assumptions: ["Parâmetros fixados na sentença; salário mínimo da época do fato INFORMADO pelo usuário", "Correção monetária a partir do fato não incluída", "Limites do art. 49 e aumento do art. 60, §1º, do Código Penal — conferir redação vigente"],
  };
}

export interface CalcModel {
  name: string;
  area: string;
  status: CalcStatus;
  fields: { key: string; label: string; kind?: "text" | "textarea" | "select"; options?: string[]; placeholder?: string }[];
  run?: (i: Record<string, string>) => CalcRun;
}

export const CALC_MODELS: CalcModel[] = [
  { name: "Correção monetária e juros", area: "Cível", status: "AGUARDA_TABELA", run: monetaryCorrection, fields: [
    { key: "valorOriginal", label: "Valor original (R$)" },
    { key: "serie", label: "Índice mensal informado (AAAA-MM;taxa% por linha)", kind: "textarea", placeholder: "2025-01;0,16\n2025-02;1,31" },
    { key: "jurosMes", label: "Juros simples (% ao mês)" },
    { key: "multa", label: "Multa (%)" },
  ] },
  { name: "Financiamento Price/SAC", area: "Bancária", status: "DEMONSTRATIVO", run: amortization, fields: [
    { key: "valorFinanciado", label: "Valor financiado (R$)" },
    { key: "taxaContratada", label: "Taxa contratada (% a.m.)" },
    { key: "prazo", label: "Prazo (meses)" },
    { key: "sistema", label: "Sistema", kind: "select", options: ["Price", "SAC"] },
  ] },
  { name: "Verbas rescisórias (simplificado)", area: "Trabalhista", status: "REGRAS_PARCIAIS", run: severance, fields: [
    { key: "salario", label: "Último salário (R$)" },
    { key: "diasTrabalhadosMes", label: "Dias trabalhados no mês da saída" },
    { key: "avos13", label: "Avos de 13º (0–12)" },
    { key: "avosFerias", label: "Avos de férias proporcionais (0–12)" },
    { key: "anosCompletos", label: "Anos completos de serviço" },
    { key: "saldoFgts", label: "Saldo do FGTS para fins rescisórios (R$)" },
  ] },
  { name: "Pensão alimentícia", area: "Família", status: "DEMONSTRATIVO", run: alimony, fields: [
    { key: "baseCalculo", label: "Base de cálculo (R$)" },
    { key: "percentual", label: "Percentual fixado (%)" },
    { key: "mesesAtraso", label: "Meses em atraso" },
  ] },
  { name: "Pena de multa (dias-multa)", area: "Penal", status: "REGRAS_PARCIAIS", run: penalFine, fields: [
    { key: "diasMulta", label: "Dias-multa (10–360)" },
    { key: "fracaoSalario", label: "Valor do dia (em salários mínimos, ex.: 0,0333)" },
    { key: "salarioMinimo", label: "Salário mínimo da época do fato (R$)" },
    { key: "fatorAumento", label: "Fator de aumento (1 a 3)" },
  ] },
  { name: "Atualização de tributo (taxa acumulada informada)", area: "Tributária", status: "AGUARDA_TABELA", run: monetaryCorrection, fields: [
    { key: "valorOriginal", label: "Valor do tributo (R$)" },
    { key: "serie", label: "Taxa mensal informada (AAAA-MM;taxa% por linha)", kind: "textarea", placeholder: "2025-01;1,01" },
    { key: "jurosMes", label: "Juros adicionais (% ao mês, se houver)" },
    { key: "multa", label: "Multa (%)" },
  ] },
];

export const findModel = (name: string) => CALC_MODELS.find((m) => m.name === name);
