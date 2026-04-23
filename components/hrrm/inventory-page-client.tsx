"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Download,
  Filter,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  UserX,
  LayoutGrid,
  List,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getFloatingMenuStyle } from "@/components/hotel/floating-menu-position";
import type { RoomInventoryRow, RoomTypeRow } from "@/lib/queries/hrrm-inventory";
import {
  createRoomAction,
  createRoomTypeAction,
  deleteRoomAction,
  deleteRoomTypeAction,
  setRoomHousekeepingStatusAction,
  setRoomOperationalStatusAction,
  updateRoomAction,
  updateRoomTypeAction,
} from "@/lib/actions/hrrm-inventory";

const HK_OPTIONS = [
  { value: "clean", label: "Clean" },
  { value: "dirty", label: "Dirty" },
  { value: "inspected", label: "Inspected" },
] as const;
const OP_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "occupied", label: "Occupied" },
  { value: "out_of_order", label: "Out of order" },
  { value: "maintenance", label: "Maintenance" },
  { value: "inactive", label: "Inactive" },
] as const;

function operationalOnlyLabel(op: string | null) {
  const o = (op ?? "available").toLowerCase();
  const hit = OP_OPTIONS.find((x) => x.value === o);
  return hit?.label ?? op ?? "—";
}

function hkValueForSelect(hk: string | null) {
  const h = (hk ?? "clean").toLowerCase();
  if (HK_OPTIONS.some((o) => o.value === h)) return h;
  return "clean";
}

function HousekeepingSelect({
  roomId,
  value,
  canManage,
  onUpdated,
  compact,
}: {
  roomId: string;
  value: string | null;
  canManage: boolean;
  onUpdated: () => void;
  /** Table row: single-line control without extra label block */
  compact?: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const v = hkValueForSelect(value);

  if (!canManage) {
    const label = HK_OPTIONS.find((x) => x.value === v)?.label ?? (value || "—");
    if (compact) {
      return <span className="text-muted">{label}</span>;
    }
    return (
      <div className="mt-3">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">Housekeeping</p>
        <p className="text-sm text-muted">{label}</p>
      </div>
    );
  }

  const control = (
    <select
      className={cn(
        "rounded-md border border-border bg-surface text-sm text-foreground",
        compact ? "min-w-[7.5rem] max-w-full px-2 py-1" : "w-full px-2 py-1.5",
      )}
      aria-label="Housekeeping status"
      value={v}
      disabled={saving}
      onClick={(e) => e.stopPropagation()}
      onChange={async (e) => {
        const next = e.target.value;
        setSaving(true);
        const res = await setRoomHousekeepingStatusAction({ id: roomId, housekeepingStatus: next });
        setSaving(false);
        if (!res.ok) {
          alert(res.error);
          return;
        }
        onUpdated();
      }}
    >
      {HK_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );

  if (compact) {
    return control;
  }

  return (
    <div className="mt-3">
      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted">
        Housekeeping
      </label>
      {control}
    </div>
  );
}

function statusDotClass(hk: string | null, op: string | null) {
  const o = (op ?? "").toLowerCase();
  if (o === "out_of_order" || o === "maintenance") return "bg-red-500";
  if (o === "inactive") return "bg-zinc-500";
  if (o === "occupied") return "bg-amber-500";
  const h = (hk ?? "clean").toLowerCase();
  if (h === "dirty") return "bg-blue-500";
  return "bg-emerald-500";
}

type TabId = "rooms" | "types";

export function HrrmInventoryPageClient({
  initialRooms,
  initialRoomTypes,
  loadError,
  canManage,
}: {
  initialRooms: RoomInventoryRow[];
  initialRoomTypes: RoomTypeRow[];
  loadError: string | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("rooms");
  const [rooms, setRooms] = useState(initialRooms);
  const [roomTypes, setRoomTypes] = useState(initialRoomTypes);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [floorQ, setFloorQ] = useState("");
  const [buildingQ, setBuildingQ] = useState("all");

  useEffect(() => {
    setRooms(initialRooms);
  }, [initialRooms]);
  useEffect(() => {
    setRoomTypes(initialRoomTypes);
  }, [initialRoomTypes]);

  const floors = useMemo(() => {
    const s = new Set<string>();
    for (const r of rooms) {
      if (r.floor?.trim()) s.add(r.floor.trim());
    }
    return [...s].sort();
  }, [rooms]);

  const buildings = useMemo(() => {
    const s = new Set<string>();
    for (const r of rooms) {
      if (r.building?.trim()) s.add(r.building.trim());
    }
    return [...s].sort();
  }, [rooms]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rooms.filter((r) => {
      if (buildingQ !== "all" && (r.building?.trim() || "") !== buildingQ) return false;
      if (floorQ && (r.floor?.trim() || "") !== floorQ) return false;
      if (!q) return true;
      const blob = [r.room_number, r.floor, r.building, r.room_type_name, r.operational_status, r.housekeeping_status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [rooms, search, floorQ, buildingQ]);

  const hkCounts: Record<string, number> = {};
  let ooo = 0;
  let occ = 0;
  for (const r of rooms) {
    const h = (r.housekeeping_status ?? "unknown").toLowerCase();
    hkCounts[h] = (hkCounts[h] ?? 0) + 1;
    const o = (r.operational_status ?? "").toLowerCase();
    if (o === "out_of_order" || o === "maintenance") ooo += 1;
    if (o === "occupied") occ += 1;
  }

  const exportCsv = useCallback(() => {
    const headers = [
      "room_number",
      "floor",
      "building",
      "room_type",
      "housekeeping",
      "operational",
    ];
    const lines = [headers.join(",")].concat(
      filtered.map((r) =>
        [r.room_number, r.floor ?? "", r.building ?? "", r.room_type_name ?? "", r.housekeeping_status ?? "", r.operational_status ?? ""]
          .map((c) => `"${String(c).replace(/"/g, '""')}"`)
          .join(","),
      ),
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "rooms-inventory.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs text-muted">Inventory</p>
          <h1 className="text-2xl font-semibold text-foreground [font-family:var(--font-outfit),system-ui,sans-serif]">
            Property inventory
          </h1>
          <p className="mt-1 text-sm text-muted">
            Room types for rates and reports, and physical keys / doors as rooms. Manage access:{" "}
            {canManage ? (
              <span className="text-emerald-600 dark:text-emerald-400">edit enabled</span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400">view only</span>
            )}
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-lg border border-border p-0.5">
            <button
              type="button"
              onClick={() => setTab("rooms")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                tab === "rooms" ? "bg-gold text-gold-foreground" : "text-muted hover:text-foreground",
              )}
            >
              Physical rooms
            </button>
            <button
              type="button"
              onClick={() => setTab("types")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                tab === "types" ? "bg-gold text-gold-foreground" : "text-muted hover:text-foreground",
              )}
            >
              Room types
            </button>
          </div>
        </div>
      </div>

      {loadError ? (
        <p className="rounded-lg border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-200">{loadError}</p>
      ) : null}

      {tab === "types" ? (
        <RoomTypesPanel
          roomTypes={roomTypes}
          canManage={canManage}
          onTypesChange={setRoomTypes}
          onRefresh={() => router.refresh()}
        />
      ) : (
        <>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <Input
                placeholder="Search room, type, or floor…"
                className="max-w-md flex-1"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="flex h-10 rounded-lg border border-border bg-surface px-3 text-sm text-foreground"
                value={floorQ}
                onChange={(e) => setFloorQ(e.target.value)}
              >
                <option value="">All floors</option>
                {floors.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <select
                className="flex h-10 min-w-[9rem] rounded-lg border border-border bg-surface px-3 text-sm text-foreground"
                value={buildingQ}
                onChange={(e) => setBuildingQ(e.target.value)}
              >
                <option value="all">All buildings</option>
                {buildings.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              <span className="text-muted" title="Refine the grid">
                <Filter className="h-4 w-4" />
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="flex rounded-lg border border-border p-0.5">
                <button
                  type="button"
                  onClick={() => setView("grid")}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium",
                    view === "grid" ? "bg-gold text-gold-foreground" : "text-muted",
                  )}
                >
                  <LayoutGrid className="h-3.5 w-3.5" /> Grid
                </button>
                <button
                  type="button"
                  onClick={() => setView("list")}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium",
                    view === "list" ? "bg-gold text-gold-foreground" : "text-muted",
                  )}
                >
                  <List className="h-3.5 w-3.5" /> List
                </button>
              </div>
              <Button variant="secondary" className="gap-2" type="button" onClick={exportCsv}>
                <Download className="h-4 w-4" /> Export
              </Button>
            </div>
          </div>

          <RoomsPanel
            view={view}
            rooms={filtered}
            allCount={rooms.length}
            roomTypes={roomTypes}
            canManage={canManage}
            onRefresh={() => router.refresh()}
            statusDotClass={statusDotClass}
            hkCounts={hkCounts}
            ooo={ooo}
            occ={occ}
          />
        </>
      )}
    </div>
  );
}

function RoomTypesPanel({
  roomTypes,
  canManage,
  onTypesChange,
  onRefresh,
}: {
  roomTypes: RoomTypeRow[];
  canManage: boolean;
  onTypesChange: (r: RoomTypeRow[]) => void;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RoomTypeRow | null>(null);
  const [name, setName] = useState("");
  const [cap, setCap] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function openNew() {
    setEditing(null);
    setName("");
    setCap("2");
    setErr(null);
    setOpen(true);
  }
  function openEdit(t: RoomTypeRow) {
    setEditing(t);
    setName(t.name);
    setCap(t.capacity != null ? String(t.capacity) : "2");
    setErr(null);
    setOpen(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const c = cap.trim() ? Number.parseInt(cap, 10) : 2;
    if (!Number.isFinite(c) || c < 1) {
      setLoading(false);
      setErr("Enter a valid capacity (1–20).");
      return;
    }
    const r = editing
      ? await updateRoomTypeAction({ id: editing.id, name, capacity: c })
      : await createRoomTypeAction({ name, capacity: c });
    setLoading(false);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    setOpen(false);
    onRefresh();
  }

  async function onDelete(t: RoomTypeRow) {
    if (!canManage) return;
    if (!confirm(`Delete room type “${t.name}”?`)) return;
    const r = await deleteRoomTypeAction(t.id);
    if (!r.ok) {
      alert(r.error);
      return;
    }
    onTypesChange(roomTypes.filter((x) => x.id !== t.id));
    onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted">Define product categories (Standard, Suite, etc.) used when assigning physical rooms and rate plans.</p>
        {canManage ? (
          <Button type="button" onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" /> Add room type
          </Button>
        ) : null}
      </div>
      {err && !open ? <p className="text-sm text-red-400">{err}</p> : null}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wider text-muted">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Default capacity</th>
              <th className="w-32 px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {roomTypes.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-muted">
                  No room types yet. {canManage ? "Add one, then add rooms in the other tab." : ""}
                </td>
              </tr>
            ) : (
              roomTypes.map((t) => (
                <tr key={t.id} className="border-b border-border/60">
                  <td className="px-4 py-3 font-medium text-foreground">{t.name}</td>
                  <td className="px-4 py-3 text-muted">{t.capacity ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {canManage ? (
                      <div className="flex justify-end gap-1">
                        <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(t)}>
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-red-500"
                          onClick={() => void onDelete(t)}
                        >
                          Delete
                        </Button>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {open && canManage
        ? createPortal(
            <div
              className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/60 p-4"
              role="dialog"
              aria-modal="true"
              onClick={() => setOpen(false)}
            >
              <form
                onSubmit={(e) => void onSubmit(e)}
                className="relative w-full max-w-md rounded-xl border border-border bg-surface-elevated p-6 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-lg font-semibold text-foreground">
                  {editing ? "Edit room type" : "New room type"}
                </h2>
                {err ? <p className="mt-2 text-sm text-red-400">{err}</p> : null}
                <label className="mt-4 block text-xs font-medium text-muted">Name</label>
                <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} required />
                <label className="mt-3 block text-xs font-medium text-muted">Default max guests (capacity)</label>
                <Input className="mt-1" type="number" min={1} max={20} value={cap} onChange={(e) => setCap(e.target.value)} />
                <div className="mt-6 flex justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
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
    </div>
  );
}

function RoomsPanel({
  view,
  rooms,
  allCount,
  roomTypes,
  canManage,
  onRefresh,
  statusDotClass,
  hkCounts,
  ooo,
  occ,
}: {
  view: "grid" | "list";
  rooms: RoomInventoryRow[];
  allCount: number;
  roomTypes: RoomTypeRow[];
  canManage: boolean;
  onRefresh: () => void;
  statusDotClass: (h: string | null, o: string | null) => string;
  hkCounts: Record<string, number>;
  ooo: number;
  occ: number;
}) {
  const [modal, setModal] = useState<"new" | { edit: RoomInventoryRow } | null>(null);

  return (
    <>
      {view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rooms.map((r) => (
            <RoomCard
              key={r.id}
              room={r}
              canManage={canManage}
              onEdit={() => setModal({ edit: r })}
              onRefresh={onRefresh}
            />
          ))}
          {canManage ? (
            <button
              type="button"
              onClick={() => setModal("new")}
              className="flex min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-gold/40 bg-gold/5 text-gold transition-colors hover:bg-gold/10"
            >
              <Plus className="mb-2 h-10 w-10" />
              <span className="text-sm font-medium">Add physical room</span>
            </button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2">
          {canManage ? (
            <div className="flex justify-end">
              <Button type="button" onClick={() => setModal("new")} className="gap-2">
                <Plus className="h-4 w-4" /> Add room
              </Button>
            </div>
          ) : null}
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase text-muted">
                <th className="px-4 py-3 font-medium">Room</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Floor / building</th>
                <th className="px-4 py-3 font-medium">Housekeeping</th>
                <th className="px-4 py-3 font-medium">Operational</th>
                <th className="w-20 px-4 py-3 text-right font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.id} className="border-b border-border/60">
                  <td className="px-4 py-3 font-medium text-foreground">{r.room_number}</td>
                  <td className="px-4 py-3 text-muted">{r.room_type_name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">
                    {r.floor ?? "—"} · {r.building ?? "—"}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <HousekeepingSelect
                      roomId={r.id}
                      value={r.housekeeping_status}
                      canManage={canManage}
                      onUpdated={onRefresh}
                      compact
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2 text-muted">
                      <span
                        className={cn("h-2 w-2 shrink-0 rounded-full", statusDotClass(r.housekeeping_status, r.operational_status))}
                      />
                      {operationalOnlyLabel(r.operational_status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canManage ? (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setModal({ edit: r })}>
                        Edit
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-muted">
        <div className="flex flex-wrap gap-4">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> {hkCounts.clean ?? 0} clean
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-blue-500" /> {hkCounts.dirty ?? 0} dirty
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-500" /> {occ} occupied
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-500" /> {ooo} out of order / maintenance
          </span>
        </div>
        <span>
          Showing {rooms.length} of {allCount} room{allCount === 1 ? "" : "s"}
        </span>
      </div>

      {modal && canManage ? (
        <RoomFormModal
          mode={modal === "new" ? "new" : "edit"}
          room={modal === "new" ? null : modal.edit}
          roomTypes={roomTypes}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            onRefresh();
          }}
        />
      ) : null}
    </>
  );
}

function RoomCard({
  room: r,
  canManage,
  onEdit,
  onRefresh,
}: {
  room: RoomInventoryRow;
  canManage: boolean;
  onEdit: () => void;
  onRefresh: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>();
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) {
      setMenuStyle(undefined);
      return;
    }
    const t = triggerRef.current;
    if (t) setMenuStyle(getFloatingMenuStyle(t, 120));
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      const n = e.target as Node;
      if (wrapRef.current?.contains(n) || menuRef.current?.contains(n)) return;
      setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  async function setInactive() {
    setMenuOpen(false);
    if (!confirm(`Mark room ${r.room_number} as inactive?`)) return;
    const res = await setRoomOperationalStatusAction({ id: r.id, operationalStatus: "inactive" });
    if (!res.ok) alert(res.error);
    else onRefresh();
  }
  async function onDelete() {
    setMenuOpen(false);
    if (!confirm(`Delete room ${r.room_number}?`)) return;
    const res = await deleteRoomAction(r.id);
    if (!res.ok) alert(res.error);
    else onRefresh();
  }

  return (
    <Card className="relative overflow-hidden transition-colors">
      {canManage ? (
        <div className="absolute right-2 top-2 z-20" ref={wrapRef}>
          <button
            ref={triggerRef}
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface/90 text-muted hover:text-foreground"
            aria-label="Room actions"
            onClick={() => {
              if (menuOpen) {
                setMenuOpen(false);
                return;
              }
              if (triggerRef.current) setMenuStyle(getFloatingMenuStyle(triggerRef.current, 120));
              setMenuOpen(true);
            }}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {typeof document !== "undefined" && menuOpen && menuStyle
            ? createPortal(
                <div
                  ref={menuRef}
                  role="menu"
                  className="rounded-lg border border-border bg-surface-elevated py-1 text-foreground shadow-lg"
                  style={menuStyle}
                >
                  <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-foreground/5" onClick={() => { setMenuOpen(false); onEdit(); }}>
                    <Pencil className="h-4 w-4" /> Edit
                  </button>
                  <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-foreground/5" onClick={() => void setInactive()}>
                    <UserX className="h-4 w-4" /> Mark inactive
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-500 hover:bg-foreground/5"
                    onClick={() => void onDelete()}
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                </div>,
                document.body,
              )
            : null}
        </div>
      ) : null}
      <span
        className={cn(
          "absolute top-3 h-2.5 w-2.5 rounded-full",
          canManage ? "right-12" : "right-3",
          statusDotClass(r.housekeeping_status, r.operational_status),
        )}
      />
      <CardHeader className="pb-2 pr-10">
        <CardTitle className="text-2xl text-foreground">{r.room_number}</CardTitle>
        <p className="text-[10px] uppercase tracking-wider text-muted">
          {r.floor ?? "—"} · {r.building ?? "—"}
        </p>
      </CardHeader>
      <CardContent>
        <div className="rounded border border-border px-2 py-1 text-center text-xs text-foreground/90">
          {r.room_type_name ?? "Unassigned type"}
        </div>
        <HousekeepingSelect
          roomId={r.id}
          value={r.housekeeping_status}
          canManage={canManage}
          onUpdated={onRefresh}
        />
        <p className="mt-2 text-[10px] text-muted">
          <span className="font-semibold uppercase tracking-wider">Operational</span>{" "}
          <span className="font-normal normal-case">{operationalOnlyLabel(r.operational_status)}</span>
        </p>
      </CardContent>
    </Card>
  );
}

function RoomFormModal({
  mode,
  room,
  roomTypes,
  onClose,
  onSaved,
}: {
  mode: "new" | "edit";
  room: RoomInventoryRow | null;
  roomTypes: RoomTypeRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [roomNumber, setRoomNumber] = useState(room?.room_number ?? "");
  const [typeId, setTypeId] = useState(room?.room_type_id ?? "");
  const [floor, setFloor] = useState(room?.floor ?? "");
  const [building, setBuilding] = useState(room?.building ?? "");
  const [hk, setHk] = useState((room?.housekeeping_status as string) ?? "clean");
  const [op, setOp] = useState((room?.operational_status as string) ?? "available");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (room) {
      setRoomNumber(room.room_number);
      setTypeId(room.room_type_id ?? "");
      setFloor(room.floor ?? "");
      setBuilding(room.building ?? "");
      setHk(room.housekeeping_status ?? "clean");
      setOp(room.operational_status ?? "available");
    }
  }, [room]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const type = typeId || null;
    if (mode === "new") {
      const r = await createRoomAction({
        roomNumber,
        roomTypeId: type,
        floor: floor || null,
        building: building || null,
        housekeepingStatus: hk,
        operationalStatus: op,
      });
      setLoading(false);
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      onSaved();
      return;
    }
    if (!room) return;
    const r = await updateRoomAction({
      id: room.id,
      roomNumber,
      roomTypeId: type,
      floor: floor || null,
      building: building || null,
      housekeepingStatus: hk,
      operationalStatus: op,
    });
    setLoading(false);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    onSaved();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <form
        onSubmit={(e) => void onSubmit(e)}
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface-elevated p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-foreground">{mode === "new" ? "Add room" : "Edit room"}</h2>
        {err ? <p className="mt-2 text-sm text-red-400">{err}</p> : null}
        <label className="mt-4 block text-xs font-medium text-muted">Room number / name</label>
        <Input className="mt-1" value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} required />
        <label className="mt-3 block text-xs font-medium text-muted">Room type</label>
        <select
          className="mt-1 flex h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
          value={typeId}
          onChange={(e) => setTypeId(e.target.value)}
        >
          <option value="">— Unassigned (assign later) —</option>
          {roomTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} (max {t.capacity ?? 2} guests)
            </option>
          ))}
        </select>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-muted">Floor</label>
            <Input className="mt-1" value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="e.g. 3" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted">Building / wing</label>
            <Input className="mt-1" value={building} onChange={(e) => setBuilding(e.target.value)} />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-muted">Housekeeping</label>
            <select
              className="mt-1 flex h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
              value={hk}
              onChange={(e) => setHk(e.target.value)}
            >
              {HK_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted">Operational</label>
            <select
              className="mt-1 flex h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
              value={op}
              onChange={(e) => setOp(e.target.value)}
            >
              {OP_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
