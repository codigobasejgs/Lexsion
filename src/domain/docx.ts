// Exportação .docx (OOXML) de minutas, sem dependências: texto puro → parágrafos Word.
// Linhas em CAIXA ALTA viram títulos de seção; o título da minuta vira Heading 1.
import { zip } from "@/lib/zip";

export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// XML 1.0 não aceita caracteres de controle; texto do usuário é sempre escapado (nada de HTML/markup passa).
const xml = (s: string) =>
  s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const isHeading = (line: string) => line.length >= 3 && line.length <= 80 && line === line.toUpperCase() && /[A-ZÀ-Ú]/.test(line);

function para(text: string, style?: string): string {
  const pPr = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : "";
  return `<w:p>${pPr}<w:r><w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p>`;
}

/** Nome de arquivo seguro (sem caracteres proibidos no Windows), mantendo acentos. */
export function docxFileName(title: string): string {
  const base = title.replace(/[\\/:*?"<>|\u0000-\u001F]/g, "").replace(/\s+/g, " ").trim().slice(0, 80) || "minuta";
  return `${base}.docx`;
}

export interface DocxInput {
  title: string;
  body: string;
  header?: string; // ex.: nome do escritório
  footer?: string; // ex.: aviso de ambiente demonstrativo
  brandColor?: string; // #rrggbb do escritório (linha sob o cabeçalho); validado antes de entrar no XML
}

export function buildDocx({ title, body, header, footer, brandColor }: DocxInput): Uint8Array {
  const color = /^#[0-9a-f]{6}$/i.test(brandColor ?? "") ? brandColor!.slice(1).toUpperCase() : null;
  const paragraphs = body
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => (line.trim() === "" ? para("") : isHeading(line.trim()) ? para(line.trim(), "Heading2") : para(line)))
    .join("");
  const ns = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const sect = `<w:sectPr>${header ? '<w:headerReference w:type="default" r:id="rIdHeader"/>' : ""}${footer ? '<w:footerReference w:type="default" r:id="rIdFooter"/>' : ""}<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1701" w:right="1134" w:bottom="1134" w:left="1701" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr>`;
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${ns}><w:body>${para(title, "Heading1")}${paragraphs}${sect}</w:body></w:document>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:lang w:val="pt-BR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="360" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/><w:spacing w:after="240"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="240"/></w:pPr><w:rPr><w:b/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Small"><w:name w:val="Small"/><w:basedOn w:val="Normal"/><w:rPr><w:sz w:val="18"/></w:rPr></w:style></w:styles>`;
  const rels = [
    '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
    header ? '<Relationship Id="rIdHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>' : "",
    footer ? '<Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' : "",
  ].join("");
  const files: Record<string, string> = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>${header ? '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' : ""}${footer ? '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' : ""}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`,
    "docProps/core.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${xml(title)}</dc:title><dc:creator>LexSion (demonstração)</dc:creator><dc:language>pt-BR</dc:language></cp:coreProperties>`,
    "word/_rels/document.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`,
    "word/document.xml": document,
    "word/styles.xml": styles,
  };
  // Cabeçalho com o nome do escritório em negrito na cor da marca e uma linha inferior da mesma cor.
  const headerPara = header
    ? `<w:p><w:pPr><w:pStyle w:val="Small"/>${color ? `<w:pBdr><w:bottom w:val="single" w:sz="12" w:space="4" w:color="${color}"/></w:pBdr>` : ""}</w:pPr><w:r><w:rPr><w:b/>${color ? `<w:color w:val="${color}"/>` : ""}</w:rPr><w:t xml:space="preserve">${xml(header)}</w:t></w:r></w:p>`
    : "";
  if (header) files["word/header1.xml"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ${ns}>${headerPara}</w:hdr>`;
  if (footer) files["word/footer1.xml"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${ns}>${para(footer, "Small")}</w:ftr>`;
  return zip(files);
}
