"use client";

import { useState } from "react";
import { toast } from "sonner";
import { X, Lock } from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/client";

export default function LoginModal({
  open,
  onClose,
  onLoggedIn,
}: {
  open: boolean;
  onClose: () => void;
  onLoggedIn: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      setPassword("");
      onLoggedIn();
      onClose();
      toast.success("Login feito.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-xs rounded-2xl border p-6"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-lg font-semibold">
            <Lock size={16} /> Entrar
          </h2>
          <button onClick={onClose} aria-label="Fechar" className="opacity-60 hover:opacity-100">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            autoFocus
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border px-3 py-2 text-sm outline-none"
            style={{ borderColor: "var(--border)", background: "transparent" }}
          />
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl border px-3 py-2 text-sm outline-none"
            style={{ borderColor: "var(--border)", background: "transparent" }}
          />
          <button
            type="submit"
            disabled={loading || !email || !password}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-white transition hover:brightness-90 disabled:opacity-50 disabled:hover:brightness-100"
            style={{ background: "var(--accent)" }}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
