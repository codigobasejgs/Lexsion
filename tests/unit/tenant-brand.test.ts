import { describe, expect, it } from "vitest";
import { sniff, validateLogoBytes, validateLogoSize, MAX_LOGO_BYTES } from "@/lib/logo-upload";
import { tenantTheme, SURFACES } from "@/lib/tenant-tokens";
import { contrast } from "@/lib/contrast";
import { DEFAULT_BRANDING, normalizeHex, monthlyValue } from "@/domain/tenancy";
import { buildManifest, buildRealManifest } from "@/lib/pwa-manifest";
import { resolveContext } from "@/lib/tenant-resolver";
import { tenants } from "@/mocks/tenants";
import { slugError } from "@/services/mock/tenant-repo";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const enc = (s: string) => new TextEncoder().encode(s);

describe("QA-049..056 — upload de logotipo", () => {
  it("identifica pelo conteúdo, não pela extensão", () => {
    expect(sniff(PNG)).toBe("png");
    expect(sniff(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
    expect(sniff(enc("RIFF\0\0\0\0WEBPVP8 "))).toBe("webp");
    expect(sniff(enc('<?xml version="1.0"?><svg onload="alert(1)">'))).toBe("svg");
  });
  it("recusa SVG (inclusive com script), vazio, grande, desconhecido e extensão trocada", () => {
    expect(validateLogoBytes(enc("<svg><script>alert(1)</script></svg>"), "logo.png")).toMatch(/SVG não é aceito/);
    expect(validateLogoBytes(new Uint8Array(), "a.png")).toBe("Arquivo vazio.");
    expect(validateLogoBytes(new Uint8Array(MAX_LOGO_BYTES + 1).fill(0x89), "a.png")).toMatch(/2 MB/);
    expect(validateLogoBytes(enc("MZ executável"), "logo.png")).toMatch(/não reconhecido/);
    expect(validateLogoBytes(PNG, "logo.jpg")).toMatch(/extensão/);
    expect(validateLogoBytes(PNG, "LOGO.PNG")).toBeNull();
  });
  it("limites de dimensão", () => {
    expect(validateLogoSize(32, 200)).toMatch(/pequena/);
    expect(validateLogoSize(5000, 100)).toMatch(/grande/);
    expect(validateLogoSize(512, 512)).toBeNull();
  });
});

describe("QA-057..063 — cores do escritório sempre legíveis", () => {
  const extremes = ["#ffffff", "#000000", "#ffff00", "#0000ff", "#777777", "#f6d88c"];
  for (const c of extremes) {
    it(`cor ${c}: botão ≥3:1 com a superfície, texto do botão ≥4,5:1, destaque ≥4,5:1`, () => {
      const t = tenantTheme({ ...DEFAULT_BRANDING, primary: c, accent: c });
      for (const mode of ["dark", "light"] as const) {
        const s = SURFACES[mode];
        expect(contrast(t[mode].brand, s.surface)).toBeGreaterThanOrEqual(3);
        expect(contrast(t[mode].onBrand, t[mode].brand)).toBeGreaterThanOrEqual(4.5);
        for (const bg of [s.canvas, s.surface, s.selection]) expect(contrast(t[mode].accent, bg)).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
  it("os 3 escritórios demo têm cores distintas e legíveis", () => {
    expect(new Set(tenants.map((t) => t.settings.primary)).size).toBe(3);
  });
  it("normaliza hex", () => {
    expect(normalizeHex("#ABC")).toBe("#aabbcc");
    expect(normalizeHex("javascript:alert(1)")).toBeNull();
  });
});

describe("PWA-001..012 — manifestos por contexto", () => {
  it("LexSion, Super Admin, ERP e portal de cada escritório têm ids distintos e mesma origem", () => {
    const keys = ["lexsion", "admin", ...tenants.flatMap((t) => [`erp-${t.slug}`, `portal-${t.slug}`])];
    const ms = keys.map((k) => buildManifest(k, tenants)!);
    expect(new Set(ms.map((m) => m.id)).size).toBe(keys.length);
    for (const m of ms) {
      expect(m.id!.startsWith("/") && m.start_url!.startsWith("/")).toBe(true);
      expect(m.start_url!.startsWith(m.scope!.replace(/\/$/, "")) || m.scope === "/").toBe(true);
      expect(m.icons!.some((i) => i.sizes === "512x512")).toBe(true);
    }
  });
  it("ícones de um escritório nunca aparecem no manifesto de outro nem no LexSion", () => {
    const a = JSON.stringify(buildManifest("erp-aurora-advocacia", tenants));
    expect(a).not.toMatch(/atlas-juridico|novo-escritorio|\/icons\//);
    expect(JSON.stringify(buildManifest("lexsion", tenants))).not.toMatch(/tenants\//);
  });
  it("id estável após trocar marca", () => {
    const changed = tenants.map((t) => (t.slug === "atlas-juridico" ? { ...t, settings: { ...t.settings, brandName: "Atlas Novo", primary: "#ff0000" } } : t));
    expect(buildManifest("erp-atlas-juridico", changed)!.id).toBe(buildManifest("erp-atlas-juridico", tenants)!.id);
  });
  it("escritório desconhecido ou removido: sem manifesto", () => {
    expect(buildManifest("erp-nao-existe", tenants)).toBeNull();
    expect(buildManifest("erp-aurora-advocacia", tenants.map((t) => ({ ...t, status: "removida" as const })))).toBeNull();
  });
});

describe("QA-013..020 — resolução de contexto", () => {
  it("rotas e hosts", () => {
    expect(resolveContext("localhost", "/admin/organizacoes")).toEqual({ context: "admin", slug: null });
    expect(resolveContext("localhost", "/demo/tenant/atlas-juridico")).toEqual({ context: "tenant", slug: "atlas-juridico" });
    expect(resolveContext("localhost", "/demo/tenant/invasor")).toEqual({ context: "tenant", slug: null });
    expect(resolveContext("aurora-advocacia.lexsion.com.br", "/app/inicio")).toEqual({ context: "tenant", slug: "aurora-advocacia" });
    expect(resolveContext("desconhecido.lexsion.com.br", "/app/inicio")).toEqual({ context: "tenant", slug: null });
    expect(resolveContext("admin.lexsion.com.br", "/")).toEqual({ context: "admin", slug: null });
    expect(resolveContext("localhost", "/")).toEqual({ context: "platform", slug: null });
  });
  it("slugs reservados, inválidos e duplicados", () => {
    expect(slugError("admin", [])).toMatch(/reservado/);
    expect(slugError("-ruim", [])).toMatch(/minúsculas/);
    expect(slugError("Aurora", [])).toMatch(/minúsculas/);
    expect(slugError("aurora-advocacia", ["aurora-advocacia"])).toMatch(/em uso/);
    expect(slugError("silva-advogados", [])).toBeNull();
  });
});

describe("QA-161..164 — receita SaaS", () => {
  it("MRR conta só assinatura ativa/inadimplente; trial e suspenso não entram", () => {
    expect(monthlyValue({ plan: "profissional", cycle: "anual", status: "ativa" })).toBe(33250);
    expect(monthlyValue({ plan: "profissional", cycle: "mensal", status: "trial" })).toBe(0);
    expect(monthlyValue({ plan: "essencial", cycle: "mensal", status: "suspensa" })).toBe(0);
  });
});

describe("PWA de escritório REAL (marca pública do banco)", () => {
  const b = { slug: "silva-adv", name: "Silva Advogados", brandName: "Silva Advogados", pwaShortName: "Silva", primary: "#123456", backgroundDark: "#0a0b0c", iconVersion: 4, hasIcon: true };
  it("ERP e portal têm ids distintos e estáveis, abrem o login real e usam o ícone próprio versionado", () => {
    const erp = buildRealManifest("erp", b, "https://x.supabase.co/storage/v1/object/public/marcas/slug-silva-adv");
    const portal = buildRealManifest("portal", b, "https://x.supabase.co/storage/v1/object/public/marcas/slug-silva-adv");
    expect(erp.id).not.toBe(portal.id);
    expect(buildRealManifest("erp", { ...b, brandName: "Outro nome", iconVersion: 9 }, "u").id).toBe(erp.id);
    expect(erp.start_url).toMatch(/^\/entrar\?escritorio=silva-adv/);
    expect(portal.start_url).toMatch(/perfil=cliente/);
    expect(erp.icons!.every((i) => i.src.includes("slug-silva-adv") && i.src.endsWith("?v=4"))).toBe(true);
    expect(erp.theme_color).toBe("#0a0b0c");
    expect(JSON.stringify(erp)).not.toMatch(/demonstrativo|demo\//);
  });
  it("sem ícone próprio usa o da LexSion; cor inválida cai no padrão", () => {
    const m = buildRealManifest("erp", { ...b, hasIcon: false, backgroundDark: "red;}" }, "u");
    expect(m.icons!.every((i) => i.src.startsWith("/icons/"))).toBe(true);
    expect(m.theme_color).toBe("#090A0D");
  });
});
