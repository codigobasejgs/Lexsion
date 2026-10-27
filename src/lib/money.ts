// Dinheiro sempre em centavos inteiros (seção 11 / M11 do prompt mestre).
export type Cents = number;

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBRL(cents: Cents): string {
  return brl.format(cents / 100);
}

/** Aceita "1.234,56", "R$ 1.234,56", "1234.56" ou "1234". Retorna null se inválido. */
export function parseBRL(input: string): Cents | null {
  const s = input.replace(/R\$|\s/g, "");
  if (!/^-?[\d.,]+$/.test(s)) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  // Separador decimal = o último que aparece com 1–2 dígitos depois dele.
  const decPos = Math.max(lastComma, lastDot);
  let intPart = s;
  let decPart = "";
  if (decPos >= 0 && s.length - decPos - 1 <= 2) {
    intPart = s.slice(0, decPos);
    decPart = s.slice(decPos + 1);
  }
  intPart = intPart.replace(/[.,]/g, "");
  if (intPart === "" || intPart === "-") intPart += "0";
  const cents = Number(intPart) * 100 + Math.sign(Number(intPart) || 1) * Number(decPart.padEnd(2, "0") || 0);
  return Number.isSafeInteger(cents) ? cents : null;
}

/** Divide o total em n parcelas; a última absorve o resto, a soma é sempre igual ao total. */
export function splitInstallments(total: Cents, n: number): Cents[] {
  if (!Number.isInteger(n) || n < 1) throw new Error("Número de parcelas inválido");
  const base = Math.floor(total / n);
  const parts = Array<Cents>(n).fill(base);
  parts[n - 1] = total - base * (n - 1);
  return parts;
}
