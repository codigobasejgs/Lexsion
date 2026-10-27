# 00 — Auditoria de base (27/10/2026)

Executada **antes** de qualquer alteração desta rodada. Logs: `docs/qa/logs/baseline-*.txt`.

## Ambiente
| Item | Valor |
|---|---|
| Diretório | `Siwiltec - Advogados/siwiltec` (Windows 10, Git Bash/PowerShell) |
| Runtime | Node 22.17.1 · pnpm 10.13.1 (`pnpm-lock.yaml`; `packageManager` fixado) |
| Framework | Next.js 16.4.3 (App Router, Turbopack) · React 19.3 · TypeScript estrito · Tailwind 4 |
| Estado/dados | TanStack Query 5 + IndexedDB (`siwiltec-demo`), fallback em memória |
| Testes | Vitest 5 · Playwright 1.64 + axe-core · navegadores instalados: **só Chromium** |
| PWA | `src/app/manifest.ts`, `public/sw.js` manual com VERSION carimbada no build |
| Vercel | sem `vercel.json` (não é necessário para Next.js) |
| Git | **não existia**; inicializado nesta rodada (checkpoint `08fc09e`) |

## Baseline (antes de editar)
| Comando | Resultado |
|---|---|
| `pnpm install --frozen-lockfile` | PASS |
| `pnpm lint` | PASS — 0 problemas |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS — 53 testes |
| `pnpm build` | PASS |
| `pnpm test:e2e` | PASS — 129 passaram, 2 pulados de propósito (47 s) |

## Inventário
- 83 páginas (`page.tsx`): 70 em `/app`, 5 no portal, `/admin/organizacoes`, `/entrar`, `/recuperar-acesso`, `/boas-vindas`, `/offline`, `/design-system`, `/`.
- Documentos existentes: `docs/matriz-requisitos.md` (M01–M23, A01–A18, U01–U14 com as **definições originais** do prompt mestre v2 em `../Documentação/SIWILTEC_Prompt_Claude_Code1.md`), relatório de testes, arquitetura, backlog, decisões, roteiros, compatibilidade, performance, deploy.
- Materiais da cliente presentes em `../Documentação/`: prompt mestre, conversa de WhatsApp, planilha Tícius `.xlsb`, imagem de marca `.jpeg`, áudios e vídeos. **Ausentes**: `PROMPT_MASTER_SIWILTEC_ERP_JURIDICO_CLAUDE_CODE.md`, `PROJETO SIWILTEC.docx`, `SIWILTECH.txt`, livros da autora.

## Verificação das alegações do resumo anterior
| Alegação | Evidência | Status |
|---|---|---|
| Docs M/A/U, relatórios, guias | arquivos presentes em `docs/` | VERIFICADO |
| Rolagem corrigida em Cálculos, Caixa, Equipe | a 360/1440 sim; **a 320 e 768 havia rolagem em outras telas** | PARCIAL → corrigido (BUG-04/05) |
| Prévia de importação espaçada | colunas com `pr-3` | VERIFICADO |
| ~804/1.044 KB de JS | medido de novo: 786/995 KB (sem SW, sem cache) | VERIFICADO (mesma ordem) |
| DOCX pendente | não existia | INEXISTENTE → implementado |
| Firefox/WebKit | não instalados | BLOQUEADO (rede — ver 06) |
| Storage bloqueado | **login falhava silenciosamente** | INEXISTENTE → BUG-02 corrigido |

## Segredos e dados sensíveis (resumo; detalhe em 07)
- Varredura por padrões de chave/token/senha em `src`, `tests`, `docs`, `public`: **nenhuma ocorrência**. Acertos só em cache do Vitest e no hash de integridade do lockfile.
- CPFs no código são de teste (dígitos válidos por algoritmo ou mascarados `000.000.xxx-xx`), não pertencem a pessoas reais conhecidas.
- Conversa de WhatsApp contém marcadores de credencial; **nenhum trecho dela aparece no código, testes ou docs** (comparação automatizada de nomes próprios). A pasta `Documentação/` fica **fora** do repositório Git.
- Planilha `.xlsb`: lida só a estrutura (lista de abas) por script Python sobre o ZIP, sem abrir no Excel e sem executar VBA (o arquivo contém `vbaProject`).
