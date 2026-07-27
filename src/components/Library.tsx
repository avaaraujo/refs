"use client";

import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";
import { Plus, MagnifyingGlass, ClipboardText, X, Lock, LockOpen } from "@phosphor-icons/react/dist/ssr";
import AddModal from "./AddModal";
import DetailModal from "./DetailModal";
import LoginModal from "./LoginModal";
import ItemCard from "./ItemCard";
import type { Item } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { buildBoardBrief } from "@/lib/brief";

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

  async function copyBoardBrief() {
    const scopeLabel = activeTag ? `tag: ${activeTag}` : search.trim() ? `busca: "${search.trim()}"` : undefined;
    try {
      await navigator.clipboard.writeText(buildBoardBrief(filtered, scopeLabel));
      toast.success(`Brief do board copiado (${filtered.length} ite${filtered.length === 1 ? "m" : "ns"}).`);
    } catch {
      toast.error("Erro ao copiar brief.");
    }
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setAuthed(false);
  }

  function canMorph() {
    type VTDocument = Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } };
    const doc = document as VTDocument;
    if (!doc.startViewTransition) return null;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
    return doc;
  }

  // morph card -> modal: assign o mesmo view-transition-name na imagem/título
  // de origem ANTES do snapshot antigo, e limpa do card assim que o modal
  // (que já nasce com o mesmo nome) entra — só um elemento pode ter o nome
  // por vez, senão o browser rejeita a transição.
  function handleOpenItem(item: Item) {
    const doc = canMorph();
    if (!doc) {
      setActiveItem(item);
      return;
    }
    const cardImg = document.querySelector<HTMLElement>(`[data-card-img="${item.id}"]`);
    const cardTitle = document.querySelector<HTMLElement>(`[data-card-title="${item.id}"]`);
    if (cardImg) cardImg.style.viewTransitionName = "card-img";
    if (cardTitle) cardTitle.style.viewTransitionName = "card-title";
    doc.startViewTransition(() => {
      flushSync(() => setActiveItem(item));
      if (cardImg) cardImg.style.viewTransitionName = "";
      if (cardTitle) cardTitle.style.viewTransitionName = "";
    });
  }

  // navegação por setas dentro do modal: sem card de origem pra fazer morph
  // (o modal já cobre a tela), então só o par imagem/título troca de nome
  // pra crossfade suave entre os itens em vez de recriar o morph card->modal
  function handleNavigate(delta: number) {
    if (!activeItem) return;
    const idx = filtered.findIndex((i) => i.id === activeItem.id);
    if (idx === -1) return;
    const next = filtered[idx + delta];
    if (!next) return;
    const doc = canMorph();
    if (!doc) {
      setActiveItem(next);
      return;
    }
    doc.startViewTransition(() => {
      flushSync(() => setActiveItem(next));
    });
  }

  function handleCloseDetail() {
    const item = activeItem;
    const doc = canMorph();
    if (!item || !doc) {
      setActiveItem(null);
      return;
    }
    doc.startViewTransition(() => {
      flushSync(() => setActiveItem(null));
      const cardImg = document.querySelector<HTMLElement>(`[data-card-img="${item.id}"]`);
      const cardTitle = document.querySelector<HTMLElement>(`[data-card-title="${item.id}"]`);
      if (cardImg) cardImg.style.viewTransitionName = "card-img";
      if (cardTitle) cardTitle.style.viewTransitionName = "card-title";
    }).finished.finally(() => {
      const cardImg = document.querySelector<HTMLElement>(`[data-card-img="${item.id}"]`);
      const cardTitle = document.querySelector<HTMLElement>(`[data-card-title="${item.id}"]`);
      if (cardImg) cardImg.style.viewTransitionName = "";
      if (cardTitle) cardTitle.style.viewTransitionName = "";
    });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">
            Refs do Avá<span style={{ color: "var(--accent)" }}>.</span>
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
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
              aria-label="Buscar referências"
              className="w-40 bg-transparent text-sm outline-none sm:w-56"
            />
          </div>
          {!loading && filtered.length > 0 && (
            <button
              onClick={copyBoardBrief}
              aria-label="Copiar brief do board"
              title="Copiar brief do board"
              className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              style={{ borderColor: "var(--border)", color: "var(--muted)" }}
            >
              <ClipboardText size={16} />
              <span className="hidden sm:inline">Brief do board</span>
            </button>
          )}
          {authed ? (
            <>
              <button
                onClick={() => setModalOpen(true)}
                className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition hover:brightness-90"
                style={{ background: "var(--accent)", color: "var(--on-accent)" }}
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
              className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
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
              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition hover:brightness-90"
              style={{ background: "var(--accent)", color: "var(--on-accent)" }}
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
                className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
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
              onOpen={handleOpenItem}
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
        onClose={handleCloseDetail}
        onDelete={handleDelete}
        onUpdated={handleUpdated}
        onNavigate={handleNavigate}
        hasPrev={activeItem ? filtered.findIndex((i) => i.id === activeItem.id) > 0 : false}
        hasNext={
          activeItem ? filtered.findIndex((i) => i.id === activeItem.id) < filtered.length - 1 : false
        }
      />
    </div>
  );
}
