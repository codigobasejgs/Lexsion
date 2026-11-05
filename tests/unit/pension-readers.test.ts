// CTPS Digital, PPP e comparação CNIS × CTPS. Dados 100% sintéticos.
import { describe, expect, it } from "vitest";
import { compareCnisCtps, parseCtps, parsePpp, type BondLike } from "@/domain/pension/readers";
import { assessPpp } from "@/domain/pension/rules";
import type { PdfLine } from "@/domain/pension/cnis-parser";

const L = (page: number, ...texts: string[]): PdfLine[] => texts.map((text) => ({ page, text }));

describe("CTPS Digital (sintética)", () => {
  const r = parseCtps([
    ...L(1, "Contratos de trabalho", "Empregador: METALURGICA EXEMPLO LTDA", "CNPJ: 12.345.678/0001-90", "Cargo: SOLDADOR", "Data de admissão: 01/02/1990", "Data de desligamento: 30/06/1998"),
    ...L(2, "Empregador: COMERCIO FICTICIO ME", "CNPJ: 98.765.432/0001-10", "Cargo:", "AUXILIAR DE ESTOQUE", "Data de admissão: 01/03/1998", "Data de desligamento: --", "Empregador: EMPRESA SO CTPS LTDA", "Data de admissão: 31/02/2007"),
  ]);
  it("lê contratos com rótulo na mesma linha ou na seguinte, com página", () => {
    expect(r.contracts).toHaveLength(3);
    expect(r.contracts[0]).toMatchObject({ employer: "METALURGICA EXEMPLO LTDA", employerId: "12.345.678/0001-90", role: "SOLDADOR", start: "1990-02-01", end: "1998-06-30", confidence: "alta" });
    expect(r.contracts[1]).toMatchObject({ role: "AUXILIAR DE ESTOQUE", start: "1998-03-01", end: null });
    expect(r.contracts[1].evidence[0].page).toBe(2);
  });
  it("data impossível não vira data: vai para não lidas", () => {
    expect(r.contracts[2]).toMatchObject({ start: null, confidence: "baixa" });
    expect(r.unread.some((u) => u.excerpt.includes("31/02/2007"))).toBe(true);
  });
});

describe("PPP (sintético)", () => {
  const r = parsePpp([
    ...L(1, "PERFIL PROFISSIOGRÁFICO PREVIDENCIÁRIO", "CNPJ 12.345.678/0001-90", "3 - Nome Empresarial: METALURGICA EXEMPLO LTDA", "6 - Nome do Trabalhador: JOAO DE TESTE",
      "SEÇÃO DE LOTAÇÃO E ATRIBUIÇÃO", "01/02/1990 a 30/06/1998 SOLDADOR",
      "PROFISSIOGRAFIA", "01/02/1990 a 30/06/1998 Executa solda elétrica e oxiacetilênica em estruturas metálicas", "na linha de produção."),
    ...L(2, "EXPOSIÇÃO A FATORES DE RISCO", "01/02/1990 a 05/03/1997 F Ruído contínuo 92 dB(A) dosimetria N", "01/02/1990 a 30/06/1998 Q Fumos metálicos de solda (níquel) qualitativo S", "01/01/1999 a 01/01/1998 F Calor 28 IBUTG N",
      "RESPONSÁVEL PELOS REGISTROS AMBIENTAIS", "01/01/1996 a 30/06/1998 Eng. de segurança"),
  ]);
  it("lê empresa, trabalhador e períodos de exposição com agente, intensidade e EPI", () => {
    expect(r).toMatchObject({ employer: "METALURGICA EXEMPLO LTDA", employerId: "12.345.678/0001-90", worker: "JOAO DE TESTE" });
    expect(r.periods).toHaveLength(2);
    expect(r.periods[0]).toMatchObject({ start: "1990-02-01", end: "1997-03-05", role: "SOLDADOR", epiEffective: "nao" });
    expect(r.periods[0].agents[0]).toMatchObject({ kind: "ruido", intensity: 92, technique: "dosimetria" });
    expect(r.periods[0].activities).toContain("na linha de produção");
    expect(r.periods[1].agents[0]).toMatchObject({ kind: "quimico", carcinogenic: true, intensity: null });
    expect(r.periods[1].epiEffective).toBe("sim");
  });
  it("período invertido vai para não lidas; responsável técnico só cobre a partir de 1996", () => {
    expect(r.unread.some((u) => u.excerpt.includes("01/01/1999 a 01/01/1998"))).toBe(true);
    expect(r.periods[0].technicalResponsible).toBe(false);
  });
  it("leitura alimenta o checklist técnico", () => {
    const a = assessPpp({ ...r.periods[0], signed: true });
    expect(a.findings.some((f) => f.text.startsWith("Ruído 92") && f.classification === "possivel_enquadramento")).toBe(true);
  });
});

describe("comparação CNIS × CTPS", () => {
  const cnis: BondLike[] = [
    { id: "c1", origin: "METALURGICA EXEMPLO LTDA", originId: "12.345.678/0001-90", start: "1990-02-01", end: "1998-06-30" },
    { id: "c2", origin: "COMERCIO FICTICIO ME", originId: "98.765.432/0001-10", start: "1998-03-01", end: "2005-10-15" },
    { id: "c3", origin: "Contribuinte Individual", originId: null, start: "2010-01-01", end: null },
  ];
  const ctps: BondLike[] = [
    { id: "t1", origin: "METALURGICA EXEMPLO LTDA", originId: "12.345.678/0001-90", start: "1990-02-01", end: "1998-06-30" },
    { id: "t2", origin: "Comércio Fictício", originId: null, start: "1998-03-01", end: "2005-11-20" },
    { id: "t3", origin: "EMPRESA SO CTPS LTDA", originId: null, start: "2007-01-01", end: "2008-01-01" },
  ];
  it("classifica confere, datas divergentes, só no CNIS e só na CTPS", () => {
    const r = compareCnisCtps(cnis, ctps);
    expect(r.map((x) => x.kind)).toEqual(["confere", "datas_divergentes", "so_cnis", "so_ctps"]);
    expect(r[1].detail).toContain("fim CNIS 15/10/2005 × CTPS 20/11/2005");
  });
});
