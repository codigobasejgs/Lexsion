// Leitura de PDF com texto, ponta a ponta, sobre um CNIS SINTÉTICO gerado no próprio teste.
import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { pdfLines } from "@/lib/pdf-text";
import { parseCnis } from "@/domain/pension/cnis-parser";

async function syntheticPdf(pages: string[][]) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const lines of pages) {
    const p = pdf.addPage([595, 842]);
    lines.forEach((l, i) => {
      // Cada linha em dois trechos separados, como o extrato real (colunas).
      const [a, b] = l.split(" | ");
      p.drawText(a, { x: 40, y: 800 - i * 16, size: 9, font });
      if (b) p.drawText(b, { x: 330, y: 800 - i * 16 + 0.6, size: 9, font });
    });
  }
  return new Uint8Array(await pdf.save());
}

describe("pdfLines", () => {
  it("reconstrói linhas por altura e alimenta o leitor de CNIS", async () => {
    const data = await syntheticPdf([
      ["Nome: JOSE SINTETICO DE TESTE", "NIT: 123.45678.90-1", "Data de Nascimento: 05/05/1962"],
      ["1 123.45678.90-1 12.345.678/0001-90 EMPRESA ALFA LTDA | Empregado 01/02/1990 30/06/1998", "01/1998 1.500,00"],
    ]);
    const r = await pdfLines(data);
    expect(r.pages).toBe(2);
    expect(r.lines.find((l) => l.page === 2)?.text).toBe("1 123.45678.90-1 12.345.678/0001-90 EMPRESA ALFA LTDA Empregado 01/02/1990 30/06/1998");
    const cnis = parseCnis(r.lines);
    expect(cnis.person.name).toBe("JOSE SINTETICO DE TESTE");
    expect(cnis.bonds[0]).toMatchObject({ start: "1990-02-01", end: "1998-06-30", originId: "12.345.678/0001-90" });
    expect(cnis.bonds[0].evidence.page).toBe(2);
    expect(cnis.contributions[0]).toMatchObject({ month: "1998-01", amount: 1500 });
  });
  it("PDF sem texto (só imagem) devolve zero caracteres: não inventa leitura", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([595, 842]);
    const r = await pdfLines(new Uint8Array(await pdf.save()));
    expect(r.textChars).toBe(0);
    expect(r.lines).toEqual([]);
  });
  it("arquivo que não é PDF falha (o servidor converte em mensagem)", async () => {
    await expect(pdfLines(new TextEncoder().encode("não é pdf"))).rejects.toThrow();
  });
});
