# 05 — Relatório QA Master (28/10/2026)

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
