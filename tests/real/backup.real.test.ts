import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { afterAll, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";

// Backup REAL e INTEGRAL: banco + arquivos do Storage → R2 cifrado → restauração numa cópia ISOLADA (PGlite) →
// conferência de contagens, SHA-256 de cada arquivo e correspondência documento ⇄ arquivo. Escritório e arquivos
// sintéticos (qa-bkp-…), apagados no final. Nunca restaura sobre o banco real.
vi.mock("server-only", () => ({}));
const env: Record<string, string> = {};
if (fs.existsSync(".env.local")) for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l); if (m) env[m[1]] = m[2]; }
Object.assign(process.env, env);
const ON = process.env.RUN_REAL === "1" && !!env.R2_SECRET_ACCESS_KEY && !!env.BACKUP_ENCRYPTION_KEY;

describe("cifra do backup (sem rede)", () => {
  it("abre com a chave certa; recusa chave errada e arquivo adulterado", async () => {
    const { seal, open } = await import("@/lib/backup");
    const k = crypto.randomBytes(32), plain = Buffer.from('{"clientes":["Maria"]}');
    const s = seal(plain, k);
    expect(s.includes(Buffer.from("Maria"))).toBe(false); // nada legível no arquivo
    expect(open(s, k).equals(plain)).toBe(true);
    expect(() => open(s, crypto.randomBytes(32))).toThrow();
    const bad = Buffer.from(s); bad[bad.length - 1] ^= 1;
    expect(() => open(bad, k)).toThrow();
  });
});

describe.skipIf(!ON)("REAL — backup integral (banco + Storage) e restauração isolada", () => {
  const tag = crypto.randomBytes(3).toString("hex");
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
  let org = "";
  const pdf = Buffer.from(`%PDF-1.4\n% QA backup ${tag}\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n`);
  const png = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000" + crypto.randomBytes(8).toString("hex"), "hex");
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "lexsion-restore-"));
  afterAll(async () => {
    if (org) {
      await admin.storage.from("documentos").remove([`${org}/qa-${tag}/procuracao.pdf`, `${org}/qa-${tag}/rg.png`]);
      await admin.from("organizations").delete().eq("id", org);
      await admin.from("audit_logs").delete().eq("organization_id", org);
    }
    fs.rmSync(out, { recursive: true, force: true }); // cópia restaurada tem dados pessoais: não fica no disco
  }, 120_000);

  it("gera, envia, confere, restaura banco e arquivos numa cópia isolada e casa documento ⇄ arquivo", async () => {
    org = (await admin.from("organizations").insert({ slug: `qa-bkp-${tag}`, name: `QA Backup ${tag}` }).select("id").single().throwOnError()).data!.id;
    for (const [name, buf, type] of [["procuracao.pdf", pdf, "application/pdf"], ["rg.png", png, "image/png"]] as const) {
      const { error } = await admin.storage.from("documentos").upload(`${org}/qa-${tag}/${name}`, buf, { contentType: type });
      expect(error).toBeNull();
      await admin.from("org_records").insert({ organization_id: org, collection: "files", id: `f-${name}-${tag}`, data: { id: `f-${name}-${tag}`, organizationId: org, name, path: `${org}/qa-${tag}/${name}`, size: buf.length } }).throwOnError();
    }
    const { runBackup } = await import("@/lib/backup");
    const r = await runBackup();
    expect(r.verified).toBe(true);
    expect(r.files).toBeGreaterThanOrEqual(2);
    expect(r.filesUploaded).toBeGreaterThanOrEqual(2);
    // Segunda execução: incremental, nada novo para enviar.
    const r2 = await runBackup();
    expect(r2.filesUploaded).toBe(0);
    expect(r2.files).toBe(r.files);
    // Objeto não é público.
    const pub = await fetch(`https://pub-e1b2c88922e548c590d856a73a262c39.r2.dev/${r2.name}`).catch(() => null);
    expect(pub?.ok ?? false).toBe(false);

    const run = (script: string, ...args: string[]) => execFileSync("node", [script, ...args], { encoding: "utf8", env: { ...process.env, HTTPS_PROXY: process.env.HTTPS_PROXY ?? "" }, maxBuffer: 1 << 26 });
    const dec = run("scripts/restaurar-do-r2.mjs", out, r2.name);
    expect(dec).toMatch(/0 com SHA-256 divergente/);
    const dir = dec.trim().split(/\r?\n/).at(-1)!;
    expect(fs.readFileSync(path.join(dir, "storage", "documentos", org, `qa-${tag}`, "procuracao.pdf")).equals(pdf)).toBe(true);
    expect(fs.readFileSync(path.join(dir, "storage", "documentos", org, `qa-${tag}`, "rg.png")).equals(png)).toBe(true);
    const rest = run("scripts/restaurar-teste.mjs", dir);
    expect(rest).toMatch(/OK  arquivos do Storage: (\d+)\/\1 com tamanho e SHA-256 conferidos/);
    expect(rest).toMatch(/OK  banco ⇄ arquivos: (\d+)\/\1 registro/);
    expect(rest).toMatch(/RESTAURACAO_OK/);
  }, 600_000);
});
