// Fluxo da análise: leitura entra pendente, só o revisado conta; pendências e comparação derivadas. Dados sintéticos.
import { describe, expect, it } from "vitest";
import { derive, effectiveEnd, emptyIntel, mergeCnis, mergeCtps, type IntelData } from "@/domain/pension/analysis";
import { parseCnis } from "@/domain/pension/cnis-parser";
import { parseCtps } from "@/domain/pension/readers";

const src = (documentId: string, kind: "CNIS" | "CTPS" = "CNIS") => ({ kind, documentId, fileId: `f-${documentId}`, fileName: `${kind}.pdf`, pages: 1, readAt: "2026-11-05T10:00:00Z", rulesVersion: "x" });
const cnis = parseCnis([
  { page: 1, text: "Nome: ANA SINTETICA" },
  { page: 1, text: "Data de Nascimento: 01/01/1960" },
  { page: 1, text: "1 123.45678.90-1 12.345.678/0001-90 METALURGICA EXEMPLO LTDA Empregado 01/01/1990 31/12/1999" },
  { page: 1, text: "01/1999 900,00 PREC-MENOR-MIN" },
  { page: 1, text: "2 123.45678.90-1 98.765.432/0001-10 COMERCIO FICTICIO ME Empregado 01/01/2000 IREC-LC123 06/2010" },
]);

describe("análise previdenciária", () => {
  const base = mergeCnis(emptyIntel("2026-11-05"), cnis, src("d1"));
  it("leitura entra pendente e não conta até revisão", () => {
    expect(base.bonds.every((b) => b.status === "pendente")).toBe(true);
    expect(base.birthDate).toBe("1960-01-01");
    const r = derive(base);
    expect(r.commonDays).toBe(0);
    expect(r.pendencias[0].text).toContain("2 vínculo(s) lido(s) aguardando revisão");
  });
  it("revisado conta; sem fim usa a última remuneração e gera pendência; abaixo do mínimo sai da carência", () => {
    const d: IntelData = { ...base, sex: "F", bonds: base.bonds.map((b) => ({ ...b, status: "confirmado" })) };
    expect(effectiveEnd(d.bonds[1])).toBe("2010-06-30");
    const r = derive(d);
    expect(r.counted).toHaveLength(2);
    expect(r.carencyMonths).toBe(120 + 126 - 1);
    expect(r.pendencias.some((p) => p.text.includes("contado até 30/06/2010"))).toBe(true);
    expect(r.pendencias.some((p) => p.action.includes("plano simplificado"))).toBe(true);
    expect(r.benefits.find((b) => b.id === "idade")!.requirements[1].state).toBe("atendido");
  });
  it("tempo especial só converte com sexo informado e só até 13/11/2019", () => {
    const d: IntelData = { ...base, sex: "M", bonds: base.bonds.map((b, i) => ({ ...b, status: "confirmado", special: i === 0 ? 25 : null })) };
    const r = derive(d);
    expect(r.conversion?.addedDays).toBe(Math.floor(3652 * 0.4));
    expect(derive({ ...d, sex: null }).conversion).toBeNull();
  });
  it("reler o mesmo documento substitui a leitura; descartado não entra", () => {
    const again = mergeCnis(base, cnis, src("d1"));
    expect(again.bonds).toHaveLength(2);
    const d: IntelData = { ...base, bonds: base.bonds.map((b) => ({ ...b, status: "descartado" })) };
    expect(derive(d).counted).toHaveLength(0);
  });
  it("CTPS lida entra na comparação", () => {
    const ctps = parseCtps([{ page: 1, text: "Empregador: METALURGICA EXEMPLO LTDA" }, { page: 1, text: "CNPJ: 12.345.678/0001-90" }, { page: 1, text: "Data de admissão: 01/01/1990" }, { page: 1, text: "Data de desligamento: 15/12/1999" }]);
    const d = mergeCtps(base, ctps, src("d2", "CTPS"));
    const r = derive(d);
    expect(r.comparison.map((c) => c.kind)).toEqual(["datas_divergentes", "so_cnis"]);
    expect(r.pendencias.some((p) => p.text.includes("fim CNIS 31/12/1999 × CTPS 15/12/1999"))).toBe(true);
  });
});
