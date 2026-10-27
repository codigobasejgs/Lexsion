import { describe, expect, it } from "vitest";
import { buildPreview, guessMapping, SAMPLE_CSV } from "@/domain/importer";
import { parseCsv } from "@/domain/csv";
import type { Client } from "@/domain/types";

describe("importação CSV (A14)", () => {
  const rows = parseCsv(SAMPLE_CSV);
  const map = guessMapping(rows[0]);
  it("reconhece colunas pelo cabeçalho", () => {
    expect(map).toMatchObject({ Nome: "name", CPF: "document", Telefone: "phone", Nascimento: "birthDate" });
  });
  it("classifica cada linha: cria, ignora cabeçalho repetido/placeholder/duplicado, rejeita sem identificação", () => {
    const p = buildPreview(rows, map, []);
    const by = (n: number) => p.find((x) => x.row === n)!;
    expect(by(2).action).toBe("criar");
    expect(by(3).data.birthDate).toBe("1960-01-01"); // serial Excel 21916
    expect(by(4)).toMatchObject({ action: "ignorar", reason: "cabeçalho repetido" });
    expect(by(5).action).toBe("ignorar"); // nd
    expect(by(6).issues.join()).toMatch(/ano artificial/);
    expect(by(7)).toMatchObject({ action: "ignorar", reason: "documento repetido no próprio arquivo" });
    expect(by(8).action).toBe("rejeitar"); // CPF e telefone inválidos
    expect(by(9).data.name).toMatch(/^=HYPERLINK/); // guardado como texto; a exportação CSV neutraliza com apóstrofo
  });
  it("deduplica contra cadastro existente por documento (não por nome)", () => {
    const existing = [{ id: "c1", name: "Outro Nome", document: "529.982.247-25", phone: "" } as Client];
    const p = buildPreview(rows, map, existing);
    expect(p.find((x) => x.row === 2)).toMatchObject({ action: "atualizar", matchId: "c1" });
  });
});
