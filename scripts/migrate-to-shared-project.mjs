// Copia o refs do projeto antigo (public.*) pro projeto compartilhado (refs.*),
// incluindo os arquivos do bucket "refs". Só usa as service_role keys — não
// precisa de senha do banco. Idempotente (upsert): pode rodar de novo.
//
// Antes: rode supabase/shared_project_refs.sql no projeto novo.
// Uso:   node scripts/migrate-to-shared-project.mjs [--dry-run]
//
// Origem: ./.env.local (projeto antigo do refs)
// Destino: ../ava-cheap-web/.env.local (projeto do ava.cheap), ou NEW_ENV_FILE.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry-run");
const BUCKET = "refs";
const BATCH = 100;

function loadEnv(path) {
  const env = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const oldEnv = loadEnv(process.env.OLD_ENV_FILE ?? ".env.local");
const newEnv = loadEnv(process.env.NEW_ENV_FILE ?? "../ava-cheap-web/.env.local");

const oldUrl = oldEnv.NEXT_PUBLIC_SUPABASE_URL;
const newUrl = newEnv.NEXT_PUBLIC_SUPABASE_URL;
if (!oldUrl || !newUrl || !oldEnv.SUPABASE_SERVICE_ROLE_KEY || !newEnv.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY em um dos .env.");
}
if (oldUrl === newUrl) throw new Error("Origem e destino são o mesmo projeto.");
console.log(`origem  ${oldUrl}\ndestino ${newUrl} (schema refs)${DRY ? "  [dry-run]" : ""}\n`);

const src = createClient(oldUrl, oldEnv.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const dst = createClient(newUrl, newEnv.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  db: { schema: "refs" },
});

async function readAll(table, order) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await src.from(table).select("*").order(order).range(from, from + 999);
    if (error) throw new Error(`ler ${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

async function copyTable(table, order, onConflict) {
  const rows = await readAll(table, order);
  if (!DRY) {
    for (let i = 0; i < rows.length; i += BATCH) {
      const { error } = await dst.from(table).upsert(rows.slice(i, i + BATCH), { onConflict });
      if (error) throw new Error(`gravar ${table}: ${error.message}`);
    }
  }
  console.log(`${table}: ${rows.length} linhas`);
  return rows;
}

// ordem respeita as FKs
const collections = await copyTable("collections", "created_at", "id");
const items = await copyTable("items", "created_at", "id");
const links = await copyTable("item_collections", "item_id", "item_id,collection_id");
const images = await copyTable("item_images", "created_at", "id");

// arquivos do bucket: derivados dos caminhos guardados no banco
const paths = [...new Set([...items.map((i) => i.image_path), ...images.map((i) => i.image_path)].filter(Boolean))];
console.log(`\nstorage: ${paths.length} arquivos`);

let copied = 0;
const failed = [];
let next = 0;
async function worker() {
  while (next < paths.length) {
    const path = paths[next++];
    try {
      const { data: blob, error: dlErr } = await src.storage.from(BUCKET).download(path);
      if (dlErr) throw new Error(`download: ${dlErr.message}`);
      if (!DRY) {
        const { error: upErr } = await dst.storage
          .from(BUCKET)
          .upload(path, blob, { contentType: blob.type || undefined, upsert: true });
        if (upErr) throw new Error(`upload: ${upErr.message}`);
      }
      copied++;
    } catch (e) {
      failed.push(`${path} — ${e.message}`);
    }
  }
}
await Promise.all(Array.from({ length: 5 }, worker));

console.log(`copiados: ${copied}/${paths.length}`);
if (failed.length) {
  console.log(`\nFALHAS (${failed.length}):\n` + failed.join("\n"));
}

// conferência de contagens no destino
if (!DRY) {
  console.log("\nconferência (origem → destino):");
  for (const [t, n] of [["collections", collections.length], ["items", items.length], ["item_collections", links.length], ["item_images", images.length]]) {
    const { count, error } = await dst.from(t).select("*", { count: "exact", head: true });
    console.log(`${t}: ${n} → ${error ? "erro " + error.message : count}${!error && count !== n ? "  ⚠ DIVERGE" : ""}`);
  }
}
process.exitCode = failed.length ? 1 : 0;
