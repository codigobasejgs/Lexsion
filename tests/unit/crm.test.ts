import { describe, expect, it } from "vitest";
import { canFollowUp } from "@/domain/followup";
import { applyStageChange, buildTouch, findClientMatches, formatPhone, isValidCnpj, isValidCpf, normalizePhone } from "@/domain/crm";
import { clientSchema } from "@/domain/schemas";
import type { Client, Lead } from "@/domain/types";

describe("telefone", () => {
  it("normaliza formatos equivalentes para a mesma chave", () => {
    expect(normalizePhone("(71) 98888-7777")).toBe("5571988887777");
    expect(normalizePhone("+55 71 98888-7777")).toBe("5571988887777");
    expect(normalizePhone("71988887777")).toBe("5571988887777");
    expect(formatPhone("5571988887777")).toBe("(71) 98888-7777");
  });
});

describe("documentos", () => {
  it("valida dígitos de CPF e CNPJ", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("529.982.247-24")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11.222.333/0001-80")).toBe(false);
  });
  it("schema de cliente rejeita CPF inválido com mensagem no campo", () => {
    const r = clientSchema.safeParse({ kind: "PF", name: "Teste Silva", document: "123.456.789-00", phone: "(71) 98888-7777", city: "Salvador", uf: "BA", ownerId: "u" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["document"]);
  });
});

describe("atribuição", () => {
  it("UTM ⇒ confirmada; só declaração ⇒ declarada; nada ⇒ origem não identificada (sem inferir pelo telefone)", () => {
    expect(buildTouch({ at: "t", utm: { utm_source: "meta", utm_campaign: "bpc" } })).toMatchObject({ evidence: "confirmada", origin: "Meta Ads", campaign: "bpc" });
    expect(buildTouch({ at: "t", declaredOrigin: "Indicação" })).toMatchObject({ evidence: "declarada", origin: "Indicação" });
    expect(buildTouch({ at: "t" })).toMatchObject({ evidence: "nao_identificada", origin: "Origem não identificada" });
    expect(buildTouch({ at: "t", utm: { foo: "x" } }).evidence).toBe("nao_identificada"); // parâmetro qualquer não é evidência
  });
});

const lead = (p: Partial<Lead> = {}): Lead => ({
  id: "l", organizationId: "o", name: "X", phone: "5571988887777", area: "Previdenciário", service: "BPC", stage: "novo", stageEnteredAt: "t0",
  firstTouch: { at: "t0", evidence: "nao_identificada", origin: "Origem não identificada" }, lastTouch: { at: "t0", evidence: "nao_identificada", origin: "Origem não identificada" },
  consentContact: true, tags: [], history: [{ at: "t0", to: "novo", actorId: "u" }], createdAt: "t0", ...p,
});

describe("funil", () => {
  it("perda exige motivo; contratado exige cliente; histórico registra transição", () => {
    expect(applyStageChange(lead(), "perdido", "u", "t1")).toEqual({ ok: false, error: "lost_reason_required" });
    expect(applyStageChange(lead(), "contratado", "u", "t1")).toEqual({ ok: false, error: "client_required" });
    const r = applyStageChange(lead(), "perdido", "u", "t1", "Sem retorno");
    expect(r.ok && r.lead.lostReason).toBe("Sem retorno");
    expect(r.ok && r.lead.history.at(-1)).toMatchObject({ from: "novo", to: "perdido" });
    const reopened = r.ok ? applyStageChange(r.lead, "atendimento", "u", "t2") : null;
    expect(reopened?.ok && reopened.lead.lostReason).toBeUndefined();
  });
});

describe("duplicados", () => {
  const c = (id: string, document: string, phone: string) => ({ id, document, phone }) as Client;
  it("documento casa antes de telefone; telefone com máscara diferente também casa", () => {
    const list = [c("a", "529.982.247-25", "(71) 90000-0001"), c("b", "000", "71 900000002")];
    expect(findClientMatches(list, { document: "52998224725" })).toEqual([{ client: list[0], by: "documento" }]);
    expect(findClientMatches(list, { phone: "(71) 90000-0002" })).toEqual([{ client: list[1], by: "telefone" }]);
  });
});

describe("follow-up ético", () => {
  const base = { consentContact: true, attempts: 0, maxAttempts: 2, hour: 10, window: [9, 18] as [number, number], replied: false, isClient: false };
  it("libera só com consentimento, dentro do horário, abaixo do limite", () => {
    expect(canFollowUp(base)).toEqual({ allowed: true });
    expect(canFollowUp({ ...base, optOutAt: "2026-10-26T10:00:00Z" })).toMatchObject({ allowed: false, reason: expect.stringMatching(/opt-out/) });
    expect(canFollowUp({ ...base, consentContact: false })).toMatchObject({ allowed: false });
    expect(canFollowUp({ ...base, hour: 20 })).toMatchObject({ allowed: false, reason: expect.stringMatching(/Fora do horário/) });
    expect(canFollowUp({ ...base, attempts: 2 })).toMatchObject({ allowed: false, reason: expect.stringMatching(/Limite/) });
    expect(canFollowUp({ ...base, replied: true })).toMatchObject({ allowed: false });
    expect(canFollowUp({ ...base, isClient: true })).toMatchObject({ allowed: false });
  });
});
