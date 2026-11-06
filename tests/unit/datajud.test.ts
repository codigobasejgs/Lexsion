// DataJud: número CNJ, roteamento por tribunal e normalização. Sem rede (fetch simulado), sem processo real.
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { aliasFor, datajudLookup, parseCnj } from "@/lib/datajud";

// Número sintético com dígito verificador calculado pela regra do CNJ (módulo 97).
const make = (n: string, ano: string, j: string, tr: string, o: string) => {
  const dv = 98 - Number(BigInt(`${n}${ano}${j}${tr}${o}00`) % BigInt(97));
  return `${n}-${String(dv).padStart(2, "0")}.${ano}.${j}.${tr}.${o}`;
};

describe("número CNJ", () => {
  it("aceita o dígito correto e recusa o errado", () => {
    const ok = make("0001234", "2024", "4", "01", "3300");
    expect(parseCnj(ok)?.formatted).toBe(ok);
    const wrong = ok.replace(/-(\d\d)\./, (_, d) => `-${String((Number(d) + 1) % 100).padStart(2, "0")}.`);
    expect(parseCnj(wrong)).toBeNull();
    expect(parseCnj("123")).toBeNull();
  });
  it("roteia para o índice oficial do tribunal", () => {
    expect([aliasFor(4, 1), aliasFor(8, 5), aliasFor(8, 26), aliasFor(5, 0), aliasFor(5, 15), aliasFor(6, 7), aliasFor(3, 0), aliasFor(9, 26)]).toEqual(["trf1", "tjba", "tjsp", "tst", "trt15", "tre-dft", "stj", "tjmsp"]);
    expect(aliasFor(1, 0)).toBeNull(); // STF fora da API pública
  });
});

describe("consulta", () => {
  const cnj = make("0001234", "2024", "4", "01", "3300");
  it("monta a consulta só com campos públicos, filtra sigilosos e ordena andamentos", async () => {
    process.env.DATAJUD_API_KEY = "x".repeat(30);
    const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      expect(body._source).not.toContain("partes");
      expect(body.query.match.numeroProcesso).toBe(cnj.replace(/\D/g, ""));
      return new Response(JSON.stringify({ hits: { hits: [
        { _source: { tribunal: "TRF1", grau: "G1", classe: { nome: "Procedimento Comum" }, orgaoJulgador: { nome: "1ª Vara Federal" }, dataAjuizamento: "20240115000000", assuntos: [{ nome: "Aposentadoria" }], movimentos: [{ dataHora: "2024-02-01T10:00:00", nome: "Citação" }, { dataHora: "2024-03-01T10:00:00", nome: "Sentença" }] } },
        { _source: { tribunal: "TRF1", nivelSigilo: 1 } },
      ] } }), { status: 200 });
    });
    const r = await datajudLookup(cnj, fetcher as unknown as typeof fetch);
    expect(fetcher.mock.calls[0][0]).toBe("https://api-publica.datajud.cnj.jus.br/api_publica_trf1/_search");
    if (!r.ok) throw new Error(r.message);
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ classe: "Procedimento Comum", ajuizamento: "2024-01-15T00:00:00", assuntos: ["Aposentadoria"] });
    expect(r.items[0].movimentos.map((m) => m.nome)).toEqual(["Sentença", "Citação"]);
  });
  it("chave recusada e tribunal fora da API viram mensagens claras", async () => {
    const r = await datajudLookup(cnj, (async () => new Response("{}", { status: 401 })) as unknown as typeof fetch);
    expect(r).toMatchObject({ ok: false, code: "key" });
    expect(await datajudLookup(make("0000001", "2024", "1", "00", "0000"))).toMatchObject({ ok: false, code: "unsupported" });
  });
});
