"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { X, ArrowSquareOut, Trash, Check, ArrowClockwise, ClipboardText } from "@phosphor-icons/react/dist/ssr";
import { publicImageUrl } from "@/lib/publicUrl";
import { timeAgo } from "@/lib/timeAgo";
import { colorSwatches } from "@/lib/colorSwatch";
import { buildItemBrief } from "@/lib/brief";
import type { Item } from "@/lib/types";

// linha compacta pra dentro do cluster de taxonomia: sem borda própria,
// a borda é do container que agrupa Style/Color/Tech/Tags como um bloco só
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

export default function DetailModal({
  item,
  authed,
  onClose,
  onDelete,
  onUpdated,
}: {
  item: Item | null;
  authed: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
  onUpdated: (item: Item) => void;
}) {
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [recapturing, setRecapturing] = useState(false);
  const [delay, setDelay] = useState(3);

  useEffect(() => {
    setNotes(item?.notes ?? "");
  }, [item]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!item) return null;

  const hasTaxonomy = item.style.length > 0 || Boolean(item.color) || item.tech.length > 0 || item.tags.length > 0;

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

  const swatches = colorSwatches(item.color);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-modal-title"
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* print na largura toda: o recorte 4:3 é paisagem, então deitar o
            modal (imagem em cima, conteúdo em duas colunas embaixo) evita a
            sobra vazia que uma coluna estreita ao lado do print sempre deixa */}
        <div className="relative shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={publicImageUrl(item.image_path)}
            alt={item.title ?? ""}
            className="max-h-[45vh] w-full object-cover"
            style={{ viewTransitionName: "card-img" }}
          />
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-white transition hover:opacity-80"
            style={{ background: "rgba(20,20,20,0.65)" }}
          >
            <X size={16} />
          </button>
          {item.url && (
            <div
              className="absolute inset-x-0 bottom-0 flex justify-start p-4 pt-10"
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

        <div className="scroll-thin flex-1 overflow-y-auto">
          <div className="grid sm:grid-cols-[1fr_320px]">
            <div className="border-b p-5 sm:border-b-0 sm:border-r" style={{ borderColor: "var(--border)" }}>
              {item.category && (
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--accent)" }}>
                  {item.category}
                </p>
              )}
              <h2
                id="detail-modal-title"
                className="font-title mt-1 text-xl leading-snug"
                style={{ viewTransitionName: "card-title" }}
              >
                {item.title}
              </h2>

              {item.description && (
                <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
                  {item.description}
                </p>
              )}

              {/* proveniência: fonte + data, texto puro — o link pra visitar
                  já existe uma vez só, flutuando sobre o print acima */}
              <div className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: "var(--muted)" }}>
                {item.source_domain && (
                  <>
                    <span>{item.source_domain}</span>
                    <span aria-hidden="true">·</span>
                  </>
                )}
                <span>{timeAgo(item.created_at)}</span>
              </div>

              {/* notas: campo editável, tratamento de formulário (label em cima),
                  não uma linha de dado somente-leitura */}
              {(authed || notes) && (
                <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
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
            </div>

            <div className="p-5">
              {/* taxonomia gerada por IA — o valor central do produto (ver PRODUCT.md) */}
              {hasTaxonomy && (
                <div>
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
                              <i
                                key={hex}
                                className="h-3.5 w-3.5 rounded-sm border"
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
                </div>
              )}

              {/* recipe: facetas de estilo mais descritivas que as tags, +
                  prompt pronto pra recriar a direção visual num novo projeto
                  (ver PRODUCT.md — leitura por IA em outros projetos do dono) */}
              {(item.recipe_tags?.length ?? 0) > 0 && (
                <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--border)" }}>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                    Recipe
                  </p>
                  <div>
                    {item.recipe_tags.map((t) => (
                      <Pill key={t} tone="style">
                        {t}
                      </Pill>
                    ))}
                  </div>
                  {item.site_recipe && (
                    <pre
                      className="scroll-thin mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap rounded-lg border p-2.5 font-mono text-[11px] leading-relaxed"
                      style={{ borderColor: "var(--border)", color: "var(--muted)" }}
                    >
                      {item.site_recipe}
                    </pre>
                  )}
                </div>
              )}

              {hasTaxonomy && (
                <div className="mt-4 flex gap-2">
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
                <div className="mt-4 flex flex-col gap-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
                  {item.url && (
                    <div>
                      <p className="mb-2 text-xs" style={{ color: "var(--muted)" }}>
                        Print saiu errado (ex: animação de entrada não terminou)? Recapture.
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
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
