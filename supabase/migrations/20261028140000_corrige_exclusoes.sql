-- Corrige 2 defeitos encontrados no teste real (limpeza de dados de QA falhou):
-- 1) Apagar escritório falhava: o trigger de auditoria gravava log com FK para o escritório em exclusão.
--    Auditoria passa a não ter FK (registro histórico sobrevive à exclusão do escritório, como deve ser).
-- 2) Apagar usuário falhava: colunas de autoria referenciavam auth.users sem ação. Passam a "on delete set null".

alter table public.audit_logs drop constraint if exists audit_logs_organization_id_fkey;

do $$
declare r record;
begin
  for r in
    select c.conrelid::regclass as tbl, c.conname, a.attname as col
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
    where c.contype = 'f' and c.confrelid = 'auth.users'::regclass and c.confdeltype = 'a'
      and c.connamespace = 'public'::regnamespace
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format('alter table %s add constraint %I foreign key (%I) references auth.users(id) on delete set null', r.tbl, r.conname, r.col);
  end loop;
end $$;

-- Ao apagar o escritório, os casos caem em cascata ANTES dos clientes? Não há garantia de ordem:
-- cases.client_id "restrict" bloqueava a cascata. Dentro do mesmo escritório, a cascata do escritório deve vencer.
alter table public.cases drop constraint if exists cases_client_id_fkey;
alter table public.cases add constraint cases_client_id_fkey foreign key (client_id) references public.clients(id) on delete cascade;
