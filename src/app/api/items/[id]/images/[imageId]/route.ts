import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthedUser } from "@/lib/supabase/server";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> },
) {
  if (!(await getAuthedUser())) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { imageId } = await params;
  const supabase = createAdminClient();

  const { data: image, error: fetchError } = await supabase
    .from("item_images")
    .select("image_path")
    .eq("id", imageId)
    .single();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 404 });

  await supabase.storage.from("refs").remove([image.image_path]);
  const { error: deleteError } = await supabase.from("item_images").delete().eq("id", imageId);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
