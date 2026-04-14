import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getUserContext } from "@/lib/queries/context";
import type { ServiceAccessLevel } from "@/lib/auth/service-access";

export async function fetchTenantUsers(tenantId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, global_role, tenant_id")
    .eq("tenant_id", tenantId)
    .order("full_name", { ascending: true });

  if (error) return { rows: [], error: error.message };
  return { rows: data ?? [], error: null };
}

export async function fetchTenantDepartmentsForSelect(tenantId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("departments")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .order("name");

  if (error) return { rows: [] as { id: string; name: string }[], error: error.message };
  return { rows: data ?? [], error: null as string | null };
}

export async function fetchEmployees(tenantId: string) {
  const supabase = await createClient();
  const { data: employees, error: eErr } = await supabase
    .from("employees")
    .select(
      "id, employee_code, full_name, email, job_title, status, hire_date, department_id",
    )
    .eq("tenant_id", tenantId)
    .order("full_name", { ascending: true });

  if (eErr) return { rows: [], error: eErr.message };

  const deptIds = [
    ...new Set((employees ?? []).map((e) => e.department_id).filter(Boolean)),
  ] as string[];
  let deptMap = new Map<string, string>();
  if (deptIds.length > 0) {
    const { data: depts } = await supabase
      .from("departments")
      .select("id, name")
      .in("id", deptIds);
    deptMap = new Map((depts ?? []).map((d) => [d.id, d.name]));
  }

  const rows = (employees ?? []).map((e) => ({
    ...e,
    department_name: e.department_id ? deptMap.get(e.department_id) ?? null : null,
  }));

  return { rows, error: null };
}

export async function fetchEmployeeStats(tenantId: string) {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  return { count: count ?? 0, error: error?.message ?? null };
}

export async function fetchRooms(tenantId: string) {
  const supabase = await createClient();
  const { data: rooms, error: rErr } = await supabase
    .from("rooms")
    .select(
      "id, room_number, floor, building, housekeeping_status, operational_status, room_type_id",
    )
    .eq("tenant_id", tenantId)
    .order("room_number", { ascending: true });

  if (rErr) return { rows: [], error: rErr.message };

  const typeIds = [
    ...new Set((rooms ?? []).map((r) => r.room_type_id).filter(Boolean)),
  ] as string[];
  let typeMap = new Map<string, string>();
  if (typeIds.length > 0) {
    const { data: types } = await supabase
      .from("room_types")
      .select("id, name")
      .in("id", typeIds);
    typeMap = new Map((types ?? []).map((t) => [t.id, t.name]));
  }

  const rows = (rooms ?? []).map((r) => ({
    ...r,
    room_type_name: r.room_type_id ? typeMap.get(r.room_type_id) ?? null : null,
  }));

  return { rows, error: null };
}

export async function fetchReservationsWithGuests(tenantId: string) {
  const supabase = await createClient();
  const { data: reservations, error: resErr } = await supabase
    .from("reservations")
    .select(
      "id, guest_id, room_id, confirmation_code, check_in, check_out, status, balance_cents, created_at",
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (resErr) return { rows: [], error: resErr.message };

  const guestIds = [...new Set((reservations ?? []).map((r) => r.guest_id))];
  const roomIds = [
    ...new Set((reservations ?? []).map((r) => r.room_id).filter(Boolean)),
  ] as string[];

  const [guestsRes, roomsRes] = await Promise.all([
    guestIds.length
      ? supabase.from("guests").select("id, full_name").in("id", guestIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    roomIds.length
      ? supabase.from("rooms").select("id, room_number").in("id", roomIds)
      : Promise.resolve({ data: [] as { id: string; room_number: string }[] }),
  ]);

  const guestMap = new Map((guestsRes.data ?? []).map((g) => [g.id, g.full_name]));
  const roomMap = new Map((roomsRes.data ?? []).map((r) => [r.id, r.room_number]));

  const rows = (reservations ?? []).map((r) => ({
    id: r.id,
    confirmation_code: r.confirmation_code,
    check_in: r.check_in,
    check_out: r.check_out,
    status: r.status,
    balance_cents: r.balance_cents,
    guest_name: guestMap.get(r.guest_id) ?? "—",
    room_number: r.room_id ? roomMap.get(r.room_id) ?? "—" : "—",
  }));

  return { rows, error: null };
}

export async function fetchRatePlans(tenantId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rate_plans")
    .select("id, name, base_amount_cents, policy, is_active")
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true });

  if (error) return { rows: [], error: error.message };
  return { rows: data ?? [], error: null };
}

export async function fetchAttendanceLogs(tenantId: string) {
  const supabase = await createClient();
  const { data: logs, error: lErr } = await supabase
    .from("attendance_logs")
    .select("id, employee_id, punch_type, punched_at")
    .eq("tenant_id", tenantId)
    .order("punched_at", { ascending: false })
    .limit(50);

  if (lErr) return { rows: [], error: lErr.message };

  const empIds = [...new Set((logs ?? []).map((l) => l.employee_id))];
  if (empIds.length === 0) return { rows: [], error: null };

  const { data: emps } = await supabase
    .from("employees")
    .select("id, full_name, department_id")
    .in("id", empIds);

  const deptIds = [
    ...new Set((emps ?? []).map((e) => e.department_id).filter(Boolean)),
  ] as string[];
  let deptMap = new Map<string, string>();
  if (deptIds.length > 0) {
    const { data: depts } = await supabase
      .from("departments")
      .select("id, name")
      .in("id", deptIds);
    deptMap = new Map((depts ?? []).map((d) => [d.id, d.name]));
  }

  const empMap = new Map(
    (emps ?? []).map((e) => [
      e.id,
      {
        name: e.full_name,
        department: e.department_id ? deptMap.get(e.department_id) ?? "—" : "—",
      },
    ]),
  );

  const rows = (logs ?? []).map((r) => {
    const e = empMap.get(r.employee_id);
    return {
      id: r.id,
      punch_type: r.punch_type,
      punched_at: r.punched_at,
      employee_name: e?.name ?? "—",
      department: e?.department ?? "—",
    };
  });

  return { rows, error: null };
}

export async function fetchHrrmDashboardCounts(tenantId: string) {
  const supabase = await createClient();
  const [roomsRes, resRes, guestsRes] = await Promise.all([
    supabase.from("rooms").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    supabase.from("guests").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
  ]);

  return {
    roomCount: roomsRes.count ?? 0,
    activeReservationCount: resRes.count ?? 0,
    guestCount: guestsRes.count ?? 0,
    error:
      roomsRes.error?.message || resRes.error?.message || guestsRes.error?.message || null,
  };
}

export async function fetchTenantName(tenantId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", tenantId)
    .maybeSingle();
  if (error) return { name: null as string | null, error: error.message };
  return { name: data?.name ?? null, error: null as string | null };
}

export async function fetchTenantSubscription(tenantId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("plan, status, current_period_end, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return { subscription: data, error: error?.message ?? null };
}

export type TenantUserRow = {
  id: string;
  full_name: string | null;
  global_role: string | null;
  created_at: string | null;
  role_labels: string[];
  hrms_access: ServiceAccessLevel;
  hrrm_access: ServiceAccessLevel;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  global_role: string | null;
  created_at: string | null;
};

function mapProfilesAndRolesToTenantRows(
  profiles: ProfileRow[] | null,
  roleRows: { user_id: string; service: string; access_level: string }[] | null,
): TenantUserRow[] {
  const ids = (profiles ?? []).map((p) => p.id);
  const labelsByUser = new Map<string, string[]>();
  const accessByUser = new Map<string, { hrms: ServiceAccessLevel; hrrm: ServiceAccessLevel }>();

  for (const uid of ids) {
    accessByUser.set(uid, { hrms: "none", hrrm: "none" });
  }

  for (const r of roleRows ?? []) {
    const label = `${r.service}:${r.access_level}`;
    const list = labelsByUser.get(r.user_id) ?? [];
    list.push(label);
    labelsByUser.set(r.user_id, list);

    const cur = accessByUser.get(r.user_id);
    if (!cur) continue;
    if (
      r.service === "hrms" &&
      (r.access_level === "none" || r.access_level === "view" || r.access_level === "manage")
    ) {
      cur.hrms = r.access_level;
    }
    if (
      r.service === "hrrm" &&
      (r.access_level === "none" || r.access_level === "view" || r.access_level === "manage")
    ) {
      cur.hrrm = r.access_level;
    }
  }

  return (profiles ?? []).map((p) => {
    const acc = accessByUser.get(p.id) ?? { hrms: "none" as const, hrrm: "none" as const };
    return {
      id: p.id,
      full_name: p.full_name,
      global_role: p.global_role,
      created_at: p.created_at ?? null,
      role_labels: labelsByUser.get(p.id) ?? [],
      hrms_access: acc.hrms,
      hrrm_access: acc.hrrm,
    };
  });
}

/**
 * Lists tenant profiles + user_roles access. Hotel admins use the service role so RLS /
 * missing `profiles_select_same_tenant_hotel_admin` on the DB cannot hide rows.
 */
export async function fetchTenantUsersWithRoles(tenantId: string): Promise<{
  rows: TenantUserRow[];
  error: string | null;
}> {
  const ctx = await getUserContext();
  const hotelAdminFullList =
    ctx?.globalRole === "hotel_admin" && ctx.tenantId === tenantId;

  if (hotelAdminFullList) {
    try {
      const sr = createServiceRoleClient();
      const { data: profiles, error } = await sr
        .from("profiles")
        .select("id, full_name, global_role, created_at")
        .eq("tenant_id", tenantId)
        .order("full_name", { ascending: true });

      if (error) return { rows: [], error: error.message };

      const ids = (profiles ?? []).map((p) => p.id);
      const { data: roleRows, error: rErr } = ids.length
        ? await sr
            .from("user_roles")
            .select("user_id, service, access_level")
            .eq("tenant_id", tenantId)
            .in("user_id", ids)
        : { data: [] as { user_id: string; service: string; access_level: string }[], error: null };

      if (rErr) return { rows: [], error: rErr.message };

      return {
        rows: mapProfilesAndRolesToTenantRows(profiles ?? [], roleRows ?? []),
        error: null,
      };
    } catch (e) {
      return {
        rows: [],
        error:
          e instanceof Error
            ? e.message
            : "SUPABASE_SERVICE_ROLE_KEY is missing — add it to web/.env.local to load the full user list.",
      };
    }
  }

  const supabase = await createClient();
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, full_name, global_role, created_at")
    .eq("tenant_id", tenantId)
    .order("full_name", { ascending: true });

  if (error) return { rows: [], error: error.message };

  const ids = (profiles ?? []).map((p) => p.id);
  const { data: roleRows } = ids.length
    ? await supabase
        .from("user_roles")
        .select("user_id, service, access_level")
        .eq("tenant_id", tenantId)
        .in("user_id", ids)
    : { data: [] as { user_id: string; service: string; access_level: string }[] };

  return {
    rows: mapProfilesAndRolesToTenantRows(profiles ?? [], roleRows ?? []),
    error: null,
  };
}

export async function fetchHrmsDashboardStats(tenantId: string) {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const startOfDay = `${today}T00:00:00.000Z`;

  const [emp, shifts, punches] = await Promise.all([
    supabase.from("employees").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    supabase
      .from("shifts")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("shift_date", today),
    supabase
      .from("attendance_logs")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("punched_at", startOfDay),
  ]);

  return {
    employeeCount: emp.count ?? 0,
    shiftsToday: shifts.count ?? 0,
    punchesToday: punches.count ?? 0,
    error: emp.error?.message || shifts.error?.message || punches.error?.message || null,
  };
}

export type DepartmentCountRow = {
  id: string;
  name: string;
  employee_count: number;
};

export async function fetchDepartmentsWithCounts(tenantId: string): Promise<{
  rows: DepartmentCountRow[];
  totalEmployees: number;
  error: string | null;
}> {
  const supabase = await createClient();
  const { data: depts, error } = await supabase
    .from("departments")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .order("name");

  if (error) return { rows: [], totalEmployees: 0, error: error.message };

  const { count: totalEmployees } = await supabase
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  const rows: DepartmentCountRow[] = await Promise.all(
    (depts ?? []).map(async (d) => {
      const { count } = await supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("department_id", d.id);
      return { id: d.id, name: d.name, employee_count: count ?? 0 };
    }),
  );

  return { rows, totalEmployees: totalEmployees ?? 0, error: null };
}

export async function fetchShiftsUpcoming(tenantId: string, limit = 80) {
  const supabase = await createClient();
  const start = new Date().toISOString().slice(0, 10);
  const { data: shifts, error } = await supabase
    .from("shifts")
    .select("id, employee_id, shift_date, start_time, end_time, shift_type")
    .eq("tenant_id", tenantId)
    .gte("shift_date", start)
    .order("shift_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(limit);

  if (error) return { rows: [], error: error.message };

  const empIds = [...new Set((shifts ?? []).map((s) => s.employee_id))];
  let empMap = new Map<string, string>();
  if (empIds.length > 0) {
    const { data: emps } = await supabase
      .from("employees")
      .select("id, full_name, job_title")
      .in("id", empIds);
    empMap = new Map(
      (emps ?? []).map((e) => [e.id, e.full_name + (e.job_title ? ` · ${e.job_title}` : "")]),
    );
  }

  const rows = (shifts ?? []).map((s) => ({
    ...s,
    employee_label: empMap.get(s.employee_id) ?? "—",
  }));

  return { rows, error: null };
}

export async function fetchReservationStats(tenantId: string) {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [checkInsToday, departuresToday, nonCanceled] = await Promise.all([
    supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("check_in", today),
    supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("check_out", today)
      .neq("status", "canceled"),
    supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .neq("status", "canceled"),
  ]);

  return {
    checkInsToday: checkInsToday.count ?? 0,
    departuresToday: departuresToday.count ?? 0,
    activeBookings: nonCanceled.count ?? 0,
    error:
      checkInsToday.error?.message ||
      departuresToday.error?.message ||
      nonCanceled.error?.message ||
      null,
  };
}

export async function fetchRoomHousekeepingAggregate(tenantId: string) {
  const supabase = await createClient();
  const { data: rooms, error } = await supabase
    .from("rooms")
    .select("id, housekeeping_status, operational_status")
    .eq("tenant_id", tenantId);

  if (error) {
    return {
      total: 0,
      byHousekeeping: {} as Record<string, number>,
      outOfOrder: 0,
      error: error.message,
    };
  }

  const byHousekeeping: Record<string, number> = {};
  let outOfOrder = 0;
  for (const r of rooms ?? []) {
    const op = (r.operational_status ?? "").toLowerCase();
    if (op === "out_of_order" || op === "maintenance" || op === "ooo") {
      outOfOrder += 1;
    }
    const h = (r.housekeeping_status ?? "unknown").toLowerCase();
    byHousekeeping[h] = (byHousekeeping[h] ?? 0) + 1;
  }

  return {
    total: rooms?.length ?? 0,
    byHousekeeping,
    outOfOrder,
    error: null as string | null,
  };
}

export async function fetchRecentReservationsForConcierge(tenantId: string, limit = 8) {
  const supabase = await createClient();
  const { data: reservations, error: rErr } = await supabase
    .from("reservations")
    .select("id, guest_id, confirmation_code, check_in, check_out, status")
    .eq("tenant_id", tenantId)
    .order("check_in", { ascending: true })
    .limit(limit);

  if (rErr) return { rows: [], error: rErr.message };

  const guestIds = [...new Set((reservations ?? []).map((r) => r.guest_id))];
  const { data: guests } = guestIds.length
    ? await supabase.from("guests").select("id, full_name, loyalty_tier").in("id", guestIds)
    : { data: [] as { id: string; full_name: string; loyalty_tier: string | null }[] };

  const gMap = new Map((guests ?? []).map((g) => [g.id, g]));

  const rows = (reservations ?? []).map((r) => {
    const g = gMap.get(r.guest_id);
    return {
      id: r.id,
      confirmation_code: r.confirmation_code,
      check_in: r.check_in,
      check_out: r.check_out,
      status: r.status,
      guest_name: g?.full_name ?? "—",
      loyalty_tier: g?.loyalty_tier ?? null,
    };
  });

  return { rows, error: null };
}
