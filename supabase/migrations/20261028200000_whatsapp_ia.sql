-- WhatsApp (Evolution) e IA reais. Só ADITIVA.
-- A chave da Evolution e a do provedor de IA ficam no servidor (variáveis de ambiente). Aqui só estado e auditoria.

-- Uma instância por escritório, sempre com prefixo "lexsion-" (nunca toca instâncias de terceiros no mesmo servidor).
create table if not exists public.whatsapp_instances (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  instance_name text not null unique check (instance_name ~ '^lexsion-[a-z0-9-]{3,60}$'),
  status text not null default 'desconectado' check (status in ('desconectado','conectando','operacional','erro')),
  phone text,
  webhook_secret_hash text not null, -- sha256 do segredo do webhook; o segredo em claro nunca é guardado
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.whatsapp_instances enable row level security;
-- Equipe do escritório vê o estado; ninguém grava pelo navegador (só o servidor com a chave secreta).
drop policy if exists wa_read on public.whatsapp_instances;
create policy wa_read on public.whatsapp_instances for select to authenticated using (public.is_member(organization_id));
grant select (organization_id, instance_name, status, phone, updated_at) on public.whatsapp_instances to authenticated;

-- Uso de IA por escritório (limite e custo). Sem conteúdo da conversa: só contagem e finalidade.
create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  purpose text not null check (purpose in ('resposta','resumo','minuta','triagem')),
  model text not null,
  input_chars int not null,
  output_chars int not null,
  at timestamptz not null default now()
);
create index if not exists ai_usage_org_at on public.ai_usage (organization_id, at desc);
alter table public.ai_usage enable row level security;
drop policy if exists ai_usage_read on public.ai_usage;
create policy ai_usage_read on public.ai_usage for select to authenticated using (public.has_role(organization_id, array['admin','tenant_admin']) or public.is_platform(array['superadmin','platform_admin']));
grant select on public.ai_usage to authenticated;

-- Consentimento explícito do titular para usar IA externa com dados do escritório (LGPD: decisão do controlador).
alter table public.organizations add column if not exists ai_enabled_at timestamptz;
alter table public.organizations add column if not exists ai_enabled_by uuid references auth.users(id) on delete set null;

create or replace function public.set_ai_enabled(p_org uuid, p_enabled boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(p_org, array['admin']) then raise exception 'somente o titular habilita a IA' using errcode = '42501'; end if;
  update public.organizations set ai_enabled_at = case when p_enabled then now() else null end, ai_enabled_by = case when p_enabled then auth.uid() else null end where id = p_org;
  insert into public.audit_logs (organization_id, actor_id, action, entity, entity_id, detail) values (p_org, auth.uid(), 'ai', 'organizations', p_org::text, case when p_enabled then 'IA habilitada pelo titular' else 'IA desabilitada' end);
end $$;
revoke execute on function public.set_ai_enabled(uuid, boolean) from public, anon;
grant execute on function public.set_ai_enabled(uuid, boolean) to authenticated;
grant select (ai_enabled_at) on public.organizations to authenticated;

-- Mensagens: "messages" e "conversations" continuam em org_records (RLS por papel). Webhook grava com a chave do servidor.
