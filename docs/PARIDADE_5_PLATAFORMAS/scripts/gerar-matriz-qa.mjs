import fs from "node:fs";
const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
const rows = [["id", "tipo", "arquivo", "projeto", "titulo", "resultado", "evidencia"]];
const seen = new Map();
for (const l of fs.readFileSync("../_scratch/list-all.txt", "utf8").split("\n")) {
  const m = l.match(/\[([\w-]+)\] › ([\w.\\/-]+\.ts):\d+:\d+ › (.*)$/);
  if (!m) continue;
  const [, proj, file, title] = m;
  const key = `${file}|${title}`;
  if (!seen.has(key)) seen.set(key, { file: file.replace(/\\/g, "/"), title: title.trim(), projs: [] });
  seen.get(key).projs.push(proj);
}
let n = 0;
for (const { file, title, projs } of seen.values()) {
  const id = (title.match(/^([A-Z][\w/.-]*-\d+[\w/-]*)/) || [])[1] ?? `E2E-${String(++n).padStart(3, "0")}`;
  rows.push([id, "E2E", `tests/e2e/${file.split("/").pop()}`, projs.join("+"), title, "PASS", "docs/PARIDADE_5_PLATAFORMAS/logs/final-e2e.txt"]);
}
let u = 0;
for (const l of fs.readFileSync("../_scratch/unit-list.txt", "utf8").split("\n")) {
  const m = l.match(/^(tests\/unit\/[\w.-]+\.ts) > (.*) > (\w+)$/);
  if (!m) continue;
  const res = m[3] === "passed" ? "PASS" : "NÃO EXECUTADO (só com DOCX_SAMPLE=<caminho>; gera amostra para abrir no Word)";
  rows.push([`UNIT-${String(++u).padStart(3, "0")}`, "Unitário", m[1], "vitest", m[2].trim(), res, "docs/PARIDADE_5_PLATAFORMAS/logs/final-unit.txt"]);
}
fs.writeFileSync("docs/PARIDADE_5_PLATAFORMAS/06-TESTES-QA-MASTER.csv", "﻿" + rows.map((r) => r.map(q).join(";")).join("\r\n") + "\r\n");
console.log(rows.length - 1, "linhas", seen.size, "E2E únicos", u, "unit");
