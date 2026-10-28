import { buildManifest, buildRealManifest, type PublicBrand } from "@/lib/pwa-manifest";
import { tenants } from "@/mocks/tenants";
import { DEMO_SLUGS } from "@/lib/tenant-resolver";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabaseConfigured } from "@/lib/supabase/env";

// Manifesto por contexto. Escritórios da demonstração: catálogo fixo. Escritórios REAIS: marca pública do banco
// (public_brand: só nome, cores e ícone; escritório suspenso não tem manifesto). Revalida sempre.
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const m = buildManifest(key, tenants) ?? (await realManifest(key));
  if (!m) return new Response("Manifesto não encontrado", { status: 404 });
  return new Response(JSON.stringify(m), {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8", "Cache-Control": "public, max-age=0, must-revalidate" },
  });
}

async function realManifest(key: string) {
  const m = key.match(/^(erp|portal)-([a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9]))$/);
  if (!m || DEMO_SLUGS.includes(m[2]) || !supabaseConfigured()) return null;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/public_brand`, {
    method: "POST",
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_slug: m[2] }),
    cache: "no-store",
  }).catch(() => null);
  const b = (await r?.json().catch(() => null)) as (PublicBrand & { id?: string }) | null;
  if (!r?.ok || !b?.slug) return null;
  return buildRealManifest(m[1] as "erp" | "portal", b, `${SUPABASE_URL}/storage/v1/object/public/marcas/slug-${m[2]}`);
}

