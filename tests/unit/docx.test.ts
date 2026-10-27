import { describe, expect, it } from "vitest";
import { buildDocx, docxFileName } from "@/domain/docx";
import { crc32, unzip } from "@/lib/zip";

const body = "SÍNTESE DOS FATOS\nA segurada, nascida em 29/02/1960, requereu o benefício — “ação” à revisão.\n\n<script>alert(1)</script> & \"aspas\" 😀\u0007";

describe("DOCX", () => {
  const files = unzip(buildDocx({ title: "Petição inicial — João", body, header: "Aurora (fictícia)", footer: "Ambiente demonstrativo" }));

  it("WL-DOCX: cabeçalho com nome e cor do escritório; cor inválida é ignorada (sem injeção no XML)", () => {
    const h = unzip(buildDocx({ title: "T", body: "x", header: "Atlas Jurídico", brandColor: "#1d4ed8" }))["word/header1.xml"];
    expect(h).toContain("Atlas Jurídico");
    expect(h).toContain('<w:color w:val="1D4ED8"/>');
    expect(h).toContain('w:bottom w:val="single"');
    const bad = unzip(buildDocx({ title: "T", body: "x", header: "A", brandColor: '"/><w:evil/>' }))["word/header1.xml"];
    expect(bad).not.toMatch(/evil|w:color/);
  });

  it("CRC32 confere com valor de referência", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("pacote OOXML tem as partes obrigatórias", () => {
    for (const p of ["[Content_Types].xml", "_rels/.rels", "word/document.xml", "word/styles.xml", "word/_rels/document.xml.rels", "word/header1.xml", "word/footer1.xml"]) expect(files[p], p).toBeTruthy();
    expect(files["[Content_Types].xml"]).toContain("wordprocessingml.document.main+xml");
  });

  it("preserva acentuação PT-BR, título e seções", () => {
    const d = files["word/document.xml"];
    expect(d).toContain("Petição inicial — João");
    expect(d).toContain('<w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t xml:space="preserve">SÍNTESE DOS FATOS');
    expect(d).toContain("29/02/1960");
    expect(d).toContain("“ação”");
    expect(d).toContain("😀");
  });

  it("conteúdo malicioso é escapado e caracteres de controle removidos (XML bem-formado)", () => {
    const d = files["word/document.xml"];
    expect(d).not.toContain("<script>");
    expect(d).toContain("&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;aspas&quot;");
    expect(d).not.toMatch(/\u0007/);
    // Documento bem-formado: toda tag de parágrafo aberta é fechada.
    expect((d.match(/<w:p>/g) ?? []).length).toBe((d.match(/<\/w:p>/g) ?? []).length);
  });

  it("nome de arquivo limpo", () => {
    expect(docxFileName('Petição: "João" / 2026?')).toBe("Petição João 2026.docx");
    expect(docxFileName("   ")).toBe("minuta.docx");
  });
});

// Grava amostra para validação manual/automática em Word ou LibreOffice: DOCX_SAMPLE=<caminho> pnpm test docx
it.runIf(!!process.env.DOCX_SAMPLE)("grava amostra .docx", async () => {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(process.env.DOCX_SAMPLE!, buildDocx({
    title: "Requerimento administrativo — Maria das Graças Exemplo",
    header: "Aurora Advocacia (fictícia)",
    footer: "Ambiente demonstrativo — rascunho sem valor de protocolo",
    body: "SÍNTESE DOS FATOS\nA requerente, nascida em 29/02/1960, solicita a análise do benefício.\n\nPEDIDOS\nDeferimento após revisão profissional.\nAção, coração, órgão, ç, ã, õ, “aspas”.",
  }));
});
