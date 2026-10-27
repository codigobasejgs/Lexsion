import type { MetadataRoute } from "next";
import { SITE_URL } from "./sitemap";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/app/", "/portal", "/admin", "/demonstracao", "/demo/", "/entrar", "/recuperar-acesso", "/pwa/", "/offline", "/design-system"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
