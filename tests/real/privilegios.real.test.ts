import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

// Privilégios REAIS no Supabase de produção (o banco local não reproduz os padrões do Supabase).
// Lê o catálogo pela Management API; nada é alterado.
const env: Record<string, string> = {};
if (fs.existsSync(".env.local")) for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l); if (m) env[m[1]] = m[2]; }
const ON = process.env.RUN_REAL === "1" && !!env.SUPABASE_ACCESS_TOKEN;
const q = async <T,>(sql: string): Promise<T[]> => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/database/query`, { method: "POST", headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: sql }) });
  return r.json();
};

describe.skipIf(!ON)("REAL — privilégios do banco", () => {
  it("anônimo não tem privilégio em nenhuma tabela pública; autenticado nunca tem TRUNCATE", async () => {
    const anon = await q<{ table_name: string }>("select distinct table_name from information_schema.role_table_grants where table_schema='public' and grantee='anon'");
    expect(anon).toEqual([]);
    const trunc = await q<{ table_name: string }>("select distinct table_name from information_schema.role_table_grants where table_schema='public' and grantee='authenticated' and privilege_type in ('TRUNCATE','REFERENCES','TRIGGER')");
    expect(trunc).toEqual([]);
  });
  it("RLS ligada em todas as tabelas públicas", async () => {
    const off = await q<{ relname: string }>("select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity");
    expect(off).toEqual([]);
  });
  it("hash do segredo do webhook não é legível por usuário logado", async () => {
    const cols = await q<{ column_name: string }>("select column_name from information_schema.column_privileges where table_schema='public' and table_name='whatsapp_instances' and grantee='authenticated' and privilege_type='SELECT'");
    expect(cols.map((c) => c.column_name)).not.toContain("webhook_secret_hash");
  });
  it("anônimo só executa a função de marca pública", async () => {
    const f = await q<{ routine_name: string }>("select distinct routine_name from information_schema.role_routine_grants where routine_schema='public' and grantee='anon'");
    expect(f.map((x) => x.routine_name)).toEqual(["public_brand"]);
    const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
    expect((await anon.from("org_records").select("id").limit(1)).error?.message ?? "").toMatch(/permission denied/);
    expect((await anon.rpc("my_access")).error).not.toBeNull();
  });
});
