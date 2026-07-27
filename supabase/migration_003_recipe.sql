-- Rode no SQL editor do Supabase depois das migrations anteriores.
-- recipe_tags: frases curtas descrevendo facetas distintas do estilo geral
-- (composição, tipografia, cor, padrões de UI) — mais descritivas que "tags".
-- site_recipe: prompt pronto (em inglês) pra recriar essa direção visual
-- num novo projeto, com um placeholder [CONTENT] pro conteúdo específico.
alter table items add column if not exists recipe_tags text[] not null default '{}';
alter table items add column if not exists site_recipe text;
