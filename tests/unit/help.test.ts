import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { HELP_ARTICLES, shotPath } from "@/content/help";
import { TRACKS } from "@/content/academy";
import { TOURS } from "@/tours/tours";
import { SHOTS } from "../capture/help-manifest";

const src = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? src(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : []));
const code = src("src").filter((f) => !f.includes(`content${path.sep}`) && !f.includes(`tours${path.sep}`)).map((f) => fs.readFileSync(f, "utf8")).join("\n");

const REQUIRED = ["primeiro-acesso", "cadastrar-cliente", "organizar-lead", "assumir-conversa", "solicitar-documento", "revisar-extracao", "abrir-caso", "registrar-prazo", "agendar-pericia", "comparar-cenarios", "revisar-minuta", "enviar-proposta", "assinatura", "entrada-e-parcelas", "baixa-parcial", "emitir-recibo", "conciliacao", "importar-csv", "configurar-notificacoes", "conectar-whatsapp", "operar-no-celular", "entender-modo-demo", "recuperar-erros"];

describe("central de ajuda e academia (M23)", () => {
  it("cobre a lista mínima de artigos, com campos obrigatórios", () => {
    const slugs = HELP_ARTICLES.map((a) => a.slug);
    expect(REQUIRED.filter((s) => !slugs.includes(s))).toEqual([]);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const a of HELP_ARTICLES) {
      expect(a.steps.length, a.slug).toBeGreaterThanOrEqual(3);
      expect(a.prerequisites && a.who && a.expected && a.errors.length, a.slug).toBeTruthy();
      expect(a.shots.length, `${a.slug} sem print`).toBeGreaterThan(0);
    }
  });

  it("nomes de botões citados existem no código da interface", () => {
    const missing = HELP_ARTICLES.flatMap((a) => a.buttons.filter((b) => !code.includes(b)).map((b) => `${a.slug}: ${b}`));
    expect(missing).toEqual([]);
  });

  it("links internos (relacionados e academia) apontam para artigos existentes", () => {
    const slugs = new Set(HELP_ARTICLES.map((a) => a.slug));
    expect(HELP_ARTICLES.flatMap((a) => a.related).filter((r) => !slugs.has(r))).toEqual([]);
    expect(TRACKS.flatMap((t) => t.lessons).filter((l) => l.article && !slugs.has(l.article)).map((l) => l.article)).toEqual([]);
    const tours = new Set(TOURS.map((t) => t.id));
    expect(TRACKS.flatMap((t) => t.lessons).filter((l) => l.tour && !tours.has(l.tour)).map((l) => l.tour)).toEqual([]);
  });

  it("alvos de tour existem como data-tour no código", () => {
    const targets = TOURS.flatMap((t) => t.steps.flatMap((s) => (Array.isArray(s.target) ? s.target : [s.target])));
    expect(targets.filter((t) => !code.includes(`data-tour="${t}"`))).toEqual([]);
  });

  it("manifesto de prints cobre todos os prints declarados, com rota e perfil", () => {
    expect(SHOTS.length).toBe(HELP_ARTICLES.reduce((n, a) => n + a.shots.length, 0));
    for (const s of SHOTS) expect(s.route.startsWith("/") && s.selector.length > 0).toBe(true);
  });

  it("arquivos de print existem (gerados por pnpm capture:help)", () => {
    const missing = HELP_ARTICLES.flatMap((a) => a.shots.map((s) => shotPath(a.slug, s))).filter((p) => !fs.existsSync(path.join("public", p)));
    expect(missing).toEqual([]);
  });
});

describe("cobertura rota → artigo → tour → print (HELP-01/02/04)", async () => {
  const { ROUTE_HELP } = await import("@/content/route-help");
  const routes = src("src/app/app").filter((f) => f.endsWith("page.tsx")).map((f) => f.split(path.sep).join("/").replace(/^src\/app/, "").replace(/\/page\.tsx$/, ""));
  it("toda rota operacional do escritório tem artigo de ajuda", () => {
    const missing = routes.filter((r) => !ROUTE_HELP.some((h) => r === h.prefix || r.startsWith(h.prefix + "/")));
    expect(missing).toEqual([]);
  });
  it("artigos e tours referenciados por rota existem", () => {
    const slugs = new Set(HELP_ARTICLES.map((a) => a.slug));
    const tours = new Set(TOURS.map((t) => t.id));
    expect(ROUTE_HELP.filter((h) => !slugs.has(h.article)).map((h) => h.article)).toEqual([]);
    expect(ROUTE_HELP.filter((h) => h.tour && !tours.has(h.tour)).map((h) => h.tour)).toEqual([]);
  });
  it("sinônimos comuns encontram artigos", () => {
    const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    const find = (q: string) => HELP_ARTICLES.filter((a) => norm(`${a.title} ${a.goal} ${a.steps.join(" ")} ${a.buttons.join(" ")} ${(a.keywords ?? []).join(" ")}`).includes(norm(q)));
    for (const q of ["prazo", "audiência", "CNIS", "boleto", "comprovante", "contrato", "receber"]) expect(find(q).length, q).toBeGreaterThan(0);
  });
});
