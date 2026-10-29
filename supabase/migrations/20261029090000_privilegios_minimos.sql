-- Privilégio mínimo, rodada 2 (auditoria de 29/10/2026). Só REVOGA; nenhum dado é alterado. Reversível com GRANT.
-- Sondagem com sessões reais não achou brecha explorável (RLS barrou tudo); isto fecha o excesso de privilégio
-- para que um erro futuro de policy não vire brecha.

-- 1) MAINTAIN (PostgreSQL 17: VACUUM/ANALYZE/REINDEX/REFRESH/CLUSTER/LOCK) nunca para usuários do app.
revoke maintain on all tables in schema public from authenticated, anon;

-- 2) Sequências: anon sem uso algum; authenticated sem sequência de tabela que o navegador não grava.
revoke all on all sequences in schema public from anon;
revoke all on sequence public.source_sync_runs_id_seq, public.ai_usage_id_seq from authenticated;

-- 3) Auditoria append-only também por privilégio (a RLS já bloqueava UPDATE/DELETE).
revoke update, delete on public.audit_logs from authenticated;

-- 4) Privilégios padrão de objetos FUTUROS criados por postgres: sem MAINTAIN, sem sequências para anon.
alter default privileges for role postgres in schema public revoke maintain on tables from authenticated, anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
