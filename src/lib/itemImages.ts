import type { RefsClient } from "@/lib/supabase/admin";
import type { ItemImage } from "./types";

// item_images guarda prints ADICIONAIS de um item (hero, pricing, footer do
// mesmo site) — o print de capa continua em items.image_path. Mesmo padrão
// de merge à parte que collection_ids (ver lib/collections.ts): não dá pra
// expressar num único select porque não é uma coluna de items.
export async function attachImages<T extends { id: string }>(
  supabase: RefsClient,
  items: T[],
): Promise<(T & { images: ItemImage[] })[]> {
  if (items.length === 0) return [];
  const { data } = await supabase
    .from("item_images")
    .select("id, item_id, image_path, position")
    .in(
      "item_id",
      items.map((i) => i.id),
    )
    .order("position", { ascending: true });

  const byItem = new Map<string, ItemImage[]>();
  for (const row of data ?? []) {
    const list = byItem.get(row.item_id) ?? [];
    list.push({ id: row.id, image_path: row.image_path, position: row.position });
    byItem.set(row.item_id, list);
  }

  return items.map((item) => ({ ...item, images: byItem.get(item.id) ?? [] }));
}

export async function attachImagesToOne<T extends { id: string }>(
  supabase: RefsClient,
  item: T,
): Promise<T & { images: ItemImage[] }> {
  const [withImages] = await attachImages(supabase, [item]);
  return withImages;
}

export async function addItemImage(
  supabase: RefsClient,
  itemId: string,
  imagePath: string,
): Promise<ItemImage> {
  const { data: existing } = await supabase
    .from("item_images")
    .select("position")
    .eq("item_id", itemId)
    .order("position", { ascending: false })
    .limit(1);
  const nextPosition = (existing?.[0]?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("item_images")
    .insert({ item_id: itemId, image_path: imagePath, position: nextPosition })
    .select("id, image_path, position")
    .single();

  if (error) throw new Error(error.message);
  return data;
}
