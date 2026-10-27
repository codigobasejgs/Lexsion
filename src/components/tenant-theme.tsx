"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "@/components/providers";
import { tenantCss, tenantTheme } from "@/lib/tenant-tokens";

// Aplica a identidade do escritório no ERP e no portal. Super Admin, entrada e páginas públicas ficam LexSion.
// Tokens com contraste garantido; a cor escolhida pelo escritório continua salva como foi escolhida.
export function TenantTheme() {
  const { tenant } = useSession();
  const path = usePathname();
  const scoped = !!tenant && (path.startsWith("/app") || path.startsWith("/portal"));
  const css = scoped ? tenantCss(tenant.slug, tenantTheme(tenant.settings)) : "";
  const s = tenant?.settings;

  useEffect(() => {
    const root = document.documentElement;
    if (scoped) root.dataset.tenant = tenant!.slug;
    else delete root.dataset.tenant;
    // Título do contexto certo também após navegação no cliente; o servidor já manda certo graças ao cookie demo.
    const title = scoped ? s!.brandName : path.startsWith("/admin") ? "LexSion Super Admin" : "LexSion — Plataforma Jurídica Inteligente";
    const fix = () => { if (!path.startsWith("/demo/tenant/") && document.title !== title) document.title = title; };
    fix();
    const t = setTimeout(() => { fix(); syncManifest(); }, 300); // Next aplica o head da rota depois do efeito
    // Manifesto do contexto atual, sem esperar novo carregamento do servidor.
    // Uma única <link rel=manifest> (BUG LX-06: a navegação deixava duas e o navegador usava a primeira, errada).
    const href = scoped ? `/pwa/${path.startsWith("/portal") ? "portal" : "erp"}-${tenant!.slug}/manifest.webmanifest` : path.startsWith("/admin") ? "/pwa/admin/manifest.webmanifest" : "/pwa/lexsion/manifest.webmanifest";
    // Entrada pública do escritório (/demo/tenant/<slug>): o servidor já resolveu pelo endereço; não sobrescrever.
    const serverOwned = path.startsWith("/demo/tenant/");
    const syncManifest = () => {
      if (serverOwned) return;
      const links = [...document.querySelectorAll<HTMLLinkElement>('link[rel="manifest"]')];
      links.slice(1).forEach((l) => l.remove());
      if (links[0] && links[0].getAttribute("href") !== href) links[0].setAttribute("href", href);
    };
    syncManifest();
    root.dataset.density = scoped ? s!.density : "confortavel";
    root.dataset.textSize = scoped ? s!.textSize : "padrao";
    root.dataset.motion = scoped && s!.reducedMotion ? "reduce" : "auto";
    return () => clearTimeout(t);
  }, [scoped, tenant, s, path]);

  return css ? <style data-testid="tenant-theme">{css}</style> : null;
}
