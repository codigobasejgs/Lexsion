// Manifestos PWA por contexto (função pura, testável). Um origin, vários apps: o `id` distingue cada instalação.
// Limitação real: no mesmo host, escopos se sobrepõem (tudo vive em /app); o isolamento de instalação por SO
// só fica garantido com host próprio por escritório (subdomínio/domínio) — fase de DNS.
import type { MetadataRoute } from "next";
import type { Tenant } from "@/domain/tenancy";

export type ManifestKey = "lexsion" | "admin" | `erp-${string}` | `portal-${string}`;
export const manifestHref = (key: ManifestKey) => `/pwa/${key}/manifest.webmanifest`;

const OBSIDIAN = "#090A0D";
const LEXSION_ICONS: MetadataRoute.Manifest["icons"] = [
  { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
  { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  { src: "/icons/monochrome-512.png", sizes: "512x512", type: "image/png", purpose: "monochrome" },
];
const tenantIcons = (slug: string): MetadataRoute.Manifest["icons"] => [
  { src: `/tenants/${slug}/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
  { src: `/tenants/${slug}/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
  { src: `/tenants/${slug}/maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
];

const base = { lang: "pt-BR", dir: "ltr" as const, display: "standalone" as const, orientation: "any" as const, categories: ["business", "productivity"] };

export function buildManifest(key: string, tenants: Tenant[]): MetadataRoute.Manifest | null {
  if (key === "lexsion")
    return { ...base, id: "/?app=lexsion", name: "LexSion — Plataforma Jurídica Inteligente", short_name: "LexSion", description: "Toda a advocacia. Uma plataforma. Ambiente demonstrativo.", start_url: "/?origem=pwa", scope: "/", background_color: OBSIDIAN, theme_color: OBSIDIAN, icons: LEXSION_ICONS };
  if (key === "admin")
    return { ...base, id: "/admin/?app=lexsion-admin", name: "LexSion Super Admin", short_name: "LexSion Admin", description: "Operação da plataforma LexSion. Ambiente demonstrativo.", start_url: "/admin/organizacoes?origem=pwa", scope: "/admin/", background_color: OBSIDIAN, theme_color: OBSIDIAN, icons: LEXSION_ICONS };
  const m = key.match(/^(erp|portal)-([a-z0-9-]+)$/);
  const t = m && tenants.find((x) => x.slug === m[2] && x.status !== "removida");
  if (!m || !t) return null;
  const b = t.settings;
  const portal = m[1] === "portal";
  return {
    ...base,
    // id estável por escritório: trocar logo/cor/nome NÃO muda o id (não cria app duplicado).
    id: portal ? `/portal/?app=portal-${t.slug}` : `/demo/tenant/${t.slug}/?app=erp`,
    name: portal ? `${b.brandName} — Área do cliente` : b.brandName,
    short_name: portal ? `${b.pwaShortName} Cliente`.slice(0, 20) : b.pwaShortName,
    description: portal ? `Acompanhe seus casos com ${b.brandName}.` : `Sistema do escritório ${b.brandName}. Ambiente demonstrativo.`,
    start_url: portal ? `/portal?escritorio=${t.slug}&origem=pwa` : `/demo/tenant/${t.slug}?origem=pwa`,
    scope: portal ? "/portal" : "/",
    background_color: b.backgroundDark,
    theme_color: b.backgroundDark,
    icons: tenantIcons(t.slug),
  };
}
