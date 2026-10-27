import { describe, expect, it } from "vitest";
import { contrast, ensureContrast } from "@/lib/contrast";

describe("contraste", () => {
  it("calcula razão WCAG", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });
  it("tokens Black & Gold atingem 4.5:1 nos pares principais", () => {
    expect(contrast("#d6ae62", "#171108")).toBeGreaterThanOrEqual(4.5); // botão escuro
    expect(contrast("#765414", "#ffffff")).toBeGreaterThanOrEqual(4.5); // botão claro
    expect(contrast("#c4b8a5", "#15120e")).toBeGreaterThanOrEqual(4.5); // texto secundário escuro
    expect(contrast("#655744", "#ffffff")).toBeGreaterThanOrEqual(4.5); // texto secundário claro
  });
  it("cor de marca fraca é corrigida automaticamente", () => {
    const r = ensureContrast("#333333", "#090807");
    expect(r.adjusted).toBe(true);
    expect(contrast(r.color, "#090807")).toBeGreaterThanOrEqual(4.5);
  });
});
