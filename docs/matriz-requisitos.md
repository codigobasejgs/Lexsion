# Matriz de requisitos

Situação em 26/10/2026. **Implementado** = funciona no frontend demo com dados fictícios. **Simulado** = fluxo completo, sem chamada externa, rotulado na tela. **Backend** = depende da próxima fase.
Testes: `U` = Vitest (`tests/unit`), `E` = Playwright (`tests/e2e`), `C` = captura de prints (`tests/capture`).

## Módulos

| Módulo | Rotas | Situação | Testes | Pendências |
|---|---|---|---|---|
| M01 Acesso, onboarding, Meu dia | `/entrar`, `/recuperar-acesso`, `/boas-vindas` → `/app/boas-vindas`, `/app/inicio` | Implementado; recuperação e convite simulados | E foundation, journeys 3 | Auth real |
| M02 CRM e atribuição | `/app/crm`, `/app/crm/captura`, `/app/crm/leads/[id]` | Implementado (funil, UTM, first/last touch, conversão sem duplicar) | U crm, E journey-e2 | Anúncios reais |
| M03 Atendimento | `/app/atendimento`, `/app/atendimento/[id]` | Implementado; envio simulado; fila quando desconectado | E foundation (A05), journeys 5 | Evolution API |
| M04 Agentes de IA | `/app/ia/agentes(/[id])`, `/simulador`, `/execucoes`, `/objecoes` | Simulado (respostas de demonstração), versões e publicação | E rotas | Provedor de IA |
| M05 Automações | `/app/automacoes(/[id])`, `/execucoes` | Simulado (execução registrada, sem envio) | E rotas | Fila/worker |
| M06 Clientes 360 | `/app/clientes`, `/novo`, `/[id]` | Implementado | E journey-e2 | — |
| M07 Casos e processos | `/app/casos(/[id])`, `/app/processos`, `/app/publicacoes` | Implementado; CNJ validado (mod 97) | U domain-e3e7, E rotas | DataJud real |
| M08 Prazos, tarefas, agenda | `/app/prazos`, `/app/tarefas`, `/app/agenda`, `/app/audiencias`, `/app/pericias` | Implementado; contagem com memória e versão de calendário; .ics | U, E journeys 3 | Calendário oficial por tribunal |
| M09 Documentos | `/app/documentos(/[id])`, `/solicitacoes` | Implementado; extração só em documentos de teste | E rotas | OCR real |
| M10 Previdenciário | `/app/previdenciario`, `/analises/[id]` | Simulado (resultados fixos rotulados); invalidação por pendência | E journeys 2 | Motor de regras validado |
| M11 Cálculos | `/app/calculos(/[id])` | Aritmética administrativa; resto cadastro/revisão | E rotas | Motores por área |
| M12 RPV/precatórios | `/app/requisitorios(/[id])` | Implementado (acompanhamento manual) | E rotas | Fontes oficiais |
| M13 Pesquisa e minutas | `/app/pesquisa`, `/app/minutas(/[id])`, `/app/modelos` | Implementado; DOCX pendente | E rotas | Fontes jurídicas; DOCX |
| M14 Propostas/contratos/assinatura | `/app/propostas(/nova,/[id])`, `/app/contratos(/[id])`, `/app/assinaturas` | Simulado (envio e assinatura); regras reais (A09) | U, E journeys 1 | ZapSign |
| M15 Financeiro | `/app/financeiro`, `/receber`, `/pagar`, `/caixa`, `/conciliacao`, `/recibos` | Implementado | U finance, E foundation, journeys 4 | — |
| M16 Pagamentos | `/app/pagamentos` | Simulado (cobrança, eventos, idempotência) | U, E rotas | Asaas/InfinitePay/Mercado Pago |
| M17 Marketing | `/app/marketing/campanhas`, `/paginas`, `/conteudos` | Simulado (sem publicação) | E rotas | OAuth/APIs de anúncio |
| M18 Jornal | `/app/jornal(/[id])`, `/alertas` | Amostras com fonte oficial; sem coleta | E rotas | Ingestão |
| M19 Portal do cliente | `/portal`, `/casos/[id]`, `/documentos`, `/pagamentos`, `/ajuda` | Implementado; tour próprio | E foundation, journeys (isolamento) | RLS |
| M20 Integrações | `/app/integracoes(/[provider])`, `/eventos` | Simulado; fila de saída sem duplicar | E journeys 5 | Todas as conexões |
| M21 Importação | `/app/importacoes(/[id])` | Implementado (CSV, prévia, dedupe, reversão, anti-fórmula) | U importer, E rotas | XLSX |
| M22 Relatórios, equipe, admin | `/app/relatorios`, `/app/equipe`, `/app/configuracoes`, `/admin/organizacoes` | Implementado; convite simulado | U contrast, E rotas, superadmin | Billing SaaS |
| M23 Tours, academia, ajuda | `/app/academia`, `/app/ajuda(/[slug])` | Implementado: 14 tours, 5 trilhas, 24 artigos + glossário, 32 prints reais | U help, E journeys 6 e A15, C | Material dos livros; vídeos |

## Critérios de aceite

| # | Situação | Evidência |
|---|---|---|
| A01 | Ok | Rotas acessadas direto nos E2E; `not-found.tsx`; `Guard` (sem permissão) |
| A02 | Ok | E foundation (reload após envio), E funil (reload); restauração com confirmação em Configurações → Dados |
| A03 | Ok | E journey-e2 + journeys 1 |
| A04 | Ok | E journey-e2 passos 4–8 |
| A05 | Ok | E foundation “assumir atendimento” |
| A06 | Ok | `documentos/[id]`: “Nenhum dado foi extraído deste arquivo” para upload sem fixture |
| A07 | Ok | E journeys 2 (“Resultado desatualizado”) |
| A08 | Ok | U domain-e3e7 (úteis/corridos/feriados), E journeys 3 |
| A09 | Ok | E journeys 1 (opcional não bloqueia; reenvio não duplica) |
| A10 | Ok | U finance; E foundation (parcial + estorno), journeys 4 |
| A11 | Ok | `domain/metrics.ts` (`null` ⇒ “não calculável”), U |
| A12 | Ok (demo) | E troca de escritório, isolamento do portal, superadmin agregado. **Não certifica backend.** |
| A13 | Ok | Botões simulados rotulados; DOCX listado como pendência explícita, não “em breve” |
| A14 | Ok | U importer (serial Excel, fórmulas, duplicados) |
| A15 | Ok | E “tour não fica preso…”, journeys 6 (pausar/retomar) |
| A16 | Ok | U help (arquivos existem, botões citados existem no código); 32 PNG em `public/help/screenshots/0.1.0/` |
| A17 | Ok | Ver `docs/relatorio-testes.md` |
| A18 | Ok | Busca por padrões de chave sem ocorrências no código; `.env.example` só com nomes vazios |

## UI/UX e PWA

| # | Situação | Evidência / pendência |
|---|---|---|
| U01 | Ok | Tokens em `globals.css`; `/design-system` |
| U02 | Ok | 6 telas de referência com axe e overflow (E foundation) |
| U03 | Ok | Barra inferior, “Mover” sem arrastar, cartões no celular |
| U04 | Parcial | 360/1440 automatizados; zoom 200% e orientação: **não testados em aparelho real** |
| U05 | Ok | Claro/escuro/sistema; U contrast (pares principais ≥ 4,5:1) |
| U06 | Ok | axe sem violações sérias em 40+ rotas × 2 viewports |
| U07 | Ok | `InstallCard` com prompt real ou orientação por navegador |
| U08 | Ok | E SW offline; `/api` e RSC nunca em cache |
| U09 | Ok | E pwa-update |
| U10 | Parcial | Fallback em memória implementado e sinalizado; teste automatizado de storage bloqueado: pendente |
| U11 | Ok | Configurações → Notificações: push identificado como futuro, permissão só por botão |
| U12 | Parcial | Screenshots e relatório de testes; aparelhos reais pendentes (`matriz-compatibilidade.md`) |
| U13 | Ok | `docs/performance.md` com método; Lighthouse não executado (declarado) |
| U14 | Ok | Prints desktop e celular; artigo “Operar no celular e instalar” |
