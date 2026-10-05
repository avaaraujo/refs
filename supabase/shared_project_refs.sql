-- Refs no projeto compartilhado do Supabase (o mesmo do ava.cheap).
-- Estado final do schema (schema.sql + migrations 002–008 já consolidados),
-- isolado no schema "refs" pra não misturar com as tabelas do ava.cheap (public).
-- Rode inteiro no SQL editor do projeto yranqpacxvijxbbpkzlp. É idempotente.
--
-- Acesso: todo o código do refs usa a service_role (createAdminClient), então
-- só ela recebe grants. anon/authenticated não enxergam nada do schema refs —
-- mais fechado que o projeto antigo, onde o anon key tinha acesso total.

create extension if not exists pgcrypto;
create extension if not exists vector with schema extensions;

create schema if not exists refs;
set search_path = refs, extensions, public;

create table if not exists refs.items (
  id uuid primary key default gen_random_uuid(),
  url text,
  source_domain text,
  image_path text not null,       -- caminho no storage bucket "refs"
  title text,
  description text,
  tags text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  category text,
  style text[] not null default '{}',
  color text,
  tech text[] not null default '{}',
  recipe_tags text[] not null default '{}',
  site_recipe text,
  palette text[] not null default '{}',
  embedding extensions.vector(512)
);

create index if not exists items_tags_idx on refs.items using gin (tags);
create index if not exists items_created_at_idx on refs.items (created_at desc);
-- hnsw (em vez de ivfflat): não precisa de linhas pra treinar, então pode
-- ser criado antes da cópia dos dados.
create index if not exists items_embedding_idx on refs.items using hnsw (embedding extensions.vector_cosine_ops);

create table if not exists refs.collections (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists refs.item_collections (
  item_id uuid not null references refs.items(id) on delete cascade,
  collection_id uuid not null references refs.collections(id) on delete cascade,
  primary key (item_id, collection_id)
);
create index if not exists item_collections_collection_id_idx on refs.item_collections (collection_id);

create table if not exists refs.item_images (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references refs.items(id) on delete cascade,
  image_path text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists item_images_item_id_idx on refs.item_images (item_id, position);

create or replace function refs.match_items(
  query_embedding extensions.vector(512),
  match_count int default 20,
  filter_category text default null,
  filter_collection_id uuid default null
)
returns table (id uuid, similarity float)
language sql stable
set search_path = refs, extensions, public
as $$
  select items.id, 1 - (items.embedding <=> query_embedding) as similarity
  from refs.items
  where items.embedding is not null
    and (filter_category is null or items.category = filter_category)
    and (
      filter_collection_id is null
      or exists (
        select 1 from refs.item_collections ic
        where ic.item_id = items.id and ic.collection_id = filter_collection_id
      )
    )
  order by items.embedding <=> query_embedding
  limit match_count
$$;

-- só a service_role acessa o schema
revoke all on schema refs from public, anon, authenticated;
grant usage on schema refs to service_role;
grant all on all tables in schema refs to service_role;
grant all on all functions in schema refs to service_role;
alter default privileges in schema refs grant all on tables to service_role;
alter default privileges in schema refs grant all on functions to service_role;

-- expõe o schema na API REST (equivale a Settings → API → Exposed schemas).
-- Se preferir, faça pelo painel e apague estas duas linhas.
alter role authenticator set pgrst.db_schemas = 'public, graphql_public, refs';
notify pgrst, 'reload config';

-- Bucket público de prints (leitura por URL pública não precisa de policy;
-- upload/remoção são feitos pela service_role, que ignora RLS).
insert into storage.buckets (id, name, public)
values ('refs', 'refs', true)
on conflict (id) do nothing;
