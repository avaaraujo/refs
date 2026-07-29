-- Rode no SQL editor do Supabase depois das migrations anteriores.
-- Busca semântica: embedding do texto do item (título + descrição + tags +
-- recipe_tags), gerado via Voyage AI (voyage-3-lite, 512 dimensões) no
-- momento da criação/re-tagging. ivfflat exige ter linhas na tabela pra
-- treinar as listas — se der erro "column does not have enough rows",
-- rode só o "create extension" + "add column" primeiro, popule os itens
-- (retag-all) e rode o create index depois.
create extension if not exists vector;

alter table items add column if not exists embedding vector(512);

-- função de busca por similaridade (cosine distance) usada pela API e pelo MCP
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
    and (filter_collection_id is null or items.collection_id = filter_collection_id)
  order by items.embedding <=> query_embedding
  limit match_count
$$;

create index if not exists items_embedding_idx on items using ivfflat (embedding vector_cosine_ops) with (lists = 100);
