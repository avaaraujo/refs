-- Rode no SQL editor do Supabase depois das migrations anteriores.
-- Cores dominantes reais extraídas do print (via sharp, ver lib/palette.ts)
-- — diferente de "color", que é a descrição textual gerada pela IA
-- ("Cream & Orange"). Usado pra swatches clicáveis (copiar hex) na UI.
alter table items add column if not exists palette text[] not null default '{}';
