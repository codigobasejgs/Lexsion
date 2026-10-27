# 15 — Backlog backend (Supabase)

Especificação completa (tabelas, RLS, Storage, contratos dos adaptadores): `docs/BACKEND_FASE_2/CONTRATOS_E_MODELO_DADOS.md`. Integrações por provedor: `docs/INTEGRACOES_BACKEND_FASE_2.md`.

| Ordem | Item | Pré-requisito do proprietário | Critério de pronto |
|---|---|---|---|
| 1 | Projeto Supabase de homologação + Auth (MFA) | criar projeto/token **novos** (os da conversa devem ser rotacionados) | `/entrar` autentica conta de teste; `authRepository` real |
| 2 | Tabelas núcleo + RLS + testes pgTAP por papel e entre tenants | aprovação do modelo | nenhuma leitura cruzada entre escritórios |
| 3 | Troca de `services/mock` por repositórios Supabase | — | E2E atuais passando contra homologação |
| 4 | Storage (R2/Supabase) com URL assinada | habilitar R2 | upload/download de documento e logo |
| 5 | Outbox + Evolution | instância e transporte definidos | mensagem real com consentimento e opt-out |
| 6 | Resend | domínio `send.` verificado | recuperação de acesso e e-mails transacionais |
| 7 | Gateway (honorários e assinatura SaaS) | escolher provedor | webhook assinado, idempotente, reconciliação |
| 8 | ZapSign | conta sandbox | contrato concluído só com todos os signatários |
| 9 | CSP com nonce, rate limit, logs sem dados pessoais | — | cabeçalhos validados |
