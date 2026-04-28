import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { localDateIso } from "@/lib/format";
import { getUserContext } from "@/lib/queries/context";
import type { ServiceAccessLevel } from "@/lib/auth/service-access";
import { isMissingDbColumnError } from "@/lib/supabase/schema-errors";

/** Prefer service role for tenant-scoped HRRM reads so RLS never returns an empty ledger when data exists. */
async function getSupabaseHrrmRead() {
  try {
    return createServiceRoleClient();
  } catch {
    return await createClient();
  }
}

/** When `departments.is_active` migration is not applied yet, PostgREST returns this. */
function missingDepartmentsIsActiveColumn(msg: string | undefined): boolean {
  if (!msg) return false;
  const m = msg.toLowerCase();
  return m.includes("is_active") && m.includes("does not exist");
}

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
  const withActive = await supabase
    .from("departments")
    .select("id, name, is_active")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("name");

  if (withActive.error && missingDepartmentsIsActiveColumn(withActive.error.message)) {
    const fallback = await supabase
      .from("departments")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .order("name");
    if (fallback.error) {
      return { rows: [] as { id: string; name: string }[], error: fallback.error.message };
    }
    return {
      rows: (fallback.data ?? []).map((d) => ({ id: d.id, name: d.name })),
      error: null as string | null,
    };
  }

  if (withActive.error) {
    return { rows: [] as { id: string; name: string }[], error: withActive.error.message };
  }
  return {
    rows: (withActive.data ?? []).map((d) => ({ id: d.id, name: d.name })),
    error: null as string | null,
  };
}

export async function fetchEmployees(tenantId: string) {
  const supabase = await createClient();
  const { data: employees, error: eErr } = await supabase
    .from("employees")
    .select(
      "id, employee_code, full_name, email, job_title, status, hire_date, department_id, photo_url, monthly_salary_cents",
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

/** Row for HRMS directory: employees plus tenant login profiles without an employee record. */
export type HrmsDirectoryRow = {
  id: string;
  kind: "employee" | "account";
  employee_code: string | null;
  full_name: string;
  email: string | null;
  job_title: string | null;
  status: string;
  hire_date: string | null;
  department_id: string | null;
  department_name: string | null;
  /** Storage path for private bucket `employee-photos`, or legacy http URL */
  photo_url: string | null;
  monthly_salary_cents: number | null;
};

function accountJobTitleFromGlobalRole(globalRole: string | null): string {
  switch (globalRole) {
    case "hotel_admin":
      return "Hotel administrator";
    case "superadmin":
      return "Platform superadmin";
    case "hrms":
      return "HR (legacy role)";
    case "hrrm":
      return "Rooms (legacy role)";
    case "user":
    default:
      return "Staff account";
  }
}

/**
 * Full tenant roster for HRMS: all `employees` rows, plus `profiles` on this tenant that are not
 * linked via `employees.user_id`. Uses the service role so the list is not limited by RLS (still
 * scoped to `tenantId` from the signed-in user’s profile).
 */
export async function fetchHrmsDirectory(
  tenantId: string,
): Promise<{ rows: HrmsDirectoryRow[]; departments: { id: string; name: string }[]; error: string | null }> {
  const ctx = await getUserContext();
  if (!ctx?.userId || ctx.tenantId !== tenantId) {
    return { rows: [], departments: [], error: "Not authorized." };
  }

  let admin: ReturnType<typeof createServiceRoleClient>;
  try {
    admin = createServiceRoleClient();
  } catch {
    const emp = await fetchEmployees(tenantId);
    const depts = await fetchTenantDepartmentsForSelect(tenantId);
    return {
      rows: (emp.rows ?? []).map((r) => ({
        id: r.id,
        kind: "employee" as const,
        employee_code: r.employee_code,
        full_name: r.full_name,
        email: r.email,
        job_title: r.job_title,
        status: r.status,
        hire_date: r.hire_date,
        department_id: r.department_id,
        department_name: r.department_name,
        photo_url: r.photo_url ?? null,
        monthly_salary_cents: r.monthly_salary_cents ?? null,
      })),
      departments: depts.rows,
      error: emp.error ?? depts.error,
    };
  }

  const { data: employees, error: eErr } = await admin
    .from("employees")
    .select(
      "id, user_id, employee_code, full_name, email, job_title, status, hire_date, department_id, photo_url, monthly_salary_cents",
    )
    .eq("tenant_id", tenantId)
    .order("full_name", { ascending: true });

  if (eErr) {
    return { rows: [], departments: [], error: eErr.message };
  }

  const { data: allDepts, error: dErr } = await admin
    .from("departments")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .order("name");

  if (dErr) {
    return { rows: [], departments: [], error: dErr.message };
  }

  const deptMap = new Map((allDepts ?? []).map((d) => [d.id, d.name]));

  const empRows: HrmsDirectoryRow[] = (employees ?? []).map((e) => ({
    id: e.id,
    kind: "employee",
    employee_code: e.employee_code,
    full_name: e.full_name,
    email: e.email,
    job_title: e.job_title,
    status: e.status ?? "active",
    hire_date: e.hire_date,
    department_id: e.department_id,
    department_name: e.department_id ? deptMap.get(e.department_id) ?? null : null,
    photo_url: e.photo_url ?? null,
    monthly_salary_cents: e.monthly_salary_cents ?? null,
  }));

  const linkedUserIds = new Set(
    (employees ?? []).map((e) => e.user_id).filter((x): x is string => Boolean(x)),
  );

  const { data: profiles, error: pErr } = await admin
    .from("profiles")
    .select("id, full_name, global_role")
    .eq("tenant_id", tenantId);

  if (pErr) {
    return {
      rows: empRows.sort((a, b) => a.full_name.localeCompare(b.full_name)),
      departments: allDepts ?? [],
      error: pErr.message,
    };
  }

  const accountRows: HrmsDirectoryRow[] = (profiles ?? [])
    .filter((p) => !linkedUserIds.has(p.id))
    .map((p) => ({
      id: `account-${p.id}`,
      kind: "account",
      employee_code: null,
      full_name: p.full_name?.trim() || "User",
      email: null,
      job_title: accountJobTitleFromGlobalRole(p.global_role),
      status: "account",
      hire_date: null,
      department_id: null,
      department_name: null,
      photo_url: null,
      monthly_salary_cents: null,
    }));

  const merged = [...empRows, ...accountRows].sort((a, b) =>
    a.full_name.localeCompare(b.full_name),
  );

  return {
    rows: merged,
    departments: allDepts ?? [],
    error: null,
  };
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

/** HRRM reservations ledger row (with guest + room labels). */
export type ReservationLedgerRow = {
  id: string;
  guest_id: string;
  room_id: string | null;
  confirmation_code: string | null;
  check_in: string;
  check_out: string;
  status: string;
  payment_status: string | null;
  balance_cents: number;
  created_at: string;
  guest_name: string;
  guest_email: string | null;
  guest_phone: string | null;
  loyalty_tier: string | null;
  room_number: string;
};

export async function fetchReservationsWithGuests(
  tenantId: string,
): Promise<{ rows: ReservationLedgerRow[]; error: string | null }> {
  const supabase = await getSupabaseHrrmRead();
  const { data: reservations, error: resErr } = await supabase
    .from("reservations")
    .select(
      "id, guest_id, room_id, confirmation_code, check_in, check_out, status, payment_status, balance_cents, created_at",
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
      ? supabase
          .from("guests")
          .select("id, full_name, email, phone, loyalty_tier")
          .in("id", guestIds)
      : Promise.resolve({
          data: [] as { id: string; full_name: string; email: string | null; phone: string | null; loyalty_tier: string | null }[],
        }),
    roomIds.length
      ? supabase.from("rooms").select("id, room_number").in("id", roomIds)
      : Promise.resolve({ data: [] as { id: string; room_number: string }[] }),
  ]);

  const guestMap = new Map(
    (guestsRes.data ?? []).map((g) => [
      g.id,
      {
        name: g.full_name,
        email: g.email ?? null,
        phone: g.phone ?? null,
        loyalty: g.loyalty_tier ?? null,
      },
    ]),
  );
  const roomMap = new Map((roomsRes.data ?? []).map((r) => [r.id, r.room_number]));

  const rows: ReservationLedgerRow[] = (reservations ?? []).map((r) => {
    const g = guestMap.get(r.guest_id);
    const bal = r.balance_cents;
    return {
      id: r.id,
      guest_id: r.guest_id,
      room_id: r.room_id,
      confirmation_code: r.confirmation_code,
      check_in: r.check_in,
      check_out: r.check_out,
      status: r.status,
      payment_status: r.payment_status ?? null,
      balance_cents: typeof bal === "bigint" ? Number(bal) : bal ?? 0,
      created_at: r.created_at ?? "",
      guest_name: g?.name ?? "—",
      guest_email: g?.email ?? null,
      guest_phone: g?.phone ?? null,
      loyalty_tier: g?.loyalty ?? null,
      room_number: r.room_id ? roomMap.get(r.room_id) ?? "—" : "—",
    };
  });

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
  const ctx = await getUserContext();
  if (!ctx?.userId || ctx.tenantId !== tenantId) {
    return { rows: [], error: "Not authorized." };
  }

  /** Same tenant as session; service role avoids RLS hiding employees/departments on join. */
  let supabase: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createServiceRoleClient>;
  try {
    supabase = createServiceRoleClient();
  } catch {
    supabase = await createClient();
  }

  const { data: logs, error: lErr } = await supabase
    .from("attendance_logs")
    .select("id, employee_id, punch_type, punched_at")
    .eq("tenant_id", tenantId)
    .order("punched_at", { ascending: false })
    .limit(50);

  if (lErr) return { rows: [], error: lErr.message };

  const empIds = [...new Set((logs ?? []).map((l) => l.employee_id))];
  if (empIds.length === 0) return { rows: [], error: null };

  const { data: emps, error: eErr } = await supabase
    .from("employees")
    .select("id, full_name, department_id")
    .eq("tenant_id", tenantId)
    .in("id", empIds);

  if (eErr) return { rows: [], error: eErr.message };

  const deptIds = [
    ...new Set((emps ?? []).map((e) => e.department_id).filter(Boolean)),
  ] as string[];
  let deptMap = new Map<string, string>();
  if (deptIds.length > 0) {
    const { data: depts, error: dErr } = await supabase
      .from("departments")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .in("id", deptIds);
    if (dErr) return { rows: [], error: dErr.message };
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
      employee_name: e?.name ?? "Unknown employee",
      department: e?.department ?? "—",
    };
  });

  return { rows, error: null };
}

export async function fetchHrrmDashboardCounts(tenantId: string) {
  const supabase = await getSupabaseHrrmRead();
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

/** Full row for Hotel Admin → Settings (requires migration `tenant_hotel_settings`). */
export type HotelTenantSettings = {
  name: string;
  slug: string;
  region: string | null;
  description: string | null;
  cover_image_url: string | null;
  logo_url: string | null;
  /** Public URLs for portfolio gallery (managed in Settings). */
  gallery_urls: string[];
  timezone: string;
  default_currency: string;
  contact_phone: string | null;
  reservations_email: string | null;
  default_check_in_time: string | null;
  default_check_out_time: string | null;
  policies_notes: string | null;
};

function parseTenantGalleryUrls(raw: unknown): string[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string" && x.length > 0);
}

const HOTEL_SETTINGS_SELECT_WITH_GALLERY =
  "name, slug, region, description, cover_image_url, logo_url, gallery_urls, timezone, default_currency, contact_phone, reservations_email, default_check_in_time, default_check_out_time, policies_notes";

const HOTEL_SETTINGS_SELECT_NO_GALLERY =
  "name, slug, region, description, cover_image_url, logo_url, timezone, default_currency, contact_phone, reservations_email, default_check_in_time, default_check_out_time, policies_notes";

export async function fetchHotelTenantSettings(tenantId: string): Promise<{
  settings: HotelTenantSettings | null;
  error: string | null;
}> {
  const supabase = await createClient();
  let res = await supabase
    .from("tenants")
    .select(HOTEL_SETTINGS_SELECT_WITH_GALLERY)
    .eq("id", tenantId)
    .maybeSingle();

  let galleryFallback = false;
  if (res.error && isMissingDbColumnError(res.error)) {
    galleryFallback = true;
    res = await supabase
      .from("tenants")
      .select(HOTEL_SETTINGS_SELECT_NO_GALLERY)
      .eq("id", tenantId)
      .maybeSingle();
  }

  const { data, error } = res;

  if (error) {
    return { settings: null, error: error.message };
  }
  if (!data) {
    return { settings: null, error: null };
  }
  const row = data as Record<string, unknown>;
  return {
    settings: {
      name: String(data.name ?? ""),
      slug: String(data.slug ?? ""),
      region: (row.region as string | null) ?? null,
      description: (row.description as string | null) ?? null,
      cover_image_url: (row.cover_image_url as string | null) ?? null,
      logo_url: (row.logo_url as string | null) ?? null,
      gallery_urls: galleryFallback ? [] : parseTenantGalleryUrls(row.gallery_urls),
      timezone: String(row.timezone ?? "UTC"),
      default_currency: String(row.default_currency ?? "ETB"),
      contact_phone: (row.contact_phone as string | null) ?? null,
      reservations_email: (row.reservations_email as string | null) ?? null,
      default_check_in_time: (row.default_check_in_time as string | null) ?? null,
      default_check_out_time: (row.default_check_out_time as string | null) ?? null,
      policies_notes: (row.policies_notes as string | null) ?? null,
    },
    error: null,
  };
}

/** Name, slug, description, cover, and gallery for hotel portfolio / property overview. */
export type TenantPortfolio = {
  name: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  gallery_urls: string[];
};

export async function fetchTenantPortfolio(tenantId: string): Promise<{
  portfolio: TenantPortfolio | null;
  error: string | null;
}> {
  const supabase = await createClient();
  let res = await supabase
    .from("tenants")
    .select("name, slug, description, cover_image_url, gallery_urls")
    .eq("id", tenantId)
    .maybeSingle();

  let galleryFallback = false;
  if (res.error && isMissingDbColumnError(res.error)) {
    galleryFallback = true;
    res = await supabase
      .from("tenants")
      .select("name, slug, description, cover_image_url")
      .eq("id", tenantId)
      .maybeSingle();
  }

  const { data, error } = res;

  if (error) {
    return { portfolio: null, error: error.message };
  }
  if (!data) {
    return { portfolio: null, error: null };
  }
  const row = data as Record<string, unknown>;
  return {
    portfolio: {
      name: data.name,
      slug: data.slug,
      description: (row.description as string | null) ?? null,
      cover_image_url: (row.cover_image_url as string | null) ?? null,
      gallery_urls: galleryFallback ? [] : parseTenantGalleryUrls(row.gallery_urls),
    },
    error: null,
  };
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

export type TenantUserWithEmployee = TenantUserRow & {
  employee: {
    id: string;
    status: string;
    department_id: string | null;
    job_title: string | null;
    employee_code: string | null;
    hire_date: string | null;
    monthly_salary_cents: number | null;
  } | null;
};

/**
 * Hotel Admin: tenant profiles + `user_roles`, plus an optional `employees` row per login user.
 */
export async function fetchTenantUsersForHotel(
  tenantId: string,
): Promise<{ rows: TenantUserWithEmployee[]; error: string | null }> {
  const base = await fetchTenantUsersWithRoles(tenantId);
  if (base.error) {
    return { rows: [], error: base.error };
  }
  let admin: ReturnType<typeof createServiceRoleClient>;
  try {
    admin = createServiceRoleClient();
  } catch {
    return {
      rows: base.rows.map((r) => ({ ...r, employee: null })),
      error: null,
    };
  }
  const { data: emps, error: eErr } = await admin
    .from("employees")
    .select(
      "id, user_id, status, department_id, job_title, employee_code, hire_date, monthly_salary_cents",
    )
    .eq("tenant_id", tenantId);
  if (eErr) {
    return { rows: [], error: eErr.message };
  }
  const byUser = new Map(
    (emps ?? [])
      .filter((e) => e.user_id)
      .map((e) => {
        const row = e as {
          id: string;
          user_id: string;
          status: string;
          department_id: string | null;
          job_title: string | null;
          employee_code: string | null;
          hire_date: string | null;
          monthly_salary_cents: number | null;
        };
        return [row.user_id, row] as const;
      }),
  );
  return {
    rows: base.rows.map((r) => {
      const e = byUser.get(r.id);
      return {
        ...r,
        employee: e
          ? {
              id: e.id,
              status: e.status ?? "active",
              department_id: e.department_id,
              job_title: e.job_title,
              employee_code: e.employee_code,
              hire_date: e.hire_date,
              monthly_salary_cents: e.monthly_salary_cents,
            }
          : null,
      };
    }),
    error: null,
  };
}

export async function fetchHrmsDashboardStats(tenantId: string) {
  const ctx = await getUserContext();
  if (!ctx?.userId || ctx.tenantId !== tenantId) {
    return {
      employeeCount: 0,
      shiftsToday: 0,
      punchesToday: 0,
      error: "Not authorized.",
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const startOfDay = `${today}T00:00:00.000Z`;

  let supabase: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createServiceRoleClient>;
  try {
    supabase = createServiceRoleClient();
  } catch {
    supabase = await createClient();
  }

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
  /** All HR employee rows in this department (may include people without a Supabase login). */
  employee_count: number;
  /** Employees with `user_id` set — these can appear on the hotel “platform users” staff list when linked to a profile. */
  linked_login_count: number;
  /** False when department is soft-disabled (hidden from new assignments). Omitted in older API responses. */
  is_active?: boolean;
};

export async function fetchDepartmentsWithCounts(tenantId: string): Promise<{
  rows: DepartmentCountRow[];
  totalEmployees: number;
  error: string | null;
}> {
  const supabase = await createClient();
  const withActive = await supabase
    .from("departments")
    .select("id, name, is_active")
    .eq("tenant_id", tenantId)
    .order("name");

  let depts: { id: string; name: string; is_active?: boolean }[] | null;

  if (withActive.error && missingDepartmentsIsActiveColumn(withActive.error.message)) {
    const fallback = await supabase
      .from("departments")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .order("name");
    if (fallback.error) {
      return { rows: [], totalEmployees: 0, error: fallback.error.message };
    }
    depts = fallback.data;
  } else if (withActive.error) {
    return { rows: [], totalEmployees: 0, error: withActive.error.message };
  } else {
    depts = withActive.data;
  }

  const { count: totalEmployees } = await supabase
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  const rows: DepartmentCountRow[] = await Promise.all(
    (depts ?? []).map(async (d) => {
      const [{ count }, { count: linkedCount }] = await Promise.all([
        supabase
          .from("employees")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("department_id", d.id),
        supabase
          .from("employees")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("department_id", d.id)
          .not("user_id", "is", null),
      ]);
      return {
        id: d.id,
        name: d.name,
        employee_count: count ?? 0,
        linked_login_count: linkedCount ?? 0,
        is_active: (d as { is_active?: boolean }).is_active !== false,
      };
    }),
  );

  return { rows, totalEmployees: totalEmployees ?? 0, error: null };
}

/**
 * HR reports: department headcounts + total employees. Uses service role when available so counts
 * match reality for the tenant (RLS/session quirks won’t zero out aggregates).
 */
export async function fetchHrmsReportsAnalytics(tenantId: string): Promise<{
  totalEmployees: number;
  departments: DepartmentCountRow[];
  error: string | null;
}> {
  const ctx = await getUserContext();
  if (!ctx?.userId || ctx.tenantId !== tenantId) {
    return { totalEmployees: 0, departments: [], error: "Not authorized." };
  }

  let admin: ReturnType<typeof createServiceRoleClient>;
  try {
    admin = createServiceRoleClient();
  } catch {
    const res = await fetchDepartmentsWithCounts(tenantId);
    return {
      totalEmployees: res.totalEmployees,
      departments: res.rows,
      error: res.error,
    };
  }

  const withActiveAdmin = await admin
    .from("departments")
    .select("id, name, is_active")
    .eq("tenant_id", tenantId)
    .order("name");

  let depts: { id: string; name: string; is_active?: boolean }[] | null;

  if (withActiveAdmin.error && missingDepartmentsIsActiveColumn(withActiveAdmin.error.message)) {
    const fallback = await admin
      .from("departments")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .order("name");
    if (fallback.error) {
      return { totalEmployees: 0, departments: [], error: fallback.error.message };
    }
    depts = fallback.data;
  } else if (withActiveAdmin.error) {
    return { totalEmployees: 0, departments: [], error: withActiveAdmin.error.message };
  } else {
    depts = withActiveAdmin.data;
  }

  const { count: totalEmployees } = await admin
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  const departments: DepartmentCountRow[] = await Promise.all(
    (depts ?? []).map(async (d) => {
      const [{ count }, { count: linkedCount }] = await Promise.all([
        admin
          .from("employees")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("department_id", d.id),
        admin
          .from("employees")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("department_id", d.id)
          .not("user_id", "is", null),
      ]);
      return {
        id: d.id,
        name: d.name,
        employee_count: count ?? 0,
        linked_login_count: linkedCount ?? 0,
        is_active: (d as { is_active?: boolean }).is_active !== false,
      };
    }),
  );

  return {
    totalEmployees: totalEmployees ?? 0,
    departments,
    error: null,
  };
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
  const supabase = await getSupabaseHrrmRead();
  const today = localDateIso();
  const [checkInsToday, departuresToday, activeReservations] = await Promise.all([
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
      .in("status", ["checked_in", "pending"]),
  ]);

  return {
    checkInsToday: checkInsToday.count ?? 0,
    departuresToday: departuresToday.count ?? 0,
    activeBookings: activeReservations.count ?? 0,
    error:
      checkInsToday.error?.message ||
      departuresToday.error?.message ||
      activeReservations.error?.message ||
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
  const supabase = await getSupabaseHrrmRead();
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
