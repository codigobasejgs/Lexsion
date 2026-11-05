import "server-only";
import crypto from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { officeSecret } from "@/lib/credentials";
import type { PdfLine } from "@/domain/pension/cnis-parser";

// OCR de páginas escaneadas pelo Gemini, com controle de custo:
//  * só as páginas SEM texto vão ao provedor (o resto já foi lido localmente pelo pdfjs, sem custo);
//  * modelo econômico (Flash-Lite), saída só com o texto da página, sem "thinking";
//  * resultado em cache por escritório + SHA-256 do arquivo + versão: o mesmo documento não é cobrado de novo;
//  * reserva atômica no banco (ai_reserve) ANTES da chamada e acerto com os tokens reais (ai_settle);
//  * nenhum conteúdo vai para log ou para ai_usage (só números e o id do documento).
export const OCR_VERSION = "ocr-v1";
export const OCR_MODEL = process.env.GEMINI_OCR_MODEL ?? "gemini-2.5-flash-lite";
export const OCR_MAX_PAGES = 30; // por documento
const BASE = /^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.GEMINI_API_BASE ?? "") ? process.env.GEMINI_API_BASE! : "https://generativelanguage.googleapis.com";
// Documentação oficial: cada página de PDF ≈ 258 tokens de imagem. Estimativa conservadora para a reserva.
const EST_IN_PER_PAGE = 258 + 120, EST_OUT_PER_PAGE = 1200;

export type OcrResult = { ok: true; lines: PdfLine[]; cached: boolean; pages: number[]; usage?: { input: number; output: number; costUsd: number; latencyMs: number } } | { ok: false; reason: string; message: string };

const PROMPT = "Transcreva fielmente TODO o texto visível desta página de documento previdenciário brasileiro (CNIS, CTPS ou PPP), linha por linha, na ordem de leitura. Preserve números, datas (dd/mm/aaaa), CNPJ, NIT e valores exatamente como aparecem. Em tabelas, coloque cada linha da tabela em uma linha, com as colunas separadas por espaço. Não resuma, não corrija, não complete, não comente. Se um trecho for ilegível, escreva [ilegível].";

const MESSAGES: Record<string, string> = {
  ocr_bloqueado: "Leitura de documento escaneado desativada: o faturamento do Google ainda não foi confirmado pela administração da plataforma.",
  teto_plataforma: "Limite mensal de gasto com leitura por IA da plataforma atingido. Tente no próximo mês ou fale com o suporte.",
  teto_paginas_plataforma: "Limite mensal de páginas da plataforma atingido.",
  limite_dia: "Limite diário de páginas lidas por IA do seu escritório atingido. Tente amanhã.",
  limite_mes: "Limite mensal de páginas lidas por IA do seu escritório atingido.",
  sem_orcamento: "Orçamento de IA não configurado na plataforma.",
  sem_chave: "Chave do Gemini não configurada.",
  muitas_paginas: `Documento com mais de ${OCR_MAX_PAGES} páginas escaneadas: divida o arquivo.`,
  provedor: "O Google não conseguiu ler o documento agora. Nada foi cobrado. Tente de novo em instantes.",
};
export const ocrMessage = (reason: string) => MESSAGES[reason] ?? MESSAGES.provedor;

/** Custo estimado (US$) para reservar, pelo preço oficial do modelo no banco. */
async function estimate(pages: number) {
  const { data } = await supabaseAdmin().rpc("ai_price", { p_model: OCR_MODEL }).maybeSingle();
  const p = data as { input_per_mtok: number; output_per_mtok: number } | null;
  return p ? (pages * EST_IN_PER_PAGE * Number(p.input_per_mtok) + pages * EST_OUT_PER_PAGE * Number(p.output_per_mtok)) / 1e6 : 0.01 * pages;
}

/** Chamada ao Gemini com um PDF de UMA página. Devolve texto e tokens reais (usageMetadata). */
export async function geminiPage(key: string, pdfPage: Uint8Array): Promise<{ text: string; input: number; output: number } | null> {
  const r = await fetch(`${BASE}/v1beta/models/${OCR_MODEL}:generateContent`, {
    method: "POST", headers: { "x-goog-api-key": key, "Content-Type": "application/json" }, signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ inline_data: { mime_type: "application/pdf", data: Buffer.from(pdfPage).toString("base64") } }, { text: PROMPT }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 4096, thinkingConfig: { thinkingBudget: 0 } },
    }),
  }).catch(() => null);
  if (!r?.ok) return null;
  const j = (await r.json().catch(() => null)) as { candidates?: { content?: { parts?: { text?: string }[] } }[]; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number } } | null;
  const text = j?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!j?.usageMetadata) return null;
  return { text, input: j.usageMetadata.promptTokenCount ?? 0, output: (j.usageMetadata.candidatesTokenCount ?? 0) + (j.usageMetadata.thoughtsTokenCount ?? 0) };
}

/**
 * OCR das páginas indicadas (1-based). `nativeLines` = linhas já lidas localmente das outras páginas.
 * Ordem: cache → reserva → chamada por página → acerto → cache. Qualquer falha devolve motivo e não cobra.
 */
export async function ocrPages(opts: { org: string; actor: string | null; documentId: string; bytes: Uint8Array; pages: number[]; call?: typeof geminiPage }): Promise<OcrResult> {
  const db = supabaseAdmin();
  const sha = crypto.createHash("sha256").update(opts.bytes).digest("hex");
  const { data: hit } = await db.from("ocr_cache").select("lines,ocr_pages").eq("organization_id", opts.org).eq("file_sha256", sha).eq("processing_version", OCR_VERSION).maybeSingle();
  if (hit) {
    await db.from("ai_usage").insert({ organization_id: opts.org, actor_id: opts.actor, purpose: "ocr", module: "ocr", model: OCR_MODEL, input_chars: 0, output_chars: 0, pages: 0, cost_usd: 0, estimated: false, status: "cache", processing_version: OCR_VERSION, document_ref: opts.documentId });
    return { ok: true, lines: hit.lines as PdfLine[], cached: true, pages: hit.ocr_pages as number[] };
  }
  if (!opts.pages.length) return { ok: true, lines: [], cached: false, pages: [] };
  if (opts.pages.length > OCR_MAX_PAGES) return { ok: false, reason: "muitas_paginas", message: ocrMessage("muitas_paginas") };
  const own = await officeSecret(opts.org, "gemini").catch(() => null);
  const key = own ?? process.env.GEMINI_API_KEY ?? "";
  if (key.length < 20) return { ok: false, reason: "sem_chave", message: ocrMessage("sem_chave") };
  const est = await estimate(opts.pages.length);
  const { data: res, error: rerr } = await db.rpc("ai_reserve", { p_org: opts.org, p_module: "ocr", p_purpose: "ocr", p_model: OCR_MODEL, p_pages: opts.pages.length, p_est_usd: est, p_version: OCR_VERSION, p_doc: opts.documentId, p_actor: opts.actor, p_key_owner: own ? "escritorio" : "plataforma" });
  if (rerr) throw new Error(`reserva de IA falhou (${rerr.code})`); // erro de banco: não chama o provedor
  const rv = res as { ok: boolean; id?: number; reason?: string } | null;
  if (!rv?.ok) return { ok: false, reason: rv?.reason ?? "provedor", message: ocrMessage(rv?.reason ?? "provedor") };

  const t0 = Date.now();
  const src = await PDFDocument.load(opts.bytes, { ignoreEncryption: false });
  const lines: PdfLine[] = [];
  let input = 0, output = 0;
  for (const n of opts.pages) {
    const one = await PDFDocument.create();
    const [pg] = await one.copyPages(src, [n - 1]);
    one.addPage(pg);
    const out = await (opts.call ?? geminiPage)(key, await one.save());
    if (!out) { await db.rpc("ai_settle", { p_id: rv.id, p_ok: false, p_in: null, p_out: null, p_latency: Date.now() - t0 }); return { ok: false, reason: "provedor", message: ocrMessage("provedor") }; }
    input += out.input; output += out.output;
    for (const l of out.text.split(/\r?\n/)) if (l.trim()) lines.push({ page: n, text: l.trim() });
  }
  const latencyMs = Date.now() - t0;
  const { data: cost } = await db.rpc("ai_settle", { p_id: rv.id, p_ok: true, p_in: input, p_out: output, p_latency: latencyMs });
  await db.from("ocr_cache").upsert({ organization_id: opts.org, file_sha256: sha, processing_version: OCR_VERSION, model: OCR_MODEL, pages: opts.pages.length, ocr_pages: opts.pages, lines }, { onConflict: "organization_id,file_sha256,processing_version" });
  return { ok: true, lines, cached: false, pages: opts.pages, usage: { input, output, costUsd: Number(cost ?? 0), latencyMs } };
}
