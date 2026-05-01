"use client";

import { useMemo, useState } from "react";
import { BedDouble } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ListPagination } from "@/components/ui/list-pagination";
import type { RoomInventoryRow, RoomTypeRow } from "@/lib/queries/hrrm-inventory";

type RoomPriceRow = RoomInventoryRow & {
  type: RoomTypeRow | null;
  basePrice: number | null;
};

function formatBirrCents(cents: number | null | undefined) {
  if (cents == null) return "—";
  const amount = cents / 100;
  const whole = Number.isInteger(amount);
  return `${new Intl.NumberFormat("en-ET", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount)} birr`;
}

function formatRoomPrice(price: number | null) {
  if (price == null) return "—";
  return formatBirrCents(Math.round(price * 100));
}

function SummaryCards({
  roomTypesCount,
  pricedTypes,
  roomCount,
  pricedRooms,
  avgTypePrice,
}: {
  roomTypesCount: number;
  pricedTypes: number;
  roomCount: number;
  pricedRooms: number;
  avgTypePrice: number | null;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-zinc-500">Room types</p>
          <p className="mt-2 text-2xl font-semibold text-white">{roomTypesCount}</p>
          <p className="mt-1 text-sm text-zinc-500">{pricedTypes} with price</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-zinc-500">Specific rooms</p>
          <p className="mt-2 text-2xl font-semibold text-white">{roomCount}</p>
          <p className="mt-1 text-sm text-zinc-500">{pricedRooms} priced</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-zinc-500">Average type price</p>
          <p className="mt-2 text-2xl font-semibold text-gold">{formatBirrCents(avgTypePrice)}</p>
          <p className="mt-1 text-sm text-zinc-500">Across priced types</p>
        </CardContent>
      </Card>
    </div>
  );
}

function RoomTypePricingSection({
  roomTypes,
  pricedTypes,
  roomTypeError,
}: {
  roomTypes: RoomTypeRow[];
  pricedTypes: number;
  roomTypeError: string | null;
}) {
  const [search, setSearch] = useState("");
  const [pricingFilter, setPricingFilter] = useState<"all" | "priced" | "missing">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(9);

  const filteredRoomTypes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return roomTypes.filter((type) => {
      if (pricingFilter === "priced" && type.price == null) return false;
      if (pricingFilter === "missing" && type.price != null) return false;
      if (!q) return true;
      const blob = [type.name, String(type.capacity ?? ""), String(type.price ?? "")]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [pricingFilter, roomTypes, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRoomTypes.length / pageSize));
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const offset = (pageSafe - 1) * pageSize;
  const pagedRoomTypes = useMemo(
    () => filteredRoomTypes.slice(offset, offset + pageSize),
    [filteredRoomTypes, offset, pageSize],
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Room type pricing</CardTitle>
            <CardDescription>Base price configured on each room type in inventory.</CardDescription>
          </div>
          <Badge tone="gold">
            {pricedTypes} priced{roomTypes.length !== pricedTypes ? ` · ${roomTypes.length - pricedTypes} missing` : ""}
          </Badge>
        </div>
        <div className="flex flex-col gap-3 pt-3 sm:flex-row">
          <Input
            placeholder="Search type, capacity, or price…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            aria-label="Search room type pricing"
          />
          <select
            className="h-10 min-w-[11rem] rounded-lg border border-border bg-surface px-3 text-sm text-foreground"
            value={pricingFilter}
            onChange={(e) => {
              setPricingFilter(e.target.value as "all" | "priced" | "missing");
              setPage(1);
            }}
            aria-label="Filter room types by pricing"
          >
            <option value="all">All pricing states</option>
            <option value="priced">Priced only</option>
            <option value="missing">Missing price</option>
          </select>
        </div>
      </CardHeader>
      <CardContent>
        {filteredRoomTypes.length === 0 ? (
          <p className="text-sm text-zinc-500">
            {roomTypes.length === 0 && !roomTypeError
              ? "No room types yet. Add them from Inventory first."
              : "No room types match the current search or filter."}
          </p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {pagedRoomTypes.map((type) => (
                <div key={type.id} className="rounded-xl border border-border/70 bg-surface-elevated/40 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-white">{type.name}</p>
                      <p className="mt-1 text-xs text-zinc-500">Capacity {type.capacity ?? "—"} guests</p>
                    </div>
                    <Badge tone={type.price != null ? "green" : "gray"}>
                      {type.price != null ? "Priced" : "Missing"}
                    </Badge>
                  </div>
                  <div className="mt-6 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Base room price</p>
                      <p className="mt-2 text-2xl font-semibold text-gold">{formatRoomPrice(type.price)}</p>
                    </div>
                    <div className="rounded-lg border border-border/70 bg-surface p-2 text-zinc-300">
                      <BedDouble className="h-5 w-5" />
                    </div>
                  </div>
                </div>
              ))}
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
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PricingHealthSection({
  pricedRooms,
  unpricedRooms,
}: {
  pricedRooms: number;
  unpricedRooms: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pricing health</CardTitle>
        <CardDescription>How complete the current pricing setup is for room inventory.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-border/70 bg-surface-elevated/40 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Priced rooms</p>
          <p className="mt-2 text-3xl font-semibold text-white">{pricedRooms}</p>
          <p className="mt-2 text-sm text-zinc-400">Rooms inheriting a price from their assigned room type.</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-surface-elevated/40 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Missing room pricing</p>
          <p className="mt-2 text-3xl font-semibold text-white">{unpricedRooms}</p>
          <p className="mt-2 text-sm text-zinc-400">Rooms without a priced type or without a type assignment.</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-surface-elevated/40 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Pricing logic</p>
          <p className="mt-2 text-sm leading-6 text-zinc-300">
            Specific room prices below currently inherit from the room type base price.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function SpecificRoomPricesSection({
  roomPriceRows,
  roomError,
}: {
  roomPriceRows: RoomPriceRow[];
  roomError: string | null;
}) {
  const [search, setSearch] = useState("");
  const [pricingFilter, setPricingFilter] = useState<"all" | "priced" | "missing">("all");
  const [buildingFilter, setBuildingFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const buildingOptions = useMemo(() => {
    const values = new Set<string>();
    for (const room of roomPriceRows) {
      if (room.building?.trim()) values.add(room.building.trim());
    }
    return [...values].sort();
  }, [roomPriceRows]);

  const filteredRoomPrices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return roomPriceRows.filter((room) => {
      if (pricingFilter === "priced" && room.basePrice == null) return false;
      if (pricingFilter === "missing" && room.basePrice != null) return false;
      if (buildingFilter !== "all" && (room.building?.trim() || "") !== buildingFilter) return false;
      if (!q) return true;
      const blob = [
        room.room_number,
        room.room_type_name ?? "",
        room.building ?? "",
        room.floor ?? "",
        room.operational_status ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [buildingFilter, pricingFilter, roomPriceRows, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRoomPrices.length / pageSize));
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const offset = (pageSafe - 1) * pageSize;
  const pagedRoomPrices = useMemo(
    () => filteredRoomPrices.slice(offset, offset + pageSize),
    [filteredRoomPrices, offset, pageSize],
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Specific room prices</CardTitle>
            <CardDescription>Each room currently inherits pricing from its assigned room type.</CardDescription>
          </div>
          <Badge tone="orange">{roomPriceRows.length} rooms</Badge>
        </div>
        <div className="flex flex-col gap-3 pt-3 lg:flex-row">
          <Input
            placeholder="Search room, type, building, or status…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            aria-label="Search room prices"
          />
          <select
            className="h-10 min-w-[10rem] rounded-lg border border-border bg-surface px-3 text-sm text-foreground"
            value={buildingFilter}
            onChange={(e) => {
              setBuildingFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filter room prices by building"
          >
            <option value="all">All buildings</option>
            {buildingOptions.map((building) => (
              <option key={building} value={building}>
                {building}
              </option>
            ))}
          </select>
          <select
            className="h-10 min-w-[10rem] rounded-lg border border-border bg-surface px-3 text-sm text-foreground"
            value={pricingFilter}
            onChange={(e) => {
              setPricingFilter(e.target.value as "all" | "priced" | "missing");
              setPage(1);
            }}
            aria-label="Filter room prices by pricing"
          >
            <option value="all">All pricing states</option>
            <option value="priced">Priced only</option>
            <option value="missing">Missing price</option>
          </select>
        </div>
      </CardHeader>
      <CardContent>
        {filteredRoomPrices.length === 0 ? (
          <p className="text-sm text-zinc-500">
            {roomPriceRows.length === 0 && !roomError
              ? "No rooms yet. Add physical rooms in Inventory."
              : "No rooms match the current search or filters."}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-border/70">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-white/5">
                  <tr className="border-b border-border/70 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                    <th className="px-4 py-3">Room</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Pricing source</th>
                    <th className="px-4 py-3 text-right">Room price</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRoomPrices.map((room) => (
                    <tr key={room.id} className="border-b border-border/60 last:border-b-0">
                      <td className="px-4 py-4">
                        <p className="font-semibold text-white">{room.room_number}</p>
                        <p className="mt-1 text-xs text-zinc-500">{room.operational_status ?? "available"}</p>
                      </td>
                      <td className="px-4 py-4 text-zinc-300">{room.room_type_name ?? "Unassigned type"}</td>
                      <td className="px-4 py-4 text-zinc-400">
                        {room.floor ?? "—"} / {room.building ?? "—"}
                      </td>
                      <td className="px-4 py-4">
                        <Badge tone={room.basePrice != null ? "green" : "gray"}>
                          {room.type?.name ? `Type: ${room.type.name}` : "No pricing source"}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-right text-lg font-semibold text-gold">
                        {formatRoomPrice(room.basePrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ListPagination
              itemLabel="rooms"
              totalItems={roomPriceRows.length}
              filteredItems={filteredRoomPrices.length}
              page={pageSafe}
              pageSize={pageSize}
              totalPages={totalPages}
              onPageChange={setPage}
              onPageSizeChange={(next) => {
                setPageSize(next);
                setPage(1);
              }}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function HrrmRatesPage({
  roomTypes,
  roomPriceRows,
  roomTypeError,
  roomError,
}: {
  roomTypes: RoomTypeRow[];
  roomPriceRows: RoomPriceRow[];
  roomTypeError: string | null;
  roomError: string | null;
}) {
  const pricedTypes = roomTypes.filter((t) => t.price != null).length;
  const pricedRooms = roomPriceRows.filter((room) => room.basePrice != null).length;
  const unpricedRooms = roomPriceRows.length - pricedRooms;
  const avgTypePrice =
    pricedTypes > 0
      ? Math.round(
          roomTypes.reduce((sum, type) => sum + (type.price != null ? Math.round(type.price * 100) : 0), 0) / pricedTypes,
        )
      : null;
  const errors = [roomTypeError, roomError].filter(Boolean);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
          Rates & pricing
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Base prices by room type and inherited prices by specific room.
        </p>
      </div>

      {errors.map((message, index) => (
        <p
          key={`${message}-${index}`}
          className="rounded-lg border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-200"
        >
          {message}
        </p>
      ))}

      <SummaryCards
        roomTypesCount={roomTypes.length}
        pricedTypes={pricedTypes}
        roomCount={roomPriceRows.length}
        pricedRooms={pricedRooms}
        avgTypePrice={avgTypePrice}
      />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <RoomTypePricingSection
          roomTypes={roomTypes}
          pricedTypes={pricedTypes}
          roomTypeError={roomTypeError}
        />
        <PricingHealthSection pricedRooms={pricedRooms} unpricedRooms={unpricedRooms} />
      </div>

      <SpecificRoomPricesSection roomPriceRows={roomPriceRows} roomError={roomError} />
    </div>
  );
}
