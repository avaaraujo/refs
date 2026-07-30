"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  X,
  ArrowSquareOut,
  Trash,
  Check,
  ArrowClockwise,
  ClipboardText,
  CaretLeft,
  CaretRight,
  CaretDown,
  Plus,
} from "@phosphor-icons/react/dist/ssr";
import { publicImageUrl } from "@/lib/publicUrl";
import { timeAgo } from "@/lib/timeAgo";
import { colorSwatches } from "@/lib/colorSwatch";
import { buildItemBrief } from "@/lib/brief";
import type { Item, Collection } from "@/lib/types";

// linha compacta pra dentro do cluster de taxonomia: sem borda própria,
// a borda é da própria seção do acordeão que a contém
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-3 py-1.5 text-sm">
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <div>{children}</div>
    </div>
  );
}

function Pill({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "style" | "tech" }) {
  const color = tone === "style" ? "var(--style)" : tone === "tech" ? "var(--tech)" : "var(--fg)";
  return (
    <span
      className="mr-1.5 mb-1.5 inline-block rounded-full border px-2 py-0.5 text-xs"
      style={{ borderColor: "var(--border)", color }}
    >
      {children}
    </span>
  );
}

// seção do acordeão: só uma fica aberta por vez (controlado pelo pai) — dá
// pra ver que Recipe/Taxonomia existem sem precisar abrir nada (o rótulo +
// contagem já contam a história), diferente de esconder atrás de abas
function AccordionSection({
  label,
  meta,
  open,
  onToggle,
  children,
}: {
  label: string;
  meta?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t" style={{ borderColor: "var(--border)" }}>
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between py-3 text-left text-xs font-semibold uppercase tracking-wide transition"
        style={{ color: open ? "var(--fg)" : "var(--muted)" }}
      >
        <span>
          {label}
          {meta && (
            <span className="ml-1.5 font-normal normal-case tracking-normal" style={{ color: "var(--muted)" }}>
              · {meta}
            </span>
          )}
        </span>
        <CaretDown
          size={11}
          className="shrink-0 transition-transform"
          style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
      </button>
      {open && <div className="pb-4">{children}</div>}
    </div>
  );
}

export default function DetailModal({
  item,
  authed,
  collections,
  onClose,
  onDelete,
  onUpdated,
  onNavigate,
  hasPrev,
  hasNext,
}: {
  item: Item | null;
  authed: boolean;
  collections: Collection[];
  onClose: () => void;
  onDelete: (id: string) => void;
  onUpdated: (item: Item) => void;
  onNavigate: (delta: number) => void;
  hasPrev: boolean;
  hasNext: boolean;
}) {
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingCollection, setSavingCollection] = useState(false);
  const [recapturing, setRecapturing] = useState(false);
  const [delay, setDelay] = useState(3);
  const [openSection, setOpenSection] = useState<"info" | "taxonomy" | "recipe">("recipe");
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNotes(item?.notes ?? "");
  }, [item]);

  // só rereseta a imagem ativa quando o item TROCA (navegação entre refs) —
  // não a cada onUpdated do mesmo item (ex: salvar nota), senão perde a
  // seleção de print toda vez que qualquer campo é editado
  useEffect(() => {
    setActiveImageIndex(0);
  }, [item?.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // não navega enquanto o dono está digitando (notas, delay de recapture)
      const target = e.target as HTMLElement | null;
      if (target && ["TEXTAREA", "INPUT"].includes(target.tagName)) return;
      if (e.key === "ArrowLeft" && hasPrev) onNavigate(-1);
      if (e.key === "ArrowRight" && hasNext) onNavigate(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onNavigate, hasPrev, hasNext]);

  if (!item) return null;

  const hasTaxonomy = item.style.length > 0 || Boolean(item.color) || item.tech.length > 0 || item.tags.length > 0;
  const hasRecipe = (item.recipe_tags?.length ?? 0) > 0;
  const hasInfo = Boolean(item.description) || authed || Boolean(notes) || item.collection_ids.length > 0;
  // paleta real extraída do print (lib/palette.ts) é preferida sobre a
  // aproximação por palavra-chave da descrição textual (lib/colorSwatch.ts) —
  // essa última só cobre itens antigos ainda sem backfill de palette
  const swatches = item.palette.length > 0 ? item.palette : colorSwatches(item.color);

  async function copyHex(hex: string) {
    try {
      await navigator.clipboard.writeText(hex);
      toast.success(`${hex} copiado.`);
    } catch {
      toast.error("Erro ao copiar hex.");
    }
  }

  const taxonomyMeta = [
    item.style.length > 0 ? `${item.style.length} style` : null,
    item.tech.length > 0 ? `${item.tech.length} tech` : null,
    item.tags.length > 0 ? `${item.tags.length} tags` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const recipeMeta = `${item.recipe_tags.length} faceta${item.recipe_tags.length === 1 ? "" : "s"}${
    item.site_recipe ? " + prompt" : ""
  }`;

  async function recapture() {
    setRecapturing(true);
    try {
      const res = await fetch(`/api/items/${item!.id}/recapture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delay }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      onUpdated(json.item);
      toast.success("Print e tags atualizados.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao recapturar.");
    } finally {
      setRecapturing(false);
    }
  }

  async function copyBrief() {
    try {
      await navigator.clipboard.writeText(buildItemBrief(item!, notes));
      toast.success("Brief copiado.");
    } catch {
      toast.error("Erro ao copiar brief.");
    }
  }

  async function copySiteRecipe() {
    try {
      await navigator.clipboard.writeText(item!.site_recipe ?? "");
      toast.success("Site recipe copiado.");
    } catch {
      toast.error("Erro ao copiar site recipe.");
    }
  }

  async function saveNotes() {
    setSavingNotes(true);
    try {
      const res = await fetch(`/api/items/${item!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      onUpdated(json.item);
      toast.success("Notas salvas.");
    } catch {
      toast.error("Erro ao salvar notas.");
    } finally {
      setSavingNotes(false);
    }
  }

  async function toggleCollection(collectionId: string) {
    const next = item!.collection_ids.includes(collectionId)
      ? item!.collection_ids.filter((id) => id !== collectionId)
      : [...item!.collection_ids, collectionId];
    setSavingCollection(true);
    try {
      const res = await fetch(`/api/items/${item!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collection_ids: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      onUpdated(json.item);
    } catch {
      toast.error("Erro ao mudar coleção.");
    } finally {
      setSavingCollection(false);
    }
  }

  async function uploadImage(file: File) {
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/items/${item!.id}/images`, { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      onUpdated({ ...item!, images: [...item!.images, json.image] });
      setActiveImageIndex(item!.images.length + 1);
      toast.success("Print adicionado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao adicionar print.");
    } finally {
      setUploadingImage(false);
    }
  }

  async function deleteImage(imageId: string) {
    if (!window.confirm("Apagar este print?")) return;
    try {
      const res = await fetch(`/api/items/${item!.id}/images/${imageId}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error);
      onUpdated({ ...item!, images: item!.images.filter((i) => i.id !== imageId) });
      setActiveImageIndex(0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao apagar print.");
    }
  }

  // capa (item.image_path) + prints adicionais (item_images), nessa ordem —
  // ver lib/itemImages.ts / migration_008
  const gallery = [{ id: null as string | null, image_path: item.image_path }, ...item.images];
  const activeImage = gallery[activeImageIndex] ?? gallery[0];
  // miniaturas mostram só os OUTROS prints (o ativo já está grande) — clicar
  // numa miniatura troca qual entra na posição grande
  const otherImages = gallery
    .map((img, idx) => ({ img, idx }))
    .filter(({ idx }) => idx !== activeImageIndex);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center gap-8 bg-black/60 p-4"
      onClick={onClose}
    >
      {/* botão fica invisible (não "hidden") quando não há anterior/próximo,
          pra reservar o espaço e o modal não deslocar de lado nas pontas
          da lista — o gap do flex já garante a distância fixa até o modal */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (hasPrev) onNavigate(-1);
        }}
        aria-label="Referência anterior"
        aria-hidden={!hasPrev}
        tabIndex={hasPrev ? 0 : -1}
        className={`hidden h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition sm:flex ${
          hasPrev ? "hover:opacity-80" : "invisible"
        }`}
        style={{ background: "rgba(255,255,255,0.1)" }}
      >
        <CaretLeft size={20} weight="bold" />
      </button>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-modal-title"
        className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl border sm:h-[min(78vh,480px)] sm:w-fit sm:flex-row lg:h-[min(80vh,640px)] xl:h-[min(82vh,760px)]"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* a altura é fixa (a do modal) e a largura é derivada dela via
            aspect-ratio — nunca o inverso, senão o painel ao lado (mais alto
            com Recipe aberto) estica a imagem. object-contain (não cover)
            pra nunca cropar o print — sobra vira letterbox, não corte. A
            tira de miniaturas abaixo do print grande consome parte dessa
            altura fixa (flex column, não flutua por cima), então o aspect
            do CONTAINER precisa ser mais estreito que o da captura
            (1400x900, ~1.56) pra sobrar isso pro print de fato preencher a
            largura toda sem barras laterais — 7:5 (1.4) é o ajuste que
            compensa a tira sem medir pixel a pixel por breakpoint. */}
        <div className="flex shrink-0 aspect-[7/5] flex-col sm:h-full">
          <div className="relative min-h-0 flex-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={publicImageUrl(activeImage.image_path)}
              alt={item.title ?? ""}
              className="h-full w-full object-contain"
              style={{ viewTransitionName: activeImageIndex === 0 ? "card-img" : undefined }}
            />
            {item.url && (
              <div
                className="absolute inset-x-0 bottom-0 flex justify-start p-3 pt-8"
                style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.55))" }}
              >
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex max-w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-sm text-white backdrop-blur-md transition hover:border-[var(--accent)]"
                  style={{ background: "rgba(20,20,20,0.75)", borderColor: "rgba(255,255,255,0.15)" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${item.source_domain}&sz=32`}
                    alt=""
                    className="h-4 w-4 shrink-0 rounded-sm"
                  />
                  <span className="truncate">Ver {item.source_domain}</span>
                  <ArrowSquareOut size={14} />
                </a>
              </div>
            )}
          </div>

          {(otherImages.length > 0 || authed) && (
            <div
              className="scroll-thin flex shrink-0 gap-1.5 overflow-x-auto border-t p-2"
              style={{ borderColor: "var(--border)" }}
            >
              {otherImages.map(({ img, idx }) => (
                <button
                  key={img.id ?? "cover"}
                  onClick={() => setActiveImageIndex(idx)}
                  aria-label={idx === 0 ? "Ver print de capa" : `Ver print adicional ${idx}`}
                  className="h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 transition hover:border-[var(--accent)]"
                  style={{ borderColor: "var(--border)" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={publicImageUrl(img.image_path)} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
              {authed && (
                <>
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    disabled={uploadingImage}
                    aria-label="Adicionar print"
                    title="Adicionar print (hero, pricing, footer...)"
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border-2 border-dashed transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
                    style={{ borderColor: "var(--border)", color: "var(--muted)" }}
                  >
                    <Plus size={18} className={uploadingImage ? "animate-pulse" : undefined} />
                  </button>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadImage(file);
                      e.target.value = "";
                    }}
                  />
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex w-full flex-col overflow-hidden sm:w-[400px] sm:shrink-0 lg:w-[440px] xl:w-[500px]">
          <div className="flex items-start justify-between gap-3 p-5 pb-3.5 lg:p-6 lg:pb-4">
            <div>
              {item.category && (
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--accent)" }}>
                  {item.category}
                </p>
              )}
              <h2
                id="detail-modal-title"
                className="font-title mt-1 text-lg leading-snug"
                style={{ viewTransitionName: "card-title" }}
              >
                {item.title}
              </h2>
              {/* só a data — o link pra visitar já existe uma vez só,
                  flutuando sobre o print ao lado */}
              <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                {timeAgo(item.created_at)}
              </p>
            </div>
            <button onClick={onClose} aria-label="Fechar" className="shrink-0 opacity-60 hover:opacity-100">
              <X size={18} />
            </button>
          </div>

          <div className="scroll-thin flex-1 overflow-y-auto px-5 lg:px-6">
            {hasInfo && (
              <AccordionSection
                label="Info & notas"
                open={openSection === "info"}
                onToggle={() => setOpenSection((s) => (s === "info" ? "recipe" : "info"))}
              >
                {item.description && (
                  <p className="text-sm" style={{ color: "var(--muted)" }}>
                    {item.description}
                  </p>
                )}
                {(authed || notes) && (
                  <div className={item.description ? "mt-4" : ""}>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                      Notas
                    </p>
                    {authed ? (
                      <div className="flex flex-col gap-2">
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={3}
                          placeholder="Adicionar uma nota..."
                          aria-label="Notas"
                          className="rounded-lg border px-2.5 py-2 text-sm outline-none"
                          style={{ borderColor: "var(--border)", background: "transparent" }}
                        />
                        {notes !== (item.notes ?? "") && (
                          <button
                            onClick={saveNotes}
                            disabled={savingNotes}
                            className="flex w-fit items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition hover:brightness-90 disabled:opacity-50 disabled:hover:brightness-100"
                            style={{ background: "var(--accent)", color: "var(--on-accent)" }}
                          >
                            <Check size={12} /> Salvar
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm">{notes}</p>
                    )}
                  </div>
                )}
                {(authed || item.collection_ids.length > 0) && (
                  <div className={item.description || notes ? "mt-4" : ""}>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                      Coleções
                    </p>
                    {authed ? (
                      collections.length === 0 ? (
                        <p className="text-sm" style={{ color: "var(--muted)" }}>
                          Nenhuma coleção criada ainda.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {collections.map((c) => {
                            const active = item.collection_ids.includes(c.id);
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => toggleCollection(c.id)}
                                disabled={savingCollection}
                                aria-pressed={active}
                                className="rounded-full border px-2.5 py-1 text-xs transition disabled:opacity-50"
                                style={{
                                  borderColor: active ? "var(--accent)" : "var(--border)",
                                  background: active ? "var(--accent)" : "transparent",
                                  color: active ? "var(--on-accent)" : "var(--muted)",
                                }}
                              >
                                {c.name}
                              </button>
                            );
                          })}
                        </div>
                      )
                    ) : (
                      <p className="text-sm">
                        {collections
                          .filter((c) => item.collection_ids.includes(c.id))
                          .map((c) => c.name)
                          .join(", ")}
                      </p>
                    )}
                  </div>
                )}
              </AccordionSection>
            )}

            {hasTaxonomy && (
              <AccordionSection
                label="Taxonomia"
                meta={taxonomyMeta}
                open={openSection === "taxonomy"}
                onToggle={() => setOpenSection((s) => (s === "taxonomy" ? "recipe" : "taxonomy"))}
              >
                {item.style.length > 0 && (
                  <Field label="Style">
                    {item.style.map((s) => (
                      <Pill key={s} tone="style">
                        {s}
                      </Pill>
                    ))}
                  </Field>
                )}
                {item.color && (
                  <Field label="Color">
                    <div className="flex items-center gap-2">
                      {swatches.length > 0 && (
                        <span className="inline-flex shrink-0 gap-1">
                          {swatches.map((hex) => (
                            <button
                              key={hex}
                              type="button"
                              onClick={() => copyHex(hex)}
                              title={`Copiar ${hex}`}
                              aria-label={`Copiar cor ${hex}`}
                              className="h-3.5 w-3.5 rounded-sm border transition hover:scale-125"
                              style={{ background: hex, borderColor: "var(--border)" }}
                            />
                          ))}
                        </span>
                      )}
                      <span>{item.color}</span>
                    </div>
                  </Field>
                )}
                {item.tech.length > 0 && (
                  <Field label="Tech">
                    {item.tech.map((t) => (
                      <Pill key={t} tone="tech">
                        {t}
                      </Pill>
                    ))}
                  </Field>
                )}
                {item.tags.length > 0 && (
                  <Field label="Tags">
                    {item.tags.map((t) => (
                      <Pill key={t}>{t}</Pill>
                    ))}
                  </Field>
                )}
              </AccordionSection>
            )}

            {hasRecipe && (
              <AccordionSection
                label="Recipe"
                meta={recipeMeta}
                open={openSection === "recipe"}
                onToggle={() => setOpenSection((s) => (s === "recipe" ? "taxonomy" : "recipe"))}
              >
                <div>
                  {item.recipe_tags.map((t) => (
                    <Pill key={t} tone="style">
                      {t}
                    </Pill>
                  ))}
                </div>
                {item.site_recipe && (
                  <pre
                    className="scroll-thin mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border p-2.5 font-mono text-[11px] leading-relaxed"
                    style={{ borderColor: "var(--border)", color: "var(--muted)" }}
                  >
                    {item.site_recipe}
                  </pre>
                )}
              </AccordionSection>
            )}
          </div>

          <div className="border-t p-5 lg:p-6" style={{ borderColor: "var(--border)" }}>
            {hasTaxonomy && (
              <div className="flex gap-2">
                <button
                  onClick={copyBrief}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  style={{ borderColor: "var(--border)" }}
                >
                  <ClipboardText size={14} /> Copiar brief
                </button>
                {item.site_recipe && (
                  <button
                    onClick={copySiteRecipe}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <ClipboardText size={14} /> Copiar site recipe
                  </button>
                )}
              </div>
            )}

            {authed && (
              <div className={`flex flex-col gap-3 ${hasTaxonomy ? "mt-4 border-t pt-4" : ""}`} style={{ borderColor: "var(--border)" }}>
                {item.url && (
                  <div>
                    <p className="mb-2 text-xs" style={{ color: "var(--muted)" }}>
                      Print saiu errado (ex: animação de entrada não terminou)? Recapture — refaz a capa e os outros 3 prints espalhados.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={recapture}
                        disabled={recapturing}
                        className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
                        style={{ borderColor: "var(--border)" }}
                      >
                        <ArrowClockwise size={13} className={recapturing ? "animate-spin" : undefined} />
                        {recapturing ? "Recapturando..." : "Recapturar"}
                      </button>
                      <label className="flex items-center gap-1.5 text-xs" style={{ color: "var(--muted)" }}>
                        esperar
                        <input
                          type="number"
                          min={0}
                          max={15}
                          value={delay}
                          onChange={(e) => setDelay(Number(e.target.value))}
                          disabled={recapturing}
                          className="w-12 rounded-md border px-1.5 py-1 text-xs outline-none"
                          style={{ borderColor: "var(--border)", background: "transparent" }}
                        />
                        s
                      </label>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-4">
                  <button
                    onClick={() => {
                      if (!window.confirm("Apagar esta referência?")) return;
                      onDelete(item.id);
                      onClose();
                    }}
                    className="flex w-fit items-center gap-1.5 text-xs transition hover:opacity-80"
                    style={{ color: "var(--danger)" }}
                  >
                    <Trash size={14} /> Apagar referência
                  </button>
                  {activeImageIndex > 0 && (
                    <button
                      onClick={() => deleteImage(gallery[activeImageIndex].id!)}
                      className="flex w-fit items-center gap-1.5 text-xs opacity-70 transition hover:opacity-100"
                      style={{ color: "var(--danger)" }}
                    >
                      <Trash size={14} /> Apagar este print
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (hasNext) onNavigate(1);
        }}
        aria-label="Próxima referência"
        aria-hidden={!hasNext}
        tabIndex={hasNext ? 0 : -1}
        className={`hidden h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition sm:flex ${
          hasNext ? "hover:opacity-80" : "invisible"
        }`}
        style={{ background: "rgba(255,255,255,0.1)" }}
      >
        <CaretRight size={20} weight="bold" />
      </button>
    </div>
  );
}
