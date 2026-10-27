import type { MetadataRoute } from "next";

export const SITE_URL = "https://lexsion.com.br";
// Só páginas públicas institucionais. Demonstração, sistema, portal e Super Admin ficam fora (e com noindex).
const PUBLIC = ["/", "/funcionalidades", "/solucoes", "/planos", "/sobre", "/contato", "/instalar", "/privacidade", "/termos"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC.map((p) => ({ url: `${SITE_URL}${p === "/" ? "" : p}`, changeFrequency: "monthly", priority: p === "/" ? 1 : 0.6 }));
}
