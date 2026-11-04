import fs from "node:fs";
import crypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";

// Homologação CONTROLADA do provedor real (Evolution): cria uma instância de teste "lexsion-qa-…", confere que o QR
// vem do servidor real, que o estado é "não conectado" e remove a instância. Nenhum aparelho é pareado, nenhuma
// mensagem é enviada, nenhuma instância de outro sistema é tocada. RUN_REAL=1 e EVOLUTION_REAL=1.
vi.mock("server-only", () => ({}));
const env: Record<string, string> = {};
if (fs.existsSync(".env.local")) for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l); if (m) env[m[1]] = m[2]; }
Object.assign(process.env, { EVOLUTION_URL: env.EVOLUTION_URL, EVOLUTION_API_KEY: env.EVOLUTION_API_KEY });
const ON = process.env.RUN_REAL === "1" && process.env.EVOLUTION_REAL === "1" && !!env.EVOLUTION_API_KEY;

describe.skipIf(!ON)("REAL — Evolution: QR de instância de teste (sem parear)", () => {
  it("cria lexsion-qa-…, recebe QR do servidor real, estado não conectado, remove", async () => {
    const ev = await import("@/lib/evolution");
    const name = `lexsion-qa-qr-${crypto.randomBytes(3).toString("hex")}`;
    try {
      expect(await ev.connectionState(name)).toBe("missing");
      const r = await ev.createOrConnect(name, "https://lexsion.com.br/api/whatsapp/webhook?org=00000000-0000-0000-0000-000000000000&s=homologacao-sem-segredo-valido");
      expect(r.ok).toBe(true);
      const qr = r.ok ? r.qr : null;
      expect(typeof qr === "string" && /^data:image\/png;base64,|^[A-Za-z0-9+/=]{200,}/.test(qr)).toBe(true);
      expect(["connecting", "close"]).toContain(await ev.connectionState(name));
      expect(await ev.setWebhook(name, "https://lexsion.com.br/api/whatsapp/webhook?org=00000000-0000-0000-0000-000000000000&s=segredo-novo-de-homologacao")).toBe(true);
    } finally {
      expect(await ev.deleteInstance(name)).toBe(true);
      expect(await ev.connectionState(name)).toBe("missing");
    }
  }, 120_000);
  it("escopo: chamada a instância fora do prefixo lexsion- é recusada antes da rede", async () => {
    const ev = await import("@/lib/evolution");
    await expect(ev.connectionState("tubarao-principal")).rejects.toThrow(/fora do escopo/);
  });
});
