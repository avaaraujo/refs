import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthedUser } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createAdminClient();
  // item_collections(count) é o embed do PostgREST via a FK reversa —
  // devolve [{count: N}] por linha, usado na página /colecoes pra mostrar
  // quantos itens cada coleção tem sem precisar de N+1 queries
  const { data, error } = await supabase
    .from("collections")
    .select("*, item_collections(count)")
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const collections = (data ?? []).map((c) => {
    const { item_collections, ...rest } = c as typeof c & { item_collections: { count: number }[] };
    return { ...rest, item_count: item_collections?.[0]?.count ?? 0 };
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
