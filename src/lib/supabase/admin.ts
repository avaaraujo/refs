import { createClient } from "@supabase/supabase-js";

// o refs vive no schema "refs" do projeto compartilhado (ver supabase/shared_project_refs.sql)
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "refs" } },
  );
}

export type RefsClient = ReturnType<typeof createAdminClient>;
