// Texto de PDF no servidor (pdfjs no próprio processo, sem eval). Nada sai da infraestrutura e nada é registrado em log.
// Agrupa os trechos por linha (mesma altura na página) e ordena da esquerda para a direita.
import type { PdfLine } from "@/domain/pension/cnis-parser";

export const PDF_MAX_BYTES = 15 * 1024 * 1024;
export const PDF_MAX_PAGES = 80;
/** Abaixo disso por página o PDF é tratado como imagem/escaneado (precisa de OCR). */
export const MIN_CHARS_PER_PAGE = 40;

export async function pdfLines(data: Uint8Array): Promise<{ lines: PdfLine[]; pages: number; textChars: number; noTextPages: number[] }> {
  const g = globalThis as { pdfjsWorker?: unknown };
  // Import explícito do worker: o pdfjs roda no mesmo processo e o rastreador de arquivos da Vercel inclui o módulo.
  // @ts-expect-error o pacote não publica tipos para o worker
  g.pdfjsWorker ??= await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Cópia: o pdfjs transfere (esvazia) o buffer recebido; o original segue disponível para o OCR.
  const doc = await pdfjs.getDocument({ data: data.slice(), isEvalSupported: false, disableFontFace: true, useSystemFonts: false, verbosity: 0 }).promise;
  try {
    const lines: PdfLine[] = [];
    let textChars = 0;
    const noTextPages: number[] = [];
    const pages = Math.min(doc.numPages, PDF_MAX_PAGES);
    for (let n = 1; n <= pages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const rows = new Map<number, { x: number; s: string }[]>();
      let pageChars = 0;
      for (const it of content.items) {
        if (!("str" in it) || !it.str.trim()) continue;
        const y = Math.round(it.transform[5] / 2) * 2; // tolerância de 2 pt entre trechos da mesma linha
        rows.set(y, [...(rows.get(y) ?? []), { x: it.transform[4], s: it.str }]);
        textChars += it.str.trim().length;
        pageChars += it.str.trim().length;
      }
      for (const y of [...rows.keys()].sort((a, b) => b - a)) lines.push({ page: n, text: rows.get(y)!.sort((a, b) => a.x - b.x).map((r) => r.s).join(" ") });
      if (pageChars < MIN_CHARS_PER_PAGE) noTextPages.push(n); // escaneada/foto: candidata a OCR
      page.cleanup();
    }
    return { lines, pages: doc.numPages, textChars, noTextPages };
  } finally {
    await doc.destroy();
  }
}
