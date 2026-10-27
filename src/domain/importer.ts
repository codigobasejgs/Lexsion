// Importação de clientes a partir de CSV (M21, A14). Pura: recebe linhas, devolve prévia; nada é gravado aqui.
import type { Client } from "./types";
import { isValidCnpj, isValidCpf, isValidPhone, normalizePhone, formatPhone } from "./crm";
import { isPlaceholder, parseSheetDate } from "./csv";

export const TARGET_FIELDS = { name: "Nome", document: "CPF/CNPJ", phone: "Telefone", email: "E-mail", birthDate: "Nascimento", city: "Cidade", uf: "UF", profession: "Profissão" } as const;
export type TargetField = keyof typeof TARGET_FIELDS;

// Sinônimos de cabeçalho (inclui nomes de colunas da aba Clientes da Tícius, exportada para CSV).
const SYN: Record<TargetField, string[]> = {
  name: ["nome", "cliente", "nome completo", "nome do cliente"],
  document: ["cpf", "cnpj", "cpf/cnpj", "documento", "cpf / cnpj"],
  phone: ["telefone", "celular", "whatsapp", "fone", "contato"],
  email: ["email", "e-mail"],
  birthDate: ["nascimento", "data de nascimento", "dt nasc", "data nasc."],
  city: ["cidade", "município", "municipio"],
  uf: ["uf", "estado"],
  profession: ["profissão", "profissao", "ocupação"],
};

export function guessMapping(header: string[]): Record<string, TargetField | ""> {
  const out: Record<string, TargetField | ""> = {};
  for (const h of header) {
    const n = h.trim().toLowerCase();
    out[h] = (Object.keys(SYN) as TargetField[]).find((f) => SYN[f].includes(n)) ?? "";
  }
  return out;
}

export interface PreviewRow {
  row: number; // linha no arquivo (1 = cabeçalho)
  action: "criar" | "atualizar" | "ignorar" | "rejeitar";
  reason?: string;
  issues: string[];
  data: Partial<Client>;
  matchId?: string;
}

export function buildPreview(rows: string[][], mapping: Record<string, TargetField | "">, existing: Client[]): PreviewRow[] {
  const [header, ...body] = rows;
  const idx = (f: TargetField) => header.findIndex((h) => mapping[h] === f);
  const seenDocs = new Set<string>();
  return body.map((r, i): PreviewRow => {
    const get = (f: TargetField) => (idx(f) >= 0 ? (r[idx(f)] ?? "").trim() : "");
    const line = i + 2;
    const issues: string[] = [];
    // Cabeçalho repetido no meio do arquivo (comum em planilhas exportadas).
    if (header.every((h, k) => (r[k] ?? "").trim().toLowerCase() === h.trim().toLowerCase())) return { row: line, action: "ignorar", reason: "cabeçalho repetido", issues, data: {} };
    const name = get("name");
    if (isPlaceholder(name)) return { row: line, action: "ignorar", reason: "linha sem nome (vazia ou marcador Na/nd/-)", issues, data: {} };
    const docRaw = get("document");
    const doc = docRaw.replace(/\D/g, "");
    let docOk = false;
    if (!isPlaceholder(docRaw)) {
      docOk = doc.length === 11 ? isValidCpf(doc) : doc.length === 14 ? isValidCnpj(doc) : false;
      if (!docOk) issues.push(`documento inválido: “${docRaw}”`);
    }
    const phoneRaw = get("phone");
    if (!isPlaceholder(phoneRaw) && !isValidPhone(phoneRaw)) issues.push(`telefone inválido: “${phoneRaw}”`);
    const birth = get("birthDate");
    const bd = birth ? parseSheetDate(birth) : {};
    if (birth && bd.issue) issues.push(`nascimento: ${bd.issue}`);
    if (docOk && seenDocs.has(doc)) return { row: line, action: "ignorar", reason: "documento repetido no próprio arquivo", issues, data: {} };
    if (docOk) seenDocs.add(doc);
    // Deduplicação contextual: documento válido; sem documento, nome + telefone. Nunca só nome.
    const match = existing.find((c) => (docOk && c.document.replace(/\D/g, "") === doc) || (!docOk && isValidPhone(phoneRaw) && normalizePhone(c.phone) === normalizePhone(phoneRaw) && c.name.toLowerCase() === name.toLowerCase()));
    const data: Partial<Client> = {
      name, kind: doc.length === 14 ? "PJ" : "PF", document: docOk ? docRaw : "", phone: isValidPhone(phoneRaw) ? formatPhone(phoneRaw) : "",
      email: get("email") && !isPlaceholder(get("email")) ? get("email") : undefined, birthDate: bd.date, city: isPlaceholder(get("city")) ? "" : get("city"),
      uf: (get("uf") || "BA").toUpperCase().slice(0, 2), profession: isPlaceholder(get("profession")) ? undefined : get("profession"),
    };
    if (!docOk && !isValidPhone(phoneRaw)) return { row: line, action: "rejeitar", reason: "sem documento nem telefone válidos para identificar a pessoa", issues, data };
    return { row: line, action: match ? "atualizar" : "criar", issues, data, matchId: match?.id };
  });
}

/** CSV fictício de exemplo (formato próximo ao da aba Clientes exportada). */
export const SAMPLE_CSV = [
  "Nome;CPF;Telefone;Nascimento;Cidade;UF;Profissão",
  "Benedita Importada Teste;529.982.247-25;(71) 98888-0001;12/04/1958;Salvador;BA;Aposentada",
  "Carlos Planilha Exemplo;111.444.777-35;(71) 98888-0002;21916;Camaçari;BA;Pedreiro",
  "Nome;CPF;Telefone;Nascimento;Cidade;UF;Profissão",
  "nd;nd;nd;nd;nd;nd;nd",
  "Dalva Sem Documento;Na;(75) 98888-0003;01/01/1900;Feira de Santana;BA;-",
  "Ernesto Duplicado;529.982.247-25;(71) 98888-0004;10/10/1960;Salvador;BA;Motorista",
  "Fábio Inválido;123.456.789-00;123;31/02/1970;Salvador;BA;Vigia",
  "=HYPERLINK(\"http://exemplo.invalid\");390.533.447-05;(71) 98888-0005;05/05/1975;Lauro de Freitas;BA;Comerciante",
].join("\n");
