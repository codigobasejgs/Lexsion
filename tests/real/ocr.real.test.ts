// OCR com controle de custo, contra o Supabase REAL do projeto e um provedor SIMULADO local (127.0.0.1): prova a
// reserva atômica, os limites, o acerto pelos tokens devolvidos, o cache e a auditoria SEM gastar nada no Google.
// Dados sintéticos (escritório QA criado e apagado). RUN_REAL=1.
import fs from "node:fs";
import http from "node:http";
import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
vi.mock("server-only", () => ({}));
if (fs.existsSync(".env.local")) for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const PORT = 48700 + Math.floor(Math.random() * 200);
process.env.GEMINI_API_BASE = `http://127.0.0.1:${PORT}`;
const ON = process.env.RUN_REAL === "1" && !!process.env.SUPABASE_SECRET_KEY;
const tag = crypto.randomBytes(3).toString("hex");
let server: http.Server;
const calls: { model: string; hasPdf: boolean; bytes: number }[] = [];
let mode: "ok" | "erro" = "ok";
let org = "";
let settingsBefore: Record<string, unknown> | null = null;

async function scannedPdf(pages: number, textPages: number[] = []) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i++) {
    const p = doc.addPage([595, 842]);
    if (textPages.includes(i)) p.drawText("1 123.45678.90-1 12.345.678/0001-90 EMPRESA ALFA LTDA Empregado 01/02/1990 30/06/1998 texto nativo", { x: 30, y: 800, size: 8, font });
    else p.drawRectangle({ x: 40, y: 700, width: 200, height: 40 }); // "imagem": sem texto
  }
  return new Uint8Array(await doc.save());
}

describe.runIf(ON)("OCR com controle de custo (real, provedor simulado)", () => {
  beforeAll(async () => {
    server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        const j = JSON.parse(body || "{}");
        const part = j.contents?.[0]?.parts?.find((x: { inline_data?: { data: string } }) => x.inline_data);
        calls.push({ model: req.url ?? "", hasPdf: !!part, bytes: part ? Buffer.from(part.inline_data.data, "base64").length : 0 });
        if (mode === "erro") { res.statusCode = 503; return res.end("{}"); }
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: "2 123.45678.90-1 98.765.432/0001-10 EMPRESA BETA ME Empregado 01/03/1999 31/12/2005" }] } }], usageMetadata: { promptTokenCount: 400, candidatesTokenCount: 60 } }));
      });
    });
    await new Promise<void>((r) => server.listen(PORT, "127.0.0.1", () => r()));
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const db = supabaseAdmin();
    settingsBefore = (await db.from("ai_settings").select("ocr_enabled,billing_confirmed_at,billing_note").single()).data;
    const { data } = await db.from("organizations").insert({ slug: `qa-ocr-${tag}`, name: `QA OCR ${tag}`, status: "trial" }).select("id").single().throwOnError();
    org = data!.id;
  }, 60_000);
  afterAll(async () => {
    server?.close();
    if (!org) return;
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const db = supabaseAdmin();
    if (settingsBefore) await db.from("ai_settings").update(settingsBefore).eq("id", true);
    await db.from("ai_budgets").delete().eq("scope", "escritorio").eq("ref", org);
    await db.from("ai_usage").delete().eq("organization_id", org);
    await db.from("organizations").delete().eq("id", org);
  });

  it("bloqueado por padrão: sem faturamento confirmado nada é enviado ao provedor", async () => {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    await supabaseAdmin().from("ai_settings").update({ ocr_enabled: false, billing_confirmed_at: null }).eq("id", true);
    const { ocrPages } = await import("@/lib/ocr");
    const r = await ocrPages({ org, actor: null, documentId: "doc-qa", bytes: await scannedPdf(2), pages: [1, 2] });
    expect(r).toMatchObject({ ok: false, reason: "ocr_bloqueado" });
    expect(calls).toHaveLength(0);
  }, 60_000);

  it("liberado: só as páginas sem texto vão ao provedor; custo pelos tokens devolvidos; cache não cobra de novo", async () => {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const db = supabaseAdmin();
    await db.from("ai_settings").update({ ocr_enabled: true, billing_confirmed_at: new Date().toISOString(), billing_note: "teste automatizado (provedor simulado)" }).eq("id", true);
    await db.from("ai_budgets").upsert({ scope: "escritorio", ref: org, ocr_pages_day: 5, ocr_pages_month: 10, note: "QA" }, { onConflict: "scope,ref" });
    const bytes = await scannedPdf(3, [1]);
    const { pdfLines } = await import("@/lib/pdf-text");
    const t = await pdfLines(bytes);
    expect(t.noTextPages).toEqual([2, 3]);
    const { ocrPages, OCR_MODEL } = await import("@/lib/ocr");
    const r = await ocrPages({ org, actor: null, documentId: "doc-qa", bytes, pages: t.noTextPages });
    if (!r.ok) throw new Error(r.reason);
    expect(calls).toHaveLength(2);
    expect(calls.every((c) => c.hasPdf && c.model.includes(OCR_MODEL))).toBe(true);
    expect(r.usage).toMatchObject({ input: 800, output: 120 });
    expect(r.usage!.costUsd).toBeCloseTo((800 * 0.1 + 120 * 0.4) / 1e6, 8);
    expect(r.lines.map((l) => l.page)).toEqual([2, 3]);
    const { data: u } = await db.from("ai_usage").select("status,pages,input_tokens,output_tokens,estimated,module,document_ref,processing_version,input_chars").eq("organization_id", org).eq("status", "concluido");
    expect(u).toEqual([{ status: "concluido", pages: 2, input_tokens: 800, output_tokens: 120, estimated: false, module: "ocr", document_ref: "doc-qa", processing_version: "ocr-v1", input_chars: 0 }]);
    const again = await ocrPages({ org, actor: null, documentId: "doc-qa", bytes, pages: t.noTextPages });
    expect(again).toMatchObject({ ok: true, cached: true });
    expect(calls).toHaveLength(2); // nada novo enviado
  }, 120_000);

  it("limite diário do escritório aplicado no banco; falha do provedor não cobra nem consome páginas", async () => {
    const { ocrPages } = await import("@/lib/ocr");
    const big = await scannedPdf(4);
    const r = await ocrPages({ org, actor: null, documentId: "doc-qa-2", bytes: big, pages: [1, 2, 3, 4] });
    expect(r).toMatchObject({ ok: false, reason: "limite_dia" }); // 2 usadas + 4 > 5
    mode = "erro";
    const f = await ocrPages({ org, actor: null, documentId: "doc-qa-3", bytes: await scannedPdf(1), pages: [1] });
    mode = "ok";
    expect(f).toMatchObject({ ok: false, reason: "provedor" });
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const { data } = await supabaseAdmin().from("ai_usage").select("status,pages,cost_usd").eq("organization_id", org).eq("document_ref", "doc-qa-3");
    expect(data).toEqual([{ status: "falha", pages: 0, cost_usd: 0 }]);
  }, 120_000);
});
