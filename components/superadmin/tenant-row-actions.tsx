"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { MoreVertical, Pencil, Trash2, Ban, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getFloatingMenuStyle } from "@/components/hotel/floating-menu-position";
import { ETHIOPIA_REGIONS } from "@/lib/tenant-onboarding-options";
import {
  updateTenantAction,
  deleteTenantAction,
  setTenantSubscriptionStatusAction,
} from "@/app/superadmin/tenants/actions";
import type { TenantRow } from "@/lib/queries/superadmin";

const itemClass =
  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-foreground/5 dark:hover:bg-white/5";

type Props = {
  row: TenantRow;
};

export function TenantRowActions({ row: t }: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(t.name);
  const [slug, setSlug] = useState(t.slug);
  const [region, setRegion] = useState(t.region ?? "");
  const [description, setDescription] = useState(t.description ?? "");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties | undefined>();

  const isSubActive = (t.subStatus ?? "").toLowerCase() === "active";

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
    if (!coverFile) {
      setCoverPreview(null);
      return;
    }
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  useEffect(() => {
    if (!editOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setEditOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [editOpen]);

  function openEdit() {
    setName(t.name);
    setSlug(t.slug);
    setRegion(t.region ?? "");
    setDescription(t.description ?? "");
    setCoverFile(null);
    setError(null);
    setMenuOpen(false);
    setEditOpen(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData();
    fd.set("tenantId", t.id);
    fd.set("name", name.trim());
    fd.set("slug", slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, ""));
    if (region) fd.set("region", region);
    fd.set("description", description.trim());
    if (coverFile) fd.set("coverImage", coverFile);
    const r = await updateTenantAction(fd);
    setLoading(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setEditOpen(false);
    router.refresh();
  }

  async function onToggleInactive() {
    setMenuOpen(false);
    const wantInactive = isSubActive;
    const label = t.name;
    if (
      !confirm(
        wantInactive
          ? `Mark "${label}" as inactive? Staff may lose access until re-activated.`
          : `Re-activate "${label}"? Subscription status will be set to active.`,
      )
    ) {
      return;
    }
    setError(null);
    const r = await setTenantSubscriptionStatusAction({
      tenantId: t.id,
      status: wantInactive ? "inactive" : "active",
    });
    if (!r.ok) {
      setError(r.error);
      return;
    }
    router.refresh();
  }

  async function onDelete() {
    setMenuOpen(false);
    if (
      !confirm(
        `Delete "${t.name}" permanently? This unlinks all users from this property and removes tenant data where the database allows. This cannot be undone.`,
      )
    ) {
      return;
    }
    setError(null);
    const r = await deleteTenantAction(t.id);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-col items-end gap-1" ref={wrapRef}>
        <button
          ref={triggerRef}
          type="button"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-muted transition-colors hover:bg-foreground/5 hover:text-foreground dark:hover:bg-white/5"
          aria-label="Tenant actions"
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
        {error ? <p className="max-w-[10rem] text-right text-xs text-red-400">{error}</p> : null}
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
              {t.plan != null && (
                <button
                  type="button"
                  role="menuitem"
                  className={itemClass}
                  onClick={() => {
                    void onToggleInactive();
                  }}
                >
                  {isSubActive ? (
                    <>
                      <Ban className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                      Mark inactive
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                      Mark active
                    </>
                  )}
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
              aria-labelledby={`t-dialog-title-${t.id}`}
            >
              <button
                type="button"
                className="absolute inset-0 z-0 cursor-default bg-black/60"
                onClick={() => setEditOpen(false)}
                aria-label="Close"
              />
              <form
                onSubmit={(e) => void onSubmit(e)}
                className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface-elevated p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 id={`t-dialog-title-${t.id}`} className="text-lg font-semibold text-foreground">
                  Edit tenant
                </h2>
                <p className="mt-1 text-sm text-muted">Update property details for {t.name}.</p>
                {error ? (
                  <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
                    {error}
                  </p>
                ) : null}
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted" htmlFor={`t-name-${t.id}`}>
                      Hotel name
                    </label>
                    <Input
                      id={`t-name-${t.id}`}
                      className="mt-1.5"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted" htmlFor={`t-slug-${t.id}`}>
                      Subdomain (slug)
                    </label>
                    <Input
                      id={`t-slug-${t.id}`}
                      className="mt-1.5 font-mono text-sm"
                      value={slug}
                      onChange={(e) =>
                        setSlug(
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9-]/g, "")
                            .replace(/-+/g, "-"),
                        )
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted" htmlFor={`t-reg-${t.id}`}>
                      Region in Ethiopia
                    </label>
                    <select
                      id={`t-reg-${t.id}`}
                      className="mt-1.5 flex h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground"
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                    >
                      <option value="">—</option>
                      {ETHIOPIA_REGIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted" htmlFor={`t-desc-${t.id}`}>
                      Description
                    </label>
                    <textarea
                      id={`t-desc-${t.id}`}
                      className="mt-1.5 min-h-[88px] w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      maxLength={4000}
                    />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted">Replace hotel image (optional)</p>
                    <p className="text-xs text-muted/80">JPEG, PNG, WebP, or GIF, max 3MB</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <label className="inline-flex cursor-pointer rounded-lg border border-dashed border-border px-3 py-2 text-xs text-foreground">
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="sr-only"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) setCoverFile(f);
                          }}
                        />
                        {coverFile ? "Replace file" : "Choose file"}
                      </label>
                      {t.cover_image_url && !coverPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={t.cover_image_url}
                          alt=""
                          className="h-10 w-14 rounded object-cover"
                        />
                      ) : null}
                    </div>
                    {coverPreview ? (
                      <div className="mt-2 max-h-32 overflow-hidden rounded-lg border border-border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={coverPreview} alt="" className="max-h-32 w-full object-cover" />
                      </div>
                    ) : null}
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
    </>
  );
}
