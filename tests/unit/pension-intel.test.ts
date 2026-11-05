// Leitor de CNIS e regras previdenciárias versionadas. Dados 100% sintéticos (nenhum documento real).
import { describe, expect, it } from "vitest";
import { parseCnis, type PdfLine } from "@/domain/pension/cnis-parser";
import { assessAccidentAid, assessBenefits, assessPpp, convertSpecial, documentationFor, gracePeriod, noiseLimit, unionDays, ymd, type PppInput } from "@/domain/pension/rules";

const L = (page: number, ...texts: string[]): PdfLine[] => texts.map((text) => ({ page, text }));

describe("leitor de CNIS (sintético)", () => {
  const lines = [
    ...L(1,
      "Nome: MARIA DE TESTE SINTETICA",
      "NIT: 123.45678.90-1 CPF: 111.222.333-44",
      "Data de Nascimento: 10/03/1965",
      "1 123.45678.90-1 12.345.678/0001-90 METALURGICA EXEMPLO LTDA Empregado 01/02/1990 30/06/1998 06/1998",
      "01/1998 1.234,56",
      "02/1998 980,00 PREC-MENOR-MIN",
      "2 123.45678.90-1 98.765.432/0001-10 COMERCIO FICTICIO ME Empregado 01/03/1998 15/10/2005 PEXT",
      "3 123.45678.90-1 Contribuinte Individual Recolhimento 01/01/2010 04/2012 IREC-LC123",
    ),
    ...L(2,
      "4 123.45678.90-1 11.111.111/0001-11 EMPRESA DATA RUIM LTDA Empregado 31/02/2001 10/10/2002",
      "5 123.45678.90-1 22.222.222/0001-22 EMPRESA INVERTIDA LTDA Empregado 10/10/2005 01/01/2004",
      "6 33.333.333/0001-33 EMPRESA SEM DATA LTDA",
    ),
  ];
  const r = parseCnis(lines);

  it("lê o cabeçalho do filiado com evidência", () => {
    expect(r.person).toMatchObject({ name: "MARIA DE TESTE SINTETICA", nit: "123.45678.90-1", cpf: "111.222.333-44", birthDate: "1965-03-10" });
    expect(r.person.evidence.length).toBeGreaterThan(0);
    expect(r.pages).toBe(2);
  });
  it("lê vínculos com origem, CNPJ, datas, indicadores e página", () => {
    expect(r.bonds.map((b) => b.seq)).toEqual([1, 2, 3]);
    expect(r.bonds[0]).toMatchObject({ originId: "12.345.678/0001-90", origin: "METALURGICA EXEMPLO LTDA Empregado", start: "1990-02-01", end: "1998-06-30", kind: "empregado", confidence: "alta" });
    expect(r.bonds[0].evidence.page).toBe(1);
    expect(r.bonds[1].indicators).toEqual(["PEXT"]);
    expect(r.bonds[2]).toMatchObject({ kind: "contribuinte_individual", end: null, lastRemuneration: "04/2012", start: "2010-01-01" });
    expect(r.bonds[2].indicators).toContain("IREC-LC123");
  });
  it("lê competências do vínculo corrente com indicador de abaixo do mínimo", () => {
    expect(r.contributions).toEqual([
      expect.objectContaining({ seq: 1, month: "1998-01", amount: 1234.56, indicators: [] }),
      expect.objectContaining({ seq: 1, month: "1998-02", amount: 980, indicators: ["PREC-MENOR-MIN"] }),
    ]);
  });
  it("data impossível, fim antes do início e linha sem data vão para 'não lidas' — nunca viram vínculo", () => {
    expect(r.unread).toHaveLength(3);
    expect(r.unread[1].excerpt).toContain("data fim anterior ao início");
    expect(r.bonds.some((b) => b.origin.includes("RUIM") || b.origin.includes("INVERTIDA"))).toBe(false);
  });
  it("documento sem texto não inventa nada", () => {
    const empty = parseCnis([]);
    expect(empty.bonds).toEqual([]);
    expect(empty.person.name).toBeNull();
    expect(empty.pages).toBe(0);
  });
});

describe("conversão de tempo especial por vigência", () => {
  it("período inteiro antes da EC 103: converte com fator 1,4 (homem, 25 anos)", () => {
    const r = convertSpecial([{ id: "a", label: "A", start: "2000-01-01", end: "2009-12-31", kind: 25 }], "M");
    expect(r.lines[0].convertibleDays).toBe(3653);
    expect(r.lines[0].addedDays).toBe(Math.floor(3653 * 0.4));
    expect(r.status).toBe("aguarda_validacao");
  });
  it("período que atravessa 13/11/2019 é dividido: depois não converte", () => {
    const r = convertSpecial([{ id: "b", label: "B", start: "2019-11-01", end: "2019-11-30", kind: 25 }], "F");
    expect(r.lines[0]).toMatchObject({ days: 30, convertibleDays: 13, notConvertibleDays: 17, factor: 1.2, addedDays: 2 });
  });
  it("período todo depois da EC 103: zero acréscimo", () => {
    expect(convertSpecial([{ id: "c", label: "C", start: "2020-01-01", end: "2022-12-31", kind: 15 }], "M").addedDays).toBe(0);
  });
  it("fatores mudam por atividade e sexo (não há fator único)", () => {
    const f = (k: 15 | 20 | 25, s: "M" | "F") => convertSpecial([{ id: "x", label: "x", start: "2001-01-01", end: "2001-01-10", kind: k }], s).lines[0].factor;
    expect([f(15, "M"), f(20, "M"), f(25, "M"), f(15, "F"), f(20, "F"), f(25, "F")]).toEqual([2.33, 1.75, 1.4, 2.0, 1.5, 1.2]);
  });
});

describe("contagem e PPP", () => {
  it("união de dias não duplica concomitância", () => {
    expect(unionDays([{ start: "2020-01-01", end: "2020-01-31" }, { start: "2020-01-15", end: "2020-02-10" }])).toBe(41);
    expect(ymd(400).text).toBe("1 ano(s), 1 mes(es) e 5 dia(s)");
  });
  it("limite de ruído e documentação mudam pela época", () => {
    expect([noiseLimit("1995-01-01").db, noiseLimit("2000-01-01").db, noiseLimit("2010-01-01").db]).toEqual([80, 90, 85]);
    expect(documentationFor("1990-01-01").text).toContain("categoria profissional");
    expect(documentationFor("2005-01-01").text).toContain("PPP");
  });
  const base: PppInput = { id: "p", start: "1996-01-01", end: "2005-12-31", employer: "X", role: "Soldador", activities: "Solda elétrica em estruturas", agents: [{ kind: "ruido", name: "Ruído contínuo", intensity: 88, unit: "dB(A)", technique: "NHO-01", carcinogenic: false }], epiEffective: "nao_informado", technicalResponsible: true, signed: true, categoryClaim: "Soldador" };
  it("ruído de 88 dB: acima em 1996, abaixo de 1997 a 2003, acima depois de 19/11/2003", () => {
    const r = assessPpp(base);
    const noise = r.findings.filter((f) => f.text.startsWith("Ruído 88"));
    expect(noise.map((f) => f.classification)).toEqual(["possivel_enquadramento", "insuficiente", "possivel_enquadramento"]);
    expect(r.findings.some((f) => f.text.includes("não se aplica: o período começa depois de 28/04/1995"))).toBe(true);
  });
  it("categoria profissional só até 28/04/1995", () => {
    const r = assessPpp({ ...base, start: "1990-01-01", end: "1999-12-31" });
    expect(r.findings.find((f) => f.text.startsWith("Categoria profissional"))?.text).toContain("01/01/1990 a 28/04/1995");
  });
  it("PPP incompleto e sem assinatura não passa como consistente", () => {
    const r = assessPpp({ ...base, start: "2010-01-01", end: null, activities: "", signed: false, technicalResponsible: false, agents: [], categoryClaim: null });
    expect(r.overall).toBe("incompleta");
    expect(r.findings.map((f) => f.classification)).toEqual(expect.arrayContaining(["exige_complementacao", "insuficiente"]));
  });
});

describe("auxílio-acidente e possibilidades", () => {
  it("contribuinte individual não tem direito a auxílio-acidente", () => {
    const r = assessAccidentAid({ accidentDate: "2022-05-10", kindAtAccident: "contribuinte_individual", insuredAtAccident: true, sequelaDescribed: true, sequelaPermanent: "sim", reducedCapacityHabitual: "sim", habitualActivity: "Pedreiro", medicalDocs: 2, previousBenefit: false });
    expect(r.weaken[0]).toContain("NÃO está entre");
  });
  it("sequela temporária aponta para incapacidade temporária, não auxílio-acidente", () => {
    const r = assessAccidentAid({ accidentDate: "2022-05-10", kindAtAccident: "empregado", insuredAtAccident: true, sequelaDescribed: true, sequelaPermanent: "nao", reducedCapacityHabitual: "nao_sabe", habitualActivity: "Soldador", medicalDocs: 0, previousBenefit: true });
    expect(r.weaken.join(" ")).toContain("incapacidade temporária");
    expect(r.missing.join(" ")).toContain("Documentos médicos");
  });
  it("período de graça: 12 meses, +12 com mais de 120 contribuições", () => {
    expect(gracePeriod("2020-03-31", { over120: false, unemployedProof: false }).until).toBe("2021-05-15");
    expect(gracePeriod("2020-03-31", { over120: true, unemployedProof: false }).months).toBe(24);
  });
  it("quadro de benefícios marca o que não dá para verificar", () => {
    const r = assessBenefits({ birthDate: null, sex: null, on: "2026-11-05", commonDays: 0, carencyMonths: null, specialDays: 0, specialKinds: [], insured: null });
    expect(r.find((b) => b.id === "idade")!.requirements[0].state).toBe("nao_verificavel");
    const ok = assessBenefits({ birthDate: "1960-01-01", sex: "F", on: "2026-11-05", commonDays: 16 * 365, carencyMonths: 190, specialDays: 0, specialKinds: [], insured: true });
    expect(ok.find((b) => b.id === "idade")!.requirements.map((q) => q.state)).toEqual(["atendido", "atendido", "atendido"]);
  });
});
