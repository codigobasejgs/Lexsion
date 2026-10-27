// CSV: leitura tolerante (vírgula/ponto e vírgula, aspas) e exportação protegida contra fórmulas (A14, M22).
import { isCivilDate, type CivilDate } from "@/lib/dates";

export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (q) {
      if (ch === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

/** Neutraliza células que planilhas interpretariam como fórmula (=, +, -, @, tab, CR). */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");
}

const PLACEHOLDERS = new Set(["na", "n/a", "nd", "n/d", "-", "--", "—", "x", "null", "0"]);

export function isPlaceholder(v: string): boolean {
  return v.trim() === "" || PLACEHOLDERS.has(v.trim().toLowerCase());
}

/**
 * Data de planilha: aceita dd/mm/aaaa, aaaa-mm-dd e serial do Excel (1900).
 * Anos ≤ 1900 são tratados como problema de qualidade (data artificial), não como data válida.
 */
export function parseSheetDate(v: string): { date?: CivilDate; issue?: string } {
  const s = v.trim();
  if (isPlaceholder(s)) return { issue: "vazio ou marcador (Na/nd/-)" };
  let iso: string | undefined;
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (br) iso = `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  else if (/^\d{4}-\d{2}-\d{2}$/.test(s)) iso = s;
  else if (/^\d{1,5}$/.test(s)) {
    const serial = Number(s);
    // Excel conta 1900-02-29 inexistente: base 1899-12-30.
    iso = new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000).toISOString().slice(0, 10);
  }
  if (!iso || !isCivilDate(iso)) return { issue: `data não reconhecida: “${s}”` };
  if (Number(iso.slice(0, 4)) <= 1900) return { issue: `ano artificial (${iso.slice(0, 4)})` };
  return { date: iso };
}

export function downloadText(name: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
