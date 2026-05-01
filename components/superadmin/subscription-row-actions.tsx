"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { MoreVertical, CalendarClock, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getFloatingMenuStyle } from "@/components/hotel/floating-menu-position";
import type { SubscriptionListRow } from "@/lib/queries/superadmin";
import {
  superadminExtendSubscriptionPeriodOneMonthAction,
  superadminUpdateSubscriptionPlanAction,
} from "@/app/superadmin/subscriptions/actions";

const itemClass =
  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-foreground/5 dark:hover:bg-white/5";

const PLANS = [
  { value: "basic", label: "Basic" },
  { value: "pro", label: "Pro" },
  { value: "advanced", label: "Advanced" },
] as const;

export function SubscriptionRowActions({ row }: { row: SubscriptionListRow }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [planChoice, setPlanChoice] = useState(row.plan);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties | undefined>();

  useLayoutEffect(() => {
    if (!menuOpen) {
      setMenuStyle(undefined);
      return;
    }
    const el = triggerRef.current;
    if (el) setMenuStyle(getFloatingMenuStyle(el));
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    function place() {
      const el = triggerRef.current;
      if (el) setMenuStyle(getFloatingMenuStyle(el));
    }
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      const n = e.target as Node;
      if (wrapRef.current?.contains(n) || menuRef.current?.contains(n)) return;
      setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (planOpen) {
      setPlanChoice(row.plan);
      setError(null);
    }
  }, [planOpen, row.plan]);

  async function onSavePlan(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await superadminUpdateSubscriptionPlanAction({
      subscriptionId: row.id,
      plan: planChoice,
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setPlanOpen(false);
    setMenuOpen(false);
    router.refresh();
  }

  async function onExtendConfirm() {
    setError(null);
    setLoading(true);
    const res = await superadminExtendSubscriptionPeriodOneMonthAction(row.id);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setExtendOpen(false);
    setMenuOpen(false);
    router.refresh();
  }

  function closeExtend() {
    if (loading) return;
    setExtendOpen(false);
    setError(null);
  }

  return (
    <>
      <div className="flex flex-col items-end gap-1" ref={wrapRef}>
        <button
          ref={triggerRef}
          type="button"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-muted transition-colors hover:bg-foreground/5 hover:text-foreground dark:hover:bg-white/5"
          aria-label="Subscription actions"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => {
            setError(null);
            if (menuOpen) {
              setMenuOpen(false);
              setMenuStyle(undefined);
            } else if (triggerRef.current) {
              setMenuStyle(getFloatingMenuStyle(triggerRef.current));
              setMenuOpen(true);
            }
          }}
        >
          <MoreVertical className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>

      {typeof document !== "undefined" && menuOpen && menuStyle
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              className="z-[10040] rounded-lg border border-border bg-surface-elevated py-1 text-foreground shadow-lg ring-1 ring-[var(--ring-subtle,transparent)]"
              style={menuStyle}
            >
              <button
                type="button"
                role="menuitem"
                className={itemClass}
                onClick={() => {
                  setMenuOpen(false);
                  setPlanOpen(true);
                }}
              >
                <Layers className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                Change plan
              </button>
              <button
                type="button"
                role="menuitem"
                className={itemClass}
                onClick={() => {
                  setMenuOpen(false);
                  setExtendOpen(true);
                }}
              >
                <CalendarClock className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                Update period (+1 month)
              </button>
            </div>,
            document.body,
          )
        : null}

      {typeof document !== "undefined" && planOpen
        ? createPortal(
            <div
              className="fixed inset-0 isolate z-[10050] flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby={`sub-plan-title-${row.id}`}
            >
              <button
                type="button"
                className="absolute inset-0 z-0 cursor-default bg-black/60"
                onClick={() => !loading && setPlanOpen(false)}
                aria-label="Close"
              />
              <form
                onSubmit={(e) => void onSavePlan(e)}
                className="relative z-10 w-full max-w-md rounded-xl border border-border bg-surface-elevated p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 id={`sub-plan-title-${row.id}`} className="text-lg font-semibold text-foreground">
                  Change subscription plan
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {row.tenant_name ?? row.tenant_id} — updates the{" "}
                  <span className="font-mono text-xs">subscriptions.plan</span> row immediately.
                </p>
                {error ? (
                  <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
                    {error}
                  </p>
                ) : null}
                <div className="mt-4 space-y-2">
                  {PLANS.map((p) => (
                    <label
                      key={p.value}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors",
                        planChoice === p.value ? "border-gold/50 bg-gold/10" : "hover:bg-foreground/5",
                      )}
                    >
                      <input
                        type="radio"
                        name="plan"
                        value={p.value}
                        checked={planChoice === p.value}
                        onChange={() => setPlanChoice(p.value)}
                        className="text-gold"
                      />
                      <span className="text-sm font-medium capitalize">{p.label}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-6 flex justify-end gap-2">
                  <Button type="button" variant="secondary" disabled={loading} onClick={() => setPlanOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? "Saving…" : "Save plan"}
                  </Button>
                </div>
              </form>
            </div>,
            document.body,
          )
        : null}

      {typeof document !== "undefined" && extendOpen
        ? createPortal(
            <div
              className="fixed inset-0 isolate z-[10050] flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby={`sub-ext-title-${row.id}`}
            >
              <button
                type="button"
                className="absolute inset-0 z-0 cursor-default bg-black/60"
                onClick={closeExtend}
                aria-label="Close"
              />
              <div
                className="relative z-10 w-full max-w-md rounded-xl border border-border bg-surface-elevated p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 id={`sub-ext-title-${row.id}`} className="text-lg font-semibold text-foreground">
                  Extend billing period
                </h2>
                <p className="mt-2 text-sm text-muted">
                  Adds <strong>one month</strong> to the billing period (from the later of today or the
                  current end date), sets status to <strong>active</strong>, and{" "}
                  <strong>reactivates sign-in</strong> for all users on this property (including hotel
                  admins) by lifting Auth bans placed when the subscription expired.
                </p>
                {error ? (
                  <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
                    {error}
                  </p>
                ) : null}
                <div className="mt-6 flex justify-end gap-2">
                  <Button type="button" variant="secondary" disabled={loading} onClick={closeExtend}>
                    Cancel
                  </Button>
                  <Button type="button" disabled={loading} onClick={() => void onExtendConfirm()}>
                    {loading ? "Applying…" : "Update period"}
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
