// Gera ícones PWA a partir dos VETORES ORIGINAIS LexSion (public/brand/lexsion, cópia de ../LEXSION).
// Plataforma: public/icons/*. Escritórios demo: public/tenants/<slug>/icon-*.png a partir do logo.svg do escritório.
// Reprodutível: `pnpm pwa:assets`. Não desenha símbolo novo — só redimensiona/enquadra os SVGs fornecidos.
import sharp from "sharp";
import { mkdirSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const p = (rel) => fileURLToPath(new URL(`../${rel}`, import.meta.url));
const icon = readFileSync(p("public/brand/lexsion/lexsion-pwa-icon-512.svg"));
const emblem = readFileSync(p("public/brand/lexsion/lexsion-emblema-transparente.svg"));
const OBSIDIAN = { r: 9, g: 10, b: 13, alpha: 1 };

async function render(svg, size, file) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(file);
  console.log("gerado", file.split(/[\\/]public[\\/]/)[1]);
}
// Maskable: conteúdo dentro da zona segura (80%) sobre fundo cheio.
async function maskable(svg, size, file, bg = OBSIDIAN) {
  const inner = await sharp(svg, { density: 384 }).resize(Math.round(size * 0.62), Math.round(size * 0.62)).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: bg } }).composite([{ input: inner, gravity: "center" }]).png().toFile(file);
  console.log("gerado", file.split(/[\\/]public[\\/]/)[1]);
}

mkdirSync(p("public/icons"), { recursive: true });
await render(icon, 192, p("public/icons/icon-192.png"));
await render(icon, 512, p("public/icons/icon-512.png"));
await maskable(emblem, 192, p("public/icons/maskable-192.png"));
await maskable(emblem, 512, p("public/icons/maskable-512.png"));
await maskable(emblem, 180, p("public/icons/apple-touch-icon.png"));
// Monocromático: emblema em branco sobre transparente (silhueta do vetor original).
await sharp(emblem, { density: 384 }).resize(512, 512).ensureAlpha().linear([0, 0, 0], [255, 255, 255]).png().toFile(p("public/icons/monochrome-512.png"));
await render(readFileSync(p("public/brand/lexsion/lexsion-favicon.svg")), 32, p("public/icons/favicon-32.png"));

for (const slug of readdirSync(p("public/tenants"))) {
  const logo = p(`public/tenants/${slug}/logo.svg`);
  if (!existsSync(logo)) continue;
  const svg = readFileSync(logo);
  await render(svg, 192, p(`public/tenants/${slug}/icon-192.png`));
  await render(svg, 512, p(`public/tenants/${slug}/icon-512.png`));
  await render(svg, 180, p(`public/tenants/${slug}/apple-touch-icon.png`));
  await maskable(svg, 512, p(`public/tenants/${slug}/maskable-512.png`), { r: 255, g: 255, b: 255, alpha: 0 });
}
