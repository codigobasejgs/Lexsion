import { NextResponse, type NextRequest } from "next/server";
import { PDFDocument } from "pdf-lib";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/env";
import { PDF_MAX_BYTES, pdfLines } from "@/lib/pdf-text";
import { ocrPages, OCR_MODEL, OCR_VERSION } from "@/lib/ocr";
import { parseCnis, type PdfLine } from "@/domain/pension/cnis-parser";
import { parseCtps, parsePpp } from "@/domain/pension/readers";
import { RULES_VERSION } from "@/domain/pension/rules";

// Leitura de CNIS, CTPS Digital e PPP do PRÓPRIO escritório. O documento é localizado com a sessão do usuário (RLS do
// banco e do Storage decidem se é dele). Texto nativo do PDF é lido no servidor, sem custo. Páginas sem texto
// (escaneadas) e fotos só vão ao OCR do Gemini com PEDIDO EXPLÍCITO (ocr: true), depois das travas de custo no banco:
// OCR ligado + faturamento confirmado + limites do escritório e da plataforma. Conteúdo nunca vai para log.
export const maxDuration = 60;
const err = (status: number, code: string, message: string, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, error: { code, message, ...extra } }, { status, headers: { "Cache-Control": "no-store" } });
const ROLES = ["admin", "tenant_admin", "advogado", "estagiario"];
const KINDS = { CNIS: parseCnis, CTPS: parseCtps, PPP: parsePpp } as const;
const IMAGES = ["image/jpeg", "image/png"];
export type ExtractKind = keyof typeof KINDS;

/** Foto (JPG/PNG) vira PDF de uma página para seguir o mesmo caminho do OCR. */
async function imageToPdf(bytes: Uint8Array, mime: string) {
  const pdf = await PDFDocument.create();
  const img = mime === "image/png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  const page = pdf.addPage([img.width, img.height]);
  page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  return new Uint8Array(await pdf.save());
}

export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) return err(503, "not_configured", "Leitura indisponível neste ambiente.");
  if (req.headers.get("origin") && new URL(req.headers.get("origin")!).host !== req.headers.get("host")) return err(403, "origin", "Origem não permitida.");
  const b = (await req.json().catch(() => null)) as { organizationId?: string; documentId?: string; fileId?: string; kind?: string; ocr?: boolean } | null;
  const org = String(b?.organizationId ?? ""), docId = String(b?.documentId ?? ""), kind = String(b?.kind ?? "") as ExtractKind;
  if (!/^[0-9a-f-]{36}$/.test(org) || !docId || docId.length > 80 || !(kind in KINDS)) return err(400, "invalid", "Pedido inválido.");
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return err(401, "unauthenticated", "Sessão expirada. Entre novamente.");
  const { data: can } = await sb.rpc("has_role", { org, roles: ROLES });
  if (can !== true) return err(403, "forbidden", "Seu perfil não faz análises previdenciárias.");

  const { data: doc } = await sb.from("org_records").select("data").eq("organization_id", org).eq("collection", "documents").eq("id", docId).maybeSingle();
  if (!doc) return err(404, "not_found", "Documento não encontrado neste escritório.");
  const versions = ((doc.data as { versions?: { fileId?: string }[] }).versions ?? []).filter((v) => v.fileId);
  const fileId = b?.fileId && versions.some((v) => v.fileId === b.fileId) ? b.fileId : versions.at(-1)?.fileId;
  if (!fileId) return err(409, "no_file", "Este documento ainda não tem arquivo enviado.");
  const { data: file } = await sb.from("org_records").select("data").eq("organization_id", org).eq("collection", "files").eq("id", fileId).maybeSingle();
  const f = file?.data as { path?: string; mime?: string; size?: number; name?: string } | undefined;
  if (!f?.path || !f.path.startsWith(`${org}/`)) return err(404, "not_found", "Arquivo não encontrado.");
  if (f.mime !== "application/pdf" && !IMAGES.includes(f.mime ?? "")) return err(422, "unsupported", "Formato não lido automaticamente: envie PDF, JPG ou PNG.");
  if ((f.size ?? 0) > PDF_MAX_BYTES) return err(413, "too_big", "Arquivo maior que 15 MB.");

  const { data: blob, error } = await sb.storage.from("documentos").download(f.path);
  if (error || !blob) return err(404, "not_found", "Arquivo não encontrado no armazenamento.");
  let bytes = new Uint8Array(await blob.arrayBuffer());
  const isImage = IMAGES.includes(f.mime ?? "");
  if (isImage) {
    try { bytes = await imageToPdf(bytes, f.mime!); } catch { return err(422, "unreadable", "Não foi possível abrir a imagem."); }
  } else if (String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") return err(422, "not_pdf", "O arquivo não é um PDF válido.");

  let text: Awaited<ReturnType<typeof pdfLines>>;
  try { text = await pdfLines(bytes); }
  catch (e) {
    const pw = /password/i.test(String((e as Error)?.name ?? "") + String((e as Error)?.message ?? ""));
    return err(422, pw ? "encrypted" : "unreadable", pw ? "PDF protegido por senha: envie uma versão sem senha." : "Não foi possível ler este PDF (arquivo danificado ou fora do padrão).");
  }
  let lines: PdfLine[] = text.lines;
  let ocr: { pages: number[]; cached: boolean; model: string; version: string; costUsd?: number } | null = null;
  if (text.noTextPages.length) {
    // Sem pedido explícito, nada é enviado ao provedor (nem gera custo): a tela pergunta antes.
    if (!b?.ocr) return err(422, "needs_ocr", `${text.noTextPages.length} página(s) sem texto (escaneada ou foto). Para ler, confirme a leitura por IA.`, { pages: text.noTextPages.length, total: text.pages });
    const r = await ocrPages({ org, actor: auth.user.id, documentId: docId, bytes, pages: text.noTextPages });
    if (!r.ok) return err(r.reason === "provedor" ? 502 : 429, r.reason, r.message);
    lines = [...text.lines, ...r.lines].sort((x, y) => x.page - y.page);
    ocr = { pages: r.pages, cached: r.cached, model: OCR_MODEL, version: OCR_VERSION, costUsd: r.usage?.costUsd };
    // Auditoria: quem pediu a leitura por IA de qual documento (sem conteúdo).
    await sb.from("audit_logs").insert({ organization_id: org, actor_id: auth.user.id, action: "documento.ocr", entity: "documents", entity_id: docId, detail: `${r.pages.length} página(s) por IA (${OCR_MODEL}, ${OCR_VERSION})${r.cached ? " — resultado reaproveitado, sem custo" : ""}` });
  }
  const reading = KINDS[kind](lines);
  return NextResponse.json({ ok: true, data: { kind, documentId: docId, fileId, fileName: f.name ?? "", pages: text.pages, truncated: text.pages > 80, rulesVersion: RULES_VERSION, readAt: new Date().toISOString(), reading, ocr } }, { headers: { "Cache-Control": "no-store" } });
}
