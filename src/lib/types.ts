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
  tech: string[];
  tags: string[];
  recipe_tags: string[];
  site_recipe: string | null;
  notes: string | null;
  collection_id: string | null;
  created_at: string;
};

export type Collection = {
  id: string;
  name: string;
  created_at: string;
};

// colunas de items pra usar em todo select/update que devolve o item pro
// client — nunca inclui "embedding" (vetor de 512 floats, não serve pra UI
// e infla o payload à toa)
export const ITEM_COLUMNS =
  "id, url, source_domain, image_path, title, description, category, style, color, tech, tags, recipe_tags, site_recipe, notes, collection_id, created_at";
