// Leitor de CNIS (extrato do Meu INSS em PDF com texto). DETERMINÍSTICO: só reconhece o que está escrito.
// Entrada: linhas de texto com a página de origem (o servidor monta as linhas a partir do PDF).
// Saída: vínculos com evidência (página e trecho), remunerações por competência quando o extrato as traz,
// indicadores do INSS (PEXT, AVRC, IREC…) e linhas não reconhecidas. Nunca completa campo ausente.
import type { CivilDate } from "@/lib/dates";

export interface PdfLine { page: number; text: string }
export interface Evidence { page: number; excerpt: string }
export interface CnisBond {
  seq: number;
  nit: string | null;
  origin: string; // empregador / origem do vínculo, como escrito
  originId: string | null; // CNPJ/CEI/CPF
  kind: "empregado" | "contribuinte_individual" | "facultativo" | "domestico" | "beneficio" | "rural" | "outro";
  start: CivilDate | null;
  end: CivilDate | null;
  lastRemuneration: string | null; // MM/AAAA da última remuneração, quando o extrato não traz data fim
  indicators: string[];
  evidence: Evidence;
  confidence: "alta" | "media" | "baixa";
}
export interface CnisContribution { seq: number; month: string; amount: number | null; indicators: string[]; evidence: Evidence }
export interface CnisReading {
  person: { name: string | null; nit: string | null; cpf: string | null; birthDate: CivilDate | null; evidence: Evidence[] };
  bonds: CnisBond[];
  contributions: CnisContribution[];
  unread: Evidence[]; // linhas que parecem vínculo mas não foram reconhecidas com segurança
  pages: number;
}

/** Indicadores do CNIS (lista oficial do extrato). Significado curto para o advogado; a IN 128/2022 é a referência. */
export const CNIS_INDICATORS: Record<string, string> = {
  PEXT: "Pendência: vínculo extemporâneo (informado fora do prazo)",
  AEXT: "Acerto: vínculo extemporâneo",
  PREC: "Pendência de remuneração/recolhimento",
  IREC: "Indicador de recolhimento com pendência",
  "IREC-LC123": "Recolhimento no Plano Simplificado (LC 123) — pode não valer para tempo de contribuição",
  "PREC-MENOR-MIN": "Remuneração/recolhimento abaixo do mínimo",
  "IREC-MENOR-MIN": "Recolhimento abaixo do mínimo",
  AVRC: "Acerto de remuneração/recolhimento",
  PVIN: "Pendência no vínculo",
  AVIN: "Acerto de vínculo",
  PSC: "Pendência: salário de contribuição",
  IVIN: "Indicador de vínculo com pendência",
  "PEXT-AVRC": "Extemporâneo com acerto de remuneração",
  "IEAN": "Exposição a agente nocivo informada pelo empregador",
  "IGFIP-INF": "Informação de GFIP",
  "PADM-EMPR": "Admissão anterior ao início da atividade do empregador",
  "PRPPS": "Vínculo de Regime Próprio",
};

const DATE = /(\d{2})\/(\d{2})\/(\d{4})/g;
const toCivil = (d: string): CivilDate | null => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d);
  if (!m) return null;
  const [dd, mm, yy] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || yy < 1900 || yy > 2100) return null;
  const dt = new Date(Date.UTC(yy, mm - 1, dd));
  if (dt.getUTCMonth() !== mm - 1) return null; // 31/02 etc.
  return `${m[3]}-${m[2]}-${m[1]}` as CivilDate;
};
const NIT = /\b(\d{3}\.\d{5}\.\d{2}-\d)\b/;
const CNPJ = /\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{2}\.\d{3}\.\d{3}|\d{2}\.\d{3}\.\d{5}\/\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2})\b/; // CNPJ, raiz CNPJ, CEI ou CPF
const KNOWN_IND = new RegExp(`\\b(${Object.keys(CNIS_INDICATORS).map((k) => k.replace(/[-]/g, "\\-")).sort((a, b) => b.length - a.length).join("|")})\\b`, "g");
const indicatorsIn = (s: string) => [...new Set(s.match(KNOWN_IND) ?? [])];
const kindOf = (s: string): CnisBond["kind"] => {
  const t = s.toLowerCase();
  if (/benef[ií]cio|\bnb\b|aux[ií]lio|aposentadoria/.test(t)) return "beneficio";
  if (/dom[eé]stic/.test(t)) return "domestico";
  if (/facultativ/.test(t)) return "facultativo";
  if (/contribuinte individual|aut[oô]nomo|empres[aá]rio|recolhimento/.test(t)) return "contribuinte_individual";
  if (/segurado especial|rural/.test(t)) return "rural";
  if (/empregado|trabalhador avulso|\bcnpj\b|\bcei\b|ltda|s\/a|\bs\.a\.|\bme\b|\beireli\b|\bepp\b/.test(t)) return "empregado";
  return "outro";
};

/**
 * Reconhece:
 *  - cabeçalho do filiado (Nome, NIT, CPF, Data de nascimento) — rótulo e valor na mesma linha;
 *  - linhas de vínculo: começam com o número de sequência e trazem ao menos uma data (dd/mm/aaaa);
 *  - linhas de remuneração: "MM/AAAA  1.234,56  [INDICADORES]" logo após um vínculo.
 */
export function parseCnis(lines: PdfLine[]): CnisReading {
  const r: CnisReading = { person: { name: null, nit: null, cpf: null, birthDate: null, evidence: [] }, bonds: [], contributions: [], unread: [], pages: Math.max(0, ...lines.map((l) => l.page)) };
  let current: CnisBond | null = null;
  for (const { page, text: raw } of lines) {
    const text = raw.replace(/\s+/g, " ").trim();
    if (!text) continue;
    const ev = { page, excerpt: text.slice(0, 240) };
    // Cabeçalho do filiado.
    const nameM = /^Nome(?: do Filiado)?\s*:?\s*([A-ZÀ-Ú][A-ZÀ-Ú' .-]{3,})$/i.exec(text);
    if (nameM && !r.person.name) { r.person.name = nameM[1].trim(); r.person.evidence.push(ev); continue; }
    const nitH = /^NIT\s*:?\s*(\d{3}\.\d{5}\.\d{2}-\d)/i.exec(text);
    if (nitH && !r.person.nit) { r.person.nit = nitH[1]; r.person.evidence.push(ev); }
    const cpfH = /CPF\s*:?\s*(\d{3}\.\d{3}\.\d{3}-\d{2})/i.exec(text);
    if (cpfH && !r.person.cpf && !/^\d+\s/.test(text)) { r.person.cpf = cpfH[1]; r.person.evidence.push(ev); }
    const birthH = /Data de Nascimento\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i.exec(text);
    if (birthH && !r.person.birthDate) { r.person.birthDate = toCivil(birthH[1]); r.person.evidence.push(ev); }
    if (nitH || cpfH || birthH) continue;

    // Vínculo: "<seq> <NIT> <CNPJ/CEI> <origem> <tipo> <início> [fim] [últ.rem] [indicadores]".
    const seqM = /^(\d{1,3})\s+(.*)$/.exec(text);
    const dates = [...text.matchAll(DATE)].map((m) => m[0]);
    if (seqM && dates.length >= 1 && (NIT.test(text) || CNPJ.test(text) || /benef[ií]cio|contribuinte|facultativ|recolhimento/i.test(text))) {
      const seq = Number(seqM[1]);
      const start = toCivil(dates[0]);
      const end = dates[1] ? toCivil(dates[1]) : null;
      const lastRem = /\b(\d{2}\/\d{4})\s*$/.exec(text.replace(KNOWN_IND, "").trim())?.[1] ?? null;
      const nit = NIT.exec(text)?.[1] ?? null;
      const originId = CNPJ.exec(text.replace(NIT, ""))?.[1] ?? null;
      // Origem = o que sobra entre o identificador e a primeira data (nome do empregador como escrito).
      const before = text.slice(0, text.indexOf(dates[0])).replace(/^\d{1,3}\s+/, "").replace(NIT, "").replace(originId ?? "\u0000", "").replace(/\s+/g, " ").trim();
      if (!start) { r.unread.push(ev); current = null; continue; }
      if (end && end < start) { r.unread.push({ page, excerpt: `${ev.excerpt} [data fim anterior ao início]` }); current = null; continue; }
      const bond: CnisBond = {
        seq, nit, origin: before || "(origem não identificada no texto)", originId, kind: kindOf(text), start, end, lastRemuneration: end ? null : lastRem, indicators: indicatorsIn(text), evidence: ev,
        confidence: before && (originId || nit) ? "alta" : before ? "media" : "baixa",
      };
      r.bonds.push(bond);
      current = bond;
      continue;
    }
    // Remuneração/contribuição por competência do vínculo atual (pode haver várias por linha).
    const comps = [...text.matchAll(/\b(\d{2})\/(\d{4})\s+((?:\d{1,3}(?:\.\d{3})*|\d+),\d{2})?((?:\s+[A-Z][A-Z0-9-]{2,})*)/g)];
    if (current && comps.length && !/\d{2}\/\d{2}\/\d{4}/.test(text)) {
      for (const c of comps) {
        const mm = Number(c[1]);
        if (mm < 1 || mm > 12) continue;
        r.contributions.push({ seq: current.seq, month: `${c[2]}-${c[1]}`, amount: c[3] ? Number(c[3].replace(/\./g, "").replace(",", ".")) : null, indicators: indicatorsIn(c[4] ?? ""), evidence: ev });
      }
      continue;
    }
    // Linha com cara de vínculo (sequência + CNPJ) mas sem data reconhecível: registrar, não adivinhar.
    if (seqM && CNPJ.test(text) && !dates.length) r.unread.push(ev);
  }
  return r;
}
