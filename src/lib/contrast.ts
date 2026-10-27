// Contraste WCAG 2.x e ajuste automático de cor de marca (white-label seguro).
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lum([r, g, b]: [number, number, number]) {
  const f = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export function contrast(a: string, b: string): number {
  const [x, y] = [lum(hexToRgb(a)), lum(hexToRgb(b))].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
const toHex = (rgb: number[]) => `#${rgb.map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, "0")).join("")}`;

/** Clareia (fundo escuro) ou escurece (fundo claro) até atingir o mínimo contra o fundo. */
export function ensureContrast(color: string, bg: string, min = 4.5): { color: string; adjusted: boolean } {
  if (contrast(color, bg) >= min) return { color, adjusted: false };
  const darkBg = lum(hexToRgb(bg)) < 0.2;
  let rgb = hexToRgb(color);
  for (let i = 0; i < 40 && contrast(toHex(rgb), bg) < min; i++) rgb = rgb.map((c) => (darkBg ? c + (255 - c) * 0.08 : c * 0.92)) as [number, number, number];
  return { color: toHex(rgb), adjusted: true };
}
