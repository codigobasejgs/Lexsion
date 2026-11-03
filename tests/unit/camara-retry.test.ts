import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { discoverUpdates } = await import("@/lib/legal-intel/camara");

// A API da Câmara dá 504 em janelas curtas (visto em produção): a coleta tenta de novo com espera crescente e só
// desiste depois de 5 tentativas. Tempo simulado (fake timers) para o teste não esperar ~30 s.
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const ok = { ok: true, status: 200, headers: new Headers(), json: async () => ({ dados: [{ id: 7 }], links: [] }) };
const bad = { ok: false, status: 504, headers: new Headers(), json: async () => ({}) };

describe("Câmara: retry em instabilidade", () => {
  it("504 três vezes e depois 200: coleta normalmente", async () => {
    vi.useFakeTimers();
    const f = vi.fn().mockResolvedValueOnce(bad).mockResolvedValueOnce(bad).mockResolvedValueOnce(bad).mockResolvedValue(ok);
    vi.stubGlobal("fetch", f);
    const p = discoverUpdates("2026-11-01", "2026-11-02");
    await vi.runAllTimersAsync();
    expect(await p).toEqual([7]);
    expect(f).toHaveBeenCalledTimes(4);
  });
  it("504 em todas as 5 tentativas: erro claro (sem loop infinito)", async () => {
    vi.useFakeTimers();
    const f = vi.fn().mockResolvedValue(bad);
    vi.stubGlobal("fetch", f);
    const p = discoverUpdates("2026-11-01", "2026-11-02").catch((e: Error) => e.message);
    await vi.runAllTimersAsync();
    expect(await p).toBe("Câmara respondeu HTTP 504");
    expect(f).toHaveBeenCalledTimes(5);
  });
});
