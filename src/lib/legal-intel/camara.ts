import "server-only";
import crypto from "node:crypto";

// Conector da Câmara dos Deputados (API REST pública: https://dadosabertos.camara.leg.br/swagger/api.html).
// Descobre proposições com tramitação no período, lê a ficha oficial e normaliza. Sem raspagem de página.
const BASE = "https://dadosabertos.camara.leg.br/api/v2";
const ALLOW = /^https:\/\/dadosabertos\.camara\.leg\.br\/api\/v2\//; // allowlist contra SSRF
const TYPES = "PL,PLP,PEC,MPV,PDL";
const UA = "LexSion/1.0 (monitoramento juridico; contato nao-responda@lexsion.com.br)";

export interface NormalizedDoc {
  externalId: string;
  docKind: "proposicao" | "medida_provisoria";
  typeCode: string;
  number: string;
  title: string;
  ementa: string;
  organ: string;
  statusLabel: string;
  lastEvent: string;
  lastEventAt: string | null;
  officialUrl: string;
  publishedOn: string | null;
  contentHash: string;
  raw: Record<string, unknown>;
}

async function getJson<T>(url: string, attempt = 0): Promise<T> {
  if (!ALLOW.test(url)) throw new Error("URL fora da allowlist da Câmara");
  const r = await fetch(url, { headers: { accept: "application/json", "user-agent": UA }, signal: AbortSignal.timeout(20_000), cache: "no-store" }).catch((e: Error) => e);
  if (r instanceof Error) {
    // Falha de rede/tempo esgotado: mesma política de retry exponencial; depois disso o erro sobe e a execução registra.
    if (attempt < 3) { await new Promise((res) => setTimeout(res, 1000 * 2 ** attempt)); return getJson(url, attempt + 1); }
    throw new Error(`Câmara inacessível (${(r as Error & { cause?: { code?: string } }).cause?.code ?? r.name})`);
  }
  if ((r.status === 429 || r.status >= 500) && attempt < 3) {
    await new Promise((res) => setTimeout(res, 1000 * 2 ** attempt)); // retry exponencial
    return getJson(url, attempt + 1);
  }
  if (!r.ok) throw new Error(`Câmara respondeu HTTP ${r.status}`);
  const len = Number(r.headers.get("content-length") ?? 0);
  if (len > 5_000_000) throw new Error("resposta grande demais");
  return (await r.json()) as T;
}

type ListItem = { id: number; siglaTipo: string; numero: number; ano: number; ementa: string };
type Detail = { id: number; siglaTipo: string; numero: number; ano: number; ementa: string; ementaDetalhada?: string; dataApresentacao?: string; descricaoTipo?: string; urlInteiroTeor?: string | null; statusProposicao?: { dataHora?: string; siglaOrgao?: string; descricaoTramitacao?: string; descricaoSituacao?: string | null; despacho?: string } };

/** Lista ids com tramitação entre as datas (yyyy-mm-dd), paginando com limite. */
export async function discoverUpdates(from: string, to: string, maxItems = 300): Promise<number[]> {
  const ids: number[] = [];
  for (let p = 1; ids.length < maxItems && p <= 10; p++) {
    const j = await getJson<{ dados: ListItem[]; links: { rel: string }[] }>(`${BASE}/proposicoes?dataInicio=${from}&dataFim=${to}&siglaTipo=${TYPES}&ordem=DESC&ordenarPor=id&itens=100&pagina=${p}`);
    ids.push(...j.dados.map((d) => d.id));
    if (!j.links.some((l) => l.rel === "next")) break;
  }
  return [...new Set(ids)].slice(0, maxItems);
}

export async function fetchDocument(id: number): Promise<NormalizedDoc> {
  const d = (await getJson<{ dados: Detail }>(`${BASE}/proposicoes/${id}`)).dados;
  const s = d.statusProposicao ?? {};
  const statusLabel = [s.descricaoSituacao, s.siglaOrgao].filter(Boolean).join(" · ");
  const lastEvent = String(s.descricaoTramitacao ?? "").slice(0, 300);
  const lastEventAt = s.dataHora ? new Date(`${s.dataHora}:00-03:00`).toISOString() : null;
  const ementa = String(d.ementa ?? "").trim();
  // Hash só do que importa ao advogado: muda quando ementa, situação ou último ato mudam.
  const contentHash = crypto.createHash("sha256").update(JSON.stringify([ementa, statusLabel, lastEvent, s.dataHora ?? ""])).digest("hex");
  return {
    externalId: String(d.id), docKind: d.siglaTipo === "MPV" ? "medida_provisoria" : "proposicao", typeCode: d.siglaTipo, number: `${d.numero}/${d.ano}`,
    title: `${d.siglaTipo} ${d.numero}/${d.ano}`, ementa, organ: "Câmara dos Deputados", statusLabel, lastEvent, lastEventAt,
    officialUrl: `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${d.id}`,
    publishedOn: d.dataApresentacao ? d.dataApresentacao.slice(0, 10) : null, contentHash,
    raw: { id: d.id, siglaTipo: d.siglaTipo, numero: d.numero, ano: d.ano, descricaoTipo: d.descricaoTipo, urlInteiroTeor: d.urlInteiroTeor ?? null, status: s },
  };
}

export async function healthCheck(): Promise<boolean> {
  try { await getJson(`${BASE}/referencias/proposicoes/siglaTipo`); return true; } catch { return false; }
}
