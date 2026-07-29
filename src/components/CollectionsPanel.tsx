"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { FolderSimple, PencilSimple, Plus, Trash, X } from "@phosphor-icons/react/dist/ssr";
import type { Collection } from "@/lib/types";
import { publicImageUrl } from "@/lib/publicUrl";
import { timeAgo } from "@/lib/timeAgo";

function Mosaic({ thumbnails }: { thumbnails: string[] }) {
  if (thumbnails.length === 0) {
    return (
      <div
        className="flex h-13 w-13 shrink-0 items-center justify-center rounded-lg border"
        style={{ borderColor: "var(--border)" }}
      >
        <FolderSimple size={18} style={{ color: "var(--muted)" }} />
      </div>
    );
  }
  return (
    <div className="grid h-13 w-13 shrink-0 grid-cols-2 gap-0.5 overflow-hidden rounded-lg">
      {Array.from({ length: 4 }).map((_, i) => {
        const path = thumbnails[i];
        return path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={publicImageUrl(path)} alt="" className="h-full w-full object-cover" />
        ) : (
          <div key={i} style={{ background: "var(--border)" }} />
        );
      })}
    </div>
  );
}

// painel de coleções: drawer da direita sobre a Library (substitui a antiga
// página /colecoes) — reusa o array `collections` que a Library já carrega
// (a API já embute thumbnails/last_item_at, ver api/collections/route.ts)
export default function CollectionsPanel({
  open,
  onClose,
  collections,
  authed,
  onReload,
  onSelectCollection,
}: {
  open: boolean;
  onClose: () => void;
  collections: Collection[];
  authed: boolean;
  onReload: () => void;
  onSelectCollection: (id: string) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

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
      toast.success("Coleção criada.");
      onReload();
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
      toast.success("Coleção renomeada.");
      onReload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao renomear.");
    }
  }

  async function deleteCollection(collection: Collection) {
    if (
      !window.confirm(
        `Apagar a coleção "${collection.name}"? Os itens continuam na biblioteca, só saem dessa coleção.`,
      )
    )
      return;
    const res = await fetch(`/api/collections/${collection.id}`, { method: "DELETE" });
    if (!res.ok) toast.error("Erro ao apagar.");
    onReload();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        aria-label="Fechar painel de coleções"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Coleções"
        className="scroll-thin relative flex h-full w-full max-w-sm flex-col overflow-hidden border-l"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <div
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: "var(--border)" }}
        >
          <h2 className="font-display text-xl">Coleções</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 opacity-60 hover:opacity-100"
          >
            <X size={16} />
          </button>
        </div>

        <div className="scroll-thin flex-1 overflow-y-auto p-3.5">
          {collections.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <FolderSimple size={26} style={{ color: "var(--muted)" }} />
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                Nenhuma coleção criada ainda.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {collections.map((c) => (
                <li
                  key={c.id}
                  className="group flex items-center gap-3 rounded-xl border p-2.5 transition hover:border-[var(--accent)]"
                  style={{ borderColor: "var(--border)" }}
                >
                  <button
                    onClick={() => {
                      onSelectCollection(c.id);
                      onClose();
                    }}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <Mosaic thumbnails={c.thumbnails ?? []} />
                    <div className="min-w-0 flex-1">
                      <p className="font-title truncate text-sm">{c.name}</p>
                      <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
                        {c.item_count ?? 0} ite{(c.item_count ?? 0) === 1 ? "m" : "ns"}
                        {c.last_item_at ? ` · atualizada ${timeAgo(c.last_item_at)}` : ""}
                      </p>
                    </div>
                  </button>
                  {authed && (
                    <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                      <button
                        onClick={() => renameCollection(c)}
                        aria-label={`Renomear ${c.name}`}
                        className="rounded-lg p-1.5 opacity-60 hover:opacity-100"
                      >
                        <PencilSimple size={14} />
                      </button>
                      <button
                        onClick={() => deleteCollection(c)}
                        aria-label={`Apagar ${c.name}`}
                        className="rounded-lg p-1.5 opacity-60 hover:opacity-100"
                        style={{ color: "var(--danger)" }}
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {authed && (
            <button
              onClick={createCollection}
              className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed p-3 text-sm transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              style={{ borderColor: "var(--border)", color: "var(--muted)" }}
            >
              <Plus size={15} weight="bold" />
              Nova coleção
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
