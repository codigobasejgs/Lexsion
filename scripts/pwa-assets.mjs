// Gera ícones PWA a partir de um monograma PROVISÓRIO "SW" (sem vetor oficial da marca).
// Substituir por vetor aprovado: troque `mark()` pelo SVG oficial e rode `pnpm pwa:assets`.
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const out = new URL("../public/icons/", import.meta.url);
mkdirSync(out, { recursive: true });

const mark = (size, safe) => {
  const s = safe ? 0.62 : 0.8; // maskable: conteúdo dentro do círculo seguro de 80%
  const fs = Math.round(size * 0.42 * s / 0.8);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f1d397"/><stop offset=".55" stop-color="#d6ae62"/><stop offset="1" stop-color="#9c7230"/></linearGradient></defs>
  <rect width="100%" height="100%" ${safe ? "" : `rx="${size * 0.2}"`} fill="#0d0b08"/>
  <text x="50%" y="53%" text-anchor="middle" dominant-baseline="middle" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-weight="700" font-size="${fs}" fill="url(#g)" letter-spacing="${-fs * 0.06}">SW</text>
</svg>`;
};

const mono = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><text x="50%" y="53%" text-anchor="middle" dominant-baseline="middle" font-family="Georgia, serif" font-style="italic" font-weight="700" font-size="${size * 0.33}" fill="#fff">SW</text></svg>`;

const jobs = [
  ["icon-192.png", mark(192, false)],
  ["icon-512.png", mark(512, false)],
  ["maskable-192.png", mark(192, true)],
  ["maskable-512.png", mark(512, true)],
  ["monochrome-512.png", mono(512)],
  ["apple-touch-icon.png", mark(180, true)],
];
for (const [name, svg] of jobs) {
  await sharp(Buffer.from(svg)).png().toFile(fileURLToPath(new URL(name, out)));
  console.log("gerado", name);
}
