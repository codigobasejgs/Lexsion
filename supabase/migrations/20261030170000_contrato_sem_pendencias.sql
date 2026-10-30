-- Contrato: impedir APROVAR/PUBLICAR versão com pendências "[PENDENTE: …]" ou placeholders sem dado; e registrar
-- interesse de quem chega antes da publicação (sem contratar nada). ADITIVA. Reversão: recriar saas_ctv_guard de
-- 20261030140000 e drop table saas_signup_interests.
create or replace function public.saas_ctv_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'RASCUNHO' then raise exception 'só rascunho pode ser excluído' using errcode = '42501'; end if;
    return old;
  end if;
  if old.status in ('APROVADO','PUBLICADO','ARQUIVADO') and (new.clauses is distinct from old.clauses or new.content_sha256 <> old.content_sha256 or new.version <> old.version or new.title <> old.title) then
    raise exception 'versão aprovada é imutável; crie nova versão' using errcode = '42501';
  end if;
  if new.status <> old.status and not (
       (old.status = 'RASCUNHO' and new.status in ('REVISAO_JURIDICA','ARQUIVADO'))
    or (old.status = 'REVISAO_JURIDICA' and new.status in ('RASCUNHO','APROVADO','ARQUIVADO'))
    or (old.status = 'APROVADO' and new.status in ('PUBLICADO','ARQUIVADO'))
    or (old.status = 'PUBLICADO' and new.status = 'ARQUIVADO')) then
    raise exception 'transição de % para % não permitida', old.status, new.status using errcode = '23514';
  end if;
  if new.status in ('APROVADO','PUBLICADO') and (new.approved_by_name is null or length(trim(new.approved_by_name)) < 5 or new.approved_at is null) then
    raise exception 'aprovação exige o nome/OAB do(a) advogado(a) responsável' using errcode = '23514';
  end if;
  -- Texto com decisão jurídica em aberto não pode ser aprovado nem publicado.
  if new.status in ('APROVADO','PUBLICADO') and new.clauses::text ~ '\[PENDENTE' then
    raise exception 'o texto ainda tem itens [PENDENTE]; resolva todos e crie nova versão antes de aprovar' using errcode = '23514';
  end if;
  return new;
end $$;

-- Interesse em contratar enquanto o contrato não é publicado: só e-mail, nome e plano, com consentimento expresso.
-- Não cria conta, escritório, contrato nem cobrança. Acesso só do servidor e da plataforma.
create table if not exists public.saas_signup_interests (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email) and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'), -- o servidor já grava em minúsculas
  name text not null check (length(name) between 3 and 120),
  plan_id text references public.saas_plans(id),
  consent_at timestamptz not null,
  notified_at timestamptz,
  ip_hash text,
  created_at timestamptz not null default now()
);
alter table public.saas_signup_interests enable row level security;
drop policy if exists interest_read on public.saas_signup_interests;
create policy interest_read on public.saas_signup_interests for select to authenticated using (public.is_platform(array['superadmin','platform_admin','platform_support']));
revoke all on public.saas_signup_interests from anon, authenticated;
grant select on public.saas_signup_interests to authenticated;
