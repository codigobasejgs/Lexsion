// Fase 4: motores trabalhista, cível e penal com ÍNDICES OFICIAIS versionados (BCB/IBGE). Determinísticos, com memória
// por etapa e fonte. Regras aguardam validação jurídica; a escolha do índice e dos marcos é do profissional.
import type { CalcRun } from "./calc-engine";
import { accumulate, addMonths, levelAt, OFFICIAL, type SeriesId, type Tables } from "./tables";
import { formatBRL, parseBRL } from "@/lib/money";

const money = (s?: string) => (s && s.trim() ? parseBRL(s) : null); // centavos
const brl = (c: number) => formatBRL(Math.round(c));
const mon = (s?: string) => { const m = /^(\d{2})\/(\d{4})$/.exec((s ?? "").trim()); return m && +m[1] >= 1 && +m[1] <= 12 ? `${m[2]}-${m[1]}` : null; };
const civ = (s?: string) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((s ?? "").trim()); if (!m) return null; const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])); return d.getUTCMonth() === +m[2] - 1 ? `${m[3]}-${m[2]}-${m[1]}` : null; };
const fm = (m: string) => `${m.slice(5)}/${m.slice(0, 4)}`;
const pct = (s?: string) => { const n = Number((s ?? "").replace("%", "").replace(",", ".").trim()); return (s ?? "").trim() && Number.isFinite(n) ? n : null; };
const INDEX_LABEL: Record<string, SeriesId> = { "IPCA-E": "ipcae", IPCA: "ipca", INPC: "inpc", "IGP-M": "igpm", Selic: "selic" };
const src = (t: Tables, s: SeriesId) => `${t.sources[s]?.label ?? s} — ${t.sources[s]?.url ?? ""}`;

/**
 * Atualização de débito judicial: correção pelo índice escolhido do mês seguinte ao vencimento até o mês do cálculo e,
 * a partir da citação/marco, Selic (que já engloba correção e juros) OU juros simples de 1% a.m. (escolha do usuário).
 * Base legal: art. 406 do CC (Lei 14.905/2024: taxa legal = Selic − IPCA desde 30/08/2024); ADCs 58/59 (Justiça do Trabalho).
 */
export function updateDebt(i: Record<string, string>, t: Tables = OFFICIAL): CalcRun {
  const principal = money(i.valor);
  const due = mon(i.vencimento), to = mon(i.dataCalculo), from2 = mon(i.marcoJuros) ?? null;
  const idx = INDEX_LABEL[i.indice ?? "IPCA-E"] ?? "ipcae";
  const regime = i.juros ?? "Selic a partir do marco";
  if (principal === null || principal <= 0) return { error: "Informe o valor devido." };
  if (!due || !to || to < due) return { error: "Vencimento e data do cálculo em mm/aaaa (cálculo depois do vencimento)." };
  if (from2 && (from2 < due || from2 > to)) return { error: "O marco dos juros deve estar entre o vencimento e a data do cálculo." };
  const memory: string[] = [];
  const corrEnd = regime === "Selic a partir do marco" && from2 ? addMonths(from2, -1) : to;
  const c = corrEnd > due ? accumulate(t, idx, addMonths(due, 1), corrEnd) : { factor: 1, missing: [] as string[] };
  const corrected = Math.round(principal * c.factor);
  memory.push(`Correção ${i.indice ?? "IPCA-E"} de ${fm(addMonths(due, 1))} a ${fm(corrEnd)}: fator ${c.factor.toFixed(8)} → ${brl(corrected)}`);
  let interest = 0, total = corrected;
  if (from2) {
    if (regime === "Selic a partir do marco") {
      const s = accumulate(t, "selic", from2, to);
      total = Math.round(corrected * s.factor);
      interest = total - corrected;
      memory.push(`Selic acumulada de ${fm(from2)} a ${fm(to)} (correção + juros): fator ${s.factor.toFixed(8)} → ${brl(total)}`);
      c.missing.push(...s.missing);
    } else {
      const months = (+to.slice(0, 4) - +from2.slice(0, 4)) * 12 + (+to.slice(5) - +from2.slice(5)) + 1;
      interest = Math.round(corrected * 0.01 * months);
      total = corrected + interest;
      memory.push(`Juros simples de 1% a.m. × ${months} meses (${fm(from2)} a ${fm(to)}) = ${brl(interest)}`);
    }
  }
  const fine = Math.round(total * ((pct(i.multa) ?? 0) / 100));
  const fees = Math.round((total + fine) * ((pct(i.honorarios) ?? 0) / 100));
  if (fine) memory.push(`Multa ${pct(i.multa)}% = ${brl(fine)}`);
  if (fees) memory.push(`Honorários ${pct(i.honorarios)}% = ${brl(fees)}`);
  if (c.missing.length) memory.push(`Índice ainda não publicado em ${[...new Set(c.missing)].map(fm).join(", ")}: considerado 0% — atualizar quando sair.`);
  return {
    result: [
      { label: "Valor original", value: brl(principal) }, { label: "Valor corrigido", value: brl(corrected) }, { label: from2 ? "Juros/Selic" : "Juros", value: brl(interest) },
      ...(fine ? [{ label: "Multa", value: brl(fine) }] : []), ...(fees ? [{ label: "Honorários", value: brl(fees) }] : []), { label: "Total atualizado", value: brl(total + fine + fees) },
    ],
    memory,
    assumptions: [`Índices oficiais versionados: ${src(t, idx)}${from2 && regime === "Selic a partir do marco" ? `; ${src(t, "selic")}` : ""}`, "Correção a partir do mês seguinte ao vencimento; Selic não se acumula com outro índice no mesmo período (ADCs 58/59; art. 406 do CC)", "Escolha de índice e marcos depende do título judicial — conferir"],
  };
}

/**
 * Verbas rescisórias completas (CLT): saldo, aviso proporcional (Lei 12.506/2011) com projeção nos avos, 13º e férias
 * pela regra dos 15 dias, férias vencidas, 1/3, multa de 40% (ou 20% em acordo) e descontos de INSS (tabela progressiva).
 */
export function fullSeverance(i: Record<string, string>, t: Tables = OFFICIAL): CalcRun {
  const sal = money(i.salario), adm = civ(i.admissao), dem = civ(i.desligamento);
  const motivo = i.motivo ?? "Dispensa sem justa causa";
  const fgts = money(i.saldoFgts) ?? 0, vencidas = Math.max(0, Math.min(2, Number(i.feriasVencidas) || 0));
  if (sal === null || sal <= 0 || !adm || !dem || dem < adm) return { error: "Informe salário, admissão e desligamento (dd/mm/aaaa)." };
  const memory: string[] = [];
  const years = Math.floor((Date.parse(dem) - Date.parse(adm)) / (365.25 * 86_400_000));
  const indemn = motivo === "Dispensa sem justa causa" || motivo === "Rescisão indireta";
  const agreement = motivo === "Acordo (art. 484-A)";
  const noticeDays = indemn || agreement ? Math.min(90, 30 + 3 * years) : 0;
  const noticeValue = Math.round((sal * noticeDays) / 30 * (agreement ? 0.5 : 1));
  // Projeção do aviso indenizado (art. 487, §1º): conta para 13º e férias.
  const projected = new Date(Date.parse(dem) + noticeDays * 86_400_000).toISOString().slice(0, 10);
  const day = +dem.slice(8);
  const saldo = Math.round((sal * day) / 30);
  memory.push(`Saldo de salário: ${brl(sal)} ÷ 30 × ${day} dias = ${brl(saldo)}`);
  if (noticeDays) memory.push(`Aviso prévio ${agreement ? "pela metade (acordo) " : ""}: 30 + 3 × ${years} ano(s) = ${noticeDays} dias → ${brl(noticeValue)}; projeção até ${projected.split("-").reverse().join("/")}`);
  // Avos pela regra dos 15 dias (fração ≥ 15 dias = mês inteiro).
  const avos = (from: string, to: string) => { let n = 0; for (let m = from.slice(0, 7); m <= to.slice(0, 7); m = addMonths(m, 1)) { const first = m === from.slice(0, 7) ? +from.slice(8) : 1; const last = m === to.slice(0, 7) ? +to.slice(8) : 30; if (Math.min(last, 30) - first + 1 >= 15) n++; } return n; };
  const end = noticeDays ? projected : dem;
  const year0 = `${end.slice(0, 4)}-01-01` > adm ? `${end.slice(0, 4)}-01-01` : adm;
  const a13 = motivo === "Justa causa" ? 0 : Math.min(12, avos(year0, end));
  // Período aquisitivo corrente: do último aniversário da admissão até o fim.
  let anniv = `${end.slice(0, 4)}${adm.slice(4)}`;
  if (anniv > end) anniv = `${+end.slice(0, 4) - 1}${adm.slice(4)}`;
  if (anniv < adm) anniv = adm;
  const aFerias = motivo === "Justa causa" ? 0 : Math.min(12, avos(anniv, end));
  const d13 = Math.round((sal * a13) / 12), fProp = Math.round((sal * aFerias) / 12), fVenc = Math.round(sal * vencidas);
  const terco = Math.round((fProp + fVenc) / 3);
  memory.push(`13º proporcional: ${a13}/12 → ${brl(d13)}; férias proporcionais: ${aFerias}/12 → ${brl(fProp)}${vencidas ? `; férias vencidas: ${vencidas} → ${brl(fVenc)}` : ""}; 1/3 = ${brl(terco)} (regra dos 15 dias)`);
  const multa = indemn ? Math.round(fgts * 0.4) : agreement ? Math.round(fgts * 0.2) : 0;
  if (multa) memory.push(`Multa do FGTS ${agreement ? "20%" : "40%"} sobre ${brl(fgts)} = ${brl(multa)}`);
  // INSS (empregado) sobre saldo e 13º, separadamente; aviso indenizado e férias indenizadas não sofrem incidência.
  const inssOf = (base: number) => { const b = Math.min(base / 100, 8475.55); const bands = [[1621.0, 0.075], [2902.84, 0.09], [4354.27, 0.12], [8475.55, 0.14]] as const; let v = 0, lo = 0; for (const [hi, a] of bands) { if (b > lo) v += (Math.min(b, hi) - lo) * a; lo = hi; } return Math.round(v * 100); };
  const inss = inssOf(saldo) + inssOf(d13);
  memory.push(`INSS (tabela 2026) sobre saldo ${brl(inssOf(saldo))} e sobre 13º ${brl(inssOf(d13))}; aviso e férias indenizados sem incidência`);
  const gross = saldo + noticeValue + d13 + fProp + fVenc + terco + multa;
  void t;
  return {
    result: [
      { label: "Saldo de salário", value: brl(saldo) }, ...(noticeDays ? [{ label: `Aviso prévio (${noticeDays} dias)`, value: brl(noticeValue) }] : []),
      { label: `13º proporcional (${a13}/12)`, value: brl(d13) }, { label: `Férias proporcionais (${aFerias}/12)`, value: brl(fProp) }, ...(fVenc ? [{ label: "Férias vencidas", value: brl(fVenc) }] : []),
      { label: "1/3 constitucional", value: brl(terco) }, ...(multa ? [{ label: `Multa FGTS (${agreement ? "20%" : "40%"})`, value: brl(multa) }] : []),
      { label: "Total bruto", value: brl(gross) }, { label: "INSS do empregado", value: brl(inss) }, { label: "Líquido estimado (antes do IRRF)", value: brl(gross - inss) },
    ],
    memory,
    assumptions: [`Motivo: ${motivo}`, "Sem horas extras, adicionais e médias variáveis (use o cálculo de horas extras e reflexos)", "IRRF não calculado (depende de dependentes e outras deduções)", "CLT arts. 477, 487 e 484-A; Lei 12.506/2011; Lei 8.036/1990, art. 18"],
  };
}

/** Horas extras com reflexos (DSR, 13º, férias + 1/3, FGTS) mês a mês. */
export function overtime(i: Record<string, string>): CalcRun {
  const sal = money(i.salario), h = pct(i.horasMes), ad = pct(i.adicional) ?? 50, div = Number(i.divisor) || 220;
  const meses = Math.max(1, Math.min(120, Number(i.meses) || 0)), uteis = Number(i.diasUteis) || 25, dsr = Number(i.diasDescanso) || 5;
  if (sal === null || sal <= 0 || h === null || h <= 0) return { error: "Informe salário e horas extras por mês." };
  const hora = sal / div, he = hora * (1 + ad / 100), mensal = Math.round(he * h), refDsr = Math.round((mensal / uteis) * dsr);
  const base = (mensal + refDsr) * meses;
  const r13 = Math.round(base / 12), rFer = Math.round((base / 12) * (4 / 3)), fgts = Math.round((base + r13 + rFer) * 0.08);
  const total = base + r13 + rFer + fgts;
  return {
    result: [{ label: `Horas extras (${meses} meses)`, value: brl(mensal * meses) }, { label: "Reflexo em DSR", value: brl(refDsr * meses) }, { label: "Reflexo em 13º", value: brl(r13) }, { label: "Reflexo em férias + 1/3", value: brl(rFer) }, { label: "FGTS 8%", value: brl(fgts) }, { label: "Total", value: brl(total) }],
    memory: [`Valor-hora = ${brl(sal)} ÷ ${div} = ${brl(Math.round(hora))}; hora extra (+${ad}%) = ${brl(Math.round(he))}`, `Mensal = ${h} h × ${brl(Math.round(he))} = ${brl(mensal)}; DSR = mensal ÷ ${uteis} úteis × ${dsr} descansos = ${brl(refDsr)}`, `13º = (HE + DSR) ÷ 12; férias = (HE + DSR) ÷ 12 × 4/3; FGTS = 8% sobre tudo`],
    assumptions: ["Média constante de horas no período", "Súmula 172 e OJ 394 do TST (DSR); correção e juros: use Atualização de débito", "Divisor conforme jornada contratual (220, 200, 180…)"],
  };
}

/** Dosimetria (CP, art. 68): pena-base (art. 59), agravantes/atenuantes (sem passar dos limites — Súmula 231 STJ), causas de aumento/diminuição. */
export function dosimetry(i: Record<string, string>): CalcRun {
  const toDays = (s?: string) => { const m = /^(\d+)\s*a(?:nos?)?(?:\s*(\d+)\s*m)?/i.exec((s ?? "").trim()); return m ? (+m[1] * 12 + (+m[2] || 0)) * 30 : null; };
  const min = toDays(i.penaMin), max = toDays(i.penaMax);
  const neg = Math.max(0, Math.min(8, Number(i.circunstanciasNegativas) || 0));
  const agr = Math.max(0, Number(i.agravantes) || 0), at = Math.max(0, Number(i.atenuantes) || 0);
  if (!min || !max || max < min) return { error: "Pena mínima e máxima no formato \"2 anos\" ou \"2 anos 6 m\"." };
  const fr = (s?: string) => { const m = /^(\d+)\/(\d+)$/.exec((s ?? "").trim()); return m ? +m[1] / +m[2] : 0; };
  const fmt = (d: number) => { const mo = Math.round(d / 30); return `${Math.floor(mo / 12)} ano(s) e ${mo % 12} mes(es)`; };
  const step1 = min + ((max - min) / 8) * neg;
  let step2 = step1 * (1 + (agr - at) / 6);
  const clamped = step2 < min ? min : step2 > max ? max : step2;
  const clampNote = clamped !== step2 ? ` → limitada a ${fmt(clamped)} (Súmula 231 do STJ e limite máximo)` : "";
  step2 = clamped;
  const step3 = step2 * (1 + fr(i.aumento)) * (1 - fr(i.diminuicao));
  const finalDays = Math.round(step3);
  const regime = finalDays > 8 * 360 ? "fechado" : finalDays > 4 * 360 ? (i.reincidente === "Sim" ? "fechado" : "semiaberto") : i.reincidente === "Sim" ? "semiaberto (reincidente)" : "aberto";
  return {
    result: [{ label: "Pena-base (1ª fase)", value: fmt(step1) }, { label: "Pena intermediária (2ª fase)", value: fmt(step2) }, { label: "Pena definitiva (3ª fase)", value: fmt(finalDays) }, { label: "Regime inicial sugerido (art. 33, §2º)", value: regime }],
    memory: [`1ª fase: mínimo ${fmt(min)} + 1/8 do intervalo × ${neg} circunstância(s) negativa(s) = ${fmt(step1)}`, `2ª fase: ${agr} agravante(s) e ${at} atenuante(s), 1/6 cada = ${fmt(step1 * (1 + (agr - at) / 6))}${clampNote}`, `3ª fase: × (1 + ${i.aumento || "0"}) × (1 − ${i.diminuicao || "0"}) = ${fmt(finalDays)}`],
    assumptions: ["Frações usuais (1/8 por circunstância do art. 59; 1/6 por agravante/atenuante) — critério jurisprudencial, não legal", "Substituição (art. 44) e sursis (art. 77) não avaliados", "Cálculo de referência para revisão: a dosimetria é ato do juiz"],
  };
}

/** Execução penal: frações de progressão do art. 112 da LEP (Lei 13.964/2019) sobre pena e data-base. */
export function progression(i: Record<string, string>): CalcRun {
  const total = Number(i.penaMeses), base = civ(i.dataBase), remidos = Math.max(0, Number(i.diasRemidos) || 0);
  const FR: Record<string, [number, string]> = { "Primário, sem violência": [0.16, "16% (art. 112, I)"], "Reincidente, sem violência": [0.2, "20% (II)"], "Primário, com violência ou grave ameaça": [0.25, "25% (III)"], "Reincidente, com violência": [0.3, "30% (IV)"], "Hediondo, primário": [0.4, "40% (V)"], "Hediondo com morte, primário": [0.5, "50% (VI, a)"], "Hediondo, reincidente": [0.6, "60% (VII)"], "Hediondo com morte, reincidente": [0.7, "70% (VIII)"] };
  const fr = FR[i.perfil ?? ""] ?? null;
  if (!Number.isFinite(total) || total <= 0 || !base || !fr) return { error: "Informe pena total (meses), data-base (dd/mm/aaaa) e perfil." };
  const daysNeeded = Math.ceil(total * 30 * fr[0]) - remidos;
  const date = new Date(Date.parse(base) + Math.max(0, daysNeeded) * 86_400_000).toISOString().slice(0, 10).split("-").reverse().join("/");
  return {
    result: [{ label: "Fração", value: fr[1] }, { label: "Dias a cumprir (descontada a remição)", value: String(Math.max(0, daysNeeded)) }, { label: "Data prevista do requisito objetivo", value: date }],
    memory: [`${total} meses × 30 × ${fr[0] * 100}% = ${Math.ceil(total * 30 * fr[0])} dias − ${remidos} dia(s) remido(s) = ${Math.max(0, daysNeeded)} dias a partir de ${base.split("-").reverse().join("/")}`],
    assumptions: ["Requisito subjetivo (bom comportamento) não avaliado", "Lei 7.210/1984, art. 112, na redação da Lei 13.964/2019; frações anteriores para crimes antes de 23/01/2020 (irretroatividade) — conferir", "Data-base conforme a última prisão ou progressão (Súmula 534/STJ, Tema 1006)"],
  };
}

/** Pensão alimentícia em atraso: parcelas mês a mês, corrigidas pelo índice escolhido. Base em salários mínimos ou valor fixo. */
export function alimonyArrears(i: Record<string, string>, t: Tables = OFFICIAL): CalcRun {
  const from = mon(i.inicio), to = mon(i.fim), calc = mon(i.dataCalculo) ?? to;
  const pctMin = pct(i.percentualSalarioMinimo), fixed = money(i.valorFixo);
  const idx = INDEX_LABEL[i.indice ?? "INPC"] ?? "inpc";
  if (!from || !to || to < from || !calc || calc < to) return { error: "Período (mm/aaaa) e data do cálculo válidos." };
  if (!pctMin && !fixed) return { error: "Informe % do salário mínimo ou valor fixo." };
  const paid = new Set((i.mesesPagos ?? "").split(/[\s,;]+/).map(mon).filter(Boolean));
  let total = 0;
  const memory: string[] = [];
  for (let m = from; m <= to; m = addMonths(m, 1)) {
    if (paid.has(m)) continue;
    const due = pctMin ? Math.round((levelAt(t, "salarioMinimo", m) ?? 0) * pctMin) : fixed!; // % × R$ = centavos
    const f = accumulate(t, idx, addMonths(m, 1), calc);
    const upd = Math.round(due * f.factor);
    total += upd;
    if (memory.length < 24) memory.push(`${fm(m)}: ${brl(due)} × ${f.factor.toFixed(6)} = ${brl(upd)}`);
  }
  return {
    result: [{ label: "Débito atualizado", value: brl(total) }],
    memory: [...memory, ...(memory.length === 24 ? ["(demais competências na mesma regra)"] : [])],
    assumptions: [`Salário mínimo vigente em cada mês (${src(t, "salarioMinimo")})`, `Correção ${i.indice ?? "INPC"}: ${src(t, idx)}`, "Juros de mora não incluídos; meses pagos informados excluídos; conferir o título (inclui 13º?)"],
  };
}
