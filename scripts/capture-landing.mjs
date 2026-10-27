// pnpm capture:landing — prints REAIS da landing (pré-requisito: pnpm build). Saída: public/landing/<id>-{desktop|mobile}.webp
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import sharp from "sharp";

const r = spawnSync("pnpm", ["exec", "playwright", "test", "--project=landing-desktop", "--project=landing-mobile"], { stdio: "inherit", shell: process.platform === "win32", env: { ...process.env, CAPTURE: "1" } });
if (r.status) process.exit(r.status);
for (const f of fs.readdirSync("public/landing").filter((f) => f.endsWith(".png"))) {
  // celular: card tem ~330 px CSS; 720 px cobre tela 2× sem pesar a primeira carga
  await sharp(`public/landing/${f}`).resize({ width: f.includes("-mobile") ? 720 : undefined, withoutEnlargement: true }).webp({ quality: 82 }).toFile(`public/landing/${f.replace(/\.png$/, ".webp")}`);
  fs.unlinkSync(`public/landing/${f}`);
}
console.log("prints da landing convertidos para WebP");
