// Catálogo de áreas (seção 7 do prompt mestre). Ter área no catálogo ≠ ter motor jurídico validado.
export const AREA_GROUPS: { group: string; areas: string[] }[] = [
  { group: "Público", areas: ["Constitucional", "Administrativo", "Previdenciário", "Tributário", "Penal", "Processual Penal", "Financeiro", "Eleitoral", "Internacional Público", "Ambiental", "Econômico"] },
  { group: "Privado", areas: ["Civil", "Processual Civil", "Família", "Sucessões", "Empresarial", "Consumidor", "Imobiliário", "Contratual", "Autoral e Propriedade Intelectual"] },
  { group: "Trabalho", areas: ["Trabalhista", "Processual do Trabalho", "Previdenciário Trabalhista", "Sindical"] },
  {
    group: "Especializações",
    areas: [
      "Médico e Saúde", "Bancário", "Digital e Proteção de Dados", "Pessoa com Deficiência", "Criança e Adolescente", "Agrário e Agronegócio",
      "Urbanístico", "Desportivo", "Marítimo", "Aeronáutico", "Internacional Privado", "Militar", "Educacional", "Bioética", "Energia",
      "Concorrência", "Minerário", "Eletrônico e Cibernético", "Notarial e Registral", "Execução Penal", "Antidiscriminatório",
      "Direitos Humanos", "Arbitragem e Mediação",
    ],
  },
];

export const ALL_AREAS = AREA_GROUPS.flatMap((g) => g.areas);
