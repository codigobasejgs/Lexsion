import { describe, expect, it } from "vitest";
import { analyzeCnis, bpcPerCapita, coveredMonths, formatMonths } from "@/domain/cnis";
import type { ContributionPeriod } from "@/domain/types";

const p = (id: string, start: string, end: string, extra: Partial<ContributionPeriod> = {}): ContributionPeriod => ({ id, employer: `Empresa ${id}`, start, end, category: "empregado", source: "CNIS", evidence: { documentId: "d", page: 1, excerpt: "" }, ...extra });

describe("núcleo CNIS", () => {
  it("conta meses civis e não duplica concomitância", () => {
    expect(coveredMonths([p("a", "2020-01-15", "2020-12-31"), p("b", "2020-06-01", "2021-03-31")]).size).toBe(15);
    expect(formatMonths(15)).toBe("1 ano(s) e 3 mes(es)");
  });
  it("aponta lacuna com os meses exatos", () => {
    const r = analyzeCnis([p("a", "2019-01-01", "2019-06-30"), p("b", "2019-10-01", "2019-12-31")]);
    expect(r.issues.map((i) => i.kind)).toEqual(["lacuna"]);
    expect(r.issues[0].text).toContain("07/2019 a 09/2019 (3 meses)");
    expect(r.months).toBe(9);
  });
  it("datas invertidas tiram o período da contagem e pesam no diagnóstico", () => {
    const r = analyzeCnis([p("a", "2020-05-01", "2020-01-31"), p("b", "2021-01-01", "2021-01-31")]);
    expect(r.issues[0].kind).toBe("datas_invertidas");
    expect(r.months).toBe(1);
    expect(r.score).toBe(75);
  });
  it("abaixo do mínimo e sem prova entram como fatores explícitos", () => {
    const r = analyzeCnis([p("a", "2020-01-01", "2020-12-31")], { belowMinimum: ["a"], withoutProof: ["a"] });
    expect(r.issues.map((i) => i.kind).sort()).toEqual(["abaixo_minimo", "sem_prova"]);
    expect(r.score).toBe(85);
  });
  it("BPC: renda per capita frente a 1/4 do mínimo informado, com exclusão registrada", () => {
    const r = bpcPerCapita([{ name: "Requerente", income: 0 }, { name: "Filho", income: 120000 }, { name: "Neto (benefício excluído)", income: 151800, excluded: true }], 151800);
    if ("error" in r) throw new Error(r.error);
    expect(r.perCapita).toBe(40000);
    expect(r.limit).toBe(37950);
    expect(r.withinLimit).toBe(false);
    expect(r.excluded).toEqual(["Neto (benefício excluído)"]);
    expect(bpcPerCapita([], 151800)).toHaveProperty("error");
    expect(bpcPerCapita([{ name: "x", income: -1 }], 151800)).toHaveProperty("error");
  });
});
