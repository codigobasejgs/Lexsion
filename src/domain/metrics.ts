// Métricas com denominador explícito (M17, M22, A11). Divisão por zero ⇒ null ⇒ "não calculável".
export function ratio(num: number, den: number): number | null {
  return den > 0 && Number.isFinite(num) ? num / den : null;
}

export function pct(num: number, den: number): string {
  const r = ratio(num, den);
  return r === null ? "não calculável" : `${(r * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

/** Hash curto e estável do texto (aprovação de minuta: alteração material invalida). */
export function textHash(s: string): string {
  let h = 2166136261;
  for (const ch of s.replace(/\s+/g, " ").trim()) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

/** Substitui {{variaveis}}; devolve também as não preenchidas. */
export function fillTemplate(body: string, vars: Record<string, string | undefined>): { text: string; missing: string[] } {
  const missing = new Set<string>();
  const text = body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k: string) => {
    const v = vars[k];
    if (!v) {
      missing.add(k);
      return `[${k} — não preenchido]`;
    }
    return v;
  });
  return { text, missing: [...missing] };
}
