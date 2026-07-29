import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthedUser } from "@/lib/supabase/server";
import { addItemImage } from "@/lib/itemImages";

// print adicional do mesmo item (hero, pricing, footer do mesmo site) — o
// print de capa é sempre items.image_path, isso aqui só adiciona à galeria
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getAuthedUser())) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Envie um print." }, { status: 400 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${randomUUID()}.${ext}`;

  const supabase = createAdminClient();
  const { error: uploadError } = await supabase.storage
    .from("refs")
    .upload(path, bytes, { contentType: file.type || "image/jpeg", upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  try {
    const image = await addItemImage(supabase, id, path);
    return NextResponse.json({ image }, { status: 201 });
  } catch (e) {
    await supabase.storage.from("refs").remove([path]);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro ao salvar print." }, { status: 500 });
  }
}
