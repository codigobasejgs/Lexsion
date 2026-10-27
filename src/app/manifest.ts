import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { tenants } from "@/mocks/tenants";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const headersList = await headers();
  const tenantSlug = headersList.get("x-tenant-slug") || "aurora-advocacia";
  const tenant = tenants.find(t => t.slug === tenantSlug) || tenants[0];

  // ponytail: id estável mesmo-origin por tenant; se mudar id, reinstala PWA.
  const id = `/app/inicio?tenant=${tenant.slug}`;

  return {
    id,
    name: `${tenant.name} — SIWILTEC`,
    short_name: tenant.name.length > 12 ? tenant.slug : tenant.name,
    description: `Gestão inteligente para ${tenant.name}. Atendimento, casos, documentos, agenda e financeiro. Ambiente demonstrativo.`,
    lang: "pt-BR",
    dir: "ltr",
    start_url: `/app/inicio?origem=pwa&tenant=${tenant.slug}`,
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: tenant.settings.primaryColor,
    theme_color: tenant.settings.primaryColor,
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/monochrome-512.png", sizes: "512x512", type: "image/png", purpose: "monochrome" },
    ],
    shortcuts: [
      { name: "Meu dia", url: "/app/inicio", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Atendimento", url: "/app/atendimento", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Agenda", url: "/app/agenda", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
