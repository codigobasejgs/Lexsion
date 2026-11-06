import "server-only";

// DataJud (CNJ), API pública: consulta PONTUAL de metadados de UM processo pelo número CNJ, para uso de trabalho do
// escritório (decisão do proprietário em 06/11/2026; termo de uso v1.2 do CNJ, itens 3.3 e 3.8). Sem busca em massa,
// sem revenda, sem partes nem documentos (a API pública não os traz). A chave fica só no servidor.
const BASE = "https://api-publica.datajud.cnj.jus.br";
export const DATAJUD_TERMS = "https://datajud-wiki.cnj.jus.br/api-publica/termo-uso";

/** J.TR do número CNJ (NNNNNNN-DD.AAAA.J.TR.OOOO) → alias do índice oficial (lista em datajud-wiki/endpoints). */
const TJ = ["", "tjac", "tjal", "tjap", "tjam", "tjba", "tjce", "tjdft", "tjes", "tjgo", "tjma", "tjmt", "tjms", "tjmg", "tjpa", "tjpb", "tjpr", "tjpe", "tjpi", "tjrj", "tjrn", "tjrs", "tjro", "tjrr", "tjsc", "tjse", "tjsp", "tjto"];
const TRE = TJ.map((x) => (x ? `tre-${x.slice(2) === "dft" ? "dft" : x.slice(2)}` : ""));
const TJM: Record<number, string> = { 13: "tjmmg", 21: "tjmrs", 26: "tjmsp" };

export function parseCnj(input: string) {
  const d = input.replace(/\D/g, "");
  if (d.length !== 20) return null;
  const [n, dv, ano, j, tr, orig] = [d.slice(0, 7), d.slice(7, 9), d.slice(9, 13), d.slice(13, 14), d.slice(14, 16), d.slice(16, 20)];
  // Dígito verificador (Res. CNJ 65/2008, módulo 97).
  const check = 98 - Number(BigInt(`${n}${ano}${j}${tr}${orig}00`) % BigInt(97));
  if (check !== Number(dv)) return null;
  return { digits: d, formatted: `${n}-${dv}.${ano}.${j}.${tr}.${orig}`, j: Number(j), tr: Number(tr) };
}

export function aliasFor(j: number, tr: number): string | null {
  if (j === 3) return "stj";
  if (j === 4) return tr >= 1 && tr <= 6 ? `trf${tr}` : null;
  if (j === 5) return tr === 0 ? "tst" : tr >= 1 && tr <= 24 ? `trt${tr}` : null;
  if (j === 6) return tr === 0 ? "tse" : TRE[tr] || null;
  if (j === 7) return tr === 0 ? "stm" : null;
  if (j === 8) return TJ[tr] || null;
  if (j === 9) return TJM[tr] ?? null;
  return null; // STF (1) e CNJ (2) não estão na API pública
}

export interface DatajudProcess {
  numero: string; tribunal: string; grau: string | null; classe: string | null; sistema: string | null; formato: string | null;
  orgaoJulgador: string | null; ajuizamento: string | null; ultimaAtualizacao: string | null; nivelSigilo: number | null;
  assuntos: string[]; movimentos: { data: string; nome: string }[];
}
type Hit = { _source: Record<string, unknown> };
const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const isoFromDatajud = (v: unknown) => {
  const t = s(v);
  if (!t) return null;
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?/.exec(t);
  return m ? `${m[1]}-${m[2]}-${m[3]}${m[4] ? `T${m[4]}:${m[5] ?? "00"}:00` : ""}` : t.slice(0, 19);
};

export function normalize(hit: Hit, formatted: string): DatajudProcess {
  const x = hit._source;
  const nome = (o: unknown) => s((o as { nome?: unknown } | null)?.nome);
  const movs = Array.isArray(x.movimentos) ? (x.movimentos as { dataHora?: unknown; nome?: unknown }[]) : [];
  return {
    numero: formatted, tribunal: s(x.tribunal) ?? "", grau: s(x.grau), classe: nome(x.classe), sistema: nome(x.sistema), formato: nome(x.formato),
    orgaoJulgador: nome(x.orgaoJulgador), ajuizamento: isoFromDatajud(x.dataAjuizamento), ultimaAtualizacao: s(x.dataHoraUltimaAtualizacao),
    nivelSigilo: typeof x.nivelSigilo === "number" ? x.nivelSigilo : null,
    assuntos: (Array.isArray(x.assuntos) ? (x.assuntos as unknown[]) : []).flat().map(nome).filter((v): v is string => !!v).slice(0, 10),
    movimentos: movs.map((m) => ({ data: s(m.dataHora) ?? "", nome: s(m.nome) ?? "" })).filter((m) => m.data && m.nome).sort((a, b) => b.data.localeCompare(a.data)).slice(0, 30),
  };
}

/** Busca um processo. `fetcher` permite testar sem rede. */
export async function datajudLookup(cnj: string, fetcher: typeof fetch = fetch) {
  const p = parseCnj(cnj);
  if (!p) return { ok: false as const, code: "invalid", message: "Número CNJ inválido (confira os 20 dígitos e o dígito verificador)." };
  const alias = aliasFor(p.j, p.tr);
  if (!alias) return { ok: false as const, code: "unsupported", message: "Este tribunal não está na API pública do DataJud (ex.: STF)." };
  const key = process.env.DATAJUD_API_KEY ?? "";
  if (key.length < 20) return { ok: false as const, code: "not_configured", message: "DataJud não configurado." };
  const r = await fetcher(`${BASE}/api_publica_${alias}/_search`, {
    method: "POST", headers: { Authorization: `APIKey ${key}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({ size: 3, query: { match: { numeroProcesso: p.digits } }, _source: ["tribunal", "grau", "classe", "sistema", "formato", "orgaoJulgador", "dataAjuizamento", "dataHoraUltimaAtualizacao", "nivelSigilo", "assuntos", "movimentos.dataHora", "movimentos.nome"] }),
  }).catch(() => null);
  if (!r) return { ok: false as const, code: "unavailable", message: "O DataJud não respondeu. Tente de novo em instantes." };
  if (r.status === 401 || r.status === 403) return { ok: false as const, code: "key", message: "O CNJ recusou a chave do DataJud (pode ter sido trocada). Avise a administração." };
  if (!r.ok) return { ok: false as const, code: "unavailable", message: `O DataJud recusou a consulta (HTTP ${r.status}).` };
  const j = (await r.json().catch(() => null)) as { hits?: { hits?: Hit[] } } | null;
  const hits = (j?.hits?.hits ?? []).map((h) => normalize(h, p.formatted)).filter((h) => !h.nivelSigilo); // sigiloso nunca é exibido
  return { ok: true as const, alias, items: hits };
}
