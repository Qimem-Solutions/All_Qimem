"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { MoreVertical, Pencil, Trash2, Ban, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getFloatingMenuStyle } from "@/components/hotel/floating-menu-position";
import type { AdminAssignmentRow } from "@/lib/queries/superadmin";
import {
  updateHotelAdminProfileAction,
  updateProvisionedAdminAction,
  setHotelAdminBannedAction,
  clearProvisionedHotelAdminAction,
  deleteHotelAdminProfileAction,
} from "@/app/superadmin/admins/actions";

const itemClass =
  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-foreground/5 dark:hover:bg-white/5 disabled:pointer-events-none disabled:opacity-40";

type TenantOption = { id: string; name: string; slug: string };

type Props = {
  row: AdminAssignmentRow;
  tenants: TenantOption[];
};

export function AdminRowActions({ row: r, tenants }: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<"delete" | "ban" | "clear" | "clearInactive" | null>(null);
  const [banWantInactive, setBanWantInactive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState(r.full_name ?? "");
  const [email, setEmail] = useState(r.admin_email ?? "");
  const [tenantId, setTenantId] = useState(r.tenant_id);

  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties | undefined>();

  const isProfile = r.source === "profile";
  const isBanned = !!(isProfile && r.auth_banned);

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
    if (!editOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setEditOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [editOpen]);

  useEffect(() => {
    if (!confirmDialog) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !confirmLoading) {
        setConfirmDialog(null);
        setError(null);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmDialog, confirmLoading]);

  function dialogKey() {
    return isProfile ? r.id : r.tenant_id;
  }

  function openEdit() {
    setFullName(r.full_name ?? "");
    setEmail(r.admin_email ?? "");
    setTenantId(r.tenant_id);
    setError(null);
    setMenuOpen(false);
    setEditOpen(true);
  }

  async function onSubmitEdit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    if (isProfile) {
      const res = await updateHotelAdminProfileAction({
        userId: r.id,
        fullName,
        email,
        tenantId,
      });
      setLoading(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
    } else {
      const res = await updateProvisionedAdminAction({
        tenantId: r.tenant_id,
        fullName,
        email,
      });
      setLoading(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
    }
    setEditOpen(false);
    router.refresh();
  }

  function onToggleBan() {
    setMenuOpen(false);
    setBanWantInactive(!isBanned);
    setError(null);
    setConfirmDialog("ban");
  }

  async function confirmBan() {
    if (!isProfile) return;
    setError(null);
    setConfirmLoading(true);
    const res = await setHotelAdminBannedAction({ userId: r.id, banned: banWantInactive });
    setConfirmLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setConfirmDialog(null);
    router.refresh();
  }

  function onDelete() {
    setMenuOpen(false);
    setError(null);
    setConfirmDialog(isProfile ? "delete" : "clear");
  }

  function onProvisionedMarkInactive() {
    setMenuOpen(false);
    setError(null);
    setConfirmDialog("clearInactive");
  }

  async function confirmDeleteProfile() {
    setError(null);
    setConfirmLoading(true);
    const res = await deleteHotelAdminProfileAction({ userId: r.id });
    setConfirmLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setConfirmDialog(null);
    router.refresh();
  }

  async function confirmClearProvisioned() {
    setError(null);
    setConfirmLoading(true);
    const res = await clearProvisionedHotelAdminAction({ tenantId: r.tenant_id });
    setConfirmLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setConfirmDialog(null);
    router.refresh();
  }

  function closeConfirmDialog() {
    if (confirmLoading) return;
    setConfirmDialog(null);
    setError(null);
  }

  return (
    <>
      <div className="flex flex-col items-end gap-1" ref={wrapRef}>
        <button
          ref={triggerRef}
          type="button"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-muted transition-colors hover:bg-foreground/5 hover:text-foreground dark:hover:bg-white/5"
          aria-label="Admin actions"
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
        {error && !editOpen && !confirmDialog ? (
          <p className="max-w-[10rem] text-right text-xs text-red-400">{error}</p>
        ) : null}
      </div>

      {typeof document !== "undefined" && menuOpen && menuStyle
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              className="rounded-lg border border-border bg-surface-elevated py-1 text-foreground shadow-lg ring-1 ring-[var(--ring-subtle,transparent)]"
              style={menuStyle}
            >
              <button type="button" role="menuitem" className={itemClass} onClick={openEdit}>
                <Pencil className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                Edit
              </button>
              {isProfile ? (
                <button type="button" role="menuitem" className={itemClass} onClick={() => void onToggleBan()}>
                  {isBanned ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                      Mark active
                    </>
                  ) : (
                    <>
                      <Ban className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                      Mark inactive
                    </>
                  )}
                </button>
              ) : (
                <button type="button" role="menuitem" className={itemClass} onClick={() => void onProvisionedMarkInactive()}>
                  <Ban className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  Mark inactive
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                className={cn(itemClass, "text-red-600 dark:text-red-400")}
                onClick={() => void onDelete()}
              >
                <Trash2 className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                Delete
              </button>
            </div>,
            document.body,
          )
        : null}

      {typeof document !== "undefined" && editOpen
        ? createPortal(
            <div
              className="fixed inset-0 isolate z-[10050] flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby={`adm-edit-title-${dialogKey()}`}
            >
              <button
                type="button"
                className="absolute inset-0 z-0 cursor-default bg-black/60"
                onClick={() => setEditOpen(false)}
                aria-label="Close"
              />
              <form
                onSubmit={(e) => void onSubmitEdit(e)}
                className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface-elevated p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 id={`adm-edit-title-${dialogKey()}`} className="text-lg font-semibold text-foreground">
                  {isProfile ? "Edit hotel admin" : "Edit pending invite"}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {isProfile
                    ? "Update name, login email, or assigned hotel."
                    : "Update the name and email stored on the hotel until an account signs up."}
                </p>
                {error ? (
                  <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
                    {error}
                  </p>
                ) : null}
                <div className="mt-4 space-y-3">
                  {isProfile ? (
                    <div>
                      <label className="text-xs font-medium text-muted" htmlFor={`adm-t-${dialogKey()}`}>
                        Hotel
                      </label>
                      <select
                        id={`adm-t-${dialogKey()}`}
                        className="mt-1.5 flex h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground"
                        value={tenantId}
                        onChange={(e) => setTenantId(e.target.value)}
                        required
                      >
                        {tenants.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.slug})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  <div>
                    <label className="text-xs font-medium text-muted" htmlFor={`adm-fn-${dialogKey()}`}>
                      Full name
                    </label>
                    <Input
                      id={`adm-fn-${dialogKey()}`}
                      className="mt-1.5"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted" htmlFor={`adm-em-${dialogKey()}`}>
                      {isProfile ? "Login email" : "Invite email"}
                    </label>
                    <Input
                      id={`adm-em-${dialogKey()}`}
                      type="email"
                      className="mt-1.5"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? "Saving…" : "Save"}
                  </Button>
                </div>
              </form>
            </div>,
            document.body,
          )
        : null}

      {typeof document !== "undefined" && confirmDialog
        ? createPortal(
            <div
              className="fixed inset-0 isolate z-[10060] flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby={`adm-confirm-title-${dialogKey()}`}
            >
              <button
                type="button"
                className="absolute inset-0 z-0 cursor-default bg-black/60"
                onClick={closeConfirmDialog}
                aria-label="Close"
              />
              <div
                className="relative z-10 w-full max-w-md rounded-xl border border-border bg-surface-elevated p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 id={`adm-confirm-title-${dialogKey()}`} className="text-lg font-semibold text-foreground">
                  {confirmDialog === "delete"
                    ? "Delete hotel admin"
                    : confirmDialog === "clear" || confirmDialog === "clearInactive"
                      ? confirmDialog === "clearInactive"
                        ? "Mark invite inactive"
                        : "Remove pending invite"
                      : "Login access"}
                </h2>
                <p className="mt-2 text-sm text-muted">
                  {confirmDialog === "delete"
                    ? `Permanently delete this admin account (${r.admin_email ?? r.full_name ?? r.id})? They will no longer be able to sign in. You cannot remove the last hotel administrator for a property.`
                    : confirmDialog === "clear" || confirmDialog === "clearInactive"
                      ? confirmDialog === "clearInactive"
                        ? `Clear the pending admin invite on “${r.tenant_name ?? "this hotel"}”? No login exists yet; you can add a new invite later.`
                        : `Remove the pending admin email from “${r.tenant_name ?? "this hotel"}”? You can add an invite again later from tenant provisioning or Create admin.`
                      : banWantInactive
                        ? `Mark this admin inactive? They will be blocked from signing in until marked active again.`
                        : `Restore sign-in for this admin?`}
                </p>
                {error ? (
                  <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
                    {error}
                  </p>
                ) : null}
                <div className="mt-6 flex justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={closeConfirmDialog}>
                    Cancel
                  </Button>
                  {confirmDialog === "delete" ? (
                    <Button
                      type="button"
                      className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500"
                      disabled={confirmLoading}
                      onClick={() => void confirmDeleteProfile()}
                    >
                      {confirmLoading ? "Deleting…" : "Delete permanently"}
                    </Button>
                  ) : confirmDialog === "clear" || confirmDialog === "clearInactive" ? (
                    <Button
                      type="button"
                      className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500"
                      disabled={confirmLoading}
                      onClick={() => void confirmClearProvisioned()}
                    >
                      {confirmLoading ? "Applying…" : confirmDialog === "clearInactive" ? "Clear invite" : "Remove invite"}
                    </Button>
                  ) : (
                    <Button type="button" disabled={confirmLoading} onClick={() => void confirmBan()}>
                      {confirmLoading ? "Applying…" : "Confirm"}
                    </Button>
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
