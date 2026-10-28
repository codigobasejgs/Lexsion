# 02 — Lacunas classificadas

Matriz completa: `01-MATRIZ-CAPACIDADES.csv` (71 capacidades atômicas). Resumo:

| Estado | Qtde | Significado |
|---|---|---|
| EXISTE_TESTADO | 38 | Comportamento comprovado por teste no HEAD final |
| EXISTE_PARCIAL | 11 | Parte funciona; o restante depende de regra validada, parser ou provedor |
| APENAS_MOCK | 7 | Interação demonstrativa rotulada (IA, assinatura, pagamentos, extração de fixture) |
| AGUARDA_PROVEDOR | 7 | Contrato pronto; falta contratação/licença (índices CJ, DataJud, Jusbrasil, Ads, PJe-Calc) |
| AGUARDA_BACKEND | 4 | Exige servidor (parser de ponto, MCP, extensão Meu INSS, leitura de processo administrativo) |
| AGUARDA_VALIDACAO_JURIDICA | 4 | Liquidação previdenciária, notas CIF, RMI e regras de transição |

## Lacunas fechadas nesta execução (frontend)
1. **Central de cálculos**: 6 modelos com aritmética testada (correção, tributo, Price/SAC, rescisão, pensão, dias-multa) e vínculo ao caso.
2. **Núcleo CNIS único**: tempo coberto, lacunas, concomitância, datas invertidas, nota explicável e pedido de prova ao portal. Um núcleo para CJ/TI/PREV/INT (sem telas duplicadas).
3. **BPC/LOAS** e **PPP/atividade especial** com versões, revisão e minuta.
4. **Fontes verificáveis** nas minutas: citação sem fonte oficial conferida bloqueia aprovação, na tela e no serviço.
5. **Versões e diff** de minuta.
6. **Workflows** por tipo de caso (5 modelos originais), encadeados em dias úteis.
7. **Follow-up ético** com opt-out executável; **cancelamento** de envio de assinatura.
8. Contratos de **índices, Jusbrasil e Ads** (planejados).

## Duplicações evitadas
- CNIS (TI-05, CJ-02, PREV-02, INT-02) usa um só núcleo, `src/domain/cnis.ts`, mostrado na análise que já existia.
- Os cálculos novos reutilizam a coleção e a tela de detalhe de `calculations`; não existe uma segunda central.
- O BPC e o PPP usam a minuta, a solicitação de documento e o portal que já existiam.

## Impossíveis ou fora de escopo nesta fase
- Consulta de tribunal ao vivo, leitura automática de PDF/laudo (OCR), IA real e assinatura com validade jurídica dependem de backend e provedor.
- Reproduzir o score, os modelos ou a base de petições de concorrentes fica proibido por direito autoral e licença.
- Uso comercial do DataJud fica restrito pelos termos do CNJ até avaliação jurídica.

## Prioridades para a próxima etapa
P0, já atendidos no frontend: nenhum cálculo "validado", bloqueio de citação, opt-out, estagiário sem aprovação.
P1: índices oficiais com data-base (fonte contratada), carência e qualidade de segurado validadas, leitura de CNIS em PDF no servidor.
P2: DataJud (após análise dos termos), ZapSign, gateway, impugnação de laudo médico.
P3: MCP, extensão de navegador, ponto eletrônico.
