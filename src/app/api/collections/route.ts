import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthedUser } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createAdminClient();
  // item_collections(count) é o embed do PostgREST via a FK reversa —
  // devolve [{count: N}] por linha, usado no CollectionsPanel pra mostrar
  // quantos itens cada coleção tem sem precisar de N+1 queries
  const { data, error } = await supabase
    .from("collections")
    .select("*, item_collections(count)")
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // segunda query pra montar o mosaico de preview (até 4 thumbnails mais
  // recentes) e "atualizada há X" de cada coleção. PostgREST não ordena de
  // forma confiável por coluna de uma relação to-one embutida (testado: o
  // `order(..., { foreignTable })` abaixo é ignorado nesse sentido), então
  // ordena em JS — dataset pessoal pequeno, sem custo relevante.
  const { data: linkRows } = await supabase
    .from("item_collections")
    .select("collection_id, items(image_path, created_at)");

  // apesar do tipo inferido pelo supabase-js sugerir array (sem types
  // gerados do schema), item_id -> items é FK to-one: em runtime o embed
  // vem como objeto único, não array (confirmado testando a query direto)
  const rows = (linkRows ?? []) as unknown as {
    collection_id: string;
    items: { image_path: string; created_at: string } | null;
  }[];
  rows.sort((a, b) => (b.items?.created_at ?? "").localeCompare(a.items?.created_at ?? ""));

  const thumbsByCollection = new Map<string, string[]>();
  const lastItemAtByCollection = new Map<string, string>();
  for (const row of rows) {
    if (!row.items) continue;
    const thumbs = thumbsByCollection.get(row.collection_id) ?? [];
    if (thumbs.length < 4) thumbs.push(row.items.image_path);
    thumbsByCollection.set(row.collection_id, thumbs);
    if (!lastItemAtByCollection.has(row.collection_id)) {
      lastItemAtByCollection.set(row.collection_id, row.items.created_at);
    }
  }

  const collections = (data ?? []).map((c) => {
    const { item_collections, ...rest } = c as typeof c & { item_collections: { count: number }[] };
    return {
      ...rest,
      item_count: item_collections?.[0]?.count ?? 0,
      thumbnails: thumbsByCollection.get(rest.id) ?? [],
      last_item_at: lastItemAtByCollection.get(rest.id) ?? null,
    };
  });

  return NextResponse.json({ collections });
}

export async function POST(req: NextRequest) {
  if (!(await getAuthedUser())) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Nome obrigatório." }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase.from("collections").insert({ name }).select("*").single();
  if (error) {
    const status = error.code === "23505" ? 409 : 500;
    return NextResponse.json({ error: status === 409 ? "Já existe uma coleção com esse nome." : error.message }, { status });
  }
  return NextResponse.json({ collection: data }, { status: 201 });
}
