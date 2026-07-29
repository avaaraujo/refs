"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, FolderSimple, PencilSimple, Plus, Trash } from "@phosphor-icons/react/dist/ssr";
import type { Collection } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

// gerenciamento de coleções separado da Library: antes só dava pra criar
// (prompt inline) e atribuir por item — aqui dá pra ver todas de uma vez,
// com contagem de itens, renomear e apagar
export default function CollectionsManager() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/collections");
    const json = await res.json();
    setCollections(json.collections ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setAuthed(Boolean(data.user)));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(Boolean(session?.user));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function createCollection() {
    const name = window.prompt("Nome da nova coleção:")?.trim();
    if (!name) return;
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setCollections((prev) => [...prev, { ...json.collection, item_count: 0 }].sort((a, b) => a.name.localeCompare(b.name)));
      toast.success("Coleção criada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar coleção.");
    }
  }

  async function renameCollection(collection: Collection) {
    const name = window.prompt("Novo nome:", collection.name)?.trim();
    if (!name || name === collection.name) return;
    try {
      const res = await fetch(`/api/collections/${collection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setCollections((prev) =>
        prev
          .map((c) => (c.id === collection.id ? { ...c, name: json.collection.name } : c))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      toast.success("Coleção renomeada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao renomear.");
    }
  }

  async function deleteCollection(collection: Collection) {
    if (!window.confirm(`Apagar a coleção "${collection.name}"? Os itens continuam na biblioteca, só saem dessa coleção.`)) return;
    setCollections((prev) => prev.filter((c) => c.id !== collection.id));
    const res = await fetch(`/api/collections/${collection.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Erro ao apagar. Recarregando...");
      load();
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Link
            href="/"
            className="mb-2 flex items-center gap-1.5 text-xs transition hover:opacity-80"
            style={{ color: "var(--muted)" }}
          >
            <ArrowLeft size={13} /> Voltar pra biblioteca
          </Link>
          <h1 className="font-display text-3xl tracking-tight">Coleções</h1>
        </div>
        {authed && (
          <button
            onClick={createCollection}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition hover:brightness-90"
            style={{ background: "var(--accent)", color: "var(--on-accent)" }}
          >
            <Plus size={16} weight="bold" />
            Nova coleção
          </button>
        )}
      </div>

      {loading ? (
        <p className="py-20 text-center text-sm" style={{ color: "var(--muted)" }}>
          Carregando...
        </p>
      ) : collections.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <FolderSimple size={28} style={{ color: "var(--muted)" }} />
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Nenhuma coleção criada ainda.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {collections.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3"
              style={{ borderColor: "var(--border)" }}
            >
              <Link href={`/?collection=${c.id}`} className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate font-title text-sm">{c.name}</span>
                <span className="shrink-0 text-xs" style={{ color: "var(--muted)" }}>
                  {c.item_count ?? 0} ite{(c.item_count ?? 0) === 1 ? "m" : "ns"}
                </span>
              </Link>
              {authed && (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => renameCollection(c)}
                    aria-label={`Renomear ${c.name}`}
                    className="rounded-lg p-2 opacity-60 transition hover:opacity-100"
                  >
                    <PencilSimple size={15} />
                  </button>
                  <button
                    onClick={() => deleteCollection(c)}
                    aria-label={`Apagar ${c.name}`}
                    className="rounded-lg p-2 opacity-60 transition hover:opacity-100"
                    style={{ color: "var(--danger)" }}
                  >
                    <Trash size={15} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
