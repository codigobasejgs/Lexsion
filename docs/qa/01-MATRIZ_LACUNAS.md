# 01 — Matriz de lacunas

IDs M/A/U com definições originais do prompt mestre v2 (`../Documentação/SIWILTEC_Prompt_Claude_Code1.md`); IDs `F-*` vêm do prompt de finalização (27/10/2026).

| ID | Fonte | Exigência | Evidência antes | Status antes | Ação | Teste de aceite | Status depois |
|---|---|---|---|---|---|---|---|
| M13 / F-DOCX | prompt final §6.6 | Exportação DOCX real | `minutas/[id]`: “DOCX ainda não implementado” | INEXISTENTE | ZIP+OOXML sem dependência; bloqueio de aprovação com campo faltante | U:docx, QD, Word 16 | VERIFICADO |
| U10 / F-ROB | §12.4 | Storage bloqueado com aviso | login falhava em silêncio | INEXISTENTE | sessão e dados em memória + aviso | QR ROB-01 | VERIFICADO |
| U04 / RESP | §12.5 | 320–1440 sem rolagem; zoom 200 % | rolagem a 320/768 em 3 telas | PARCIAL | contêineres e grades corrigidos | QS | VERIFICADO |
| U05 | U05 | Contraste medido nos temas | tema claro com accent a 3,1:1 | PARCIAL | token corrigido; axe no tema claro | U:contrast, J tema claro | VERIFICADO |
| M19 / F-G | §7 G | Atualização do portal só quando publicada | campo único sem revisão | INEXISTENTE | rascunho → publicar | QF FLUXO G | VERIFICADO |
| M02 / F-A | §6.2, §7 A | Triagem por área + atribuição | não havia triagem | INEXISTENTE | roteiros por dados (44 áreas) | U:triage, QF FLUXO A | VERIFICADO |
| M22 / F-PERFIL | §6.9 | Perfil controladoria | inexistente | INEXISTENTE | papel + usuária demo | QF ADM-01 | VERIFICADO |
| M23 / F-HELP | §11 | “Como usar esta tela?” em todos os módulos; rota→artigo→tour | só central e academia | PARCIAL | ajuda contextual no cabeçalho; 5 artigos; 2 tours; cobertura testada | U:help (70 rotas), QF HELP | VERIFICADO |
| M23 / F-BUSCA | §11.2 | Sinônimos brasileiros | busca por título/passos | PARCIAL | `keywords` em 16 artigos | U:help, QF HELP-05 | VERIFICADO |
| M02 / CRM-05 | §15.2 | Paginação | lista sem paginação | INEXISTENTE | paginação na URL | QF CRM-05 | VERIFICADO |
| M15 / FIN-06 | §15.2 | Filtro temporal no caixa | sem filtro | INEXISTENTE | mês + saldo inicial; cartões no celular | QF FIN-06 | VERIFICADO |
| M18 / F-E | §7 E | Notícia→caso→tarefa sem duplicar | duplicava no clique duplo | PARCIAL | id determinístico | QF FLUXO E | VERIFICADO |
| BROW-02/03 | §12.6 | Firefox/WebKit | não instalados | BLOQUEADO | tentativa de instalação falhou (rede) | — | BLOQUEADO |
| PERF-01 | §17 | Lighthouse | não instalado | BLOQUEADO | medição de laboratório própria | perf.ts | BLOQUEADO (alternativa documentada) |
| F-MARCA | §8 | Logo oficial e grafia | monograma provisório | BLOQUEADO (cliente) | decisão registrada | — | PENDENTE CLIENTE |
| F-LIVROS | §6.9 | Livros da autora | “Aguardando material” | BLOQUEADO (cliente) | mantido sem conteúdo fabricado | QF ADM-09 | VERIFICADO |
| F-GIT | §18 | Repositório local | sem `.git` | INEXISTENTE | `git init`, 8+ commits, sem remoto | GIT-01/02 | VERIFICADO |
| F-LANDING | §6.1 | Landing institucional | `/` redireciona para `/entrar` (com painel de marca) | PARCIAL | mantido; landing com prints reais fica para a fase de marca definitiva | — | PENDENTE (P3) |
| F-DENSIDADE | §6.1 | Preferência de densidade/linguagem simples | só tema e cor | INEXISTENTE | não implementado | — | PENDENTE (P3) |
| F-RECORRENCIA | §6.3 | Tarefa recorrente | não existe | INEXISTENTE | não implementado | — | PENDENTE (P3) |
| F-ANIVERSARIO | Tícius | Filtro de aniversariantes | não existe | INEXISTENTE | não implementado | — | PENDENTE (P3) |

Demais M01–M23, A01–A18 e U01–U14: ver `../MATRIZ_REQUISITOS_ATUALIZADA.md`.
