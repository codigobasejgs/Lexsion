import { describe, expect, it } from "vitest";
import { weakPassword } from "@/domain/passwords";

describe("senha de acesso criado pelo escritório", () => {
  it.each(["curta1", "somenteletrasaqui", "12345678901", "minhasenha2026", "Lexsion2026x"])("recusa %s", (p) => expect(weakPassword(p)).toBe(true));
  it.each(["Escritorio7Maria", "k3Tq9vLp2Wx8"])("aceita %s", (p) => expect(weakPassword(p)).toBe(false));
});
