"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { X, UploadSimple, LinkSimple } from "@phosphor-icons/react/dist/ssr";
import type { Item } from "@/lib/types";
import { normalizeUrl } from "@/lib/normalizeUrl";

export default function AddModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (item: Item) => void;
}) {
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  function reset() {
    setUrl("");
    setNotes("");
    setFile(null);
    setPreview(null);
  }

  function handleFile(f: File | null) {
    setFile(f);
    if (f) setPreview(URL.createObjectURL(f));
    else setPreview(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file && !url.trim()) {
      toast.error("Cole um link ou envie um print.");
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      if (file) fd.append("file", file);
      if (url.trim()) fd.append("url", normalizeUrl(url));
      if (notes.trim()) fd.append("notes", notes.trim());

      const res = await fetch("/api/items", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao salvar");

      toast.success("Referência salva e taggeada.");
      onCreated(json.item);
      reset();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-modal-title"
        className="w-full max-w-md rounded-2xl border p-6"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="add-modal-title" className="text-lg font-semibold">
            Nova referência
          </h2>
          <button onClick={onClose} aria-label="Fechar" className="opacity-60 hover:opacity-100">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border)] p-6 text-center transition hover:border-[var(--accent)]"
            onClick={() => fileInputRef.current?.click()}
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="preview" className="max-h-40 rounded-lg object-contain" />
            ) : (
              <>
                <UploadSimple size={24} />
                <span className="text-sm" style={{ color: "var(--muted)" }}>
                  Clique para enviar um print
                </span>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="h-px flex-1" style={{ background: "var(--border)" }} />
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              e / ou
            </span>
            <div className="h-px flex-1" style={{ background: "var(--border)" }} />
          </div>

          <div className="flex items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)" }}>
            <LinkSimple size={16} style={{ color: "var(--muted)" }} />
            <input
              type="text"
              inputMode="url"
              placeholder="apple.com ou https://apple.com"
              aria-label="Link do site"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          {url.trim() && !file && (
            <p className="-mt-2 text-xs" style={{ color: "var(--muted)" }}>
              O print será capturado automaticamente a partir do link.
            </p>
          )}

          <textarea
            placeholder="Notas (opcional)"
            aria-label="Notas"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="rounded-xl border px-3 py-2 text-sm outline-none"
            style={{ borderColor: "var(--border)", background: "transparent" }}
          />

          <button
            type="submit"
            disabled={loading}
            className="rounded-xl px-4 py-2.5 text-sm font-medium transition hover:brightness-90 disabled:opacity-50 disabled:hover:brightness-100"
            style={{ background: "var(--accent)", color: "var(--on-accent)" }}
          >
            {loading ? "Salvando e gerando tags..." : "Salvar referência"}
          </button>
        </form>
      </div>
    </div>
  );
}
