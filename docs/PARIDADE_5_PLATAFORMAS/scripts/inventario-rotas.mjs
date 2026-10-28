import fs from "node:fs";
import path from "node:path";
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const pages = walk("src/app").filter((f) => /page\.tsx$/.test(f)).map((f) => "/" + path.relative("src/app", path.dirname(f)).split(path.sep).join("/")).map((r) => r === "/." ? "/" : r).sort();
const tests = walk("tests").filter((f) => /\.ts$/.test(f)).map((f) => [path.basename(f), fs.readFileSync(f, "utf8")]);

const pub = (r) => r.startsWith("/admin") ? "Plataforma (superadmin, platform_admin, platform_support)" : r.startsWith("/portal") ? "Cliente (portal)" : r.startsWith("/app") ? "Equipe do escritório (por área)" : r.startsWith("/demo/tenant") ? "Público (demo do escritório)" : "Público";
const rx = (r) => new RegExp(r.split("/").map((p) => (p.startsWith("[") ? "[\\w%-]+" : p)).join("/") + "(?![\\w/-])");
const rows = pages.map((r) => {
  const extra = { "/app/contratos": ["journeys"], "/app/ia/agentes/[id]": ["journeys"], "/app/importacoes/[id]": ["journeys"], "/app/requisitorios/[id]": ["journeys"], "/app/previdenciario/planejamentos/[id]": ["journeys"], "/admin/suporte": ["journeys"] }[r] ?? [];
  const hit = [...extra, ...tests.filter(([, s]) => rx(r).test(s)).map(([n]) => n.replace(/\.(spec|capture|test)\.ts$/, ""))];
  return `| \`${r}\` | ${pub(r)} | ${hit.length ? [...new Set(hit)].join(", ") : "—"} |`;
});
const covered = rows.filter((l) => !l.endsWith("— |")).length;
fs.writeFileSync("docs/PARIDADE_5_PLATAFORMAS/logs/inventario-rotas.md", `Total: ${pages.length} páginas; ${covered} visitadas por teste automatizado ou captura (URL direta ou clique na lista).\n\n| Rota | Público | Testes/capturas que visitam |\n|---|---|---|\n${rows.join("\n")}\n`);
console.log(pages.length, covered);
console.log(rows.filter((l) => l.endsWith("— |")).join("\n"));
