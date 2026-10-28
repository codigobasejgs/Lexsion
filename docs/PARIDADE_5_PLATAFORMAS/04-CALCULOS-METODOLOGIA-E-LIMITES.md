# 04 — Cálculos: metodologia e limites

Motor: `src/domain/calc-engine.ts` (central de cálculos) e `src/domain/cnis.ts` (núcleo previdenciário). Dinheiro em **centavos inteiros**; arredondamento `Math.round` (meio para cima) ao centavo em cada passo mostrado na memória.

## Status por modelo (nenhum é "VALIDADO")
| Modelo | Área | Status | O que é aritmética válida | O que NÃO faz |
|---|---|---|---|---|
| Correção monetária e juros | Cível | AGUARDA_TABELA | fator acumulado ∏(1+taxa) da série **informada**, juros simples mensais, multa | não busca índice oficial; não escolhe índice nem termo inicial |
| Atualização de tributo | Tributária | AGUARDA_TABELA | mesmo motor com taxa informada | SELIC/regras por tributo não aplicadas |
| Financiamento Price/SAC | Bancária | DEMONSTRATIVO | PMT, juros sobre saldo, última parcela zera saldo | IOF, tarifas, seguros, capitalização diária, abusividade |
| Verbas rescisórias (simplificado) | Trabalhista | REGRAS_PARCIAIS | saldo, aviso proporcional (30+3/ano, teto 90), 13º e férias em avos informados, 1/3, 40% FGTS | descontos INSS/IRRF, reflexos, projeção do aviso nos avos, regra dos 15 dias |
| Pensão alimentícia | Família | DEMONSTRATIVO | percentual × base; atrasados sem correção | correção/juros dos atrasados, 13º/férias |
| Pena de multa (dias-multa) | Penal | REGRAS_PARCIAIS | dias × fração do SM × fator, limites 10–360 e 1/30–5 SM | correção desde o fato; dosimetria, progressão, prescrição |
| Horas extras; parcelamento | Trabalhista; Cível | (modelos anteriores, inalterados) | já existiam | — |
| CNIS: tempo coberto e diagnóstico | Previdenciário | DEMONSTRATIVO | meses civis sem dupla contagem; lacunas e concomitâncias exatas | carência, qualidade de segurado, regras de transição, conversão de especial, RMI |
| BPC: renda per capita | Previdenciário | DEMONSTRATIVO | soma ÷ pessoas do grupo, exclusões marcadas | não decide elegibilidade; SM e fração são **informados** |
| Workflows: prazos | Operação | DEMONSTRATIVO | dias úteis com fins de semana e feriados do escritório | calendário/suspensões do tribunal |

## Vetores de referência (golden tests, conferidos à mão)
`tests/unit/calc-engine.test.ts`, `cnis.test.ts`, `recurrence.test.ts`:
- Price R$ 10.000 a 1% a.m., 12 meses → R$ 888,49, saldo final R$ 0,00.
- SAC R$ 1.200 a 1%, 12 → 1ª R$ 112,00, última R$ 101,00.
- Correção R$ 1.000 com 1% e 2% → R$ 1.030,20; juros 1%×2 → R$ 20,60; multa 2% → R$ 20,60; total R$ 1.071,40.
- Rescisão R$ 3.000, 15 dias, 2 anos, 6/12, FGTS R$ 10.000 → aviso 36 dias R$ 3.600; total R$ 12.600,00. 30 anos → aviso limitado a 90 dias.
- Pensão 30% de R$ 2.000 → R$ 600; 3 meses → R$ 1.800.
- Dias-multa 10 × 0,5 × R$ 1.518 → R$ 7.590.
- CNIS 15/01/2020–31/12/2020 + 01/06/2020–31/03/2021 → 15 meses; lacuna 07–09/2019 → "3 meses".
- BPC: (0 + 1.200 + [1.518 excluído]) ÷ 3 = R$ 400 > 1/4 de R$ 1.518 (R$ 379,50) — teste unitário; na tela (E2E): (0 + 600 + [1.518 excluído]) ÷ 3 = R$ 200; sem a exclusão, R$ 706.
- Workflow: 26/10/2026 + 2 úteis = 28/10; +1 útil com feriado em 29/10 → 30/10.

Casos de erro testados: série com mês ausente, fora de ordem, mês 13; valores negativos; dias 40 no mês; avos > 12; dias-multa < 10; fração < 1/30; composição familiar vazia; renda negativa; datas invertidas no CNIS.

## Regras de produto
- Resultado mostra **premissas** e o selo do status; exportação CSV leva "Demonstrativo — não validado".
- Alterar entrada marca o resultado como **desatualizado** (versão de entradas × versão do resultado).
- Revisão só por quem tem `aprovar_peca`; isso é controle de interface até o servidor existir.
- Para virar VALIDADO: fonte oficial do índice/tabela com data-base, regra jurídica revisada por profissional habilitado, ≥ 3 vetores (usual, limite, erro) por fórmula e teste de regressão.
