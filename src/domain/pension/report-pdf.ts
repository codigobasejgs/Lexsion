// Relatório técnico em PDF (pdf-lib, roda no navegador: o documento não sai do aparelho para ser gerado).
// Conteúdo 100% derivado da análise revisada; cada bloco cita fonte e versão das regras.
import { PDFDocument, rgb, StandardFonts, type PDFFont } from "pdf-lib";
import type { Derived, IntelData } from "./analysis";
import { CLASSIFICATION_LABEL } from "./rules";
import { brl, RMI_VERSION } from "./rmi";
import type { runPlanning } from "./planning";

const A4 = { w: 595.28, h: 841.89 }, M = 50;
const SAFE: Record<string, string> = { "—": "-", "–": "-", "“": '"', "”": '"', "‘": "'", "’": "'", "…": "...", "→": "->", "·": "-", "≥": ">=", "×": "x", "−": "-", " ": " " };
const clean = (s: string) => s.replace(/[—–“”‘’…→·≥×− ]/g, (c) => SAFE[c]).replace(/[^\x09\x0a\x0d\x20-\x7e\xa0-\xff]/g, "?");
const br = (d: string | null | undefined) => (d ? d.split("-").reverse().join("/") : "sem data");

function wrap(text: string, font: PDFFont, size: number, max: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= max) { line = next; continue; }
    if (line) out.push(line);
    line = word;
    while (font.widthOfTextAtSize(line, size) > max) { let i = line.length; while (i > 1 && font.widthOfTextAtSize(line.slice(0, i), size) > max) i--; out.push(line.slice(0, i)); line = line.slice(i); }
  }
  out.push(line);
  return out;
}

export async function intelReportPdf(o: { office: string; client: string; title: string; d: IntelData; r: Derived; reviewed: string | null; generatedBy: string; planning?: ReturnType<typeof runPlanning> | null }): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(clean(`Relatório previdenciário - ${o.client}`)); pdf.setProducer("LexSion"); pdf.setCreator("LexSion");
  const reg = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const width = A4.w - 2 * M;
  const items: { t: string; f: PDFFont; s: number; c?: [number, number, number]; gap?: number }[] = [];
  const h = (t: string) => items.push({ t: "", f: reg, s: 6, gap: 8 }, { t: clean(t), f: bold, s: 11 });
  const p = (t: string, s = 9, c?: [number, number, number]) => { for (const l of wrap(clean(t), reg, s, width)) items.push({ t: l, f: reg, s, c }); };
  const li = (t: string) => p(`- ${t}`);
  const { d, r } = o;

  items.push({ t: clean(o.title), f: bold, s: 14 });
  p(`Cliente: ${o.client} · Data de referência: ${br(d.baseDate)} · Regras: ${r.rulesVersion} (aguardando validação jurídica)`);
  p(o.reviewed ? `Revisado por: ${o.reviewed}` : "ATENÇÃO: análise ainda não revisada por advogado(a). Não usar como parecer.", 9, o.reviewed ? undefined : [0.7, 0.1, 0.1]);
  p("Ferramenta de apoio técnico. Não substitui a análise do advogado(a), não decide elegibilidade e não acessa o Meu INSS.", 8, [0.4, 0.4, 0.4]);

  h("1. Documentos analisados");
  if (!d.sources.length) p("Nenhum documento lido automaticamente; dados informados manualmente.");
  for (const s of d.sources) li(`${s.kind}: ${s.fileName} (${s.pages} pág.), lido em ${new Date(s.readAt).toLocaleString("pt-BR")}`);

  h("2. Vínculos considerados (revisados)");
  if (!r.counted.length) p("Nenhum vínculo confirmado. Os vínculos lidos aguardam revisão e não entram na contagem.");
  for (const { b, end } of r.counted) li(`${b.origin}${b.originId ? ` (${b.originId})` : ""}: ${br(b.start)} a ${br(end)}${b.end ? "" : " (fim pela última remuneração)"}${b.status === "corrigido" ? " [corrigido na revisão]" : ""}${b.special ? ` [especial ${b.special} anos]` : ""}${b.evidence ? ` - fonte: ${b.evidence.fileName ?? "documento"}, pág. ${b.evidence.page}` : " - informado manualmente"}`);

  h("3. Tempo e carência");
  li(`Tempo comum (sem dupla contagem): ${r.commonText}`);
  if (r.conversion) {
    li(`Acréscimo por conversão de tempo especial (até 13/11/2019): ${r.conversion.addedDays} dia(s)`);
    for (const l of r.conversion.lines) p(`   ${l.memo}`, 8);
    li(`Total com conversão: ${r.totalWithConversion}`);
  }
  li(`Carência (meses com contribuição, descontados os abaixo do mínimo): ${r.carencyMonths ?? "não verificável"}`);
  if (r.grace) li(`Qualidade de segurado: ${r.grace.memo}`);

  if (r.comparison.length) { h("4. Comparação CNIS x CTPS"); for (const c of r.comparison) li(c.detail); }

  h("5. Possibilidades de benefício (requisitos)");
  const st = { atendido: "atendido", pendente: "pendente", nao_verificavel: "não verificável" } as const;
  for (const b of r.benefits) { p(b.name, 9.5); for (const q of b.requirements) li(`${q.text}: ${st[q.state]} - ${q.detail}`); p(`   ${b.note}`, 8, [0.35, 0.35, 0.35]); }

  if (r.ppp.length) {
    h("6. Atividade especial (PPP)");
    for (const { p: x, a } of r.ppp) { p(`${x.employer || "Empresa"} ${br(x.start)} a ${br(x.end)} - ${CLASSIFICATION_LABEL[a.overall]}`, 9.5); for (const f of a.findings) li(`${CLASSIFICATION_LABEL[f.classification]}: ${f.text}`); }
  }
  if (r.accident) {
    h("7. Auxílio-acidente");
    for (const t of r.accident.sustain) li(`Sustenta: ${t}`);
    for (const t of r.accident.weaken) li(`Enfraquece: ${t}`);
    for (const t of r.accident.missing) li(`Falta: ${t}`);
    p(r.accident.noCarencia, 8);
  }
  const pl = o.planning && !("error" in o.planning) ? o.planning : null;
  if (pl) {
    h(`Planejamento e RMI (${RMI_VERSION}, aguardando validação)`);
    const b = pl.plan.current.best;
    p(b ? `Hoje: tem direito a ${b.name}, RMI estimada ${b.rmi != null ? brl(b.rmi) : "-"}.` : "Hoje: ainda não cumpre requisitos de aposentadoria.");
    for (const m of b?.memo ?? []) p(`   ${m}`, 8);
    for (const pt of pl.plan.points) {
      p(`${br(pt.date)} - ${pt.name}: RMI ${pt.rmi != null ? brl(pt.rmi) : "-"} (idade ${pt.ageAt})`, 9.5);
      li(`Requisitos: ${pt.requirements.map((q) => `${q.label} ${q.needed} (terá ${q.has})`).join("; ")}`);
      li(`Contribuições até lá: ${brl(pt.contribTotal)}${pt.gain != null ? `; aumento mensal ${brl(pt.gain)}; retorno em ${pt.paybackMonths ?? "-"} meses` : ""}${pt.lifetimeValue != null ? `; valor até a expectativa de vida ${brl(pt.lifetimeValue)}` : ""}`);
      for (const m of pt.memo) p(`   ${m}`, 8);
    }
    for (const u of pl.plan.unreachable) li(`${u.name}: ${u.note ?? "inatingível"}`);
    if (pl.others) for (const i of pl.others.items) li(`${i.name}: ${brl(i.value)} - ${i.memo}`);
    for (const a of pl.plan.assumptions) p(`Premissa: ${a}`, 8);
  }
  h("8. Pendências e próximos passos");
  if (!r.pendencias.length) p("Nenhuma pendência apontada.");
  for (const x of r.pendencias) li(`${x.text} Ação: ${x.action}`);

  h("Fontes normativas");
  const srcs = new Map<string, string>();
  for (const b of r.benefits) for (const s of b.sources) srcs.set(s.label, s.url);
  for (const s of r.conversion?.sources ?? []) srcs.set(s.label, s.url);
  for (const s of r.accident?.sources ?? []) srcs.set(s.label, s.url);
  for (const { a } of r.ppp) for (const f of a.findings) if (f.source) srcs.set(f.source.label, f.source.url);
  for (const [l, u] of srcs) p(`${l} - ${u}`, 8);

  const pages: (typeof items)[] = [[]];
  let y = A4.h - M - 20;
  for (const it of items) { const step = it.gap ?? it.s * 1.45; if (y - step < M + 20) { pages.push([]); y = A4.h - M - 20; } pages.at(-1)!.push(it); y -= step; }
  const stamp = new Date().toLocaleString("pt-BR");
  pages.forEach((pl, i) => {
    const pg = pdf.addPage([A4.w, A4.h]);
    pg.drawText(clean(o.office).slice(0, 80), { x: M, y: A4.h - M + 8, size: 9, font: bold, color: rgb(0.2, 0.2, 0.3) });
    let yy = A4.h - M - 20;
    for (const it of pl) { if (it.t) pg.drawText(it.t, { x: M, y: yy, size: it.s, font: it.f, color: it.c ? rgb(...it.c) : rgb(0.1, 0.1, 0.1) }); yy -= it.gap ?? it.s * 1.45; }
    pg.drawText(clean(`Gerado por ${o.generatedBy} em ${stamp} · LexSion · Página ${i + 1} de ${pages.length}`), { x: M, y: M - 20, size: 7, font: reg, color: rgb(0.45, 0.45, 0.45) });
  });
  return pdf.save();
}
