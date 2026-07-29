-- Rode no SQL editor do Supabase depois das migrations anteriores.
-- Uma ref pode pertencer a várias coleções (ex: uma ref de dashboard serve
-- tanto pra "direção do ava.cheap" quanto pra "estudo de dashboards") —
-- substitui o items.collection_id (1 coleção por item) por uma tabela de
-- junção many-to-many.
create table if not exists item_collections (
  item_id uuid not null references items(id) on delete cascade,
  collection_id uuid not null references collections(id) on delete cascade,
  primary key (item_id, collection_id)
);

create index if not exists item_collections_collection_id_idx on item_collections (collection_id);

-- migra os vínculos existentes (1 coleção por item) pra tabela de junção
insert into item_collections (item_id, collection_id)
select id, collection_id from items where collection_id is not null
on conflict do nothing;

alter table items drop column if exists collection_id;

-- match_items (ver migration_005) filtrava por items.collection_id direto;
-- agora precisa checar a tabela de junção. Recriada aqui por completo.
create or replace function match_items(
  query_embedding vector(512),
  match_count int default 20,
  filter_category text default null,
  filter_collection_id uuid default null
)
returns table (id uuid, similarity float)
language sql stable
as $$
  select items.id, 1 - (items.embedding <=> query_embedding) as similarity
  from items
  where items.embedding is not null
    and (filter_category is null or items.category = filter_category)
    and (
      filter_collection_id is null
      or exists (
        select 1 from item_collections ic
        where ic.item_id = items.id and ic.collection_id = filter_collection_id
      )
    )
  order by items.embedding <=> query_embedding
  limit match_count
$$;
