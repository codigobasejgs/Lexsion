import { describe, expect, it } from "vitest";
import { mergeSeed } from "@/services/mock/db";
import { isShellCache } from "@/lib/shell-cache";

describe("DATA — migração sem perda e limpeza de cache ao sair", () => {
  it("DATA-01: mantém registros criados na demo e acrescenta só sementes novas", () => {
    const existing = [{ id: "c-1", name: "editado pelo usuário" }, { id: "c-novo", name: "criado na demo" }];
    const seed = [{ id: "c-1", name: "semente" }, { id: "c-2", name: "semente nova" }];
    expect(mergeSeed(existing, seed, false)).toEqual([
      { id: "c-1", name: "editado pelo usuário" },
      { id: "c-novo", name: "criado na demo" },
      { id: "c-2", name: "semente nova" },
    ]);
  });

  it("DATA-01b: em catálogos, renomeação da semente vale para o mesmo id sem apagar criados", () => {
    const out = mergeSeed([{ id: "org-boreal", name: "Boreal" }, { id: "org-x", name: "Criado no Super Admin" }], [{ id: "org-boreal", name: "Atlas" }], true);
    expect(out).toEqual([{ id: "org-boreal", name: "Atlas" }, { id: "org-x", name: "Criado no Super Admin" }]);
  });

  it("DATA-01c: banco inexistente recebe a semente inteira", () => {
    expect(mergeSeed(undefined, [{ id: "a" }], false)).toEqual([{ id: "a" }]);
  });

  it("DATA-03: sair limpa shells legados e por contexto, preserva estáticos", () => {
    expect(["siwiltec-shell-1", "siwiltec-tenant-aurora-advocacia-shell-1", "siwiltec-admin-shell-2", "siwiltec-static-1", "outro-shell-1"].filter(isShellCache))
      .toEqual(["siwiltec-shell-1", "siwiltec-tenant-aurora-advocacia-shell-1", "siwiltec-admin-shell-2"]);
  });
});

describe("AUD — auditoria da demonstração só-acréscimo (QA-115)", () => {
  const ev = (id: string, action = "x") => ({ id, organizationId: "platform", at: "2026-10-29T00:00:00Z", actorId: "u-super", action, entity: "Tenant", entityId: "org-1", detail: action });
  it("AUD-01: lista velha de outra aba não apaga eventos já gravados", async () => {
    const { mergeAudit } = await import("@/services/mock/db");
    const gravado = [ev("a", "suspenso"), ev("b", "reativado")]; // outra aba já gravou "b"
    const abaVelha = [ev("a", "suspenso"), ev("c", "plano")];     // esta aba leu antes de "b" e acrescentou "c"
    expect(mergeAudit(gravado, abaVelha).map((e) => e.id)).toEqual(["a", "b", "c"]);
  });
  it("AUD-02: reenvio do mesmo evento não duplica; ordem e conteúdo dos antigos preservados", async () => {
    const { mergeAudit } = await import("@/services/mock/db");
    const gravado = [ev("a", "original")];
    const r = mergeAudit(gravado, [ev("a", "alterado"), ev("b"), ev("b")]);
    expect(r.map((e) => e.id)).toEqual(["a", "b"]);
    expect(r[0].detail).toBe("original"); // registro antigo nunca é sobrescrito
  });
  it("AUD-03: nada novo devolve a mesma lista; base vazia aceita", async () => {
    const { mergeAudit } = await import("@/services/mock/db");
    const gravado = [ev("a")];
    expect(mergeAudit(gravado, [ev("a")])).toBe(gravado);
    expect(mergeAudit(undefined, [ev("z")]).map((e) => e.id)).toEqual(["z"]);
  });
});
