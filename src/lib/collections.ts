import type { RefsClient } from "@/lib/supabase/admin";

// item_collections é a tabela de junção (many-to-many, ver
// supabase/migration_006_collections_many_to_many.sql) — não existe coluna
// collection_id em items, então todo select de item precisa desse merge à
// parte antes de devolver pro client.
export async function attachCollectionIds<T extends { id: string }>(
  supabase: RefsClient,
  items: T[],
): Promise<(T & { collection_ids: string[] })[]> {
  if (items.length === 0) return [];
  const { data } = await supabase
    .from("item_collections")
    .select("item_id, collection_id")
    .in(
      "item_id",
      items.map((i) => i.id),
    );

  const byItem = new Map<string, string[]>();
  for (const row of data ?? []) {
    const list = byItem.get(row.item_id) ?? [];
    list.push(row.collection_id);
    byItem.set(row.item_id, list);
  }

  return items.map((item) => ({ ...item, collection_ids: byItem.get(item.id) ?? [] }));
}

export async function attachCollectionIdsToOne<T extends { id: string }>(
  supabase: RefsClient,
  item: T,
): Promise<T & { collection_ids: string[] }> {
  const [withCollections] = await attachCollectionIds(supabase, [item]);
  return withCollections;
}

// substitui por completo as coleções de um item (delete + insert) — mais
// simples que calcular diff quando o volume é de uma biblioteca pessoal
export async function setItemCollections(
  supabase: RefsClient,
  itemId: string,
  collectionIds: string[],
): Promise<void> {
  await supabase.from("item_collections").delete().eq("item_id", itemId);
  if (collectionIds.length === 0) return;
  await supabase
    .from("item_collections")
    .insert(collectionIds.map((collectionId) => ({ item_id: itemId, collection_id: collectionId })));
}

export async function resolveCollectionIds(
  supabase: RefsClient,
  names: string[],
): Promise<string[]> {
  if (names.length === 0) return [];
  const { data } = await supabase.from("collections").select("id, name").in("name", names);
  return (data ?? []).map((c) => c.id);
}

export async function itemIdsInCollection(supabase: RefsClient, collectionId: string): Promise<string[]> {
  const { data } = await supabase.from("item_collections").select("item_id").eq("collection_id", collectionId);
  return (data ?? []).map((r) => r.item_id);
}
