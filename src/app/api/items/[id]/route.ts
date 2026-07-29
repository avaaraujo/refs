import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthedUser } from "@/lib/supabase/server";
import { ITEM_COLUMNS } from "@/lib/types";
import { attachCollectionIdsToOne, setItemCollections } from "@/lib/collections";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getAuthedUser())) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  const { data: item, error: fetchError } = await supabase
    .from("items")
    .select("image_path")
    .eq("id", id)
    .single();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 404 });
  }

  await supabase.storage.from("refs").remove([item.image_path]);

  const { error: deleteError } = await supabase.from("items").delete().eq("id", id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getAuthedUser())) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const supabase = createAdminClient();

  const update: Record<string, unknown> = {};
  if (Array.isArray(body.tags)) update.tags = body.tags;
  if (typeof body.title === "string") update.title = body.title;
  if (typeof body.notes === "string") update.notes = body.notes;

  if (Array.isArray(body.collection_ids)) {
    await setItemCollections(supabase, id, body.collection_ids as string[]);
  }

  if (Object.keys(update).length === 0) {
    const { data, error } = await supabase.from("items").select(ITEM_COLUMNS).eq("id", id).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ item: await attachCollectionIdsToOne(supabase, data) });
  }

  const { data, error } = await supabase
    .from("items")
    .update(update)
    .eq("id", id)
    .select(ITEM_COLUMNS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: await attachCollectionIdsToOne(supabase, data) });
}
