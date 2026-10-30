import "server-only";
import { PDFDocument, rgb, StandardFonts, type PDFFont } from "pdf-lib";

// PDF A4 do contrato (texto selecionável, quebra de linha por largura, cabeçalho/rodapé, paginação). Gerado UMA vez
// no aceite e guardado no Storage privado: o download devolve os MESMOS bytes (nunca regenera com dados atuais).
// ponytail: fonte padrão Helvetica (WinAnsi) cobre o português; caractere fora dela vira equivalente ASCII.
// Fonte TTF incorporada só se surgir texto em outro alfabeto.
const A4 = { w: 595.28, h: 841.89 }, M = 56, SIZE = 10, LEAD = 14;
const SAFE: Record<string, string> = { "—": "-", "–": "-", "“": '"', "”": '"', "‘": "'", "’": "'", "…": "...", "→": "->", "·": "-", "≥": ">=", "⇄": "<->", " ": " " };
const clean = (s: string) => s.replace(/[—–“”‘’…→·≥⇄ ]/g, (c) => SAFE[c]).replace(/[^\x09\x0a\x0d\x20-\x7e\xa0-\xff]/g, "?");

function wrap(text: string, font: PDFFont, size: number, max: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= max) { line = next; continue; }
      if (line) out.push(line);
      // palavra maior que a linha (ex.: hash): quebra por caractere
      let w = word;
      while (font.widthOfTextAtSize(w, size) > max) { let i = w.length; while (i > 1 && font.widthOfTextAtSize(w.slice(0, i), size) > max) i--; out.push(w.slice(0, i)); w = w.slice(i); }
      line = w;
    }
    out.push(line);
  }
  return out;
}

export async function contractPdf(o: { text: string; number: string; hash: string; footer: string; evidence?: string[] }): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Contrato LexSion ${o.number}`); pdf.setSubject("Contrato SaaS LexSion"); pdf.setProducer("LexSion"); pdf.setCreator("LexSion");
  const reg = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const width = A4.w - 2 * M;
  const lines: { t: string; f: PDFFont; s: number; gap?: number; color?: [number, number, number] }[] = [];
  const blocks = clean(o.text).split("\n");
  blocks.forEach((b, i) => {
    const heading = i === 0 || (/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9 .,()\-/:]+$/.test(b) && b.length > 3 && b.length < 140);
    const banner = /^MINUTA PARA REVIS/.test(b);
    for (const l of wrap(b, heading ? bold : reg, i === 0 ? 12 : SIZE, width)) lines.push({ t: l, f: heading ? bold : reg, s: i === 0 ? 12 : SIZE, color: banner ? [0.7, 0.1, 0.1] : undefined });
    if (!b) lines.push({ t: "", f: reg, s: SIZE, gap: 4 });
  });
  if (o.evidence?.length) { lines.push({ t: "", f: reg, s: SIZE }, { t: "REGISTRO DO ACEITE ELETRÔNICO", f: bold, s: SIZE }); for (const e of o.evidence) for (const l of wrap(clean(e), reg, 9, width)) lines.push({ t: l, f: reg, s: 9 }); }
  const pages: (typeof lines)[] = [[]];
  let y = A4.h - M - 18;
  for (const l of lines) { const h = l.gap ?? LEAD * (l.s / SIZE); if (y - h < M + 24) { pages.push([]); y = A4.h - M - 18; } pages.at(-1)!.push(l); y -= h; }
  pages.forEach((pl, idx) => {
    const p = pdf.addPage([A4.w, A4.h]);
    p.drawText("LexSion", { x: M, y: A4.h - M + 10, size: 9, font: bold, color: rgb(0.55, 0.42, 0.13) });
    p.drawText(clean(`Contrato ${o.number}`), { x: A4.w - M - reg.widthOfTextAtSize(clean(`Contrato ${o.number}`), 8), y: A4.h - M + 10, size: 8, font: reg, color: rgb(0.35, 0.35, 0.35) });
    let yy = A4.h - M - 18;
    for (const l of pl) { if (l.t) p.drawText(l.t, { x: M, y: yy, size: l.s, font: l.f, color: l.color ? rgb(...l.color) : rgb(0.1, 0.1, 0.1) }); yy -= l.gap ?? LEAD * (l.s / SIZE); }
    const foot = clean(`${o.footer} · SHA-256 do texto: ${o.hash.slice(0, 16)}… · Página ${idx + 1} de ${pages.length}`);
    p.drawText(foot, { x: M, y: M - 18, size: 7, font: reg, color: rgb(0.4, 0.4, 0.4), maxWidth: width });
  });
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}
