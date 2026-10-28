import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { ALL_PROVIDERS, emailAdapter, legalDataAdapter, messagingAdapter, paymentAdapters, storageAdapter } from "@/services/adapters";

// QA-INT — contratos dos adaptadores: honestos, sem rede, sem segredo.
describe("adaptadores de integração (fase sem backend)", () => {
  it("nenhum provedor aparece como ativo nem em modo real", () => {
    expect(ALL_PROVIDERS.filter((p) => p.status === "active" || p.mode === "real")).toEqual([]);
  });
  it("credenciais aparecem só como NOMES, nunca como valores", () => {
    for (const p of ALL_PROVIDERS) for (const r of p.requires) expect(r, p.id).not.toMatch(/sb_|re_[A-Za-z0-9]{6,}|vcp_|cfut_|cfat_|eyJ/);
  });
  it("cobrança simulada é marcada como simulada, sem id externo; valor zero é recusado", async () => {
    const r = await paymentAdapters.asaas.createCheckout({ billingAccountOwner: "tenant", organizationId: "org-aurora", amount: 15000, description: "Parcela", methods: ["pix"], idempotencyKey: "k1" });
    expect(r.ok && r.data).toMatchObject({ simulated: true, externalId: null, status: "pendente" });
    expect((await paymentAdapters.asaas.createCheckout({ billingAccountOwner: "tenant", organizationId: "o", amount: 0, description: "", methods: ["pix"], idempotencyKey: "k2" })).ok).toBe(false);
  });
  it("WhatsApp exige consentimento; e-mail e WhatsApp retornam simulados", async () => {
    expect((await messagingAdapter.send({ to: "x", text: "y", consent: false })).ok).toBe(false);
    expect((await messagingAdapter.send({ to: "x", text: "y", consent: true })).ok).toBe(true);
    const e = await emailAdapter.send({ to: "a@b.c", subject: "s", html: "<p>x</p>", organizationId: "o" });
    expect(e.ok && e.data.simulated).toBe(true);
  });
  it("consulta processual e armazenamento dizem que não estão conectados", async () => {
    const s = await legalDataAdapter.search({ cnj: "0000001-00.2026.4.01.3300" });
    expect(s.ok && s.data.found).toBe(false);
    const u = await storageAdapter.signedUploadUrl({ key: "a", contentType: "application/pdf" });
    expect(!u.ok && u.error.message).toMatch(/não está configurado/);
  });
  it("adaptadores não fazem chamadas de rede (nenhum fetch no arquivo)", () => {
    expect(fs.readFileSync("src/services/adapters.ts", "utf8")).not.toMatch(/\bfetch\(|XMLHttpRequest|axios/);
  });
});

describe("adaptadores futuros mapeados (paridade)", () => {
  it("índices, Jusbrasil e anúncios estão listados como planejados, sem modo real", async () => {
    const { ALL_PROVIDERS: all, indexSourceAdapter } = await import("@/services/adapters");
    for (const id of ["cj-indices", "jusbrasil", "meta-ads", "google-ads", "datajud"]) expect(all.find((p) => p.id === id)?.status, id).toBe("planned");
    const r = await indexSourceAdapter.series({ index: "IPCA-E", from: "2025-01", to: "2025-12" });
    expect(!r.ok && r.error.code).toBe("not_configured");
  });
});
