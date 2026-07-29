import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { embedQuery, isEmbeddingConfigured } from "@/lib/embeddings";
import { ITEM_COLUMNS } from "@/lib/types";
import { attachCollectionIds } from "@/lib/collections";
import { attachImages } from "@/lib/itemImages";

// busca semântica: embeda a query e ordena por similaridade via a função
// SQL match_items (ver supabase/migration_005_embeddings.sql). Usado tanto
// pela busca "inteligente" da Library quanto pelo endpoint MCP (lib/mcpTools.ts).
export async function POST(req: NextRequest) {
  if (!isEmbeddingConfigured()) {
    return NextResponse.json(
      { error: "Busca semântica não configurada (falta VOYAGE_API_KEY)." },
      { status: 501 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const q = typeof body.q === "string" ? body.q.trim() : "";
  const category = typeof body.category === "string" ? body.category : null;
  const collectionId = typeof body.collection_id === "string" ? body.collection_id : null;
  const limit = Number.isFinite(body.limit) ? Math.min(Number(body.limit), 100) : 20;

  if (!q) return NextResponse.json({ error: "Query vazia." }, { status: 400 });

  const supabase = createAdminClient();

  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedQuery(q);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha ao gerar embedding da busca." },
      { status: 500 },
    );
  }

  const { data: matches, error: matchError } = await supabase.rpc("match_items", {
    query_embedding: queryEmbedding,
    match_count: limit,
    filter_category: category,
    filter_collection_id: collectionId,
  });

  if (matchError) return NextResponse.json({ error: matchError.message }, { status: 500 });
  if (!matches || matches.length === 0) return NextResponse.json({ items: [] });

  const ids = (matches as { id: string; similarity: number }[]).map((m) => m.id);
  const { data: items, error: itemsError } = await supabase.from("items").select(ITEM_COLUMNS).in("id", ids);
  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 });

  const withCollections = await attachCollectionIds(supabase, items ?? []);
  const withImages = await attachImages(supabase, withCollections);
  // supabase não preserva a ordem do `in()` — reordena pela similaridade
  const byId = new Map(withImages.map((i) => [i.id, i]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean);

  return NextResponse.json({ items: ordered });
}
