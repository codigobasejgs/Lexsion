import { buildManifest } from "@/lib/pwa-manifest";
import { tenants } from "@/mocks/tenants";

// Manifesto por contexto. Sem cache compartilhado entre contextos (a URL já distingue; revalida sempre).
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const m = buildManifest(key, tenants);
  if (!m) return new Response("Manifesto não encontrado", { status: 404 });
  return new Response(JSON.stringify(m), {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8", "Cache-Control": "public, max-age=0, must-revalidate" },
  });
}
