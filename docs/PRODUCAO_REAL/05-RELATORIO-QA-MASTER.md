# 05 — Relatório QA Master (atualizado em 29/10/2026)

## Rodada 3 (auditoria de produção, versão `d65affd`, 29/10/2026)
| Suíte | Resultado |
|---|---|
| Lint e typecheck | 0 erros (3 avisos antigos) |
| Unitários | **149 PASS** · 1 opcional (gera amostra .docx) |
| Banco (PGlite, todas as migrations) | **48 PASS** |
| Integração com Supabase real (`RUN_REAL=1`) | **24 PASS · 0 pulados** (inclui privilégios 13/13: catálogo + sessões reais de 5 papéis e 2 escritórios) |
| E2E completo local (build de produção + Supabase real, 2 telas) | 10 workers: 332 PASS · 19 pulados (opcionais/só produção) · 4 falhas de tempo, diferentes a cada rodada; 5 workers: 334 · 2; 2 workers nas falhas: todas passam, salvo PWA-013, que passa isolado tanto no HEAD como nesta versão. **Não há falha determinística.** |
| Regressões achadas pela suíte e corrigidas | rótulo "Na fila (simulada)" sumiu da demonstração (journeys 5); cronograma da proposta cobria "Criar proposta" em 360 px (COM-01 mobile) |
| **Produção `lexsion.com.br`** (todos os `real-*`) | **26/26** (auth 1, comercial 7, erp 6, integrações 3, inteligência 3, persistência 6, recuperação 1), 0 pulados após o ajuste do link do Senado; resíduo sintético 0 |
| Backup → restauração isolada (antes das migrations) | **RESTAURACAO_OK** (26 tabelas, RLS 0 vazamento, arquivos 2/2) |

Novos cenários reais: COM-01 proposta → revisão → aprovação só por advogado(a) (trigger recusa financeiro) → envio e aceite registrados → contrato com dados congelados → 2 assinaturas registradas → 3 parcelas somando exatamente R$ 3.000,00 → baixa manual pelo financeiro, persistente após sair e entrar · COM-02 portal: estagiário grava rascunho, só advogada publica · COM-03 exclusão autorizada auditada; financeiro não exclui cliente · COM-04 suspensão e reativação pelo Super Admin com dados intactos · COM-05 lead perdido com motivo, arquivado e não apagado · COM-06 documento excluído some do banco **e** do Storage · COM-07 logotipo → PNG público no bucket `marcas`, troca do logotipo, manifesto PWA com ícone próprio, outro papel não sobrescreve · INTEL-03 Senado.

Defeitos desta rodada: **PR-11 (P1)** trocar o logotipo pela 2ª vez falhava (upsert do Storage exige SELECT; migration `20261029100000`) · **PR-12 (P2)** cronograma da proposta sobrepunha o botão em 360 px · **PR-13 (P3)** textos "simulação" no modo real (proposta, inbox, exclusão de documento, eventos) · **PR-14 (P2)** privilégios excedentes (MAINTAIN, sequências, UPDATE/DELETE da auditoria) revogados em `20261029090000`.

## Rodada 2 (auditoria final, versão `0bc50bd`)
| Suíte | Resultado |
|---|---|
| Lint e typecheck | sem erros |
| Unitários | **143 PASS** · 1 opcional |
| Banco (RLS, papéis, portal, plataforma, marca/PWA) | **40 PASS** |
| Integração com Supabase real | **11 PASS** |
| E2E completo (build local + Supabase real, 2 telas) | **307 PASS** · 14 opcionais pulados; 3 falhas de tempo sob carga, que passaram ao repetir isoladas (PERS-01 em celular corrigido no teste; PAR-CALC-01 com 1 falha em 4; título em `/recuperar-acesso`) |
| Suítes reais (local, 2 telas) | real-erp + real-auth **14/14** · real-persistencia + real-recuperacao **14/14** |
| **Produção `lexsion.com.br`** | real-erp + real-auth **7/7** · real-persistencia + real-recuperacao **7/7** |
| Backup → restauração isolada | **RESTAURACAO_OK** (2ª execução) |

Novos cenários: PERS-01/02/03 (persistência por módulo após sair e entrar), SA-01 (Super Admin cria escritório real), WL-01 (marca e PWA do escritório real), DEMO-ISO-01 (a demonstração não grava no banco), REC-01 (recuperação de senha de uso único).

## Rodada 1

| Suíte | Comando | Ambiente | Resultado |
|---|---|---|---|
| Unitários (domínio) | `pnpm test` | Node | **141 PASS** · 1 opcional |
| Banco: RLS, papéis, portal, plataforma | `pnpm test:db` | Postgres 18 (PGlite) com as 6 migrations | **38 PASS** |
| Mutação | RLS de `org_records` desligada | idem | **6 FALHAM** (os testes detectam a brecha); restaurado |
| Integração real (RLS/Storage/convites) | `RUN_REAL=1 pnpm test:real` | Supabase do projeto | **11 PASS** (28/10, após esta implantação); limpeza conferida |
| E2E completo | `E2E_PROXY=… npx playwright test` | build de produção local + Supabase real | **301 PASS** · 14 pulados (opcionais) · 0 falhas (antes do REAL-ERP-06, que roda à parte: 14/14) |
| E2E operacional real | `real-erp`, `real-auth` (local e **em produção**: 7/7 em lexsion.com.br) | Supabase real, escritórios/pessoas sintéticos `qa-…@lexsion-qa.invalid` | **7 cenários × 2 telas = 14 PASS**; limpeza conferida (0 escritórios, 0 registros, 0 arquivos, 0 vínculos) |
| Backup + restauração | `scripts/backup-logico.mjs` + `scripts/restaurar-teste.mjs` | cópia isolada | **RESTAURACAO_OK** (16 tabelas, RLS e 2 arquivos conferidos) |

## Cenários reais verificados no navegador
REAL-AUTH-01 conta sem vínculo não entra · REAL-ERP-01 titular vê equipe real, cadastra cliente (gravado no banco com responsável real), CPF duplicado recusado ·
REAL-ERP-02 outro escritório não lê nem grava dados do A (também por API direta) e anônimo não lê nada · REAL-ERP-03 estagiário não aprova minuta ·
REAL-ERP-04 portal mostra só o caso do cliente sem notas internas, envio de PDF ao Storage vira "recebido", dúvida vira tarefa da responsável ·
REAL-ERP-05 cobrança online bloqueada com motivo, sem botão de cobrança · REAL-ERP-06 advogada libera o portal pela tela (convite + vínculo no banco); estagiário não vê a opção.

## Defeitos achados e corrigidos nesta fase
| ID | Gravidade | Defeito | Correção |
|---|---|---|---|
| PR-01 | P1 | Política de upload do portal consultava tabela que o cliente não lê (upload sempre recusado) | funções `portal_can_upload/read` (security definer) + teste |
| PR-02 | P1 | Login direcionava cliente pela tabela antiga do portal | `signInAction` usa `my_access` |
| PR-03 | P1 | Falha de rede podia cair na demonstração dentro de `/app` | tela "Sem conexão"; demonstração só por escolha explícita |
| PR-04 | P2 | Pedido de documento interno aparecia ao cliente | portal exige `requested_at`/pedido aberto |
| PR-05 | P2 | Sair da área real ia para a demonstração | sem sessão ⇒ `/entrar` (exceto quem saiu da demo) |

## Não executado
Firefox/WebKit, aparelho físico, carga, Lighthouse. Flake conhecido: título do documento sob carga em `/recuperar-acesso` (1 em 315; passa 3/3 isolado).
