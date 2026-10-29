import fs from "node:fs";
import crypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";

// Backup REAL: lê o banco de produção (só leitura), cifra, envia ao R2 privado, baixa, decifra e confere.
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

describe.skipIf(!ON)("REAL — backup diário no R2", () => {
  it("gera, envia, confere a volta e o objeto não é público", async () => {
    const { runBackup } = await import("@/lib/backup");
    const r = await runBackup();
    expect(r.verified).toBe(true);
    expect(r.rows).toBeGreaterThan(0);
    expect(r.name).toMatch(/^backups\/diario\/lexsion-.*\.lxbk$/);
    const pub = await fetch(`https://pub-e1b2c88922e548c590d856a73a262c39.r2.dev/${r.name}`).catch(() => null);
    expect(pub?.ok ?? false).toBe(false); // sem acesso público ao arquivo
  }, 280_000);
});
