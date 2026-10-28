-- Endurecimento de privilégios (achado da auditoria de 28/10/2026).
-- O Supabase concede por padrão ALL em tabelas novas a anon/authenticated. RLS protege as linhas, mas
-- TRUNCATE não passa por RLS e privilégio de tabela inteira expõe colunas que deveriam ser restritas.
-- Só REVOGA privilégios (reversível com GRANT); nenhum dado é alterado.

-- 1) Anônimo não tem nada em tabelas do app (o manifesto PWA usa a função public_brand, security definer).
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- 2) Autenticado: nunca TRUNCATE/REFERENCES/TRIGGER (o resto continua governado por RLS + grants explícitos).
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- 3) Segredo do webhook do WhatsApp: só colunas públicas são legíveis; o hash fica só para o servidor.
revoke all on public.whatsapp_instances from authenticated;
grant select (organization_id, instance_name, status, phone, updated_at) on public.whatsapp_instances to authenticated;

-- 4) Tabelas só de leitura para o navegador (escrita apenas pelo servidor com a chave secreta ou por funções).
revoke insert, update, delete on public.ai_usage, public.collection_policies from authenticated;
revoke insert, delete on public.organizations from authenticated;
revoke insert, update, delete on public.platform_members from authenticated;

-- 5) Tabelas e funções FUTURAS criadas por migrations (papel postgres) não herdam acesso de anon/authenticated.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke truncate, references, trigger on tables from authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from anon;

-- 6) Funções: nenhuma acessível a anon, exceto a marca pública do PWA.
revoke execute on all functions in schema public from anon;
grant execute on function public.public_brand(text) to anon;
