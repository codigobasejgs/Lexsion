-- Atendimento WhatsApp real: fila durável de eventos, controle IA × humano por conversa (estado + versão) e trabalhos
-- de IA cancelados ao assumir. ADITIVA. Conversas e mensagens continuam em org_records (RLS por papel já existente);
-- aqui fica só o que exige garantia do banco (deduplicação, ordem, corrida takeover × resposta).
-- Reversão: drop das tabelas e funções desta migration.

-- 1) Eventos recebidos do provedor: gravados ANTES de responder ao webhook; únicos por (instância, id do provedor).
create table if not exists public.wa_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  instance_name text not null,
  provider_id text not null,                 -- key.id da mensagem ou id sintético do evento
  kind text not null,                        -- messages.upsert | connection.update | send.message | outro
  remote_jid text,
  from_me boolean not null default false,
  payload jsonb not null,                    -- payload mínimo normalizado (sem tokens)
  status text not null default 'pendente' check (status in ('pendente','processando','feito','ignorado','erro')),
  reason text,
  attempts int not null default 0,
  provider_ts timestamptz,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (instance_name, kind, provider_id)
);
create index if not exists wa_events_pending on public.wa_events (status, received_at) where status in ('pendente','erro');
alter table public.wa_events enable row level security; -- nenhuma política: só o servidor lê/grava

-- 2) Controle por conversa: modo de atendimento e versão de controle (incrementa a cada assumir/devolver/resolver).
create table if not exists public.conversation_control (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id text not null,
  mode text not null default 'humano' check (mode in ('ia','humano','pausado','resolvido')),
  version int not null default 1,
  assignee_id uuid references auth.users(id) on delete set null,
  is_group boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (organization_id, conversation_id)
);
alter table public.conversation_control enable row level security;
drop policy if exists cc_read on public.conversation_control;
create policy cc_read on public.conversation_control for select to authenticated using (public.has_role(organization_id, array['admin','tenant_admin','advogado','atendimento']));
grant select on public.conversation_control to authenticated;

-- 3) Trabalhos de IA: um por mensagem do contato; carregam a versão de controle vista ao enfileirar.
create table if not exists public.ai_jobs (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id text not null,
  trigger_message_id text not null,
  control_version int not null,
  status text not null default 'pendente' check (status in ('pendente','gerando','enviando','enviado','cancelado','descartado','erro','encaminhado')),
  reason text,
  attempts int not null default 0,
  run_after timestamptz not null default now(), -- debounce: mensagens seguidas viram um só trabalho
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (organization_id, trigger_message_id)
);
create index if not exists ai_jobs_pending on public.ai_jobs (status, run_after) where status in ('pendente','erro');
alter table public.ai_jobs enable row level security;
drop policy if exists aj_read on public.ai_jobs;
create policy aj_read on public.ai_jobs for select to authenticated using (public.has_role(organization_id, array['admin','tenant_admin']));
grant select on public.ai_jobs to authenticated;

-- 4) Mudar o modo (assumir / devolver à IA / pausar / resolver): só equipe de atendimento; incrementa a versão e
--    cancela trabalhos de IA pendentes NA MESMA TRANSAÇÃO (uma geração que termine depois é descartada no envio).
create or replace function public.conversation_set_mode(p_org uuid, p_conv text, p_mode text, p_expected int default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.conversation_control; n int;
begin
  if not public.has_role(p_org, array['admin','tenant_admin','advogado','atendimento']) then raise exception 'sem permissão para o atendimento' using errcode = '42501'; end if;
  if p_mode not in ('ia','humano','pausado','resolvido') then raise exception 'modo inválido' using errcode = '22023'; end if;
  if not exists (select 1 from public.org_records where organization_id = p_org and collection = 'conversations' and id = p_conv) then raise exception 'conversa não encontrada' using errcode = 'P0002'; end if;
  insert into public.conversation_control (organization_id, conversation_id) values (p_org, p_conv) on conflict do nothing;
  select * into c from public.conversation_control where organization_id = p_org and conversation_id = p_conv for update;
  if c.is_group and p_mode = 'ia' then raise exception 'grupos não são atendidos pela IA' using errcode = '22023'; end if;
  if p_expected is not null and c.version <> p_expected then raise exception 'a conversa mudou; recarregue' using errcode = '40001'; end if;
  update public.conversation_control set mode = p_mode, version = version + 1, assignee_id = case when p_mode = 'humano' then auth.uid() else assignee_id end, updated_at = now(), updated_by = auth.uid()
    where organization_id = p_org and conversation_id = p_conv returning * into c;
  with x as (update public.ai_jobs set status = 'cancelado', reason = 'atendimento passou para ' || p_mode, finished_at = now()
    where organization_id = p_org and conversation_id = p_conv and status in ('pendente','gerando','erro') returning 1) select count(*) into n from x;
  insert into public.audit_logs (organization_id, actor_id, action, entity, entity_id, detail)
    values (p_org, auth.uid(), 'conversa.' || p_mode, 'conversations', p_conv, 'modo ' || p_mode || ' (versão ' || c.version || ')' || case when n > 0 then '; ' || n || ' resposta(s) da IA cancelada(s)' else '' end);
  return jsonb_build_object('mode', c.mode, 'version', c.version, 'cancelled', n);
end $$;
revoke execute on function public.conversation_set_mode(uuid, text, text, int) from public, anon;
grant execute on function public.conversation_set_mode(uuid, text, text, int) to authenticated;

-- 4b) A tela lê "aiActive" do objeto da conversa (org_records). Fonte da verdade = conversation_control: o gatilho
--     força o espelho em toda gravação da conversa (cache antigo do navegador não reativa a IA) e reflete as mudanças
--     de modo feitas pelo servidor (webhook, encaminhamento).
create or replace function public.conv_ai_mirror() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.data := jsonb_set(new.data, '{aiActive}', to_jsonb(coalesce((select mode = 'ia' from public.conversation_control
    where organization_id = new.organization_id and conversation_id = new.id), false)));
  return new;
end $$;
drop trigger if exists conv_ai_mirror on public.org_records;
create trigger conv_ai_mirror before insert or update of data on public.org_records for each row when (new.collection = 'conversations') execute function public.conv_ai_mirror();

create or replace function public.conv_control_sync() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.org_records set data = data || jsonb_build_object('status', case new.mode when 'resolvido' then 'encerrada' when 'ia' then 'ia' else 'aguardando_equipe' end), updated_at = now()
    where organization_id = new.organization_id and collection = 'conversations' and id = new.conversation_id;
  return null;
end $$;
drop trigger if exists conv_control_sync on public.conversation_control;
create trigger conv_control_sync after insert or update of mode on public.conversation_control for each row execute function public.conv_control_sync();

-- 5) Portão de envio da IA (servidor): trava a conversa, confere modo e versão. Só devolve true se a resposta ainda
--    pode sair; marca o trabalho como "enviando". Takeover concorrente espera a trava e invalida o resto.
create or replace function public.ai_job_claim_send(p_job bigint) returns boolean
language plpgsql security definer set search_path = public as $$
declare j public.ai_jobs; c public.conversation_control;
begin
  select * into j from public.ai_jobs where id = p_job for update;
  if j.id is null or j.status <> 'gerando' then return false; end if;
  select * into c from public.conversation_control where organization_id = j.organization_id and conversation_id = j.conversation_id for update;
  if c.mode <> 'ia' or c.version <> j.control_version or c.is_group then
    update public.ai_jobs set status = 'descartado', reason = 'humano assumiu ou conversa mudou antes do envio', finished_at = now() where id = j.id;
    return false;
  end if;
  update public.ai_jobs set status = 'enviando' where id = j.id;
  return true;
end $$;
revoke execute on function public.ai_job_claim_send(bigint) from public, anon, authenticated;
grant execute on function public.ai_job_claim_send(bigint) to service_role;

-- 6) Uso de IA também para o atendimento automático (finalidade nova).
alter table public.ai_usage drop constraint if exists ai_usage_purpose_check;
alter table public.ai_usage add constraint ai_usage_purpose_check check (purpose in ('resposta','resumo','minuta','triagem','atendimento','simulador'));

-- 7) Cron do atendimento (a cada minuto), mas só chama a aplicação quando há trabalho (evita invocação ociosa).
create or replace function public.trigger_atendimento() returns bigint
language plpgsql security definer set search_path = public, extensions, vault as $$
declare secret text; target text; req bigint;
begin
  if not exists (select 1 from public.wa_events where status in ('pendente','erro','processando') and attempts < 5)
     and not exists (select 1 from public.ai_jobs where status in ('pendente','gerando','enviando')) then return null; end if;
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'lexsion_cron_secret';
  select replace(decrypted_secret, '/api/cron/inteligencia', '/api/cron/atendimento') into target from vault.decrypted_secrets where name = 'lexsion_cron_url';
  if secret is null or target is null then raise exception 'segredo ou URL do cron não configurados no Vault'; end if;
  select net.http_get(url := target, headers := jsonb_build_object('Authorization', 'Bearer ' || secret), timeout_milliseconds := 110000) into req;
  return req;
end $$;
revoke execute on function public.trigger_atendimento() from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'lexsion-atendimento') then perform cron.unschedule('lexsion-atendimento'); end if;
    perform cron.schedule('lexsion-atendimento', '* * * * *', 'select public.trigger_atendimento()');
  end if;
end $$;

-- 8) Realtime: a caixa de entrada recebe mudanças sem recarregar (RLS de org_records/conversation_control vale no canal).
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'conversation_control') then execute 'alter publication supabase_realtime add table public.conversation_control'; end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'org_records') then execute 'alter publication supabase_realtime add table public.org_records'; end if;
  end if;
end $$;
