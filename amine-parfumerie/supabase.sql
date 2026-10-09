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

-- Commandes (reçues depuis la boutique, lues uniquement par l'admin via les fonctions serveur).
create table if not exists public.orders(
  id text primary key, created_at timestamptz default now(),
  name text not null, phone text not null,
  wilaya_code integer not null, wilaya text not null default '', commune text not null default '',
  address text default '', mode text not null default 'home',          -- home = domicile, office = bureau
  items jsonb not null default '[]', subtotal integer not null default 0, delivery integer, total integer not null default 0,
  status text not null default 'new', note text default '', stock_applied boolean not null default false);
alter table public.orders enable row level security;
create index if not exists orders_created_idx on public.orders(created_at desc);

-- Équipe : comptes qui peuvent se connecter à /admin (mots de passe hachés côté serveur, jamais en clair).
-- Rôles : owner (propriétaire, unique, tout + équipe), admin (tout sauf équipe), staff (commandes + stock).
create table if not exists public.team(
  id text primary key,
  name text not null,
  login text not null,
  title text not null default '',
  role text not null default 'staff' check (role in ('owner','admin','staff')),
  password_hash text not null,
  active boolean not null default true,
  created_at timestamptz default now(),
  last_login timestamptz);
create unique index if not exists team_login_uq on public.team(login);
create unique index if not exists team_one_owner on public.team(role) where role='owner';
alter table public.team enable row level security; -- aucune politique publique : seul le serveur (clé service) y accède

-- Catalogue d'origine (5 parfums de l'ancienne version). Ne s'exécute QUE si le catalogue est vide : vos produits existants ne sont jamais touchés.
-- Stock de départ : 10 par contenance (à ajuster dans /admin → Stock).
insert into public.products(id,name,brand,gender,color,old_price,img,sizes,sort)
select * from (values
  ('dAsad','Asad','Lattafa','Homme','#2a1d12',5200::integer,'','[{"l":"Flacon complet","p":4500,"q":10},{"l":"10 ml","p":900,"q":10},{"l":"30 ml","p":2250,"q":10}]'::jsonb,0),
  ('dKhamrah','Khamrah','Lattafa','Unisexe','#4a2a1a',null::integer,'','[{"l":"Flacon complet","p":5200,"q":10},{"l":"10 ml","p":1050,"q":10},{"l":"30 ml","p":2600,"q":10}]'::jsonb,1),
  ('d9PM','9PM','Afnan','Homme','#1c2433',6400::integer,'','[{"l":"Flacon complet","p":5800,"q":10},{"l":"10 ml","p":1150,"q":10},{"l":"30 ml","p":2900,"q":10}]'::jsonb,2),
  ('dClubdeNuitIntense','Club de Nuit Intense','Armaf','Homme','#16212b',null::integer,'','[{"l":"Flacon complet","p":7500,"q":10},{"l":"10 ml","p":1500,"q":10},{"l":"30 ml","p":3750,"q":10}]'::jsonb,3),
  ('dHawasforHer','Hawas for Her','Rasasi','Femme','#3b2230',null::integer,'','[{"l":"Flacon complet","p":6900,"q":10},{"l":"10 ml","p":1400,"q":10},{"l":"30 ml","p":3450,"q":10}]'::jsonb,4)
) as v(id,name,brand,gender,color,old_price,img,sizes,sort)
where not exists (select 1 from public.products);
insert into public.settings(key,value) select 'init','1' where exists (select 1 from public.products) on conflict (key) do nothing;
