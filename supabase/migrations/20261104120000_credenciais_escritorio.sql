-- Chaves de integração do PRÓPRIO escritório (Gemini, Asaas, Mercado Pago, ZapSign, InfinitePay). ADITIVA.
-- O segredo é cifrado na aplicação (AES-256-GCM, CREDENTIALS_KEY só no servidor) antes de chegar aqui; o banco
-- guarda só o texto cifrado e metadados (final da chave, resultado do último teste). Nenhum papel do navegador lê
-- esta tabela: tudo passa pela rota do servidor, que confere se quem pede é o titular do escritório.
-- Reversão: drop table public.org_credentials.
create table if not exists public.org_credentials (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('gemini','asaas','mercadopago','zapsign','infinitepay')),
  sealed text not null,                 -- base64 do pacote cifrado (iv + tag + dados)
  hint text not null,                   -- ex.: "••••a1b2" (nunca a chave)
  environment text not null default 'producao' check (environment in ('producao','teste')),
  status text not null default 'nao_testada' check (status in ('verificada','recusada','nao_testada','nao_verificavel')),
  last_check_at timestamptz,
  last_error text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (organization_id, provider)
);
alter table public.org_credentials enable row level security; -- sem políticas: só o servidor
revoke all on public.org_credentials from anon, authenticated;
