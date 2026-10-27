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
