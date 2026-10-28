import { describe, expect, it } from "vitest";
import { checkCitations, findCitations } from "@/domain/citations";

describe("citações verificáveis", () => {
  it("encontra leis, súmulas, recursos e CNJ, sem repetir", () => {
    const t = "Conforme a Lei 8.213/1991 e a Lei nº 8.213/1991, a LC 142/2013, a Súmula 576 do STJ, o REsp 1.234.567/SP e o processo 0001234-56.2025.4.01.3300.";
    expect(findCitations(t)).toEqual(["Lei 8.213/1991", "LC 142/2013", "Súmula 576 do STJ", "REsp 1.234.567/SP", "0001234-56.2025.4.01.3300"]);
  });
  it("bloqueia citação sem fonte ou não verificada; libera a verificada", () => {
    const sources = [{ id: "s1", label: "Lei nº 8.213/1991", status: "VERIFICADO" as const }, { id: "s2", label: "Súmula 576 do STJ", status: "NAO_VERIFICADO" as const }];
    const r = checkCitations("Art. 74 da Lei 8.213/1991; Súmula 576 do STJ; REsp 1/SP.", sources);
    expect(r.rows.map((x) => [x.citation, x.status])).toEqual([["Lei 8.213/1991", "VERIFICADO"], ["Súmula 576 do STJ", "NAO_VERIFICADO"], ["REsp 1/SP", "NAO_DISPONIVEL"]]);
    expect(r.blocking).toHaveLength(2);
    expect(checkCitations("Texto sem citação.", sources).blocking).toHaveLength(0);
  });
});
