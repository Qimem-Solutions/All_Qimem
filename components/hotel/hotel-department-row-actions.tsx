"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { MoreVertical, Pencil, Power, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import {
  deleteDepartmentAction,
  setDepartmentActiveAction,
  updateDepartmentAction,
} from "@/lib/actions/hotel-users";
import type { DepartmentCountRow } from "@/lib/queries/tenant-data";
import { getFloatingMenuStyle } from "@/components/hotel/floating-menu-position";

type Props = {
  department: DepartmentCountRow;
};

const itemClass =
  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-foreground/5 dark:hover:bg-white/5";

export function HotelDepartmentRowActions({ department: d }: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [name, setName] = useState(d.name);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<"toggle" | "delete" | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const isActive = d.is_active !== false;

  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties | undefined>();

  useLayoutEffect(() => {
    if (!menuOpen) {
      setMenuStyle(undefined);
      return;
    }
    const t = triggerRef.current;
    if (t) setMenuStyle(getFloatingMenuStyle(t));
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    function place() {
      const t = triggerRef.current;
      if (!t) return;
      setMenuStyle(getFloatingMenuStyle(t));
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
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setMenuOpen(false);
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const r = await updateDepartmentAction({ departmentId: d.id, name: name.trim() });
    setLoading(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setEditOpen(false);
    router.refresh();
  }

  function requestToggleActive() {
    setConfirmError(null);
    setMenuOpen(false);
    setConfirmDialog("toggle");
  }

  async function executeToggleActive() {
    setConfirmLoading(true);
    setConfirmError(null);
    const r = await setDepartmentActiveAction({ departmentId: d.id, isActive: !isActive });
    setConfirmLoading(false);
    if (!r.ok) {
      setConfirmError(r.error);
      return;
    }
    setConfirmDialog(null);
    router.refresh();
  }

  function requestDelete() {
    setConfirmError(null);
    setMenuOpen(false);
    setConfirmDialog("delete");
  }

  async function executeDelete() {
    setConfirmLoading(true);
    setConfirmError(null);
    const r = await deleteDepartmentAction({ departmentId: d.id });
    setConfirmLoading(false);
    if (!r.ok) {
      setConfirmError(r.error);
      return;
    }
    setConfirmDialog(null);
    router.refresh();
  }

  function closeConfirm() {
    if (confirmLoading) return;
    setConfirmDialog(null);
    setConfirmError(null);
  }

  function startEdit() {
    setName(d.name);
    setError(null);
    setMenuOpen(false);
    setEditOpen(true);
  }

  return (
    <>
      <div className="relative flex flex-col items-end" ref={wrapRef}>
        <button
          ref={triggerRef}
          type="button"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-muted transition-colors hover:bg-foreground/5 hover:text-foreground dark:hover:bg-white/5"
          aria-label="Department actions"
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
        {error ? <p className="mt-1 max-w-[10rem] text-right text-xs text-red-600 dark:text-red-400">{error}</p> : null}
      </div>

      {typeof document !== "undefined" && menuOpen && menuStyle
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              className="rounded-lg border border-border bg-surface-elevated py-1 text-foreground shadow-lg ring-1 ring-[var(--ring-subtle,transparent)]"
              style={menuStyle}
            >
              <button type="button" role="menuitem" className={itemClass} onClick={startEdit}>
                <Pencil className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                Edit
              </button>
              <button type="button" role="menuitem" className={itemClass} onClick={requestToggleActive}>
                <Power className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                {isActive ? "Deactivate" : "Activate"}
              </button>
              <button
                type="button"
                role="menuitem"
                className={cn(itemClass, "text-red-600 dark:text-red-400")}
                onClick={requestDelete}
              >
                <Trash2 className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                Delete
              </button>
            </div>,
            document.body,
          )
        : null}

      {editOpen ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={() => setEditOpen(false)}
            aria-label="Close"
          />
          <form
            onSubmit={onSave}
            className="relative z-10 w-full max-w-md rounded-xl border border-border bg-surface-elevated p-6 shadow-xl"
          >
            <h2 className="text-lg font-semibold text-foreground">Edit department</h2>
            <p className="mt-1 text-sm text-muted">Rename {d.name}.</p>
            {error ? (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            ) : null}
            <label className="mt-4 block text-xs font-medium text-muted" htmlFor={`dept-name-${d.id}`}>
              Name
            </label>
            <Input
              id={`dept-name-${d.id}`}
              className="mt-1.5"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      <ConfirmModal
        open={confirmDialog === "toggle"}
        title={isActive ? "Deactivate department" : "Activate department"}
        description={
          isActive
            ? `Mark “${d.name}” as inactive? It will be hidden from new staff assignments.`
            : `Re-activate “${d.name}”? It will appear in department pickers again.`
        }
        confirmLabel={isActive ? "Deactivate" : "Activate"}
        destructive={isActive}
        loading={confirmLoading}
        error={confirmError}
        onCancel={closeConfirm}
        onConfirm={executeToggleActive}
      />
      <ConfirmModal
        open={confirmDialog === "delete"}
        title="Delete department"
        description={`Permanently delete “${d.name}”? This cannot be undone. Works only if no staff and no job postings use it.`}
        confirmLabel="Delete permanently"
        destructive
        loading={confirmLoading}
        error={confirmError}
        onCancel={closeConfirm}
        onConfirm={executeDelete}
      />
    </>
  );
}
