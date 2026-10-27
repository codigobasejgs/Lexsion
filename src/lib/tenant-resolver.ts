// Resolução de contexto por host e rota. Sem dependências: roda no proxy (antes da renderização).
// Produção futura: hostname verificado → tenant_domains → tenant_id no servidor. Demo: mapa local + rotas /demo/tenant/<slug>.
export const TENANT_HEADER = "x-lexsion-tenant";
export const CONTEXT_HEADER = "x-lexsion-context";

export type AppContext = "platform" | "admin" | "tenant" | "portal";

// Slugs demonstrativos conhecidos; escritórios criados na demo só existem no navegador (IndexedDB),
// então o servidor não os conhece — o manifesto deles cai no slug genérico (limitação documentada).
export const DEMO_SLUGS = ["aurora-advocacia", "atlas-juridico", "novo-escritorio"];
// Domínio da plataforma (preparação). Subdomínios só valem com DNS/SSL configurados — não nesta fase.
export const PLATFORM_DOMAIN = "lexsion.com.br";

export const DEMO_COOKIE = "lexsion_demo_tenant";
/** Só slugs demonstrativos conhecidos; qualquer outro valor do navegador é ignorado. */
export const demoSlugFromCookie = (v: string | undefined) => (v && DEMO_SLUGS.includes(v) ? v : null);

export function resolveContext(hostname: string, pathname: string): { context: AppContext; slug: string | null } {
  const demo = pathname.match(/^\/demo\/tenant\/([a-z0-9-]+)/);
  if (demo) return { context: "tenant", slug: DEMO_SLUGS.includes(demo[1]) ? demo[1] : null };
  const sub = hostname.endsWith(`.${PLATFORM_DOMAIN}`) ? hostname.slice(0, -PLATFORM_DOMAIN.length - 1) : null;
  if (sub === "admin" || pathname.startsWith("/admin")) return { context: "admin", slug: null };
  const slug = sub && sub !== "app" && sub !== "www" ? (DEMO_SLUGS.includes(sub) ? sub : null) : null;
  if (pathname.startsWith("/portal")) return { context: "portal", slug };
  if (pathname.startsWith("/app") || slug) return { context: "tenant", slug };
  return { context: "platform", slug: null };
}
