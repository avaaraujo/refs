import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { tagImage } from "@/lib/tagging";
import { captureScreenshot, DEFAULT_CAPTURE_DELAY } from "@/lib/screenshot";
import { getAuthedUser } from "@/lib/supabase/server";

// captura (com delay) + tagging por IA passam bem dos 10s padrão
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getAuthedUser())) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const delay = Number.isFinite(body?.delay) ? Number(body.delay) : DEFAULT_CAPTURE_DELAY;

  const supabase = createAdminClient();

  const { data: item, error: fetchError } = await supabase
    .from("items")
    .select("url, image_path")
    .eq("id", id)
    .single();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 404 });
  }
  if (!item.url) {
    return NextResponse.json(
      { error: "Esta referência veio de um print enviado à mão, não tem link para recapturar." },
      { status: 400 },
    );
  }

  let bytes: Buffer;
  let mediaType: "image/jpeg" | "image/png" | "image/webp";
  try {
    const shot = await captureScreenshot(item.url, { delay });
    bytes = shot.bytes;
    mediaType = shot.mediaType;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha ao capturar screenshot." },
      { status: 400 },
    );
  }

  // caminho novo em vez de sobrescrever: a URL pública muda e nem browser nem CDN
  // servem a imagem antiga em cache
  const ext = mediaType === "image/png" ? "png" : mediaType === "image/webp" ? "webp" : "jpg";
  const newPath = `${randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("refs")
    .upload(newPath, bytes, { contentType: mediaType, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  // o print antigo estava errado, então o tagging derivado dele também estava.
  // notes é escrito à mão pelo dono — fica intacto.
  const update: Record<string, unknown> = { image_path: newPath };
  try {
    const tagging = await tagImage({
      imageBase64: bytes.toString("base64"),
      mediaType,
      urlHint: item.url,
    });
    update.title = tagging.title;
    update.description = tagging.description;
    update.category = tagging.category || null;
    update.style = tagging.style;
    update.color = tagging.color || null;
    update.tags = tagging.tags;
    update.recipe_tags = tagging.recipeTags;
    update.site_recipe = tagging.siteRecipe || null;
  } catch (e) {
    console.error("re-tagging failed", e);
  }

  const { data, error: updateError } = await supabase
    .from("items")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (updateError) {
    // não deixa o upload novo órfão no storage
    await supabase.storage.from("refs").remove([newPath]);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // só agora o print antigo é descartável; falhar aqui não invalida a recaptura
  await supabase.storage.from("refs").remove([item.image_path]);

  return NextResponse.json({ item: data });
}
