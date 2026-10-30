# 14 — QA-115 (auditoria) e governança por escritório — 30/10/2026

## QA-115: evento "Reativado" sumia da auditoria

| Item | Conteúdo |
|---|---|
| Commit da correção | `3493086` (correção + testes); `f4738c4` (isolamento da demo, achado na validação em produção) |
| Causa raiz 1 | Os serviços da demonstração regravavam a coleção `audit` **inteira** com uma lista lida **antes** da transação. Quando outra aba gravava no intervalo, o evento dela era sobrescrito. |
| Causa raiz 2 | O teste navegava antes do commit da transação do IndexedDB, que era abortada. |
| Solução | `audit` é só-acréscimo: `mergeAudit` lê e acrescenta por `id` **dentro** da transação `readwrite`, que o IndexedDB serializa entre abas. `patchRow` altera um único registro e grava os eventos na mesma transação. Os ids dos eventos usam `crypto.randomUUID()`. Não depende de BroadcastChannel, storage events nem de fechar abas. |
| Produção real | A auditoria é feita no banco: `audit_logs` aceita só INSERT, e a RLS impede forjar o autor. Ninguém altera nem apaga um registro (`privilegios.real.test.ts`). |
| Teste que falha no código antigo | `qa-auditoria-concorrente.spec.ts`: 3 abas suspendem e reativam ao mesmo tempo. Falha antes da correção; passou 5/5 com ela. |
| Unitários | `data-safety.test.ts` AUD-01..03 (sem perda, sem duplicar, ordem preservada) |
| Real (Supabase) | `auditoria-concorrente.real.test.ts`: 4/4; suíte real 31/31 |

### Evidências
- Local: QA-115 18/18 (desktop 8, mobile 5, WebKit 5); concorrência 5/5.
- **Produção (`lexsion.com.br`, commit `3493086`)**:
  - QA-115 e concorrência passaram em desktop e mobile;
  - real-governança, real-comercial e real-persistência: 32 passaram, 1 falhou (DEMO-ISO-01), 1 pulado.
- Smoke em produção: 4/4.
- **DEMO-ISO-01** falhou em 2 de 3 execuções contra produção. A causa: a sessão real carregava antes da hidratação e religava o backend real numa aba que já estava na demonstração, e o formulário ficava sem "Responsável". **Nenhum registro vazou para o banco** (consulta `Fictício Demo%` = 0). Corrigido em `f4738c4`; depois disso, real-persistência passou 12/12 em duas rodadas.
- **Produção com `f4738c4`**:
  - QA-115, concorrência, governança, comercial e persistência (desktop e mobile): **33 passaram, 0 falharam, 1 pulado**;
  - smoke 4/4.
- CI do GitHub: `3493086` **success**, depois de 3 runs seguidos com falha nos commits anteriores.

## Governança por escritório (operação real)
- `memberships_guard`:
  - ninguém altera o próprio papel;
  - só o titular concede, altera ou remove titular;
  - o último titular não sai;
  - a plataforma só atua com MFA (`aal2`).
- `org_role_restrictions` (por perfil) e `org_member_restrictions` (por pessoa, com motivo obrigatório e prazo):
  - **só retiram** acesso, nunca ampliam além do teto do plano;
  - o titular nunca é restringido;
  - toda alteração entra na auditoria;
  - são aplicadas em `record_readable`/`record_writable`, ou seja, na RLS e em toda API que lê `org_records`.
- `effective_access` mostra o que a pessoa realmente pode, calculado no banco.
- Testes:
  - DB: PGlite com casos ALLOW/DENY;
  - E2E reais: GOV-01 (retira e devolve "Ver clientes" do estagiário, banco nega e depois permite) e GOV-02 (revogação individual).

## O que **não** está resolvido
- PITR (plano Free): perda máxima de cerca de 24 h, coberta pelo backup diário no R2.
- Arquivos do Storage fora do backup (B16).
- Rotação das credenciais expostas em conversa (B12). Inclui o token do GitHub, que deve ser **revogado** e trocado por `gh auth login` ou por um token fine-grained de curta duração.
- Contratação self-service (B17).
