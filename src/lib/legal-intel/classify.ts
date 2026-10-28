// Classificação temática DETERMINÍSTICA por palavras da ementa (sem IA). A IA, quando usada, só resume
// a partir do texto oficial já coletado. Função pura, testável.
const RULES: [area: string, re: RegExp][] = [
  ["Previdenciário", /previd[eê]nci|aposentad|INSS|benef[ií]cio (assistencial|previdenci)|BPC|LOAS|aux[ií]lio[- ]doen|pens[aã]o por morte|segurad|RGPS|RPPS|8\.?213|8\.?212|car[eê]ncia/i],
  ["Trabalhista", /trabalh|CLT|empregad|empregador|sal[aá]rio m[ií]nimo|jornada|f[eé]rias|FGTS|rescis|sindica|5\.?452/i],
  ["Família", /fam[ií]lia|casamento|div[oó]rcio|uni[aã]o est[aá]vel|guarda|alimentos|pens[aã]o aliment|filia[cç][aã]o|ado[cç][aã]o/i],
  ["Sucessões", /sucess[aã]o|heran[cç]a|invent[aá]rio|testament/i],
  ["Civil", /c[oó]digo civil|10\.?406|contrato|responsabilidade civil|obriga[cç][oõ]es|propriedade|posse/i],
  ["Consumidor", /consumidor|8\.?078|fornecedor|PROCON|rela[cç][aã]o de consumo/i],
  ["Tributário", /tribut|imposto|ICMS|IPI|IRPF|imposto de renda|contribui[cç][aã]o social|PIS|COFINS|ISS|Simples Nacional|tax/i],
  ["Penal", /penal|crime|pena de|reclus[aã]o|deten[cç][aã]o|2\.?848|c[oó]digo penal|delito/i],
  ["Processual Civil", /processo civil|13\.?105|CPC|recurso|execu[cç][aã]o (fiscal|de t[ií]tulo)|cumprimento de senten/i],
  ["Bancário", /banc[aá]ri|institui[cç][aã]o financeira|cr[eé]dito consignado|empr[eé]stimo|juros/i],
  ["Médico e Saúde", /sa[uú]de|SUS|plano de sa[uú]de|m[eé]dic|hospital|medicamento/i],
  ["Pessoa com Deficiência", /defici[eê]ncia|PcD|13\.?146|autis/i],
  ["Administrativo", /servidor p[uú]blico|licita[cç]|14\.?133|administra[cç][aã]o p[uú]blica|concurso p[uú]blico/i],
  ["Digital e Proteção de Dados", /dados pessoais|LGPD|13\.?709|internet|digital|ciber/i],
  ["Eleitoral", /eleitor|elei[cç]|campanha|partid[aá]ri|candidat/i],
  ["Criança e Adolescente", /crian[cç]a|adolescente|ECA|8\.?069/i],
];

export function classifyAreas(text: string): string[] {
  const t = text.normalize("NFC");
  return RULES.filter(([, re]) => re.test(t)).map(([a]) => a);
}

/** Proposição/MP em tramitação nunca é norma vigente: o rótulo deixa isso explícito. */
export function kindLabel(kind: string): string {
  return ({ proposicao: "Projeto em tramitação", medida_provisoria: "Medida provisória", norma_publicada: "Norma publicada", norma_vigente: "Norma em vigor", decisao: "Decisão judicial", ato_administrativo: "Ato administrativo" } as Record<string, string>)[kind] ?? kind;
}
