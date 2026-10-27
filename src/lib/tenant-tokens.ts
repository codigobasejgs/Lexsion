// Tokens de tema do escritório com contraste garantido (WCAG AA) em claro e escuro.
// A cor escolhida é preservada na configuração; só o valor APLICADO é ajustado quando faltaria contraste.
import { contrast, ensureContrast } from "./contrast";
import type { TenantBranding } from "@/domain/tenancy";

// Superfícies reais dos temas (globals.css) — o contraste é medido contra elas.
export const SURFACES = { dark: { canvas: "#090A0D", surface: "#14171D", selection: "#2a2416" }, light: { canvas: "#FCFAF6", surface: "#ffffff", selection: "#f3ead6" } };

export interface ThemeTokens { brand: string; brandHover: string; onBrand: string; accent: string; focus: string }
export interface TenantTheme { dark: ThemeTokens; light: ThemeTokens; adjusted: string[] }

const BLACK = "#0b0d10";
const WHITE = "#ffffff";
const shade = (hex: string, f: number) => `#${[1, 3, 5].map((i) => Math.round(Math.max(0, Math.min(255, parseInt(hex.slice(i, i + 2), 16) * f))).toString(16).padStart(2, "0")).join("")}`;

function tokens(b: TenantBranding, mode: "dark" | "light", adjusted: string[]): ThemeTokens {
  const s = SURFACES[mode];
  // Botão: cor da marca como fundo; precisa de ≥3:1 com a superfície (componente) e texto ≥4,5:1 sobre ele.
  let brand = ensureContrast(b.primary, s.surface, 3);
  const onBrand = contrast(WHITE, brand.color) >= contrast(BLACK, brand.color) ? WHITE : BLACK;
  // Cinzas médios não chegam a 4,5:1 nem com branco nem com preto: escurece (ou clareia) o fundo do botão até chegar.
  if (contrast(onBrand, brand.color) < 4.5) brand = { color: ensureContrast(brand.color, onBrand, 4.5).color, adjusted: true };
  if (brand.adjusted) adjusted.push(`Cor principal ajustada no tema ${mode === "dark" ? "escuro" : "claro"} (${b.primary} → ${brand.color})`);
  // Texto de destaque (links, rótulos): ≥4,5:1 sobre canvas, superfície e seleção.
  let accent = b.accent;
  for (const bg of [s.canvas, s.surface, s.selection]) accent = ensureContrast(accent, bg, 4.5).color;
  if (accent !== b.accent) adjusted.push(`Cor de destaque ajustada no tema ${mode === "dark" ? "escuro" : "claro"} (${b.accent} → ${accent})`);
  return { brand: brand.color, brandHover: shade(brand.color, mode === "dark" ? 1.12 : 0.88), onBrand, accent, focus: accent };
}

export function tenantTheme(b: TenantBranding): TenantTheme {
  const adjusted: string[] = [];
  return { dark: tokens(b, "dark", adjusted), light: tokens(b, "light", adjusted), adjusted };
}

/** CSS que sobrepõe os tokens LexSion só para o escritório atual (atributo data-tenant no <html>). */
export function tenantCss(slug: string, t: TenantTheme): string {
  const v = (x: ThemeTokens) => `--brand:${x.brand};--brand-hover:${x.brandHover};--on-brand:${x.onBrand};--accent:${x.accent};--focus:${x.focus};`;
  const sel = `:root[data-tenant="${slug.replace(/[^a-z0-9-]/g, "")}"]`;
  return `${sel},${sel}[data-theme="dark"]{${v(t.dark)}}${sel}[data-theme="light"]{${v(t.light)}}`;
}
