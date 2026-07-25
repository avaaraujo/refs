"use client";

import { useState } from "react";
import { Trash, ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import { publicImageUrl } from "@/lib/publicUrl";
import type { Item } from "@/lib/types";

export default function ItemCard({
  item,
  onDelete,
  onTagClick,
  onOpen,
}: {
  item: Item;
  onDelete: (id: string) => void;
  onTagClick: (tag: string) => void;
  onOpen: (item: Item) => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <div
      className="group mb-4 break-inside-avoid cursor-pointer overflow-hidden rounded-xl border"
      style={{ borderColor: "var(--border)", background: "var(--card)" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onOpen(item)}
    >
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={publicImageUrl(item.image_path)}
          alt={item.title ?? "referência"}
          className="w-full object-cover"
          loading="lazy"
        />
        {hover && (
          <div className="absolute inset-x-0 top-0 flex justify-end gap-1 p-2">
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
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item.id);
              }}
              className="rounded-full bg-black/60 p-1.5 text-white backdrop-blur hover:bg-red-600"
            >
              <Trash size={14} />
            </button>
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-medium leading-snug">{item.title}</p>
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
                className="rounded-full border px-2 py-0.5 text-[11px] transition hover:opacity-70"
                style={{ borderColor: "var(--border)", color: "var(--muted)" }}
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
