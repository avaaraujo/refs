-- Rode no SQL editor do Supabase depois das migrations anteriores.
-- Um site tem hero, pricing, footer — antes cada print virava uma ref
-- solta, sem relação entre si. items.image_path continua sendo o print de
-- capa (o primeiro, usado no card da grade); prints adicionais do mesmo
-- item entram aqui.
create table if not exists item_images (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id) on delete cascade,
  image_path text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists item_images_item_id_idx on item_images (item_id, position);
