export type Item = {
  id: string;
  url: string | null;
  source_domain: string | null;
  image_path: string;
  title: string | null;
  description: string | null;
  category: string | null;
  style: string[];
  color: string | null;
  palette: string[];
  tech: string[];
  tags: string[];
  recipe_tags: string[];
  site_recipe: string | null;
  notes: string | null;
  collection_ids: string[];
  created_at: string;
};

export type Collection = {
  id: string;
  name: string;
  created_at: string;
};

// colunas de items pra usar em todo select/update que devolve o item pro
// client — nunca inclui "embedding" (vetor de 512 floats, não serve pra UI
// e infla o payload à toa). collection_ids NÃO é uma coluna de items (é a
// tabela de junção item_collections) — quem usa ITEM_COLUMNS precisa anexar
// collection_ids separadamente (ver lib/collections.ts).
export const ITEM_COLUMNS =
  "id, url, source_domain, image_path, title, description, category, style, color, palette, tech, tags, recipe_tags, site_recipe, notes, created_at";
