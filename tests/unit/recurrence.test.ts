import { describe, expect, it } from "vitest";
import { nextOccurrence, upcomingBirthdays } from "@/domain/recurrence";
import { scheduleWorkflow, WORKFLOW_TEMPLATES } from "@/domain/workflows";

describe("F18 — tarefa recorrente", () => {
  it("semana, quinzena, mês e ano", () => {
    expect(nextOccurrence("2026-10-26", { every: "semana" })).toBe("2026-11-02");
    expect(nextOccurrence("2026-12-25", { every: "quinzena" })).toBe("2027-01-08");
    expect(nextOccurrence("2026-10-26", { every: "mes" })).toBe("2026-11-26");
    expect(nextOccurrence("2026-10-26", { every: "ano" })).toBe("2027-10-26");
  });
  it("dia 31 em mês curto usa o último dia e volta ao 31 depois", () => {
    expect(nextOccurrence("2027-01-31", { every: "mes" })).toBe("2027-02-28");
    expect(nextOccurrence("2027-02-28", { every: "mes" }, 31)).toBe("2027-03-31");
    expect(nextOccurrence("2028-01-31", { every: "mes" })).toBe("2028-02-29"); // bissexto
  });
  it("pausada ou depois da data final: sem próxima", () => {
    expect(nextOccurrence("2026-10-26", { every: "semana", paused: true })).toBeNull();
    expect(nextOccurrence("2026-10-26", { every: "mes", until: "2026-11-01" })).toBeNull();
  });
});

describe("F18 — aniversariantes", () => {
  const people = [
    { name: "A", birthDate: "1964-10-27" as const }, { name: "B", birthDate: "1990-11-30" as const },
    { name: "C", birthDate: "1980-02-29" as const }, { name: "D" }, { name: "E", birthDate: "1975-01-03" as const },
  ];
  it("intervalo, idade e ordem; sem data é ignorado; vira o ano", () => {
    const r = upcomingBirthdays(people, "2026-10-26", 30);
    expect(r.map((x) => [x.person.name, x.date, x.age, x.inDays])).toEqual([["A", "2026-10-27", 62, 1]]);
    const dez = upcomingBirthdays(people, "2026-12-20", 20);
    expect(dez.map((x) => [x.person.name, x.date, x.age])).toEqual([["E", "2027-01-03", 52]]);
  });
  it("29/02 em ano não bissexto cai em 28/02", () => {
    expect(upcomingBirthdays(people, "2027-02-20", 10).map((x) => x.date)).toEqual(["2027-02-28"]);
  });
});

describe("workflows encadeados (dias úteis)", () => {
  it("cada etapa começa quando a anterior vence e pula fim de semana e feriado", () => {
    const t = { id: "x", area: "x", name: "x", steps: [{ title: "A", days: 2, role: "advogado" as const }, { title: "B", days: 1, role: "advogado" as const }] };
    // seg 26/10/2026 + 2 úteis = qua 28/10; + 1 útil = qui 29/10 → com feriado em 29/10, vai a sex 30/10
    expect(scheduleWorkflow(t, "2026-10-26", []).map((s) => s.due)).toEqual(["2026-10-28", "2026-10-29"]);
    expect(scheduleWorkflow(t, "2026-10-26", [{ date: "2026-10-29", name: "Feriado local" }]).map((s) => s.due)).toEqual(["2026-10-28", "2026-10-30"]);
  });
  it("modelos são originais e têm 4+ etapas com prazo positivo", () => {
    expect(WORKFLOW_TEMPLATES.length).toBeGreaterThanOrEqual(5);
    expect(WORKFLOW_TEMPLATES.every((t) => t.steps.length >= 4 && t.steps.every((s) => s.days > 0))).toBe(true);
  });
});
