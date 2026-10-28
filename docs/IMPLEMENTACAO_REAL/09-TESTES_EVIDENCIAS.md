# 09 — Testes e evidências

| Suíte | Comando | Ambiente | Resultado (28/10/2026) |
|---|---|---|---|
| Unitários (domínio) | `pnpm test` | Node | 141 PASS · 1 opcional não executado |
| Banco (migrations + RLS) | `pnpm test:db` | PGlite, Postgres 18.6 | **19 PASS** |
| Mutação de RLS | RLS de `clients` desligada manualmente | PGlite | **4 FALHAM**, como esperado (prova de que os testes detectam a brecha); migration restaurada |
| Integração real RLS/Storage | `RUN_REAL=1 pnpm test:real` | **Supabase do projeto** | **7 PASS** |
| Integração real convites | idem (`convites.real.test.ts`) | `next start` + Supabase | **4 PASS** |
| E2E login real | `playwright test real-auth` | build local + Supabase | **1 PASS** |
| E2E site/login | `playwright test lexsion-site` | build local + Supabase | 9 PASS |
| Dry-run das migrations | `pnpm db:migrate:dry` | Supabase (BEGIN/ROLLBACK) | 3/3 OK |

## Defeitos encontrados e corrigidos por teste real
| ID | Gravidade | Defeito | Como apareceu | Correção |
|---|---|---|---|---|
| IR-01 | P1 | Apagar escritório falhava (FK da auditoria) e apagar usuário falhava (FK de autoria): impedia exclusão LGPD | limpeza do teste real deixou 2 escritórios e 2 usuários | migration `20261028140000`; teste de exclusão adicionado |
| IR-02 | P1 | Titular podia mudar o próprio `status`/`plan` (reativar escritório suspenso) | revisão das policies | migration `20261028150000`; teste |
| IR-03 | P2 | Cadastro público aberto no Auth | leitura da configuração | `disable_signup = true` |
| IR-04 | P2 | Primeiro convite saiu com link para `localhost` | convite enviado antes do ajuste de `site_url` | `site_url` corrigido e convite reenviado |

Limpeza conferida após cada execução real: 0 escritórios, 0 clientes, 0 arquivos de QA; restam só o dono e o usuário de QA fixo.

## Não executado
Firefox/WebKit, aparelho físico, Lighthouse, teste de restauração de backup, teste de carga.
