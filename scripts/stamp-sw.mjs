// Grava uma versão nova em public/sw.js antes de cada build (atualização detectável pelo navegador).
import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../public/sw.js", import.meta.url);
const version = process.env.SW_VERSION ?? new Date().toISOString().replace(/\D/g, "").slice(0, 14);
const src = readFileSync(file, "utf8");
const out = src.replace(/^const VERSION = ".*";$/m, `const VERSION = "${version}";`);
if (out === src && !src.includes(`"${version}"`)) throw new Error("Linha VERSION não encontrada em public/sw.js");
writeFileSync(file, out);
console.log(`sw.js versão ${version}`);
