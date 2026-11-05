import "server-only";
import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { parseCsv } from "@/domain/csv";
import { classifyAreas } from "@/lib/legal-intel/classify";

// Coleta de FONTES OFICIAIS abertas, sem custo: séries do BCB (índices e salário mínimo) e precedentes
// qualificados do STJ (CC-BY). Idempotente (upsert por chave natural + hash). Nada de raspagem de página.
const SGS: Record<string, number> = { inpc: 188, ipca: 433, ipcae: 10764, igpm: 189, igpdi: 190, selic: 4390, tr: 7811, taxaLegal: 29543, salarioMinimo: 1619 };
const STJ_TEMAS = "https://dadosabertos.web.stj.jus.br/dataset/4238da2f-c07b-4c1a-b345-4402accacdcf/resource/df29da13-7d6b-41ba-ad96-cd1a5bbd191c/download/temas.csv";

async function get(url: string, ms = 60_000) {
  let last = "";
  for (let i = 0; i < 3; i++) {
    const r = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { "User-Agent": "LexSion/1.0 (+https://lexsion.com.br)" } }).catch((e: Error) => { last = e.message; return null; });
    if (r?.ok) return r;
    last = r ? `HTTP ${r.status}` : last;
    await new Promise((s) => setTimeout(s, 1500 * (i + 1)));
  }
  throw new Error(`${new URL(url).host}: ${last}`);
}

/** Últimos 24 meses de cada série (correções retroativas do BCB também entram). */
export async function syncBcb() {
  const db = supabaseAdmin();
  const errors: string[] = [];
  let rows = 0;
  // Janela por data: a API recusa "ultimos/N" acima de 20 (HTTP 400). Datas no formato dd/mm/aaaa, ordem crescente.
  const br = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
  const now = new Date(), from = new Date(Date.UTC(now.getUTCFullYear() - 2, now.getUTCMonth(), 1));
  // Em paralelo: a API do BCB demora para aceitar conexões; em série estouraria o tempo da função.
  await Promise.all(Object.entries(SGS).map(async ([series, code]) => {
    try {
      const data = (await (await get(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados?formato=json&dataInicial=${br(from)}&dataFinal=${br(now)}`)).json()) as { data: string; valor: string }[];
      const up = data.filter((d) => /^\d{2}\/\d{2}\/\d{4}$/.test(d.data) && Number.isFinite(Number(d.valor))).map((d) => ({ series, month: `${d.data.slice(6, 10)}-${d.data.slice(3, 5)}`, value: Number(d.valor), source_url: `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados?formato=json`, fetched_at: new Date().toISOString() }));
      // Séries diárias (taxa legal) trazem várias datas por mês: fica a última publicada no mês.
      const byMonth = new Map(up.map((u) => [u.month, u]));
      if (byMonth.size) { await db.from("official_series").upsert([...byMonth.values()], { onConflict: "series,month" }).throwOnError(); rows += byMonth.size; }
    } catch (e) { errors.push(`${series}: ${(e as Error).message}`); }
  }));
  return { rows, errors };
}

const hash = (s: string) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 32);
const date = (s: string) => (/^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null);
/** Precedentes qualificados do STJ (CSV oficial, ~2,6 MB). Grava só o que mudou. */
export async function syncStj() {
  const db = supabaseAdmin();
  const text = await (await get(STJ_TEMAS, 120_000)).text();
  const [h, ...rows] = parseCsv(text);
  const ix = (k: string) => h.indexOf(k);
  if (ix("sequencialPrecedente") < 0 || ix("teseFirmada") < 0) throw new Error("STJ: formato do CSV mudou");
  // Paginado: a API devolve no máximo 1.000 linhas por consulta.
  const prev = new Map<string, string>();
  for (let from = 0; ; from += 1000) {
    const { data } = await db.from("legal_precedents").select("id,content_hash").eq("court", "STJ").order("id").range(from, from + 999).throwOnError();
    for (const k of data ?? []) prev.set(k.id, k.content_hash);
    if (!data || data.length < 1000) break;
  }
  const items = rows.filter((r) => r[ix("numeroPrecedente")]).map((r) => {
    const kind = r[ix("tipoPrecedente")] || "Precedente", number = r[ix("numeroPrecedente")];
    const id = `stj-${kind.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "")}-${number}-${r[ix("sequencialPrecedente")]}`;
    const question = r[ix("questaoSubmetidaAJulgamento")].trim(), thesis = r[ix("teseFirmada")].trim(), subjects = r[ix("Assuntos")].trim(), legislation = r[ix("referenciaLegislativa")].trim();
    const situation = r[ix("situacao")].trim();
    const content_hash = hash([situation, question, thesis, subjects, legislation, r[ix("dataJulgamento")]].join("|"));
    const url = kind === "Tema" ? `https://processo.stj.jus.br/repetitivos/temas_repetitivos/pesquisa.jsp?novaConsulta=true&tipo_pesquisa=T&cod_tema_inicial=${encodeURIComponent(number)}&cod_tema_final=${encodeURIComponent(number)}` : "https://processo.stj.jus.br/repetitivos/temas_repetitivos/";
    return { id, court: "STJ", kind, number, situation, question, thesis, subjects, legislation, judged_on: date(r[ix("dataJulgamento")]), published_on: date(r[ix("dataPublicacaoAcordao")]), areas: classifyAreas(`${question} ${thesis} ${subjects} ${legislation}`), official_url: url, source_dataset: "dadosabertos.web.stj.jus.br/precedentes-qualificados", content_hash, fetched_at: new Date().toISOString() };
  });
  // O CSV pode repetir a mesma linha (mesmo sequencial): fica a última ocorrência.
  const unique = [...new Map(items.map((i) => [i.id, i])).values()];
  const changed = unique.filter((i) => prev.get(i.id) !== i.content_hash);
  for (let i = 0; i < changed.length; i += 300) await db.from("legal_precedents").upsert(changed.slice(i, i + 300), { onConflict: "id" }).throwOnError();
  return { total: unique.length, changed: changed.length };
}

/** Executa as duas coletas e registra no painel de fontes (mesmo formato das fontes legislativas). */
export async function syncOfficial(trigger: "cron" | "manual") {
  const db = supabaseAdmin();
  const out: Record<string, unknown> = {};
  for (const [id, fn] of [["bcb-sgs", syncBcb], ["stj-precedentes", syncStj]] as const) {
    const t0 = Date.now();
    const { data: run } = await db.from("source_sync_runs").insert({ provider_id: id, trigger }).select("id").single();
    const { data: prov } = await db.from("legal_source_providers").select("consecutive_failures").eq("id", id).single();
    try {
      const r = (await fn()) as { rows?: number; errors?: string[]; total?: number; changed?: number };
      const status = r.errors?.length ? (r.rows ? "parcial" : "erro") : "ok";
      await db.from("source_sync_runs").update({ finished_at: new Date().toISOString(), status, items_seen: r.rows ?? r.total ?? 0, items_changed: r.changed ?? 0, latency_ms: Date.now() - t0, error: r.errors?.slice(0, 3).join(" | ") || null }).eq("id", run!.id);
      await db.from("legal_source_providers").update({ last_run_at: new Date().toISOString(), ...(status !== "erro" ? { last_success_at: new Date().toISOString(), last_error: null, consecutive_failures: 0 } : { last_error: r.errors?.[0] ?? "erro", consecutive_failures: (prov?.consecutive_failures ?? 0) + 1 }) }).eq("id", id);
      out[id] = { status, ...r };
    } catch (e) {
      const msg = (e as Error).message.slice(0, 300);
      await db.from("source_sync_runs").update({ finished_at: new Date().toISOString(), status: "erro", latency_ms: Date.now() - t0, error: msg }).eq("id", run!.id);
      await db.from("legal_source_providers").update({ last_run_at: new Date().toISOString(), last_error: msg, consecutive_failures: (prov?.consecutive_failures ?? 0) + 1 }).eq("id", id);
      out[id] = { status: "erro", error: msg };
    }
  }
  return out;
}
