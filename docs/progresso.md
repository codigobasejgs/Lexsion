# Progresso — SIWILTEC frontend

Fonte do escopo: `../Documentação/SIWILTEC_Prompt_Claude_Code1.md` (prompt mestre v2, Black & Gold + PWA).
Data de referência da demo: 26/10/2026 (relógio fixo em `src/mocks/clock.ts`).

## Atualização 27/10/2026 — Auditoria e QA Master

Relatório: [`qa/10-RELATORIO_FINAL_QA_MASTER.md`](qa/10-RELATORIO_FINAL_QA_MASTER.md). Veredito: **frontend demo aprovado com restrições não críticas**.

- Novo: DOCX real, modo memória com storage bloqueado, publicação explícita no portal, triagem por área, perfil Controladoria, ajuda contextual em todas as telas, paginação no CRM, caixa por mês.
- 13 bugs corrigidos com teste de regressão (`qa/04`).
- Verificação: lint 0 · typecheck ok · Vitest 67 · build ok · E2E **204** passaram (Chromium), 0 falhas.
- Bloqueado por rede: Firefox, WebKit, Lighthouse. Não testado: aparelhos físicos e leitores de tela.

### Próximo passo (retomar daqui)
1. Em máquina com internet: `pnpm exec playwright install firefox webkit`, Lighthouse, `pnpm audit`.
2. Homologação com a cliente (`roteiros-demo.md`) e aparelhos reais (`qa/06`).
3. Itens da cliente (`ITENS_DEPENDENTES_CLIENTE.md`).
4. Fase backend (`INTEGRACOES_BACKEND_FASE_2.md`).

---

## Atualização 26/10/2026 (3) — E3 a E7 concluídas no frontend

Todos os 23 módulos têm rotas navegáveis e fluxo funcional (real local ou simulação rotulada). Detalhe por módulo e critério: [`matriz-requisitos.md`](matriz-requisitos.md). Resultados: [`relatorio-testes.md`](relatorio-testes.md).

Destaques desta rodada:
- Configurações completas: escritório, áreas, categorias, feriados com versão de calendário, notificações por evento/canal, push opcional, LGPD (exportação JSON, pedido de eliminação com revisão), white-label com contraste corrigido automaticamente, dispositivo/armazenamento.
- `/admin/organizacoes` (superadmin só com contagens agregadas), `/boas-vindas` (checklist), `/recuperar-acesso` (simulada), sino de notificações, Meu dia com publicações e propostas aguardando retorno.
- M23: motor de tours próprio (14 tours, incluindo portal), Academia (5 trilhas por função, exercícios, progresso), 24 artigos com pré-requisitos/botões/erros/relacionados + glossário, **32 prints reais** gerados por `pnpm capture:help` com manifesto.
- Sair/restaurar demonstração apagam o cache de shell do SW.

Verificação: lint 0 · typecheck ok · Vitest 53/53 · build ok · E2E 129 passaram (2 pulados de propósito).

### Próximo passo (retomar daqui)
1. Homologação com a cliente (roteiros em `roteiros-demo.md`) e aparelhos reais (`matriz-compatibilidade.md`).
2. Firefox/WebKit no Playwright (requer `playwright install`).
3. Vetor oficial da marca e confirmação do nome (SIWILTEC × SIWILTECK.IA).
4. Fase backend: `backlog-backend.md`.

---

## Atualização 26/10/2026 (2) — E2 concluída

| Item | Evidência |
|---|---|
| CRM (M02): funil de 9 etapas em quadro e lista, filtros na URL (busca, origem, perdidos), aging por etapa | `/app/crm`; E2E `funil: mover sem arrastar…` |
| Mover etapa sem arrastar (menu acessível) + arrastar no desktop; perda exige motivo; contratado exige cliente; reabrir perdido | `domain/crm.ts` `applyStageChange` + Vitest + E2E |
| Novo lead manual com validação Zod no campo; telefone normalizado; lead aberto duplicado recusado | `NewLeadDialog`, `crmService.createLead` |
| Formulário de campanha simulado (cenário 1): UTM ⇒ origem confirmada; sem UTM ⇒ “Origem não identificada”; consentimento obrigatório; cria conversa com assistente identificada | `/app/crm/captura`; E2E jornada |
| First touch × last touch: reenvio do mesmo telefone atualiza só o último contato | E2E jornada passo 8 |
| Converter lead em cliente (A04): detecção por documento/telefone, “Usar este cadastro”, CPF/CNPJ com dígito verificador, origem copiada, lead preservado, conversa vinculada | `crmService.convert`; E2E jornada |
| Novo cliente (`/app/clientes/novo`): foco no primeiro erro, data civil validada, proteção de edição, idempotência | E2E `novo cliente…` |
| Abrir caso a partir do lead convertido ou do Cliente 360 | `CaseForm`; E2E jornada passo 5 |
| Operações encadeadas gravam numa única transação IndexedDB (`writeMany`) | `services/mock/db.ts` |
| Bug corrigido: todos os diálogos usavam o mesmo id de título (nome acessível errado) → `useId` | `components/ui.tsx` |
| 4 artigos de ajuda novos (organizar lead, converter, cadastrar cliente, abrir caso) | `content/help.ts` |

Verificação: lint 0 · typecheck ok · Vitest 23/23 · E2E 29 passaram (2 pulados de propósito).
Fixtures v2: 27 leads (24 no escritório Aurora, 3 no Boreal). Ao abrir a demo, bancos locais antigos são recriados automaticamente.

### Próximo passo (retomar daqui)
E3: documentos (upload local sem extração inventada — A06; solicitações; estados), tarefas (lista/quadro), prazos com memória de contagem e confirmação profissional (A08), agenda dia/semana/mês com conflito de horário, audiências e perícias.

---

## Estado anterior — E0 e E1 concluídas; E2 parcial

### Feito e verificado
| Item | Evidência |
|---|---|
| Fundação Next.js 16.4.3 + React 19.3 + TS estrito + Tailwind 4 | `pnpm build` ok |
| Tokens Black & Gold (escuro padrão, claro, sistema) sem flash | `src/app/globals.css`, script no `layout.tsx`; `/design-system` |
| Layout adaptativo: barra inferior < 640px, rail 640–1023, sidebar ≥ 1024 recolhível | capturas `test-results/ref/` (360 e 1440) |
| Acesso demo por 8 perfis, 2 escritórios, troca sem mistura (A12) | E2E `trocar de escritório…` |
| Estado "sem permissão" | E2E `perfil sem permissão…` |
| Busca global Ctrl/⌘+K respeitando perfil | `command-palette.tsx` |
| Persistência IndexedDB + fallback em memória + BroadcastChannel entre abas | `services/mock/db.ts` |
| 6 telas de referência: Meu dia, Atendimento, Cliente 360, Análise previdenciária, Financeiro, Portal | E2E axe (sem violações sérias/críticas) + sem overflow em 360 e 1440 |
| Assumir atendimento pausa IA; humano bloqueado enquanto IA ativa (A05) | E2E A05 (com persistência após reload — A02) |
| Baixa parcial com prévia, idempotência, estorno reverso (A10) | Vitest `finance.test.ts` + E2E A10 |
| Alterar pendência invalida resultado previdenciário (A07) | `pensionService.togglePending` (inputsVersion) |
| Dinheiro em centavos, parcelas somam o total, datas civis sem UTC | Vitest `money-dates.test.ts` |
| PWA: manifest, ícones any/maskable/monochrome/apple, SW manual, `/offline` | E2E `manifest válido…` |
| Offline após visita (shell + IndexedDB); rota não visitada → `/offline`; nada de `/api` ou RSC em cache | E2E `service worker controla…` |
| Atualização A→B: bloqueia com rascunho, 1 reload, sem loop, rota preservada (U09) | E2E `pwa-update.spec.ts` |
| Exportação `.ics` real da agenda | `app/agenda/page.tsx` |
| 6 artigos de ajuda iniciais + central com busca | `content/help.ts` |

### Comandos executados (última rodada)
- `pnpm lint` → 0 problemas
- `pnpm typecheck` → ok
- `pnpm test` → 17 testes, 2 arquivos, todos passando
- `pnpm build` → ok
- `pnpm test:e2e` → 23 passaram, 2 pulados de propósito (mobile: troca de escritório e SW — rodam no desktop)

### Não testado
- **Aparelho real** (Android/Chrome, iPhone/Safari, Windows/Edge): não testado. Só Chromium headless.
- Firefox e WebKit: ainda não estão na config do Playwright.
- Leitor de tela (NVDA/VoiceOver/TalkBack): não testado. Só axe automatizado.
- Lighthouse/Core Web Vitals: não medidos.

## Próximo passo (retomar daqui)
1. **E2 completa**: CRM (M02) com Kanban/lista + funil, criação de lead por formulário de campanha com UTM, conversão lead→cliente sem duplicar (A04), criar caso a partir do cliente; formulário "Novo cliente" (hoje a ação da busca leva a `/app/clientes?novo=1`, que ainda não abre formulário).
2. E3: documentos (upload local, A06), tarefas, prazos com memória de contagem (A08), agenda dia/semana/mês e conflitos.
3. E4–E6 conforme tabela da seção 12 do prompt mestre.
4. E7: tours (`data-tour` já presentes nas telas de referência), `capture:help` com Playwright, prints nos artigos, Firefox/WebKit, aparelho real, Lighthouse.

## Pendências e decisões abertas
- Vetor oficial da marca: ícones usam monograma "SW" **provisório** (`scripts/pwa-assets.mjs`). Trocar e rodar `pnpm pwa:assets`.
- Nome: "SIWILTEC" mantido; a imagem mostra "SIWILTECK.IA" — aguardando confirmação.
- Rotas M02–M23 que não constam no menu ainda não existem; o menu só lista o que está implementado (A13).
