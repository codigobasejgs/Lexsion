import { describe, expect, it } from "vitest";
import { classifyAreas, kindLabel } from "@/lib/legal-intel/classify";

describe("Classificação temática (sem IA)", () => {
  it("identifica áreas pela ementa oficial", () => {
    expect(classifyAreas("Altera a Lei nº 8.213, de 1991, para dispor sobre aposentadoria especial")).toContain("Previdenciário");
    expect(classifyAreas("Altera a CLT para dispor sobre jornada de trabalho")).toContain("Trabalhista");
    expect(classifyAreas("Dispõe sobre o divórcio e a guarda compartilhada")).toEqual(expect.arrayContaining(["Família"]));
    expect(classifyAreas("Institui o Dia Nacional do Livro")).toEqual([]);
  });
  it("projeto em tramitação nunca é rotulado como norma em vigor", () => {
    expect(kindLabel("proposicao")).toBe("Projeto em tramitação");
    expect(kindLabel("norma_vigente")).toBe("Norma em vigor");
  });
});
