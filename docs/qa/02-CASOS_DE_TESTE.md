# 02 — Casos de teste (piso de 98 + adicionais)

Resultado: **PASS** = teste automatizado executado e aprovado em 27/10/2026 (Chromium; mobile 360 e desktop 1440 salvo indicação). **PASS-M** = verificado por inspeção/execução manual registrada. **PARCIAL** = cobre parte do critério. **BLOQ** = não executável neste ambiente (motivo real). Pré-condição comum: build de produção, fixtures v4, relógio 26/10/2026, perfis fictícios.

Arquivos: `F`=foundation · `J`=journeys · `E2`=journey-e2 · `QF`=qa-fluxos · `QD`=qa-docx · `QR`=qa-robustez · `QS`=qa-responsivo · `PU`=pwa-update · `U:x`=tests/unit/x.

## Geral / navegação
| ID | Passos (resumo) | Esperado | Resultado | Evidência |
|---|---|---|---|---|
| GEN-01 | Entrar com admin, financeiro, cliente, superadmin | Painel de cada perfil | PASS | QF “GEN-01” |
| GEN-02 | Abrir 41 rotas do menu | Renderiza `h1`, sem “não encontrado” | PASS | J “rotas E3–E7” |
| GEN-03 | Recarregar rota profunda; rota inexistente | Conteúdo/404 tratado | PASS | QR “GEN-03/04” |
| GEN-04 | Voltar/avançar com filtro na URL | Contexto preservado | PASS | QR “GEN-03/04” |
| GEN-05 | Busca global (Ctrl K) | Clientes/casos/ajuda do perfil | PASS-M | `command-palette.tsx` (filtra por `can`) |
| GEN-06 | Tema claro/escuro/sistema | Persistente, contraste ≥ 4,5:1 | PASS | U:contrast (todos os tokens claros × 4 superfícies); J “tema claro” (axe) |
| GEN-07 | Ações externas | Selo “Simulação”/“demo” | PASS | journeys 1, 5; FIN-10 |
| GEN-08 | Controles sem ação | Nenhum botão decorativo | PARCIAL | Varredura manual; DOCX implementado; “Falar com o escritório” do portal informa que é demo |
| GEN-09 | Restaurar demonstração | Alterações somem, fixtures voltam | PASS | QF “GEN-09” |
| GEN-10 | Erros de console nas jornadas | Nenhum `pageerror` | PARCIAL | QR ROB-01 verifica `pageerror`; demais jornadas não coletam console |

## CRM / clientes
| ID | Esperado | Resultado | Evidência |
|---|---|---|---|
| CRM-01 | Lead criado aparece na lista/quadro | PASS | E2 jornada (campanha) |
| CRM-02 | Erro por campo | PASS | QF FLUXO A (“Responda antes…”); E2 CPF inválido com foco |
| CRM-03 | Mudança de etapa com histórico único | PASS | E2 “funil: mover sem arrastar” |
| CRM-04 | Converter sem duplicar | PASS | E2 passos 4–8 |
| CRM-05 | Buscar/filtrar/limpar/paginar | PASS | QF “CRM-05” |
| CRM-06 | Arquivar (perdido) com motivo e oculto do funil | PASS | E2 “perda exige motivo” |
| CRM-07 | UTM preservada (first/last touch) | PASS | E2 passo 8 |
| CRM-08 | Atendimento simulado sem envio real | PASS | F “assumir atendimento”; J 5 (fila) |

## Caso / processo / prazo
| ID | Esperado | Resultado | Evidência |
|---|---|---|---|
| JUR-01 | Caso no cliente certo | PASS | E2 passo 5 |
| JUR-02 | CNJ inválido recusado | PASS | U:domain-e3e7 (mod 97); validação em `casos/[id]` |
| JUR-03 | Prazo ligado a caso e responsável | PASS | J 3 |
| JUR-04 | Concluir tarefa reflete Meu dia | PASS | QR ROB-01 (contagem cai) |
| JUR-05 | Prazo confirmado vira compromisso na agenda e no Meu dia | PASS | J 3 |
| JUR-06 | Feriados/fim de semana/fuso | PASS | U:domain-e3e7 (Finados 02/11, dias úteis); datas civis sem UTC (U:money-dates) |
| JUR-07 | Prazo demo não parece oficial | PASS | Aviso “Contagem demonstrativa” + estado “proposto” até confirmação (J 3) |
| JUR-08 | Atualização não publicada não vaza ao portal | PASS | QF FLUXO G |

## Previdenciário / cálculos
| ID | Esperado | Resultado | Evidência |
|---|---|---|---|
| PREV-01 | CNIS sintético coerente | PASS | J 2; print `comparar-cenarios-4` |
| PREV-02 | Documento ausente não vira recebido | PASS | Status “solicitado” só muda com “Registrar recebimento” (upload) |
| PREV-03 | Premissas + revisão exigida | PASS | J 2 (“Resultado desatualizado” → revisão) |
| PREV-04 | Nada de índice/fonte inventada | PASS-M | Telas rotulam “Exemplo demonstrativo — cálculo jurídico não validado” |
| CALC-01 | Validação de entradas | PARCIAL | Campos numéricos com `parseBRL`; limites extremos não testados por E2E |
| CALC-02 | Fórmulas demo determinísticas | PASS | U:finance, U:domain-e3e7 (parcelamento) |
| CALC-03 | Centavos inteiros | PASS | U:money-dates (soma de parcelas = total) |
| CALC-04 | Cálculos sem rolagem 320/360/390 | PASS | QS (7 larguras) |
| CALC-05 | Tabela rolável acessível | PASS | contêiner `role=region` + `tabIndex=0` + rótulo; axe sem violação |

## Minutas / documentos
| ID | Esperado | Resultado | Evidência |
|---|---|---|---|
| DOC-01 | Editar e salvar | PASS | QD |
| DOC-02 | Placeholder faltante sinalizado | PASS | QD |
| DOC-03 | Aprovação bloqueada com faltante | PASS | QD (botão desativado; serviço recusa) |
| DOC-04 | DOCX com nome/MIME/tamanho válidos | PASS | QD (`PK`, > 2 KB, nome limpo) |
| DOC-05 | Parse do DOCX com acentos | PASS | QD + U:docx |
| DOC-06 | Abre em aplicativo compatível | PASS | Microsoft Word 16 (COM, somente leitura): título “Título 1”, cabeçalho, rodapé, acentos |
| DOC-07 | Injeção não executa | PASS | QD (sem `dialog`; texto escapado no DOCX) |
| DOC-08 | Documento real não persiste em storage | PASS-M | Upload guarda arquivo só no IndexedDB do navegador, com aviso; nenhum dado real em fixtures |
| DOC-09 | Contrato/prévia com teclado e zoom | PASS | axe no contrato; QS zoom 200 % |

## Financeiro / contratos
| ID | Esperado | Resultado | Evidência |
|---|---|---|---|
| FIN-01 | Proposta → contrato → parcelas | PASS | J 1 |
| FIN-02 | Soma das parcelas = total | PASS | U:finance, U:money-dates |
| FIN-03 | Baixa atualiza caixa e saldo | PASS | F A10; J 4 |
| FIN-04 | Repetição não duplica | PASS | U:finance (idempotência); J 1 (“Reenviar evento”) |
| FIN-05 | Estorno com histórico | PASS | F A10 |
| FIN-06 | Filtro temporal | PASS | QF “FIN-06” |
| FIN-07 | Vencida/aberta/parcial/paga | PASS-M | Badges em `receivables.tsx`; J 4 |
| FIN-08 | Recibo com aviso demo | PASS | J 4 (valor por extenso) + rodapé “Ambiente demonstrativo” |
| FIN-09 | Caixa 320/360/390 | PASS | QS; cartões no celular |
| FIN-10 | Provedores não conectados | PASS | QF “FIN-10 / ADM-08” |

## Equipe / importação / configuração
| ID | Esperado | Resultado | Evidência |
|---|---|---|---|
| ADM-01 | Módulos permitidos/negados | PASS | F “perfil sem permissão”; QF “ADM-01” (controladoria) |
| ADM-02 | Troca de usuário não mistura | PASS | F “trocar de escritório”; QF FLUXO G |
| ADM-03 | Equipe sem rolagem | PASS | QS |
| ADM-04 | CSV: mapeamento e prévia | PASS | U:importer; print `importar-csv-3` |
| ADM-05 | Inválidos/duplicados/incompletos | PASS | U:importer (rejeita, ignora duplicado, data inválida) |
| ADM-06 | Confirmar e reverter | PASS-M | `importacoes/[id]` “Reverter lote”; GEN-09 para reset |
| ADM-07 | XLSB não executado | PASS | Importador aceita só CSV; leitura da planilha por script sem macros (00) |
| ADM-08 | Sem credenciais em HTML | PASS | QF “FIN-10 / ADM-08” |
| ADM-09 | Livros sem conteúdo fabricado | PASS | QF “ADM-09” |
| ADM-10 | Tema/logo refletem no shell | PARCIAL | Tema sim (U:contrast, Configurações); cor de marca salva mas aplicação global é fase futura (rotulado) |

## Portal, tour, ajuda
| ID | Esperado | Resultado | Evidência |
|---|---|---|---|
| PORT-01 | Cliente A não vê B | PASS | QF FLUXO G (`k-joao-apos` → não encontrado); J portal |
| PORT-02 | Não publicado fica privado | PASS | QF FLUXO G |
| PORT-03 | Documentos solicitados e resposta na timeline | PARCIAL | Pedido aparece no portal; envio pelo portal cria pendência interna; não há E2E dedicado |
| HELP-01 | Toda rota operacional tem artigo | PASS | U:help (70 rotas `/app`) |
| HELP-02 | Tours com alvo real | PASS | U:help (todo `data-tour` existe no código); J 6, QF HELP |
| HELP-03 | Concluir, voltar, pular, reiniciar, progresso | PASS | J 6 (pausar/retomar/concluir) |
| HELP-04 | Prints existem e são atuais | PASS | U:help; 38 PNG regenerados nesta versão |
| HELP-05 | Sinônimos | PASS | U:help + QF HELP-05 |
| HELP-06 | Tour com teclado e no celular | PASS | QF HELP (Esc fecha); J 6 roda em 360 px |
| HELP-07 | Prints sem dados reais | PASS-M | Prints só com fixtures fictícias (“Exemplo”, “Fictício”) |

## Persistência, PWA, navegadores, acessibilidade
| ID | Esperado | Resultado | Evidência |
|---|---|---|---|
| ROB-01 | Storage bloqueado | PASS | QR ROB-01 |
| ROB-02 | Dados antigos/corrompidos | PASS | QR ROB-02 |
| ROB-03 | Duas abas | PASS | QR ROB-03 (estável 20/20) |
| PWA-01 | Manifest e ícones | PASS | F “manifest válido” |
| PWA-02 | Sem cache sensível; atualização | PASS | F (sem `/api`, sem RSC); PU (A→B sem loop) |
| PWA-03 | Offline/online | PASS | QR PWA-03; F offline após visita |
| RESP-01 | 320/360/390 | PASS | QS |
| RESP-02 | 768/1024/1280 | PASS | QS |
| RESP-03 | Zoom 200 % | PASS | QS (reflow em 640 px CSS) |
| RESP-04 | Teclado virtual | PARCIAL | `interactive-widget=resizes-content` + diálogo rolável; sem aparelho real |
| BROW-01 | Chromium | PASS | 204 passaram |
| BROW-02 | Firefox | BLOQ | Download do navegador falhou (proxy recusado / conexão expirada) — 06 |
| BROW-03 | WebKit | BLOQ | Idem |
| A11Y-01 | axe sem sério/crítico | PASS | J (51 rotas × 2 viewports, tema escuro) + 10 telas no tema claro; F (telas de referência) |
| A11Y-02 | Teclado nos fluxos | PARCIAL | Diálogos nativos, Esc no tour, foco no erro; sem varredura Tab completa |
| A11Y-03 | Foco/rótulos/erros | PASS | E2 (foco vai ao campo com erro) |
| A11Y-04 | Movimento reduzido | PASS | QF “A11Y-04” |
| SEC-01 | Sem segredos | PASS | 07 |
| SEC-02 | Sem XSS trivial | PASS | QD DOC-07; React escapa texto; sem `dangerouslySetInnerHTML` com dado do usuário |
| SEC-03 | CSV anti-fórmula | PASS | U:domain-e3e7; QF “SEC-03” |
| PERF-01 | Lighthouse | BLOQ | Lighthouse não instalado e sem rede para instalar; medição de laboratório própria em 08 |
| PERF-02 | Bundle vs baseline | PASS | 08 |
| BUILD-01 | Install e lint | PASS | logs/final-lint.txt |
| BUILD-02 | Typecheck, unit, E2E | PASS | 67 unit; 204 E2E |
| BUILD-03 | Build e smoke | PASS | logs/final-build.txt; servidor local respondendo |
| GIT-01 | `.gitignore` | PASS | `.env*`, `test-results`, `.next` fora; `Documentação/` fora do repositório |
| GIT-02 | `git status` limpo | PASS | 7 commits locais, sem remoto |
| VERCEL-01 | Config e deep links | PASS-M | Next.js sem rewrites; deep links via App Router; GEN-03 |

## Adicionais (bugs e requisitos do repositório)
| ID | Esperado | Resultado | Evidência |
|---|---|---|---|
| ADD-01 FLUXO A completo | Triagem → atribuição → indicador do funil | PASS | QF “FLUXO A” |
| ADD-02 FLUXO E | Notícia → caso → tarefa sem duplicar | PASS | QF “FLUXO E” |
| ADD-03 Ajuda contextual | “Como usar esta tela?” abre artigo e tour | PASS | QF “HELP” |
| ADD-04 Triagem por área | 44 áreas com roteiro; sem promessa de resultado | PASS | U:triage |
| ADD-05 Diálogo em tela baixa | Ações alcançáveis | PASS | QS RESP-03 |

**Totais (contagem automática das linhas acima):** a lista do prompt tem **102 IDs** (o texto fala em 98). Resultado: **PASS 85 · PASS-M 7 · PARCIAL 7 · BLOQ 3 · FAIL 0**, além de 5 casos adicionais (ADD) aprovados.
