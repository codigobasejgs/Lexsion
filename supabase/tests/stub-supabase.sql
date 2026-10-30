-- SÓ PARA TESTES LOCAIS (PGlite). Reproduz o mínimo do ambiente Supabase de que as migrations dependem:
-- papéis anon/authenticated/service_role, auth.users, auth.uid() e storage (buckets/objects/foldername).
-- Em um projeto Supabase real estes objetos já existem: NUNCA aplicar este arquivo lá.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (id uuid primary key, email text unique);
-- Mesma leitura de claims que o Supabase faz (sub do JWT da requisição).
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', ''))::uuid
$$;
-- Claims completos (aal = nível de autenticação: aal2 depois do 2º fator). Testes definem request.jwt.claims.
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant execute on function auth.jwt() to anon, authenticated, service_role;

create schema storage;
create table storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text not null, owner uuid default auth.uid(), created_at timestamptz default now(), updated_at timestamptz default now(), metadata jsonb, unique (bucket_id, name));
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant usage on schema storage to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to authenticated;
grant select on storage.buckets to authenticated;
grant execute on function storage.foldername(text) to anon, authenticated;

-- pg_cron / pg_net / vault: o Supabase fornece; aqui só o mínimo para a migration do agendador carregar.
create schema if not exists cron;
create table cron.job (jobid bigserial primary key, jobname text unique, schedule text, command text);
create table cron.job_run_details (runid bigserial primary key, jobid bigint, status text, start_time timestamptz, end_time timestamptz);
create function cron.schedule(p_name text, p_schedule text, p_command text) returns bigint language sql as $$ insert into cron.job (jobname, schedule, command) values (p_name, p_schedule, p_command) returning jobid $$;
create function cron.unschedule(p_name text) returns boolean language sql as $$ delete from cron.job where jobname = p_name returning true $$;
create schema if not exists net;
create function net.http_get(url text, headers jsonb default '{}', timeout_milliseconds int default 1000) returns bigint language sql as $$ select 1::bigint $$;
create schema if not exists vault;
create table vault.decrypted_secrets (name text primary key, decrypted_secret text);
