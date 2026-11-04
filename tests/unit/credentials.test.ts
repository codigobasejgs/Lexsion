import crypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => { throw new Error("sem banco"); } }));
const { hint, openSecret, sealSecret } = await import("@/lib/credentials");
const { PROVIDERS } = await import("@/domain/integrations");

describe("chaves do escritório", () => {
  const k = crypto.randomBytes(32);
  it("cifra e decifra; texto cifrado não contém a chave; chave errada ou adulteração falham", () => {
    const s = sealSecret("$aact_prod_SEGREDO123", k);
    expect(Buffer.from(s, "base64").toString("latin1")).not.toContain("SEGREDO123");
    expect(openSecret(s, k)).toBe("$aact_prod_SEGREDO123");
    expect(() => openSecret(s, crypto.randomBytes(32))).toThrow();
    const b = Buffer.from(s, "base64"); b[b.length - 1] ^= 1;
    expect(() => openSecret(b.toString("base64"), k)).toThrow();
    expect(sealSecret("x", k)).not.toBe(sealSecret("x", k)); // IV novo a cada vez
  });
  it("a tela só recebe o final da chave", () => {
    expect(hint("AIzaSyABCDEFGH1234")).toBe("••••1234");
  });
  it("todo provedor tem passo a passo, link https e diz honestamente se a LexSion já usa a chave", () => {
    for (const p of PROVIDERS) {
      expect(p.steps.length, p.id).toBeGreaterThanOrEqual(3);
      expect(p.link.startsWith("https://"), p.id).toBe(true);
      if (!p.usoAtivo) expect(p.uso, p.id).toMatch(/ainda não está implementad/);
    }
  });
});
