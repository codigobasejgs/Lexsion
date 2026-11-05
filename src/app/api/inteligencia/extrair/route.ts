import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/env";
import { MIN_CHARS_PER_PAGE, PDF_MAX_BYTES, pdfLines } from "@/lib/pdf-text";
import { parseCnis } from "@/domain/pension/cnis-parser";
import { parseCtps, parsePpp } from "@/domain/pension/readers";
import { RULES_VERSION } from "@/domain/pension/rules";

// Leitura de CNIS, CTPS Digital e PPP do PRÓPRIO escritório. Tudo com a sessão do usuário: a RLS do banco e do Storage
// decide se o documento é dele (nada de chave de serviço aqui). Leitura determinística no servidor; o conteúdo não vai
// para log, IA nem terceiros. PDF sem texto (escaneado/foto) exige OCR, hoje BLOQUEADO até o faturamento do provedor
// de IA ser confirmado: a resposta diz isso e não simula leitura.
export const maxDuration = 60;
const err = (status: number, code: string, message: string) => NextResponse.json({ ok: false, error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
const ROLES = ["admin", "tenant_admin", "advogado", "estagiario"];
const KINDS = { CNIS: parseCnis, CTPS: parseCtps, PPP: parsePpp } as const;
export type ExtractKind = keyof typeof KINDS;

export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) return err(503, "not_configured", "Leitura indisponível neste ambiente.");
  if (req.headers.get("origin") && new URL(req.headers.get("origin")!).host !== req.headers.get("host")) return err(403, "origin", "Origem não permitida.");
  const b = (await req.json().catch(() => null)) as { organizationId?: string; documentId?: string; fileId?: string; kind?: string } | null;
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
  if (f.mime !== "application/pdf") return err(422, "needs_ocr", "Arquivo de imagem: a leitura automática exige OCR, que está desativado até a confirmação do faturamento do provedor de IA. Envie o PDF baixado do Meu INSS/CTPS Digital ou cadastre os períodos manualmente.");
  if ((f.size ?? 0) > PDF_MAX_BYTES) return err(413, "too_big", "Arquivo maior que 15 MB.");

  const { data: blob, error } = await sb.storage.from("documentos").download(f.path);
  if (error || !blob) return err(404, "not_found", "Arquivo não encontrado no armazenamento.");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") return err(422, "not_pdf", "O arquivo não é um PDF válido.");

  let text;
  try { text = await pdfLines(bytes); }
  catch (e) {
    const pw = /password/i.test(String((e as Error)?.name ?? "") + String((e as Error)?.message ?? ""));
    return err(422, pw ? "encrypted" : "unreadable", pw ? "PDF protegido por senha: envie uma versão sem senha." : "Não foi possível ler este PDF (arquivo danificado ou fora do padrão).");
  }
  if (text.textChars < MIN_CHARS_PER_PAGE * Math.max(1, Math.min(text.pages, 3))) {
    return err(422, "needs_ocr", "Documento sem texto (escaneado ou foto). A leitura por OCR está desativada até a confirmação do faturamento do provedor de IA; nada foi inventado. Envie o PDF original do Meu INSS/CTPS Digital ou cadastre os períodos manualmente.");
  }
  const reading = KINDS[kind](text.lines);
  return NextResponse.json({ ok: true, data: { kind, documentId: docId, fileId, fileName: f.name ?? "", pages: text.pages, truncated: text.pages > 80, rulesVersion: RULES_VERSION, readAt: new Date().toISOString(), reading } }, { headers: { "Cache-Control": "no-store" } });
}
