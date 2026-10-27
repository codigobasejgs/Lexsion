import { describe, expect, it } from "vitest";
import { TRIAGE_AREAS, triageChecklist, triageMissing, triageScript } from "@/domain/triage";

describe("triagem por área (dados)", () => {
  it("todas as áreas do catálogo têm roteiro (específico ou genérico)", () => {
    expect(TRIAGE_AREAS.length).toBeGreaterThanOrEqual(40);
    for (const a of TRIAGE_AREAS) expect(triageScript(a).questions.length, a).toBeGreaterThan(0);
  });
  it("checklist só acrescenta documento quando a resposta é sim", () => {
    const s = triageScript("Previdenciário");
    const base = triageChecklist(s, {});
    expect(base).toContain("CNIS");
    expect(base).not.toContain("PPP / LTCAT");
    expect(triageChecklist(s, { especial: "sim", rural: "nao" })).toContain("PPP / LTCAT");
    expect(triageChecklist(s, { rural: "nao" })).not.toContain("Provas de atividade rural (sindicato, notas, ITR)");
  });
  it("encaminhamento exige todas as perguntas sim/não", () => {
    const s = triageScript("Consumidor");
    expect(triageMissing(s, {}).length).toBe(2);
    expect(triageMissing(s, { cobranca: "sim", protocolo: "nao" })).toEqual([]);
  });
  it("roteiros não prometem resultado", () => {
    for (const a of TRIAGE_AREAS) for (const q of triageScript(a).questions) expect(q.text).not.toMatch(/garant|ganhar|certeza|vitória/i);
  });
});
