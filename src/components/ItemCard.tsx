"use client";

import { useState } from "react";
import { Trash, ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import { publicImageUrl } from "@/lib/publicUrl";
import type { Item } from "@/lib/types";

export default function ItemCard({
  item,
  authed,
  onDelete,
  onTagClick,
  onOpen,
}: {
  item: Item;
  authed: boolean;
  onDelete: (id: string) => void;
  onTagClick: (tag: string) => void;
  onOpen: (item: Item) => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Abrir referência: ${item.title ?? "sem título"}`}
      className="group mb-4 break-inside-avoid cursor-pointer overflow-hidden rounded-xl border transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-0.5 hover:shadow-lg"
      style={{ borderColor: hover ? "var(--accent)" : "var(--border)", background: "var(--card)" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onOpen(item)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(item);
        }
      }}
    >
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={publicImageUrl(item.image_path)}
          alt={item.title ?? "referência"}
          className="w-full object-cover"
          loading="lazy"
        />
        {/* sempre no DOM (não só em hover) pra ficar alcançável via Tab;
            visibilidade é só CSS, revelada por mouse OU foco de teclado */}
        <div className="absolute inset-x-0 top-0 flex justify-end gap-1 p-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="rounded-full bg-black/60 p-1.5 text-white backdrop-blur hover:bg-black/80"
            >
              <ArrowSquareOut size={14} />
            </a>
          )}
          {authed && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm("Apagar esta referência?")) onDelete(item.id);
              }}
              aria-label="Apagar referência"
              className="rounded-full bg-black/60 p-1.5 text-white backdrop-blur transition hover:bg-[var(--danger)]"
            >
              <Trash size={14} />
            </button>
          )}
        </div>
      </div>
      <div className="p-3">
        {item.category && (
          <p
            className="mb-1 text-[10px] font-bold uppercase tracking-wide"
            style={{ color: "var(--accent)" }}
          >
            {item.category}
          </p>
        )}
        <p className="font-title text-sm leading-snug">{item.title}</p>
        {item.description && (
          <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
            {item.description}
          </p>
        )}
        {item.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {item.tags.map((tag) => (
              <button
                key={tag}
                onClick={(e) => {
                  e.stopPropagation();
                  onTagClick(tag);
                }}
                className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
