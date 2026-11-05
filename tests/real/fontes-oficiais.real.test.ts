// Coleta REAL das fontes oficiais (BCB SGS e STJ dados abertos) gravando no Supabase do projeto. RUN_REAL=1.
import fs from "node:fs";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
// Variáveis do servidor (.env.local) para o cliente administrativo; nada é impresso.
if (fs.existsSync(".env.local")) for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }

describe.runIf(process.env.RUN_REAL === "1")("fontes oficiais (real)", () => {
  // A API do BCB não aceita conexão do Node pelo túnel da rede de teste (curl aceita): rodar com BCB_DIRECT=1 onde
  // houver rota direta. Em produção a prova é a rota /api/cron/fontes-oficiais (smoke pós-deploy).
  it.runIf(process.env.BCB_DIRECT === "1")("BCB: grava os últimos meses das séries com URL da fonte", async () => {
    const { syncBcb } = await import("@/lib/official-sources");
    const r = await syncBcb();
    expect(r.errors).toEqual([]);
    expect(r.rows).toBeGreaterThan(9 * 12);
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const { data } = await supabaseAdmin().from("official_series").select("value,source_url").eq("series", "salarioMinimo").eq("month", "2026-01").single();
    expect(Number(data!.value)).toBe(1621);
    expect(data!.source_url).toMatch(/^https:\/\/api\.bcb\.gov\.br/);
  }, 240_000);
  it("STJ: carrega precedentes qualificados; segunda execução só grava o que mudou", async () => {
    const { syncStj } = await import("@/lib/official-sources");
    const a = await syncStj();
    expect(a.total).toBeGreaterThan(2000);
    const b = await syncStj();
    expect(b.changed).toBe(0);
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const { data } = await supabaseAdmin().from("legal_precedents").select("id,official_url,areas").eq("kind", "Tema").textSearch("search", "aposentadoria especial", { type: "websearch", config: "portuguese" }).limit(3);
    expect(data!.length).toBeGreaterThan(0);
    expect(data![0].official_url).toMatch(/^https:\/\/processo\.stj\.jus\.br/);
  }, 280_000);
});
