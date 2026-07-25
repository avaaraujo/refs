"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { X, ArrowSquareOut, Trash, Check } from "@phosphor-icons/react/dist/ssr";
import { publicImageUrl } from "@/lib/publicUrl";
import { timeAgo } from "@/lib/timeAgo";
import type { Item } from "@/lib/types";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-3 border-t py-3 text-sm" style={{ borderColor: "var(--border)" }}>
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl border"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="hidden flex-1 items-start justify-center overflow-auto bg-black/5 sm:flex">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={publicImageUrl(item.image_path)} alt={item.title ?? ""} className="w-full object-cover" />
        </div>

        <div className="scroll-thin flex w-full flex-col overflow-y-auto sm:w-[380px]">
          <div className="flex items-start justify-between p-5 pb-0">
            <div>
              {item.category && (
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--accent)" }}>
                  {item.category}
                </p>
              )}
              <h2 className="mt-1 text-lg font-semibold leading-snug">{item.title}</h2>
            </div>
            <button onClick={onClose} aria-label="Fechar" className="shrink-0 opacity-60 hover:opacity-100">
              <X size={20} />
            </button>
          </div>

          <div className="sm:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={publicImageUrl(item.image_path)} alt={item.title ?? ""} className="mt-3 w-full object-cover" />
          </div>

          <div className="flex-1 px-5 pb-5">
            {item.description && (
              <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
                {item.description}
              </p>
            )}

            <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
              {timeAgo(item.created_at)}
            </p>

            {item.url && (
              <Field label="Source">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm hover:underline"
                >
                  {item.source_domain} <ArrowSquareOut size={13} />
                </a>
              </Field>
            )}

            {item.style.length > 0 && (
              <Field label="Style">
                {item.style.map((s) => (
                  <Pill key={s} tone="style">
                    {s}
                  </Pill>
                ))}
              </Field>
            )}

            {item.color && <Field label="Color">{item.color}</Field>}

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

            {(authed || notes) && (
              <Field label="Notas">
                {authed ? (
                  <div className="flex flex-col gap-2">
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      placeholder="Adicionar uma nota..."
                      className="rounded-lg border px-2.5 py-2 text-sm outline-none"
                      style={{ borderColor: "var(--border)", background: "transparent" }}
                    />
                    {notes !== (item.notes ?? "") && (
                      <button
                        onClick={saveNotes}
                        disabled={savingNotes}
                        className="flex w-fit items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-white transition hover:brightness-90 disabled:opacity-50 disabled:hover:brightness-100"
                        style={{ background: "var(--accent)" }}
                      >
                        <Check size={12} /> Salvar
                      </button>
                    )}
                  </div>
                ) : (
                  notes
                )}
              </Field>
            )}
          </div>

          {authed && (
            <div className="border-t p-4" style={{ borderColor: "var(--border)" }}>
              <button
                onClick={() => {
                  if (!window.confirm("Apagar esta referência?")) return;
                  onDelete(item.id);
                  onClose();
                }}
                className="flex items-center gap-1.5 text-xs transition hover:opacity-80"
                style={{ color: "var(--danger)" }}
              >
                <Trash size={14} /> Apagar referência
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
