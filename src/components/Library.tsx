"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, MagnifyingGlass, X, Lock, LockOpen } from "@phosphor-icons/react/dist/ssr";
import AddModal from "./AddModal";
import DetailModal from "./DetailModal";
import LoginModal from "./LoginModal";
import ItemCard from "./ItemCard";
import type { Item } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

export default function Library() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [activeItem, setActiveItem] = useState<Item | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/items");
    const json = await res.json();
    setItems(json.items ?? []);
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

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      for (const tag of item.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (activeTag && !item.tags.includes(activeTag)) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const haystack = `${item.title ?? ""} ${item.description ?? ""} ${item.tags.join(" ")}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [items, activeTag, search]);

  async function handleDelete(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Erro ao apagar. Recarregando...");
      load();
    }
  }

  function handleUpdated(updated: Item) {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    setActiveItem(updated);
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setAuthed(false);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Refs</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            {items.length} referência{items.length === 1 ? "" : "s"} salvas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-2 rounded-xl border px-3 py-2"
            style={{ borderColor: "var(--border)" }}
          >
            <MagnifyingGlass size={16} style={{ color: "var(--muted)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="w-40 bg-transparent text-sm outline-none sm:w-56"
            />
          </div>
          {authed ? (
            <>
              <button
                onClick={() => setModalOpen(true)}
                className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-white"
                style={{ background: "var(--accent)" }}
              >
                <Plus size={16} weight="bold" />
                Adicionar
              </button>
              <button
                onClick={handleLogout}
                aria-label="Sair"
                className="rounded-xl border p-2.5 opacity-60 hover:opacity-100"
                style={{ borderColor: "var(--border)" }}
              >
                <LockOpen size={16} />
              </button>
            </>
          ) : (
            <button
              onClick={() => setLoginOpen(true)}
              aria-label="Entrar"
              className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)", color: "var(--muted)" }}
            >
              <Lock size={14} />
              Entrar
            </button>
          )}
        </div>
      </header>

      {allTags.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {activeTag && (
            <button
              onClick={() => setActiveTag(null)}
              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-white"
              style={{ background: "var(--accent)" }}
            >
              {activeTag}
              <X size={12} />
            </button>
          )}
          {allTags
            .filter(([tag]) => tag !== activeTag)
            .slice(0, 24)
            .map(([tag, count]) => (
              <button
                key={tag}
                onClick={() => setActiveTag(tag)}
                className="rounded-full border px-2.5 py-1 text-xs transition hover:opacity-70"
                style={{ borderColor: "var(--border)", color: "var(--muted)" }}
              >
                {tag} <span className="opacity-60">{count}</span>
              </button>
            ))}
        </div>
      )}

      {loading ? (
        <p className="py-20 text-center text-sm" style={{ color: "var(--muted)" }}>
          Carregando...
        </p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            {items.length === 0
              ? "Nenhuma referência ainda. Adicione a primeira."
              : "Nada encontrado com esse filtro."}
          </p>
        </div>
      ) : (
        <div className="columns-2 gap-4 sm:columns-3 lg:columns-4 xl:columns-5">
          {filtered.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              authed={authed}
              onDelete={handleDelete}
              onTagClick={setActiveTag}
              onOpen={setActiveItem}
            />
          ))}
        </div>
      )}

      <AddModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(item) => setItems((prev) => [item, ...prev])}
      />

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onLoggedIn={() => setAuthed(true)} />

      <DetailModal
        item={activeItem}
        authed={authed}
        onClose={() => setActiveItem(null)}
        onDelete={handleDelete}
        onUpdated={handleUpdated}
      />
    </div>
  );
}
