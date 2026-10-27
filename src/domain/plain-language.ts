// Linguagem simples (preferência do escritório): explica termos técnicos ao cliente final.
// Não reescreve o texto do escritório — só ACRESCENTA a explicação entre parênteses na primeira ocorrência.
const GLOSSARY: [RegExp, string][] = [
  [/\bBPC\/LOAS\b/i, "benefício de um salário mínimo para idosos ou pessoas com deficiência de baixa renda"],
  [/\bINSS\b/, "órgão que paga aposentadorias e benefícios"],
  [/\bperícia\b/i, "exame com médico ou especialista indicado pelo juiz ou pelo órgão"],
  [/\bRPV\b/, "pagamento de valor pequeno determinado pela Justiça"],
  [/\bprecatório\b/i, "pagamento de valor maior determinado pela Justiça, feito em fila"],
  [/\bprotocolad[oa]\b/i, "entregue oficialmente"],
  [/\bJustiça Federal\b/i, "tribunal que julga ações contra o INSS e a União"],
  [/\bRPPS\b/, "regime de aposentadoria próprio de servidores públicos"],
  [/\bCNIS\b/, "registro das suas contribuições ao INSS"],
  [/\baudiência\b/i, "encontro marcado com o juiz"],
];
const EXPLANATIONS = new Set(GLOSSARY.map(([, e]) => `(${e})`));

/**
 * Procura termos só no texto ORIGINAL (fora de explicações já inseridas) e insere todas de uma vez.
 * Assim uma explicação que contém outro termo ("INSS") nunca recebe explicação dentro dela, e
 * aplicar duas vezes dá o mesmo resultado.
 */
export function simplify(text: string): string {
  // Partes já explicadas (de uma aplicação anterior) ficam intocadas.
  const protectedRanges: [number, number][] = [];
  for (const e of EXPLANATIONS) for (let i = text.indexOf(e); i >= 0; i = text.indexOf(e, i + 1)) protectedRanges.push([i, i + e.length]);
  const inProtected = (i: number) => protectedRanges.some(([a, b]) => i >= a && i < b);
  const inserts: { at: number; text: string }[] = [];
  for (const [re, explanation] of GLOSSARY) {
    if (text.includes(`(${explanation})`)) continue; // já explicado
    const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    for (const m of text.matchAll(g)) {
      if (m.index === undefined || inProtected(m.index)) continue;
      inserts.push({ at: m.index + m[0].length, text: ` (${explanation})` });
      break; // só a primeira ocorrência
    }
  }
  let out = text;
  for (const ins of inserts.sort((a, b) => b.at - a.at)) out = out.slice(0, ins.at) + ins.text + out.slice(ins.at);
  return out;
}
