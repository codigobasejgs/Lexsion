# 07 — Multitenant e permissões

## Escritórios fictícios
| Escritório | slug | Situação | Perfis na demo |
|---|---|---|---|
| Aurora Advocacia Previdenciária (A) | `aurora-advocacia` | ativa | 9 (titular, gestor, advogado, atendimento, financeiro, controladoria, estagiária, correspondente, cliente) |
| Atlas Jurídico Associados (B) | `atlas-juridico` | ativa | titular |
| Novo Escritório (teste) (N) | `novo-escritorio` | teste (trial) | titular (onboarding) |
| Plataforma | — | — | superadmin, administrador e suporte da plataforma |

Isolamento comprovado: A12 (trocar de escritório não mistura dados), BRAND-010 (marca de A não vaza para B), PORT-02 (rascunho não vaza ao portal).

## 12 papéis
`superadmin`, `platform_admin`, `platform_support` · `admin` (titular), `tenant_admin` (gestor operacional), `advogado`, `controladoria`, `financeiro`, `atendimento`, `estagiario`, `external_collaborator` · `cliente`.
Matriz área × papel e ação × papel em `src/domain/permissions.ts`, exibida em **Equipe** (`data-testid=matriz-acesso`). Ações: aprovar peça, publicar no portal, aprovar proposta, exportar, gerir equipe, gerir marca, gerir assinatura SaaS, ver honorários, operar plataforma, ver casos sigilosos.

Decisões: assinatura LexSion visível só ao **titular** (`admin`); gestor operacional não altera marca nem integrações; correspondente vê só casos/documentos/agenda/tarefas; suporte da plataforma não tem ações.

## Riscos sem backend
- Permissões são de interface; dados ficam no navegador da própria pessoa. **Não usar com dado real.**
- Filtro “só atribuídos” do correspondente e consentimento para suporte acessar escritório ficam para RLS (fase 2).
