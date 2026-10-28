# 10 — Diffs e compatibilidade

Faixa: `529d2f7..HEAD` (branch `paridade-5-plataformas`). 9 commits de código e mais os de documentação. Em `src`: 30 arquivos, +1.162/−26 linhas. Remoções só onde uma linha foi substituída.

## Correções em código existente (bug comprovado)
1. **`/app/previdenciario/planejamentos/[id]`**: antes redirecionava no cliente e mostrava "Abrindo planejamento…" sem título. Isso causava a única falha da baseline (intermitente no celular). Agora renderiza a mesma `PensionAnalysisView` na própria URL. A página de análises passou a exportar esse componente, com o mesmo comportamento. Evidência: 10/10 sob 5 workers.
2. **Teste `journeys › 6. aprendizagem`**: navegava antes de o tour gravar o progresso (1 falha em 151). Agora espera o popover fechar. Evidência: 20/20 sob 8 workers. Não houve mudança no produto.
3. **Teste `journeys › detalhes via lista`**: passou a esperar a URL de planejamento, por causa do item 1.

## Alterações aditivas em arquivos existentes
| Arquivo | Mudança | Por que não regride |
|---|---|---|
| `calculos/page.tsx` | Modelos da central somados ao catálogo, selo de status, caso na criação | Modelos antigos e selos mantidos (PAR-CALC-03) |
| `calculos/[id]/page.tsx` | Usa o motor novo quando o modelo existe nele; campo de caso; `textarea`/`select` | `compute` antigo intacto para os modelos anteriores |
| `casos/[id]/page.tsx` | Aba Cálculos; análises especializadas na aba Análises | Abas antigas inalteradas |
| `previdenciario/page.tsx` e `analises/[id]` | Seção de análises especializadas; painel de diagnóstico | Fluxo de etapas e cenários inalterado (foundation, journeys) |
| `minutas/[id]/page.tsx` | Painéis Fontes e Versões; aprovação exige fontes verificadas | Regra de campo faltante mantida (DOC-03). Minuta semente sem citação continua aprovável |
| `crm/leads/[id]/page.tsx` | Painel de follow-up | Conversão e triagem inalteradas (journey-e2) |
| `contratos/[id]/page.tsx` | Cancelar envio e nova versão após cancelamento | Recusa e expiração inalteradas |
| `admin/integracoes/page.tsx` | Rótulos de 2 categorias novas | — |
| `nav.ts` | Item Workflows em Operação | Ordem dos itens antigos mantida |
| `types.ts` | `Assessment`; campos opcionais em `LegalDraft` e `Lead` | Todos opcionais: dados existentes continuam válidos |
| `db.ts` e `fixtures-ops.ts` | Coleções `assessments` e `legalSources` | Sem mudar `FIXTURE_VERSION`: a demo do usuário não é recriada |
| `ops-repo.ts` | Versão ao salvar a minuta; bloqueio de citação; `cancel` | Mesmas assinaturas públicas |
| `repo.ts` | `tasksService.applyWorkflow` | Função nova |
| `adapters.ts` | 2 categorias e 4 provedores planejados | Teste "nenhum ativo/real" continua verde |
| `help.ts`, `route-help.ts`, `help-manifest.ts` | 4 artigos e 1 rota de ajuda | Prints antigos preservados |
| `playwright.config.ts` | Projetos de captura `paridade-*` (só com `CAPTURE=1`) | Suíte padrão inalterada |

## Novas rotas
`/app/workflows` e `/app/previdenciario/especializadas/[id]`. Total: 103 páginas, 103 visitadas por teste (`logs/inventario-rotas.md`).

## Novos componentes, módulos e testes
Domínio: `calc-engine`, `cnis`, `citations`, `text-diff`, `workflows`, `followup`. UI: `cnis-panel`, `sources-panel`, `versions-panel`, `followup-panel`. E2E: `paridade-calculos`, `paridade-previdenciario`, `paridade-fontes`, `paridade-operacao` (14 cenários). Unitários: +22.

## Regressão
Suíte completa final: **289 PASS, 0 FAIL** (14 pulados por viewport, intencionais), contra 260/261 na baseline. Logs em `logs/final-*.txt`.
