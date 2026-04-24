"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Size = "default" | "compact";

const sizeClass: Record<Size, string> = {
  default: "h-9 w-9",
  compact: "h-8 w-8",
};

/**
 * Top-bar avatar: opens a menu with Log out (Supabase signOut + /login).
 */
export function HeaderProfileMenu({ size = "default" }: { size?: Size }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onDoc);
      document.addEventListener("keydown", onKey);
    }
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function onLogout() {
    setOpen(false);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          sizeClass[size],
          "inline-flex items-center justify-center rounded-full border border-border bg-surface-elevated text-muted ring-2 ring-gold/20 transition hover:text-foreground hover:ring-gold/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold/50",
        )}
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <User className={cn(size === "compact" ? "h-4 w-4" : "h-5 w-5")} aria-hidden />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 min-w-[11rem] rounded-lg border border-border bg-surface-elevated py-1 shadow-lg ring-1 ring-[var(--ring-subtle)]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={onLogout}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-foreground/5 dark:hover:bg-white/5"
          >
            <LogOut className="h-4 w-4 shrink-0 text-muted" aria-hidden />
            Log out
          </button>
        </div>
      ) : null}
    </div>
  );
}
