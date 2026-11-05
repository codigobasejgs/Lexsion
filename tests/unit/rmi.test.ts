// Fase 2: tabelas oficiais e motor de RMI/planejamento. Segurados SINTÉTICOS; contas conferidas à mão.
import { describe, expect, it } from "vitest";
import { accumulate, ceilingAt, levelAt, lifeExpectancy, OFFICIAL, scFactor, scIndexFor, withUpdates } from "@/domain/tables";
import { ageOn, arrears, art16Age, art18Age, bestAverage, checkRules, coefEc103, contributionFor, correctSalaries, fatorPrevidenciario, otherBenefits, plan, pointsRequired, rmiFor, stateOn, type Profile } from "@/domain/pension/rmi";

const salaries = (from: string, to: string, value: number) => {
  const out = [];
  for (let y = +from.slice(0, 4), m = +from.slice(5, 7); `${y}-${String(m).padStart(2, "0")}` <= to; m === 12 ? (y++, m = 1) : m++) out.push({ month: `${y}-${String(m).padStart(2, "0")}`, value, source: "manual" as const });
  return out;
};

describe("tabelas oficiais versionadas", () => {
  it("têm as séries com fonte e sem jun/1994 em cruzeiros reais", () => {
    for (const s of ["inpc", "ipca", "igpdi", "selic", "salarioMinimo", "ipcr"] as const) expect(Object.keys(OFFICIAL.series[s]).length, s).toBeGreaterThan(10);
    expect(OFFICIAL.series.salarioMinimo["1994-06"]).toBeUndefined();
    expect(OFFICIAL.series.salarioMinimo["1994-07"]).toBe(64.79);
    expect(OFFICIAL.series.ipcr["1994-07"]).toBe(6.08);
    expect(OFFICIAL.sources.inpc.url).toMatch(/^https:\/\/www3\.bcb\.gov\.br/);
  });
  it("teto e mínimo vigentes por mês", () => {
    expect(ceilingAt(OFFICIAL, "2026-11")).toMatchObject({ value: 8475.55, verified: true });
    expect(ceilingAt(OFFICIAL, "2018-06")?.value).toBe(5645.8);
    expect(levelAt(OFFICIAL, "salarioMinimo", "2026-11")).toBe(1621);
  });
  it("índice legal dos salários de contribuição muda por época", () => {
    expect([scIndexFor("1994-09"), scIndexFor("1995-12"), scIndexFor("2000-01"), scIndexFor("2010-01")]).toEqual(["ipcr", "inpc", "igpdi", "inpc"]);
  });
  it("fator acumulado e meses sem índice aparecem na memória", () => {
    const t = withUpdates(OFFICIAL, [{ series: "inpc", month: "2099-01", value: 1 }]);
    const a = accumulate(t, "inpc", "2099-01", "2099-02");
    expect(a.factor).toBeCloseTo(1.01, 10);
    expect(a.missing).toEqual(["2099-02"]);
    const f = scFactor(OFFICIAL, "2024-01", "2024-04"); // INPC fev e mar/2024
    expect(f.factor).toBeCloseTo((1 + OFFICIAL.series.inpc["2024-02"] / 100) * (1 + OFFICIAL.series.inpc["2024-03"] / 100), 12);
  });
  it("tábua do IBGE por sexo", () => {
    expect(lifeExpectancy(OFFICIAL, "mulheres", 59).years).toBe(25);
    expect(lifeExpectancy(OFFICIAL, "homens", 95).years).toBe(OFFICIAL.lifeTables.homens.ex["90"]);
  });
});

describe("regras de transição (EC 103)", () => {
  it("pontos, idade progressiva e idade da mulher no art. 18", () => {
    expect([pointsRequired("F", "2019-12-01"), pointsRequired("F", "2026-11-05"), pointsRequired("F", "2040-01-01")]).toEqual([86, 93, 100]);
    expect([pointsRequired("M", "2026-11-05"), pointsRequired("M", "2040-01-01")]).toEqual([103, 105]);
    expect([art16Age("F", "2026-11-05"), art16Age("M", "2026-11-05"), art16Age("F", "2035-01-01")]).toEqual([59.5, 64.5, 62]);
    expect([art18Age("F", "2021-06-01"), art18Age("F", "2026-01-01"), art18Age("M", "2026-01-01")]).toEqual([61, 62, 65]);
  });
  it("coeficiente 60% + 2% por ano acima de 15 (mulher) / 20 (homem)", () => {
    expect(coefEc103("F", 30 * 365)).toBeCloseTo(0.9, 10);
    expect(coefEc103("M", 30 * 365)).toBeCloseTo(0.8, 10);
    expect(coefEc103("M", 19 * 365)).toBeCloseTo(0.6, 10);
  });
  it("fator previdenciário pela fórmula do art. 29, §7º", () => {
    const f = fatorPrevidenciario(OFFICIAL, "M", 35 * 365, "1966-01-01", "2026-01-01");
    const es = OFFICIAL.lifeTables.ambos_os_sexos.ex["60"];
    expect(f.f).toBeCloseTo(((35 * 0.31) / es) * (1 + (60 + 35 * 0.31) / 100), 3);
  });
  it("idade exata", () => {
    expect(ageOn("1967-08-01", "2027-08-01").years).toBe(60);
    expect(ageOn("1967-08-01", "2027-07-31").years).toBe(59);
  });
});

// Segurada sintética: nascida em 01/08/1967, vínculos de 1990 a 2026 com salários fixos.
const ana: Profile = {
  sex: "F", birthDate: "1967-08-01", conversionDays: 0,
  periods: [{ start: "1996-01-01", end: "2026-10-31" }],
  salaries: salaries("1996-01", "2026-10", 3000),
};

describe("estado, elegibilidade e RMI", () => {
  const s = stateOn(ana, "2026-11-05");
  it("tempo, carência e tempo em 13/11/2019", () => {
    expect(s.carency).toBe(370);
    expect(s.tcDays).toBe(11262);
    expect(s.tc2019Days).toBe(8718);
  });
  it("regras: art. 17 inatingível (menos de 28 anos em 13/11/2019); art. 16 e 15 ainda não", () => {
    const c = checkRules(ana, s);
    expect(c.find((x) => x.id === "art17")).toMatchObject({ reachable: false, eligible: false });
    expect(c.find((x) => x.id === "art16")?.eligible).toBe(false);
    expect(c.find((x) => x.id === "art15")?.eligible).toBe(false);
    expect(c.every((x) => x.source.url.startsWith("https://"))).toBe(true);
  });
  it("salários acima do teto são limitados e abaixo do mínimo pós-reforma ficam fora", () => {
    const r = correctSalaries([{ month: "2001-01", value: 999999, source: "manual" }, { month: "2024-05", value: 100, source: "manual" }], "2026-11");
    expect(r.rows[0].capped).toBe(ceilingAt(OFFICIAL, "2001-01")!.value);
    expect(r.rows[1].excluded).toMatch(/abaixo do mínimo/);
  });
  it("descarte só retira competências enquanto a RMI melhora e o tempo mínimo se mantém", () => {
    const rows = [100, 100, 1000, 1000, 1000].map((v, i) => ({ month: `2020-0${i + 1}`, raw: v, capped: v, factor: 1, corrected: v, excluded: null }));
    const b = bestAverage(rows, { tcDays: 5 * 30, minTcDays: 3 * 30, carency: 3, rmiOf: (avg) => avg });
    expect(b).toMatchObject({ k: 2, avg: 1000, count: 3 });
    expect(bestAverage(rows, { tcDays: 5 * 30, minTcDays: 5 * 30, carency: 3, rmiOf: (a) => a })?.k).toBe(0);
  });
  it("RMI no art. 18 em 2029: média × coeficiente, entre mínimo e teto, com memória", () => {
    const on = "2029-08-01";
    const p: Profile = { ...ana, periods: [{ start: "1996-01-01", end: "2029-07-31" }], salaries: salaries("1996-01", "2029-07", 3000) };
    const st = stateOn(p, on);
    expect(checkRules(p, st).find((x) => x.id === "art18")?.eligible).toBe(true);
    const r = rmiFor("art18", p, st);
    expect(r.rmi).toBeGreaterThan(levelAt(OFFICIAL, "salarioMinimo", "2029-07")!);
    expect(r.rmi).toBeLessThanOrEqual(ceilingAt(OFFICIAL, "2029-08")!.value);
    expect(r.memo.join(" ")).toMatch(/Média de .* salário\(s\) de contribuição atualizado/);
    expect(r.memo.join(" ")).toMatch(/Índice ainda não publicado/); // meses futuros sem INPC são declarados
  });
});

describe("planejamento", () => {
  const pl = plan(ana, "2026-11-05", { salary: 4344.43, rate: "progressiva", from: "2026-11-05" });
  it("datas futuras em ordem, cada uma com requisitos, RMI e retorno", () => {
    expect(pl.points.length).toBeGreaterThan(0);
    expect(pl.points.map((x) => x.date)).toEqual([...pl.points.map((x) => x.date)].sort());
    const art16 = pl.points.find((x) => x.rule === "art16")!;
    expect(art16.date).toBe("2027-08-01"); // 60 anos: art. 16 (mulher, 2027 = 60) com 30 anos já cumpridos
    expect(art16.requirements.every((r) => r.ok)).toBe(true);
    expect(art16.rmi).toBeGreaterThan(0);
    expect(pl.unreachable.map((x) => x.id)).toContain("art17");
    expect(pl.assumptions.join(" ")).toMatch(/tábua IBGE 2024/);
  });
  it("contribuição progressiva 2026 (tabela do INSS)", () => {
    // 1.621×7,5% + (2.902,84−1.621)×9% + (4.344,43−2.902,84)×12% = 121,575 + 115,3656 + 172,9908
    expect(contributionFor(4344.43, "progressiva").value).toBe(409.93);
    expect(contributionFor(5000, "11").value).toBe(178.31);
    expect(contributionFor(99999, "20").base).toBe(8475.55);
  });
});

describe("outros benefícios e atrasados", () => {
  it("incapacidade temporária limitada à média dos 12 últimos; auxílio-acidente 50%", () => {
    const o = otherBenefits(ana, "2026-11-05")!;
    expect(o.items.find((i) => i.id === "acidente")!.value).toBeCloseTo(o.sb * 0.5, 1);
    expect(o.items.find((i) => i.id === "temporaria")!.value).toBeLessThanOrEqual(o.sb * 0.91 + 0.01);
  });
  it("atrasados corrigidos por índice oficial com memória por competência", () => {
    const a = arrears(OFFICIAL, 1000, "2024-01", "2024-03", "inpc");
    expect(a.lines).toHaveLength(3);
    expect(a.lines[2].factor).toBe(1);
    expect(a.lines[0].factor).toBeCloseTo((1 + OFFICIAL.series.inpc["2024-02"] / 100) * (1 + OFFICIAL.series.inpc["2024-03"] / 100), 12);
  });
});
