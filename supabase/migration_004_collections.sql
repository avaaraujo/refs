-- Rode no SQL editor do Supabase depois das migrations anteriores.
-- Coleções: agrupamento nomeado de refs por projeto/intenção (ex: "direção
-- do ava.cheap"), separado das tags (geradas por IA, não escolhidas pelo
-- dono). Um item pertence a no máximo uma coleção — suficiente pro uso
-- pessoal, sem a complexidade de uma tabela de junção many-to-many.
create table if not exists collections (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table items add column if not exists collection_id uuid references collections(id) on delete set null;
create index if not exists items_collection_id_idx on items (collection_id);
