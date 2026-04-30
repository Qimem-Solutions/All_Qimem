"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  BedDouble,
  CheckCircle2,
  CircleAlert,
  Download,
  LayoutGrid,
  List,
  MoreVertical,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  UserX,
  Wrench,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { ListPagination } from "@/components/ui/list-pagination";
import { formatMoneyCents } from "@/lib/format";
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

function isInactiveRoom(op: string | null) {
  return (op ?? "").toLowerCase() === "inactive";
}

function formatRoomTypePrice(price: number | null) {
  if (price == null) return "—";
  return formatMoneyCents(Math.round(price * 100));
}

function RoomStatusStat({
  label,
  value,
  helper,
  dotClassName,
  icon,
}: {
  label: string;
  value: number;
  helper: string;
  dotClassName: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
            <span className={cn("h-2 w-2 shrink-0 rounded-full", dotClassName)} aria-hidden />
            {label}
          </div>
          <p className="mt-3 text-3xl font-semibold tabular-nums leading-none text-foreground">{value}</p>
          <p className="mt-2 text-sm text-muted">{helper}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-2.5 text-muted">{icon}</div>
      </div>
    </div>
  );
}

function HousekeepingSelect({
  roomId,
  value,
  operationalStatus,
  canManage,
  onUpdated,
  compact,
}: {
  roomId: string;
  value: string | null;
  operationalStatus: string | null;
  canManage: boolean;
  onUpdated: () => void;
  /** Table row: single-line control without extra label block */
  compact?: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const v = hkValueForSelect(value);
  const inactive = isInactiveRoom(operationalStatus);

  if (inactive) {
    if (compact) {
      return <span className="text-muted">Inactive</span>;
    }
    return (
      <div className="mt-3">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">Housekeeping</p>
        <p className="text-sm text-muted">Inactive rooms are excluded from housekeeping.</p>
      </div>
    );
  }

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
        setSaveErr(null);
        setSaving(true);
        const res = await setRoomHousekeepingStatusAction({ id: roomId, housekeepingStatus: next });
        setSaving(false);
        if (!res.ok) {
          setSaveErr(res.error);
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
    return (
      <div className="min-w-0">
        {control}
        {saveErr ? <p className="mt-1 max-w-[14rem] text-xs text-red-400">{saveErr}</p> : null}
      </div>
    );
  }

  return (
    <div className="mt-3">
      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted">
        Housekeeping
      </label>
      {control}
      {saveErr ? <p className="mt-1 text-xs text-red-400">{saveErr}</p> : null}
    </div>
  );
}

function statusDotClass(hk: string | null, op: string | null) {
  const o = (op ?? "").toLowerCase();
  if (o === "out_of_order" || o === "maintenance") return "bg-red-500";
  if (o === "inactive") return "bg-zinc-500";
  if (o === "occupied") return "bg-amber-500";
  const h = (hk ?? "clean").toLowerCase();
  if (h === "dirty") return "bg-gold";
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
  const [roomPage, setRoomPage] = useState(1);
  const [roomPageSize, setRoomPageSize] = useState(12);

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

  const roomTotalPages = Math.max(1, Math.ceil(filtered.length / roomPageSize));
  const roomPageSafe = Math.min(Math.max(1, roomPage), roomTotalPages);
  const roomOffset = (roomPageSafe - 1) * roomPageSize;
  const pagedRooms = useMemo(
    () => filtered.slice(roomOffset, roomOffset + roomPageSize),
    [filtered, roomOffset, roomPageSize],
  );

  const hkCounts: Record<string, number> = {};
  let available = 0;
  let ooo = 0;
  let occ = 0;
  for (const r of filtered) {
    if (isInactiveRoom(r.operational_status)) {
      continue;
    }
    const h = (r.housekeeping_status ?? "unknown").toLowerCase();
    hkCounts[h] = (hkCounts[h] ?? 0) + 1;
    const o = (r.operational_status ?? "").toLowerCase();
    if (o === "available") available += 1;
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
        <p className="rounded-lg border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-800 dark:text-red-200">
          {loadError}
        </p>
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
                onChange={(e) => {
                  setSearch(e.target.value);
                  setRoomPage(1);
                }}
              />
              <select
                className="flex h-10 rounded-lg border border-border bg-surface px-3 text-sm text-foreground"
                value={floorQ}
                onChange={(e) => {
                  setFloorQ(e.target.value);
                  setRoomPage(1);
                }}
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
                onChange={(e) => {
                  setBuildingQ(e.target.value);
                  setRoomPage(1);
                }}
              >
                <option value="all">All buildings</option>
                {buildings.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="flex rounded-lg border border-border p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setView("grid");
                    setRoomPage(1);
                  }}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium",
                    view === "grid" ? "bg-gold text-gold-foreground" : "text-muted",
                  )}
                >
                  <LayoutGrid className="h-3.5 w-3.5" /> Grid
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setView("list");
                    setRoomPage(1);
                  }}
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
            rooms={pagedRooms}
            allCount={rooms.length}
            filteredCount={filtered.length}
            roomTypes={roomTypes}
            canManage={canManage}
            onRefresh={() => router.refresh()}
            statusDotClass={statusDotClass}
            hkCounts={hkCounts}
            available={available}
            ooo={ooo}
            occ={occ}
            pagination={
              <ListPagination
                itemLabel="rooms"
                totalItems={rooms.length}
                filteredItems={filtered.length}
                page={roomPageSafe}
                pageSize={roomPageSize}
                totalPages={roomTotalPages}
                onPageChange={setRoomPage}
                onPageSizeChange={(next) => {
                  setRoomPageSize(next);
                  setRoomPage(1);
                }}
                pageSizeOptions={[5, 10, 20, 50]}
              />
            }
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
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [name, setName] = useState("");
  const [cap, setCap] = useState("");
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pendingDeleteType, setPendingDeleteType] = useState<RoomTypeRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteConfirmErr, setDeleteConfirmErr] = useState<string | null>(null);

  function openNew() {
    setEditing(null);
    setName("");
    setCap("2");
    setPrice("");
    setErr(null);
    setOpen(true);
  }
  function openEdit(t: RoomTypeRow) {
    setEditing(t);
    setName(t.name);
    setCap(t.capacity != null ? String(t.capacity) : "2");
    setPrice(t.price != null ? String(t.price) : "");
    setErr(null);
    setOpen(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const c = cap.trim() ? Number.parseInt(cap, 10) : 2;
    const p = price.trim() ? Number.parseFloat(price) : null;
    if (!Number.isFinite(c) || c < 1) {
      setLoading(false);
      setErr("Enter a valid capacity (1–20).");
      return;
    }
    if (p != null && (!Number.isFinite(p) || p < 0)) {
      setLoading(false);
      setErr("Enter a valid room price.");
      return;
    }
    const r = editing
      ? await updateRoomTypeAction({ id: editing.id, name, capacity: c, price: p })
      : await createRoomTypeAction({ name, capacity: c, price: p });
    setLoading(false);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    setOpen(false);
    onRefresh();
  }

  function requestDeleteType(t: RoomTypeRow) {
    if (!canManage) return;
    setDeleteConfirmErr(null);
    setPendingDeleteType(t);
  }

  async function executeDeleteRoomType() {
    if (!pendingDeleteType) return;
    setDeleteLoading(true);
    setDeleteConfirmErr(null);
    const r = await deleteRoomTypeAction(pendingDeleteType.id);
    setDeleteLoading(false);
    if (!r.ok) {
      setDeleteConfirmErr(r.error);
      return;
    }
    const id = pendingDeleteType.id;
    setPendingDeleteType(null);
    onTypesChange(roomTypes.filter((x) => x.id !== id));
    onRefresh();
  }

  function closeDeleteConfirm() {
    if (deleteLoading) return;
    setPendingDeleteType(null);
    setDeleteConfirmErr(null);
  }

  const filteredRoomTypes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roomTypes;
    return roomTypes.filter((type) => {
      const blob = [type.name, String(type.capacity ?? ""), String(type.price ?? "")]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [roomTypes, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRoomTypes.length / pageSize));
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const offset = (pageSafe - 1) * pageSize;
  const pagedRoomTypes = useMemo(
    () => filteredRoomTypes.slice(offset, offset + pageSize),
    [filteredRoomTypes, offset, pageSize],
  );

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
      <div className="flex w-full max-w-md">
        <Input
          placeholder="Search room type, capacity, or price…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          aria-label="Search room types"
        />
      </div>
      {err && !open ? <p className="text-sm text-red-400">{err}</p> : null}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wider text-muted">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Base price</th>
              <th className="px-4 py-3 font-medium">Default capacity</th>
              <th className="w-32 px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRoomTypes.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted">
                  {roomTypes.length === 0
                    ? `No room types yet. ${canManage ? "Add one, then add rooms in the other tab." : ""}`
                    : "No room types match your search."}
                </td>
              </tr>
            ) : (
              pagedRoomTypes.map((t) => (
                <tr key={t.id} className="border-b border-border/60">
                  <td className="px-4 py-3 font-medium text-foreground">{t.name}</td>
                  <td className="px-4 py-3 text-muted">{formatRoomTypePrice(t.price)}</td>
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
                          onClick={() => requestDeleteType(t)}
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
      <ListPagination
        itemLabel="room types"
        totalItems={roomTypes.length}
        filteredItems={filteredRoomTypes.length}
        page={pageSafe}
        pageSize={pageSize}
        totalPages={totalPages}
        onPageChange={setPage}
        onPageSizeChange={(next) => {
          setPageSize(next);
          setPage(1);
        }}
      />

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
                <label className="mt-3 block text-xs font-medium text-muted">Base price</label>
                <Input
                  className="mt-1"
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
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

      <ConfirmModal
        open={pendingDeleteType != null}
        title="Delete room type"
        description={
          pendingDeleteType
            ? `Delete room type “${pendingDeleteType.name}”? This cannot be undone if no rooms depend on it.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        loading={deleteLoading}
        error={deleteConfirmErr}
        onCancel={closeDeleteConfirm}
        onConfirm={executeDeleteRoomType}
      />
    </div>
  );
}

function RoomsPanel({
  view,
  rooms,
  allCount,
  filteredCount,
  roomTypes,
  canManage,
  onRefresh,
  statusDotClass,
  hkCounts,
  available,
  ooo,
  occ,
  pagination,
}: {
  view: "grid" | "list";
  rooms: RoomInventoryRow[];
  allCount: number;
  filteredCount: number;
  roomTypes: RoomTypeRow[];
  canManage: boolean;
  onRefresh: () => void;
  statusDotClass: (h: string | null, o: string | null) => string;
  hkCounts: Record<string, number>;
  available: number;
  ooo: number;
  occ: number;
  pagination: ReactNode;
}) {
  const [modal, setModal] = useState<"new" | { edit: RoomInventoryRow } | null>(null);
  const visibleCountLabel = `Showing ${filteredCount} of ${allCount} room${allCount === 1 ? "" : "s"}`;

  return (
    <>
      <Card className="overflow-hidden p-0">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Room snapshot</p>
            <h2 className="mt-1 text-lg font-semibold text-foreground [font-family:var(--font-outfit),system-ui,sans-serif]">
              Operational overview
            </h2>
            <p className="mt-1 text-sm text-muted">Housekeeping and occupancy across rooms (respects filters above).</p>
          </div>
          <div className="rounded-full border border-border bg-muted/30 px-3 py-1.5 text-sm text-muted">
            {visibleCountLabel}
          </div>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-5">
          <RoomStatusStat
            label="Available"
            value={available}
            helper="Open for assignment"
            dotClassName="bg-emerald-500"
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
          <RoomStatusStat
            label="Clean"
            value={hkCounts.clean ?? 0}
            helper="Housekeeping complete"
            dotClassName="bg-emerald-600 dark:bg-emerald-400"
            icon={<Sparkles className="h-5 w-5" />}
          />
          <RoomStatusStat
            label="Dirty"
            value={hkCounts.dirty ?? 0}
            helper="Needs housekeeping"
            dotClassName="bg-gold"
            icon={<CircleAlert className="h-5 w-5" />}
          />
          <RoomStatusStat
            label="Occupied"
            value={occ}
            helper="Currently in use"
            dotClassName="bg-amber-500"
            icon={<BedDouble className="h-5 w-5" />}
          />
          <RoomStatusStat
            label="Out of Order / Maintenance"
            value={ooo}
            helper="Temporarily unavailable"
            dotClassName="bg-red-500"
            icon={<Wrench className="h-5 w-5" />}
          />
        </div>
      </Card>

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
                      operationalStatus={r.operational_status}
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

      {pagination}

      {modal && canManage ? (
        <RoomFormModal
          key={modal === "new" ? "new-room" : modal.edit.id}
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
  const [roomConfirm, setRoomConfirm] = useState<"inactive" | "delete" | null>(null);
  const [roomActionLoading, setRoomActionLoading] = useState(false);
  const [roomActionErr, setRoomActionErr] = useState<string | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      const n = e.target as Node;
      if (wrapRef.current?.contains(n) || menuRef.current?.contains(n)) return;
      setMenuStyle(undefined);
      setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const roomIsInactive = isInactiveRoom(r.operational_status);

  function requestToggleInactive() {
    setRoomActionErr(null);
    setMenuOpen(false);
    setRoomConfirm("inactive");
  }

  async function executeRoomInactive() {
    setRoomActionLoading(true);
    setRoomActionErr(null);
    const res = await setRoomOperationalStatusAction({
      id: r.id,
      operationalStatus: roomIsInactive ? "available" : "inactive",
    });
    setRoomActionLoading(false);
    if (!res.ok) {
      setRoomActionErr(res.error);
      return;
    }
    setRoomConfirm(null);
    onRefresh();
  }

  function requestDeleteRoom() {
    setRoomActionErr(null);
    setMenuOpen(false);
    setRoomConfirm("delete");
  }

  async function executeRoomDelete() {
    setRoomActionLoading(true);
    setRoomActionErr(null);
    const res = await deleteRoomAction(r.id);
    setRoomActionLoading(false);
    if (!res.ok) {
      setRoomActionErr(res.error);
      return;
    }
    setRoomConfirm(null);
    onRefresh();
  }

  function closeRoomConfirm() {
    if (roomActionLoading) return;
    setRoomConfirm(null);
    setRoomActionErr(null);
  }

  return (
    <>
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
                setMenuStyle(undefined);
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
                  <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-foreground/5" onClick={requestToggleInactive}>
                    <UserX className="h-4 w-4" /> {roomIsInactive ? "Mark active" : "Mark inactive"}
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-500 hover:bg-foreground/5"
                    onClick={requestDeleteRoom}
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
          operationalStatus={r.operational_status}
          canManage={canManage}
          onUpdated={onRefresh}
        />
        <p className="mt-2 text-[10px] text-muted">
          <span className="font-semibold uppercase tracking-wider">Operational</span>{" "}
          <span className="font-normal normal-case">{operationalOnlyLabel(r.operational_status)}</span>
        </p>
      </CardContent>
    </Card>

      <ConfirmModal
        open={roomConfirm === "inactive"}
        title={roomIsInactive ? "Mark room active" : "Mark room inactive"}
        description={
          roomIsInactive
            ? `Mark room ${r.room_number} active again?`
            : `Mark room ${r.room_number} as inactive?`
        }
        confirmLabel={roomIsInactive ? "Mark active" : "Mark inactive"}
        destructive={!roomIsInactive}
        loading={roomActionLoading}
        error={roomActionErr}
        onCancel={closeRoomConfirm}
        onConfirm={executeRoomInactive}
      />
      <ConfirmModal
        open={roomConfirm === "delete"}
        title="Delete room"
        description={`Delete room ${r.room_number}? This cannot be undone.`}
        confirmLabel="Delete room"
        destructive
        loading={roomActionLoading}
        error={roomActionErr}
        onCancel={closeRoomConfirm}
        onConfirm={executeRoomDelete}
      />
    </>
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
  const inactive = isInactiveRoom(op);

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
              disabled={inactive}
              onChange={(e) => setHk(e.target.value)}
            >
              {HK_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {inactive ? <p className="mt-1 text-xs text-muted">Inactive rooms do not carry a housekeeping status.</p> : null}
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
