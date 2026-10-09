-- Amine Parfumerie 31 : tables + bucket photos. RLS activé SANS politique publique :
-- seules les fonctions serveur (clé service) lisent/écrivent, donc le stock réel reste privé.
create table if not exists public.products(
  id text primary key, name text not null, brand text not null,
  gender text not null default 'Unisexe', color text default '#2a1d12',
  old_price integer, img text default '', sizes jsonb not null default '[]',
  sort integer default 0, created_at timestamptz default now());
create table if not exists public.settings(key text primary key, value text not null default '');
alter table public.products enable row level security;
alter table public.settings enable row level security;
insert into storage.buckets(id,name,public) values('product-images','product-images',true) on conflict (id) do nothing;
