"use client";

import { useRef, useState } from "react";
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
  const cardRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = cardRef.current;
    if (!el) return;
    const clientX = e.clientX;
    const clientY = e.clientY;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      const x = (clientX - r.left) / r.width - 0.5;
      const y = (clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(700px) rotateY(${(x * 8).toFixed(2)}deg) rotateX(${(-y * 8).toFixed(2)}deg) translateY(-2px)`;
      rafRef.current = null;
    });
  }

  function resetTilt() {
    setHover(false);
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (cardRef.current) cardRef.current.style.transform = "";
  }

  return (
    <div
      ref={cardRef}
      role="button"
      tabIndex={0}
      aria-label={`Abrir referência: ${item.title ?? "sem título"}`}
      className="group mb-4 break-inside-avoid cursor-pointer overflow-hidden rounded-xl border transition-[transform,box-shadow,border-color] duration-150 will-change-transform hover:shadow-lg"
      style={{ borderColor: hover ? "var(--accent)" : "var(--border)", background: "var(--card)" }}
      onMouseEnter={() => setHover(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={resetTilt}
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
          data-card-img={item.id}
          className="w-full object-cover"
          loading="lazy"
        />
        {item.images.length > 0 && (
          <span className="absolute top-2 left-2 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] text-white backdrop-blur">
            +{item.images.length}
          </span>
        )}
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
        {item.palette.length > 0 && (
          <div className="absolute bottom-2 left-2 flex gap-1">
            {item.palette.slice(0, 5).map((hex) => (
              <i key={hex} className="h-2.5 w-2.5 rounded-full border border-white/40" style={{ background: hex }} />
            ))}
          </div>
        )}
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
        <p data-card-title={item.id} className="font-title text-sm leading-snug">
          {item.title}
        </p>
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
