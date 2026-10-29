import "server-only";
import crypto from "node:crypto";
import type { NormalizedDoc } from "./camara";

// Conector do Senado Federal (Dados Abertos, serviço "processo" — substituto oficial de materia/atualizadas):
// https://legis.senado.leg.br/dadosabertos/api-docs. Uma chamada lista as matérias atualizadas nos últimos N dias
// já com ementa e situação; sem raspagem de página. Fica só com proposições legislativas (sem requerimento/aviso).
const BASE = "https://legis.senado.leg.br/dadosabertos";
const ALLOW = /^https:\/\/legis\.senado\.leg\.br\/dadosabertos\//; // allowlist contra SSRF
const UA = "LexSion/1.0 (monitoramento juridico; contato nao-responda@lexsion.com.br)";
const KINDS = new Set(["Projeto de Lei Ordinária", "Projeto de Lei Complementar", "Proposta de Emenda à Constituição", "Medida Provisória", "Projeto de Decreto Legislativo"]);

export type SenadoItem = {
  id: number; codigoMateria?: number; identificacao?: string; tipoDocumento?: string; ementa?: string; casaIdentificadora?: string; autoria?: string;
  dataApresentacao?: string; situacaoAtual?: string; dataSituacaoAtual?: string; dataUltimaAtualizacao?: string; normaGerada?: string; tramitando?: string; ultimaInformacaoAtualizada?: string;
};

async function getJson<T>(url: string, attempt = 0): Promise<T> {
  if (!ALLOW.test(url)) throw new Error("URL fora da allowlist do Senado");
  const r = await fetch(url, { headers: { accept: "application/json", "user-agent": UA }, signal: AbortSignal.timeout(30_000), cache: "no-store" }).catch((e: Error) => e);
  if (r instanceof Error) {
    if (attempt < 3) { await new Promise((res) => setTimeout(res, 1000 * 2 ** attempt)); return getJson(url, attempt + 1); }
    throw new Error(`Senado inacessível (${(r as Error & { cause?: { code?: string } }).cause?.code ?? r.name})`);
  }
  if ((r.status === 429 || r.status >= 500) && attempt < 3) {
    await new Promise((res) => setTimeout(res, 2000 * 2 ** attempt)); // retry exponencial (o Senado limita por IP)
    return getJson(url, attempt + 1);
  }
  if (!r.ok) throw new Error(`Senado respondeu HTTP ${r.status}`);
  if (Number(r.headers.get("content-length") ?? 0) > 8_000_000) throw new Error("resposta grande demais");
  return (await r.json()) as T;
}

/** Proposição do Senado normalizada; null quando não é proposição legislativa ou é atualização só de arquivo antigo. */
export function normalizeSenado(p: SenadoItem, sinceDay: string): NormalizedDoc | null {
  if (!KINDS.has(p.tipoDocumento ?? "") || !p.codigoMateria || !p.identificacao) return null;
  // Matéria encerrada há tempos que só recebeu documento digitalizado não é novidade para o advogado.
  if (p.tramitando !== "Sim" && (p.dataSituacaoAtual ?? "") < sinceDay) return null;
  const [typeCode, number = ""] = p.identificacao.trim().split(/\s+/);
  const ementa = String(p.ementa ?? "").trim();
  const statusLabel = [p.situacaoAtual, p.normaGerada].filter(Boolean).join(" · ");
  // Hash só do que importa: ementa, situação (com data) e norma gerada. Documento anexado sem mudar situação não alerta.
  const contentHash = crypto.createHash("sha256").update(JSON.stringify([ementa, p.situacaoAtual ?? "", p.dataSituacaoAtual ?? "", p.normaGerada ?? ""])).digest("hex");
  return {
    externalId: String(p.codigoMateria), docKind: p.tipoDocumento === "Medida Provisória" ? "medida_provisoria" : "proposicao", typeCode, number,
    title: p.identificacao.trim(), ementa, organ: p.casaIdentificadora === "CN" ? "Congresso Nacional" : "Senado Federal",
    statusLabel, lastEvent: String(p.situacaoAtual ?? "").slice(0, 300),
    lastEventAt: p.dataUltimaAtualizacao ? new Date(`${p.dataUltimaAtualizacao.slice(0, 19)}-03:00`).toISOString() : null,
    officialUrl: `https://www25.senado.leg.br/web/atividade/materias/-/materia/${p.codigoMateria}`,
    publishedOn: p.dataApresentacao ? p.dataApresentacao.slice(0, 10) : null, contentHash,
    raw: { id: p.id, codigoMateria: p.codigoMateria, tipoDocumento: p.tipoDocumento, autoria: p.autoria ?? null, tramitando: p.tramitando ?? null, dataSituacaoAtual: p.dataSituacaoAtual ?? null, normaGerada: p.normaGerada ?? null },
  };
}

/** Matérias atualizadas desde `from` (yyyy-mm-dd). O serviço aceita no máximo 30 dias; usamos até 7. */
export async function collectSenado(from: string, maxItems: number): Promise<NormalizedDoc[]> {
  const days = Math.min(7, Math.max(1, Math.ceil((Date.now() - new Date(`${from}T00:00:00-03:00`).getTime()) / 86_400_000)));
  const list = await getJson<SenadoItem[]>(`${BASE}/processo?numdias=${days}&v=1`);
  if (!Array.isArray(list)) throw new Error("resposta do Senado fora do formato esperado");
  const seen = new Set<string>();
  const out: NormalizedDoc[] = [];
  for (const p of list) {
    const d = normalizeSenado(p, from);
    if (!d || seen.has(d.externalId)) continue;
    seen.add(d.externalId);
    out.push(d);
    if (out.length >= maxItems) break;
  }
  return out;
}
