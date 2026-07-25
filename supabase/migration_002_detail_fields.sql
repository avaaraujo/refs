-- Rode no SQL editor do Supabase depois do schema.sql inicial.
alter table items add column if not exists category text;
alter table items add column if not exists style text[] not null default '{}';
alter table items add column if not exists color text;
alter table items add column if not exists tech text[] not null default '{}';
