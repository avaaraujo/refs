"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";
import {
  Plus,
  MagnifyingGlass,
  ClipboardText,
  X,
  Lock,
  LockOpen,
  Sparkle,
  FolderSimple,
  ArrowsClockwise,
  Funnel,
  FunnelX,
  ImagesSquare,
} from "@phosphor-icons/react/dist/ssr";
import AddModal from "./AddModal";
import DetailModal from "./DetailModal";
import LoginModal from "./LoginModal";
import ItemCard from "./ItemCard";
import CollectionsPanel from "./CollectionsPanel";
import type { Item, Collection } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { buildBoardBrief } from "@/lib/brief";
import { closestDistance } from "@/lib/colorDistance";

export default function Library() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [activeItem, setActiveItem] = useState<Item | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeStyle, setActiveStyle] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // busca por cor: em vez de bater o texto gerado pela IA ("Black & Silver"
  // nunca vai casar com "Black & White" por string), compara a cor escolhida
  // no picker contra a paleta hex real de cada item (ver lib/colorDistance.ts)
  // — colorTolerance é o raio de tolerância em ΔE (quanto maior, mais frouxo)
  const [pickedColor, setPickedColor] = useState<string | null>(null);
  const [colorTolerance, setColorTolerance] = useState(30);
  const colorInputRef = useRef<HTMLInputElement>(null);

  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeCollection, setActiveCollection] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [collectionsPanelOpen, setCollectionsPanelOpen] = useState(false);

  const [semanticMode, setSemanticMode] = useState(false);
  const [semanticIds, setSemanticIds] = useState<string[] | null>(null);
  const [semanticLoading, setSemanticLoading] = useState(false);

  const [retagging, setRetagging] = useState(false);
  const [backfillingImages, setBackfillingImages] = useState(false);

  // fluxo do bookmarklet: abre a Library com ?add=<url-da-aba-de-origem>;
  // aqui só espera o check de auth terminar pra decidir se abre direto o
  // AddModal preenchido ou pede login antes
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/items");
    const json = await res.json();
    setItems(json.items ?? []);
    setLoading(false);
  }

  async function loadCollections() {
    const res = await fetch("/api/collections");
    const json = await res.json();
    setCollections(json.collections ?? []);
  }

  useEffect(() => {
    load();
    loadCollections();
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setAuthed(Boolean(data.user));
      setAuthChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(Boolean(session?.user));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const add = params.get("add");
    const collection = params.get("collection");
    if (add) setPendingUrl(add);
    if (collection) setActiveCollection(collection);
    if (add || collection) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  useEffect(() => {
    if (!pendingUrl || !authChecked) return;
    if (authed) setModalOpen(true);
    else setLoginOpen(true);
  }, [pendingUrl, authed, authChecked]);

  // busca semântica: roda em paralelo à busca textual (debounced) só quando
  // o modo está ligado — os resultados viram um filtro de ids (ver `filtered`)
  useEffect(() => {
    if (!semanticMode || !search.trim()) return;
    const q = search.trim();
    const handle = setTimeout(async () => {
      setSemanticLoading(true);
      try {
        const res = await fetch("/api/items/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q, limit: 60 }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        setSemanticIds((json.items as Item[]).map((i) => i.id));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Busca semântica falhou.");
        setSemanticMode(false);
      } finally {
        setSemanticLoading(false);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [semanticMode, search]);

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      for (const tag of item.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) if (item.category) set.add(item.category);
    return [...set].sort();
  }, [items]);

  const allStyles = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) for (const s of item.style) set.add(s);
    return [...set].sort();
  }, [items]);

  const activeFilterCount = [activeCategory, activeStyle, pickedColor, activeCollection].filter(
    Boolean,
  ).length;

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (activeTag && !item.tags.includes(activeTag)) return false;
      if (activeCategory && item.category !== activeCategory) return false;
      if (activeStyle && !item.style.includes(activeStyle)) return false;
      if (pickedColor && closestDistance(pickedColor, item.palette) > colorTolerance) return false;
      if (activeCollection && !item.collection_ids.includes(activeCollection)) return false;
      if (semanticMode) {
        if (search.trim() && semanticIds && !semanticIds.includes(item.id)) return false;
      } else if (search.trim()) {
        const q = search.trim().toLowerCase();
        const haystack = `${item.title ?? ""} ${item.description ?? ""} ${item.tags.join(" ")}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [
    items,
    activeTag,
    activeCategory,
    activeStyle,
    pickedColor,
    colorTolerance,
    activeCollection,
    search,
    semanticMode,
    semanticIds,
  ]);

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
    const scopeParts = [
      activeCollection ? collections.find((c) => c.id === activeCollection)?.name : null,
      activeTag ? `tag: ${activeTag}` : null,
      activeCategory,
      activeStyle,
      pickedColor ? `cor próxima de ${pickedColor}` : null,
      search.trim() ? `busca: "${search.trim()}"` : null,
    ].filter(Boolean);
    const scopeLabel = scopeParts.length > 0 ? scopeParts.join(", ") : undefined;
    try {
      await navigator.clipboard.writeText(buildBoardBrief(filtered, scopeLabel));
      toast.success(`Brief do board copiado (${filtered.length} ite${filtered.length === 1 ? "m" : "ns"}).`);
    } catch {
      toast.error("Erro ao copiar brief.");
    }
  }

  async function retagAll() {
    setRetagging(true);
    try {
      const res = await fetch("/api/items/retag-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "missing" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success(
        json.processed === 0
          ? "Acervo já está todo taggeado."
          : `${json.processed} referência${json.processed === 1 ? "" : "s"} re-taggeada${json.processed === 1 ? "" : "s"}${json.failed ? ` (${json.failed} falhas)` : ""}.`,
      );
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao re-taggear.");
    } finally {
      setRetagging(false);
    }
  }

  // backfill dos prints espalhados pras refs de antes dessa feature (só têm
  // a capa) — não mexe na capa, só adiciona os outros 3 prints. Clicar de
  // novo continua de onde parou (ver api/items/backfill-images/route.ts)
  async function backfillImages() {
    setBackfillingImages(true);
    try {
      const res = await fetch("/api/items/backfill-images", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success(
        json.processed === 0
          ? "Todas as refs já têm os prints espalhados."
          : `${json.processed} referência${json.processed === 1 ? "" : "s"} com prints novos${json.failed ? ` (${json.failed} falhas)` : ""}.`,
      );
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao buscar prints.");
    } finally {
      setBackfillingImages(false);
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
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="mr-auto">
            <h1 className="font-display text-3xl tracking-tight sm:text-4xl">
              Refs do Avá<span style={{ color: "var(--accent)" }}>.</span>
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
              {items.length} referência{items.length === 1 ? "" : "s"} salvas
            </p>
          </div>

          <div
            className="flex items-center gap-2 rounded-xl border px-3 py-2"
            style={{ borderColor: "var(--border)" }}
          >
            <MagnifyingGlass size={16} style={{ color: "var(--muted)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={semanticMode ? "Buscar por descrição..." : "Buscar por título, tag, descrição..."}
              aria-label="Buscar referências"
              className="w-40 bg-transparent text-sm outline-none sm:w-64"
            />
            <button
              onClick={() => setSemanticMode((v) => !v)}
              aria-label="Alternar busca semântica"
              aria-pressed={semanticMode}
              title={semanticMode ? "Busca semântica ligada" : "Busca por texto exato"}
              className="shrink-0 rounded-md p-1 transition"
              style={{ color: semanticMode ? "var(--accent)" : "var(--muted)" }}
            >
              <Sparkle
                size={14}
                weight={semanticMode ? "fill" : "regular"}
                className={semanticLoading ? "animate-pulse" : undefined}
              />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFiltersOpen((v) => !v)}
              aria-label="Filtros"
              aria-expanded={filtersOpen}
              title="Filtros"
              className="relative rounded-xl border p-2.5 transition"
              style={{
                borderColor: filtersOpen || activeFilterCount > 0 ? "var(--accent)" : "var(--border)",
                color: filtersOpen || activeFilterCount > 0 ? "var(--accent)" : "var(--muted)",
                background:
                  filtersOpen || activeFilterCount > 0
                    ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                    : "transparent",
              }}
            >
              {filtersOpen ? <FunnelX size={16} /> : <Funnel size={16} />}
              {activeFilterCount > 0 && !filtersOpen && (
                <span
                  className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-medium"
                  style={{ background: "var(--accent)", color: "var(--on-accent)" }}
                >
                  {activeFilterCount}
                </span>
              )}
            </button>

            {(collections.length > 0 || authed) && (
              <button
                onClick={() => setCollectionsPanelOpen(true)}
                aria-label="Coleções"
                title="Coleções"
                className="rounded-xl border p-2.5 transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                style={{ borderColor: "var(--border)", color: "var(--muted)" }}
              >
                <FolderSimple size={16} />
              </button>
            )}

            {!loading && filtered.length > 0 && (
              <button
                onClick={copyBoardBrief}
                aria-label="Copiar brief do board"
                title="Copiar brief do board"
                className="rounded-xl border p-2.5 transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                style={{ borderColor: "var(--border)", color: "var(--muted)" }}
              >
                <ClipboardText size={16} />
              </button>
            )}

            {authed ? (
              <>
                <button
                  onClick={retagAll}
                  disabled={retagging}
                  aria-label="Re-taggear acervo"
                  title="Re-taggear itens sem recipe/embedding atualizados"
                  className="rounded-xl border p-2.5 opacity-60 hover:opacity-100 disabled:opacity-30"
                  style={{ borderColor: "var(--border)" }}
                >
                  <ArrowsClockwise size={16} className={retagging ? "animate-spin" : undefined} />
                </button>
                <button
                  onClick={backfillImages}
                  disabled={backfillingImages}
                  aria-label="Buscar prints espalhados nas refs antigas"
                  title="Buscar os prints espalhados (hero + 3) nas refs que só têm a capa"
                  className="rounded-xl border p-2.5 opacity-60 hover:opacity-100 disabled:opacity-30"
                  style={{ borderColor: "var(--border)" }}
                >
                  <ImagesSquare size={16} className={backfillingImages ? "animate-pulse" : undefined} />
                </button>
                <button
                  onClick={() => setModalOpen(true)}
                  aria-label="Adicionar"
                  title="Adicionar"
                  className="rounded-xl p-2.5 transition hover:brightness-90"
                  style={{ background: "var(--accent)", color: "var(--on-accent)" }}
                >
                  <Plus size={16} weight="bold" />
                </button>
                <button
                  onClick={handleLogout}
                  aria-label="Sair"
                  title="Sair"
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
                title="Entrar"
                className="rounded-xl border p-2.5 transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                style={{ borderColor: "var(--border)", color: "var(--muted)" }}
              >
                <Lock size={16} />
              </button>
            )}
          </div>
        </div>

        {filtersOpen && (
          <div
            className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4"
            style={{ borderColor: "var(--border)" }}
          >
            <span
              className="mr-1 text-xs font-medium tracking-wide uppercase"
              style={{ color: "var(--muted)" }}
            >
              Filtrar por
            </span>

            <select
              value={activeCategory ?? ""}
              onChange={(e) => setActiveCategory(e.target.value || null)}
              aria-label="Filtrar por categoria"
              className="rounded-xl border bg-transparent px-2.5 py-2 text-sm outline-none"
              style={{ borderColor: "var(--border)", color: "var(--muted)" }}
            >
              <option value="">Categoria</option>
              {allCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={activeStyle ?? ""}
              onChange={(e) => setActiveStyle(e.target.value || null)}
              aria-label="Filtrar por estilo"
              className="rounded-xl border bg-transparent px-2.5 py-2 text-sm outline-none"
              style={{ borderColor: "var(--border)", color: "var(--muted)" }}
            >
              <option value="">Estilo</option>
              {allStyles.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <div
              className="flex items-center gap-1.5 rounded-xl border px-2.5 py-2"
              style={{ borderColor: "var(--border)" }}
            >
              <button
                type="button"
                onClick={() => colorInputRef.current?.click()}
                aria-label="Escolher cor pra buscar referências parecidas"
                title="Buscar por cor próxima (não precisa ser exata)"
                className="h-4 w-4 shrink-0 rounded-full border"
                style={{
                  background: pickedColor ?? "transparent",
                  borderColor: pickedColor ? "var(--border)" : "var(--muted)",
                  backgroundImage: pickedColor
                    ? undefined
                    : "linear-gradient(45deg, var(--muted) 25%, transparent 25%, transparent 75%, var(--muted) 75%), linear-gradient(45deg, var(--muted) 25%, transparent 25%, transparent 75%, var(--muted) 75%)",
                  backgroundSize: pickedColor ? undefined : "6px 6px",
                  backgroundPosition: pickedColor ? undefined : "0 0, 3px 3px",
                  opacity: pickedColor ? 1 : 0.4,
                }}
              />
              <input
                ref={colorInputRef}
                type="color"
                value={pickedColor ?? "#000000"}
                onChange={(e) => setPickedColor(e.target.value)}
                aria-label="Cor pra busca por proximidade"
                className="sr-only"
              />
              <span className="text-sm" style={{ color: "var(--muted)" }}>
                Cor
              </span>
              {pickedColor && (
                <>
                  <input
                    type="range"
                    min={10}
                    max={60}
                    value={colorTolerance}
                    onChange={(e) => setColorTolerance(Number(e.target.value))}
                    aria-label="Sensibilidade da busca por cor"
                    title="Quanto maior, mais tons parecidos entram no resultado"
                    className="w-16 accent-[var(--accent)]"
                  />
                  <button
                    onClick={() => setPickedColor(null)}
                    aria-label="Limpar filtro de cor"
                    className="shrink-0 opacity-60 hover:opacity-100"
                  >
                    <X size={12} />
                  </button>
                </>
              )}
            </div>

            {(collections.length > 0 || authed) && (
              <select
                value={activeCollection ?? ""}
                onChange={(e) => setActiveCollection(e.target.value || null)}
                aria-label="Filtrar por coleção"
                className="rounded-xl border bg-transparent px-2.5 py-2 text-sm outline-none"
                style={{ borderColor: "var(--border)", color: "var(--muted)" }}
              >
                <option value="">Coleção</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
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
        <div className="columns-2 gap-4 sm:columns-3 lg:columns-4 xl:columns-5 2xl:columns-6">
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
        initialUrl={pendingUrl ?? undefined}
        onClose={() => {
          setModalOpen(false);
          setPendingUrl(null);
        }}
        onCreated={(item) => {
          setItems((prev) => [item, ...prev]);
          setPendingUrl(null);
        }}
      />

      <CollectionsPanel
        open={collectionsPanelOpen}
        onClose={() => setCollectionsPanelOpen(false)}
        collections={collections}
        authed={authed}
        onReload={loadCollections}
        onSelectCollection={setActiveCollection}
      />

      <LoginModal
        open={loginOpen}
        onClose={() => {
          setLoginOpen(false);
          setPendingUrl(null);
        }}
        onLoggedIn={() => setAuthed(true)}
      />

      <DetailModal
        item={activeItem}
        authed={authed}
        collections={collections}
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
