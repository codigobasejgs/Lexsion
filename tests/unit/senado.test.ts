import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { normalizeSenado } = await import("@/lib/legal-intel/senado");

// Formato real do serviço /dadosabertos/processo (amostra de 29/10/2026, campos reduzidos).
const pl = { id: 9001, codigoMateria: 170001, identificacao: "PL 1234/2026", tipoDocumento: "Projeto de Lei Ordinária", ementa: "Altera a Lei nº 8.213, de 1991, para dispor sobre aposentadoria especial.", casaIdentificadora: "SF", dataApresentacao: "2026-03-10", situacaoAtual: "AGUARDANDO DESIGNAÇÃO DO RELATOR", dataSituacaoAtual: "2026-10-28", dataUltimaAtualizacao: "2026-10-28T15:26:48.77", tramitando: "Sim" };

describe("Conector do Senado (normalização)", () => {
  it("proposição vira documento com link oficial do Senado e data em UTC", () => {
    const d = normalizeSenado(pl, "2026-10-27")!;
    expect(d).toMatchObject({ externalId: "170001", docKind: "proposicao", typeCode: "PL", number: "1234/2026", title: "PL 1234/2026", organ: "Senado Federal", publishedOn: "2026-03-10" });
    expect(d.officialUrl).toBe("https://www25.senado.leg.br/web/atividade/materias/-/materia/170001");
    expect(d.lastEventAt).toBe("2026-10-28T18:26:48.000Z");
  });
  it("medida provisória e matéria do Congresso", () => {
    expect(normalizeSenado({ ...pl, tipoDocumento: "Medida Provisória", identificacao: "MPV 1300/2026", casaIdentificadora: "CN" }, "2026-10-27")).toMatchObject({ docKind: "medida_provisoria", organ: "Congresso Nacional" });
  });
  it("ignora requerimento/aviso e matéria encerrada que só recebeu documento antigo", () => {
    expect(normalizeSenado({ ...pl, tipoDocumento: "Requerimento" }, "2026-10-27")).toBeNull();
    expect(normalizeSenado({ ...pl, tramitando: "Não", dataSituacaoAtual: "1963-02-04" }, "2026-10-27")).toBeNull();
    expect(normalizeSenado({ ...pl, tramitando: "Não", dataSituacaoAtual: "2026-10-28", normaGerada: "Lei nº 15.300" }, "2026-10-27")?.statusLabel).toMatch(/Lei nº 15\.300/);
  });
  it("hash muda com a situação, não com anexo de documento", () => {
    const a = normalizeSenado(pl, "2026-10-27")!.contentHash;
    expect(normalizeSenado({ ...pl, ultimaInformacaoAtualizada: "DOCUMENTO", dataUltimaAtualizacao: "2026-10-29T09:00:00" }, "2026-10-27")!.contentHash).toBe(a);
    expect(normalizeSenado({ ...pl, situacaoAtual: "PRONTA PARA A PAUTA NA COMISSÃO", dataSituacaoAtual: "2026-10-29" }, "2026-10-27")!.contentHash).not.toBe(a);
  });
});
