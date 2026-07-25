-- Refs: biblioteca de referências visuais
-- Rode este script manualmente no SQL editor do Supabase (single-user, sem RLS por enquanto).

create extension if not exists "pgcrypto";

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  url text,
  source_domain text,
  image_path text not null,       -- caminho no storage bucket "refs"
  title text,
  description text,
  tags text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists items_tags_idx on items using gin (tags);
create index if not exists items_created_at_idx on items (created_at desc);

-- Storage bucket para os prints (criar manualmente se o insert abaixo falhar por permissão)
insert into storage.buckets (id, name, public)
values ('refs', 'refs', true)
on conflict (id) do nothing;

drop policy if exists "public read refs" on storage.objects;
create policy "public read refs"
  on storage.objects for select
  using (bucket_id = 'refs');

drop policy if exists "public insert refs" on storage.objects;
create policy "public insert refs"
  on storage.objects for insert
  with check (bucket_id = 'refs');

drop policy if exists "public delete refs" on storage.objects;
create policy "public delete refs"
  on storage.objects for delete
  using (bucket_id = 'refs');
