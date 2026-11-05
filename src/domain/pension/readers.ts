// Leitores de CTPS Digital e PPP (PDF com texto) e comparação CNIS × CTPS. DETERMINÍSTICOS: reconhecem rótulos e
// padrões do documento; o que não reconhecem fica em "não lidas" e nunca é completado por suposição.
import type { CivilDate } from "@/lib/dates";
import type { Evidence, PdfLine } from "./cnis-parser";
import type { PppInput } from "./rules";

const civil = (d: string | undefined | null): CivilDate | null => {
  const m = d ? /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d.trim()) : null;
  if (!m) return null;
  const dt = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  return dt.getUTCMonth() === +m[2] - 1 && +m[3] > 1900 && +m[3] < 2100 ? `${m[3]}-${m[2]}-${m[1]}` : null;
};
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const ev = (l: PdfLine): Evidence => ({ page: l.page, excerpt: clean(l.text).slice(0, 240) });
const DOC_ID = /\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{2}\.\d{3}\.\d{5}\/\d{2})\b/;

// ---------- CTPS Digital ----------
export interface CtpsContract { employer: string | null; employerId: string | null; role: string | null; start: CivilDate | null; end: CivilDate | null; evidence: Evidence[]; confidence: "alta" | "media" | "baixa" }
const CTPS_LABELS: [keyof Pick<CtpsContract, "employer" | "employerId" | "role" | "start" | "end">, RegExp][] = [
  ["employerId", /^(?:CNPJ|CEI|CAEPF|CNO)(?:\s*\/\s*CEI)?(?: do empregador)?\s*:?\s*(.*)$/i],
  ["employer", /^(?:Empregador|Raz[aã]o Social|Nome (?:do )?Empregador|Nome Empresarial)\s*:?\s*(.*)$/i],
  ["role", /^(?:Cargo|Ocupa[cç][aã]o|Fun[cç][aã]o|CBO)\s*:?\s*(.*)$/i],
  ["start", /^(?:Data de )?Admiss[aã]o\s*:?\s*(.*)$/i],
  ["end", /^(?:Data de )?(?:Desligamento|Demiss[aã]o|Sa[ií]da|Rescis[aã]o|T[eé]rmino)\s*:?\s*(.*)$/i],
];
/** Contratos de trabalho por rótulo ("Data de admissão: 01/02/2010" ou rótulo numa linha e valor na seguinte). */
export function parseCtps(lines: PdfLine[]): { contracts: CtpsContract[]; unread: Evidence[]; pages: number } {
  const contracts: CtpsContract[] = [];
  const unread: Evidence[] = [];
  let cur: CtpsContract | null = null;
  let pending: (typeof CTPS_LABELS)[number][0] | null = null;
  const put = (field: (typeof CTPS_LABELS)[number][0], value: string, l: PdfLine) => {
    const v = clean(value);
    if (!v) { pending = field; return; }
    pending = null;
    // Novo contrato quando o rótulo de empregador/CNPJ reaparece com o contrato atual já completo nesse campo.
    if (!cur || ((field === "employer" || field === "employerId") && cur[field] && cur.start)) { cur = { employer: null, employerId: null, role: null, start: null, end: null, evidence: [], confidence: "baixa" }; contracts.push(cur); }
    if (field === "start" || field === "end") {
      const d = civil(/\d{2}\/\d{2}\/\d{4}/.exec(v)?.[0]);
      if (!d) { if (!/^(?:-|—|n[aã]o (?:informad|consta)|em aberto|vigente|atual)/i.test(v)) unread.push(ev(l)); return; }
      cur[field] = d;
    } else if (field === "employerId") cur.employerId = DOC_ID.exec(v)?.[1] ?? v.slice(0, 40);
    else cur[field] = v.slice(0, 160);
    cur.evidence.push(ev(l));
  };
  for (const l of lines) {
    const t = clean(l.text);
    if (!t) continue;
    const hit = CTPS_LABELS.find(([, re]) => re.test(t));
    if (hit) { put(hit[0], hit[1].exec(t)![1], l); continue; }
    if (pending) put(pending, t, l);
  }
  for (const c of contracts as CtpsContract[]) {
    if (c.start && c.end && c.end < c.start) { unread.push({ ...c.evidence[0], excerpt: `${c.evidence[0]?.excerpt ?? ""} [desligamento anterior à admissão]` }); c.end = null; }
    c.confidence = c.start && (c.employerId || c.employer) ? (c.employerId && c.employer ? "alta" : "media") : "baixa";
  }
  return { contracts: (contracts as CtpsContract[]).filter((c) => c.start || c.employer || c.employerId), unread, pages: Math.max(0, ...lines.map((l) => l.page)) };
}

// ---------- PPP ----------
type Section = "lotacao" | "profissiografia" | "exposicao" | "responsavel" | null;
const SECTION: [Section, RegExp][] = [
  ["lotacao", /LOTA[CÇ][AÃ]O E ATRIBUI[CÇ][AÃ]O/i],
  ["profissiografia", /PROFISSIOGRAFIA/i],
  ["exposicao", /EXPOSI[CÇ][AÃ]O A FATORES DE RISCO/i],
  ["responsavel", /RESPONS[AÁ]VEL PELOS REGISTROS AMBIENTAIS/i],
  [null, /RESULTADOS DE MONITORA[CÇ][AÃ]O BIOL[OÓ]GICA|RESPONS[AÁ]VEL PELA MONITORA[CÇ][AÃ]O|OBSERVA[CÇ][OÕ]ES/i],
];
const RANGE = /^(\d{2}\/\d{2}\/\d{4})\s*(?:a|at[eé]|-|–|à)?\s*(\d{2}\/\d{2}\/\d{4}|--\/--\/----|atual|\s*)\s*(.*)$/i;
const INTENSITY = /(\d+(?:[.,]\d+)?)\s*(dB\s*\(?A\)?|dB|ppm|mg\/m[3³]|f\/cm[3³]|°C|IBUTG|m\/s[2²])/i;
const CHEM = /benzen|tolueno|xileno|s[ií]lica|poeira|fumo|hidrocarbon|[oó]leo|graxa|solvente|amianto|asbesto|chumbo|cromo|n[ií]quel|c[aá]dmio|mangan|merc[uú]rio|ars[eê]nio|formalde|agrot[oó]xico|qu[ií]mic/i;
const BIO = /v[ií]rus|bact[eé]ri|fungo|microrganism|biol[oó]gic|parasit|esgoto|lixo urbano|hospital/i;
// Subconjunto do Grupo 1 da LINACH: candidato a avaliação qualitativa; a lista completa e o CAS são conferidos pelo advogado.
const CARCINOGEN = /benzeno|amianto|asbesto|s[ií]lica cristalina|cromo hexavalente|cromo vi|n[ií]quel|c[aá]dmio|ber[ií]lio|ars[eê]nio|formalde[ií]do|[oó]leo mineral n[aã]o tratado|alcatr[aã]o|fuligem/i;
export interface PppReading { employer: string | null; employerId: string | null; worker: string | null; periods: PppInput[]; responsible: { start: CivilDate; end: CivilDate | null; evidence: Evidence }[]; evidence: Record<string, Evidence>; unread: Evidence[]; pages: number }
export function parsePpp(lines: PdfLine[]): PppReading {
  const r: PppReading = { employer: null, employerId: null, worker: null, periods: [], responsible: [], evidence: {}, unread: [], pages: Math.max(0, ...lines.map((l) => l.page)) };
  const roles: { start: CivilDate; end: CivilDate | null; text: string }[] = [];
  const acts: { start: CivilDate; end: CivilDate | null; text: string }[] = [];
  let section: Section = null;
  let last: { text: string } | null = null;
  for (const l of lines) {
    const t = clean(l.text);
    if (!t) continue;
    const sec = SECTION.find(([, re]) => re.test(t));
    if (sec) { section = sec[0]; last = null; continue; }
    if (!r.employerId && DOC_ID.test(t) && section === null) { r.employerId = DOC_ID.exec(t)![1]; r.evidence.employerId = ev(l); }
    const emp = /^(?:\d+\s*[-.]\s*)?Nome Empresarial\s*:?\s*(.+)$/i.exec(t);
    if (emp && !r.employer) { r.employer = emp[1].replace(DOC_ID, "").trim().slice(0, 160); r.evidence.employer = ev(l); continue; }
    const wk = /^(?:\d+\s*[-.]\s*)?Nome do Trabalhador\s*:?\s*(.+)$/i.exec(t);
    if (wk && !r.worker) { r.worker = wk[1].trim().slice(0, 160); r.evidence.worker = ev(l); continue; }
    const m = RANGE.exec(t);
    if (!m) { if (last && (section === "profissiografia" || section === "lotacao")) last.text = `${last.text} ${t}`.slice(0, 1200); continue; }
    const start = civil(m[1]), end = civil(m[2]) ?? null;
    if (!start || (end && end < start)) { r.unread.push(ev(l)); continue; }
    const rest = m[3].trim();
    if (section === "lotacao") { last = { start, end, text: rest.replace(DOC_ID, "").trim() } as (typeof roles)[number]; roles.push(last as (typeof roles)[number]); }
    else if (section === "profissiografia") { last = { start, end, text: rest } as (typeof acts)[number]; acts.push(last as (typeof acts)[number]); }
    else if (section === "responsavel") r.responsible.push({ start, end, evidence: ev(l) });
    else if (section === "exposicao") {
      const it = INTENSITY.exec(rest);
      const yn = [...rest.matchAll(/\b(S|N|Sim|N[aã]o)\b/gi)].map((x) => x[1][0].toUpperCase());
      const name = clean(rest.replace(/^(?:F|Q|B|E|M|F[ií]sico|Qu[ií]mico|Biol[oó]gico)\b\s*/i, "").split(INTENSITY)[0].replace(/\b(?:S|N)\b.*$/, "")).slice(0, 120);
      const kind = /ru[ií]do/i.test(rest) ? "ruido" : BIO.test(rest) || /^B\b/.test(rest) ? "biologico" : CHEM.test(rest) || /^Q\b/.test(rest) ? "quimico" : "fisico_outro";
      const technique = /\b(NHO[- ]?\d+|NR[- ]?15|dosimetria|decibel[ií]metro|qualitativ[ao]|quantitativ[ao])\b/i.exec(rest)?.[1] ?? "";
      const epi = yn.length >= 1 ? yn[yn.length - 1] : null;
      r.periods.push({
        id: `ppp-${r.periods.length + 1}`, start, end, employer: r.employer ?? "", role: "", activities: "",
        agents: [{ kind, name: name || (kind === "ruido" ? "Ruído" : ""), intensity: it ? Number(it[1].replace(",", ".")) : null, unit: it ? it[2].replace(/\s+/g, "") : "", technique, carcinogenic: kind === "quimico" && CARCINOGEN.test(rest) }],
        epiEffective: epi === "S" ? "sim" : epi === "N" ? "nao" : "nao_informado", technicalResponsible: false, signed: false, categoryClaim: null,
        evidence: ev(l),
      } as PppInput & { evidence: Evidence });
    } else r.unread.push(ev(l));
  }
  const covers = (p: { start: CivilDate; end: CivilDate | null }, d: CivilDate) => p.start <= d && (!p.end || p.end >= d);
  for (const p of r.periods) {
    p.role = roles.find((x) => covers(x, p.start!))?.text ?? "";
    p.activities = acts.find((x) => covers(x, p.start!))?.text ?? "";
    p.technicalResponsible = r.responsible.some((x) => covers(x, p.start!));
  }
  return r;
}

// ---------- Comparação CNIS × CTPS ----------
export interface BondLike { id: string; origin: string; originId: string | null; start: CivilDate | null; end: CivilDate | null }
export type CompareKind = "confere" | "datas_divergentes" | "so_cnis" | "so_ctps";
export interface CompareRow<B extends BondLike = BondLike> { kind: CompareKind; cnis?: B; ctps?: B; detail: string }
const root = (id: string | null) => (id ? id.replace(/\D/g, "").slice(0, 8) : "");
const words = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\b(LTDA|ME|EPP|EIRELI|S\/?A|CIA|COMERCIO|INDUSTRIA|DE|DA|DO|E|EMPREGADO)\b/g, " ").split(/[^A-Z0-9]+/).filter((w) => w.length > 2);
const sameName = (a: string, b: string) => { const x = new Set(words(a)); const y = words(b); return y.filter((w) => x.has(w)).length >= Math.min(2, y.length, x.size) && y.length > 0; };
const br = (d: CivilDate | null) => (d ? d.split("-").reverse().join("/") : "sem data");
const diffDays = (a: CivilDate, b: CivilDate) => Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000;
export function compareCnisCtps<B extends BondLike>(cnis: B[], ctps: B[]): CompareRow<B>[] {
  const used = new Set<string>();
  const out: CompareRow<B>[] = [];
  for (const c of cnis) {
    const cands = ctps.filter((t) => !used.has(t.id) && ((root(c.originId) && root(c.originId) === root(t.originId)) || sameName(c.origin, t.origin)));
    // Entre vários contratos do mesmo empregador, o de admissão mais próxima.
    const t = cands.sort((a, b) => (a.start && c.start ? diffDays(a.start, c.start) : 9e9) - (b.start && c.start ? diffDays(b.start, c.start) : 9e9))[0];
    if (!t) { out.push({ kind: "so_cnis", cnis: c, detail: `${c.origin}: está no CNIS e não foi encontrado na CTPS lida.` }); continue; }
    used.add(t.id);
    const notes: string[] = [];
    if (c.start !== t.start) notes.push(`início CNIS ${br(c.start)} × CTPS ${br(t.start)}`);
    if (c.end !== t.end) notes.push(!c.end ? `CNIS sem data de fim; CTPS registra ${br(t.end)}` : !t.end ? `CTPS sem desligamento; CNIS registra fim em ${br(c.end)}` : `fim CNIS ${br(c.end)} × CTPS ${br(t.end)}`);
    out.push(notes.length ? { kind: "datas_divergentes", cnis: c, ctps: t, detail: `${c.origin}: ${notes.join("; ")}.` } : { kind: "confere", cnis: c, ctps: t, detail: `${c.origin}: datas iguais no CNIS e na CTPS.` });
  }
  for (const t of ctps) if (!used.has(t.id)) out.push({ kind: "so_ctps", ctps: t, detail: `${t.origin}: está na CTPS e não aparece no CNIS (pode exigir acerto de vínculo no INSS).` });
  return out;
}
