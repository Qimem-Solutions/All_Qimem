/**
 * Demo / example data for one property (tenant): departments, employees, shifts,
 * attendance, and optional HRRM (room types, rooms, guests, reservations).
 *
 * All rows are tagged so re-running removes only this seed (not your real data):
 *   - Departments: name starts with "[Demo]"
 *   - Employees: employee_code starts with "DEMO-"
 *   - HRRM: room types "[Demo] ...", rooms "D-###", guests "@demo.seed.internal"
 *
 * Usage (from the `web` folder):
 *   node --env-file=.env.local scripts/seed-demo-data.mjs
 *   node --env-file=.env.local scripts/seed-demo-data.mjs --slug=my-test
 *   (Leading slashes are OK: --slug=/my-test is stored as my-test in the DB.)
 *
 * Requires:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Or: npm run seed:demo  |  npm run seed:demo:my-test  (property slug my-test)
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Slug in DB has no leading slash; URLs often use /my-test — accept both. */
function normalizeSlug(raw) {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim().replace(/^\/+|\/+$/g, "").trim();
  return s.length ? s : null;
}

function argSlug() {
  const fromEnv = normalizeSlug(process.env.SEED_TENANT_SLUG ?? "");
  if (fromEnv) return fromEnv;
  const a = process.argv.find((x) => x.startsWith("--slug="));
  if (a) return normalizeSlug(a.slice("--slug=".length));
  return null;
}

async function main() {
  if (!url || !serviceKey) {
    console.error(
      "\nMissing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
        "Add them to web/.env.local (Supabase → Settings → API).\n",
    );
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const slug = argSlug();
  let tenantQuery = supabase.from("tenants").select("id, name, slug").order("created_at");
  if (slug) {
    tenantQuery = supabase.from("tenants").select("id, name, slug").eq("slug", slug).maybeSingle();
  }

  const { data: tenantsOrOne, error: tErr } = slug
    ? await tenantQuery
    : await supabase.from("tenants").select("id, name, slug").order("created_at");

  if (tErr) {
    console.error("tenants:", tErr.message);
    process.exit(1);
  }

  const list = slug ? (tenantsOrOne ? [tenantsOrOne] : []) : tenantsOrOne ?? [];
  if (list.length === 0) {
    console.error(
      slug
        ? `No tenant with slug "${slug}". Create a property first or omit --slug to use the first tenant.`
        : "No tenants found. Create a tenant (e.g. superadmin) before seeding.",
    );
    process.exit(1);
  }

  const tenant = list[0];
  const tenantId = tenant.id;
  console.log(`Using tenant: ${tenant.name} (${tenant.slug})  id=${tenantId}\n`);

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  // --- cleanup previous demo seed for this tenant (order respects FKs) ---
  const { data: demoEmps } = await supabase
    .from("employees")
    .select("id")
    .eq("tenant_id", tenantId)
    .like("employee_code", "DEMO-%");
  const demoEmpIds = (demoEmps ?? []).map((e) => e.id);

  const { data: resv } = await supabase
    .from("reservations")
    .select("id")
    .eq("tenant_id", tenantId)
    .like("confirmation_code", "DEMO-%");
  for (const r of resv ?? []) {
    await supabase.from("reservations").delete().eq("id", r.id);
  }

  await supabase.from("guests").delete().eq("tenant_id", tenantId).like("email", "%@demo.seed.internal");

  const { data: demoRooms } = await supabase
    .from("rooms")
    .select("id")
    .eq("tenant_id", tenantId)
    .like("room_number", "D-%");
  for (const room of demoRooms ?? []) {
    await supabase.from("rooms").delete().eq("id", room.id);
  }

  await supabase.from("room_types").delete().eq("tenant_id", tenantId).like("name", "[Demo]%");

  if (demoEmpIds.length > 0) {
    await supabase.from("employees").delete().in("id", demoEmpIds);
  }

  const { data: demoDepts } = await supabase
    .from("departments")
    .select("id")
    .eq("tenant_id", tenantId)
    .like("name", "[Demo]%");
  for (const d of demoDepts ?? []) {
    await supabase.from("departments").delete().eq("id", d.id);
  }

  // --- departments ---
  const deptRows = [
    { tenant_id: tenantId, name: "[Demo] Front Office" },
    { tenant_id: tenantId, name: "[Demo] Housekeeping" },
    { tenant_id: tenantId, name: "[Demo] Food & Beverage" },
    { tenant_id: tenantId, name: "[Demo] Engineering" },
  ];
  const { data: depts, error: dErr } = await supabase.from("departments").insert(deptRows).select("id, name");
  if (dErr || !depts?.length) {
    console.error("departments insert:", dErr?.message);
    process.exit(1);
  }
  const byName = Object.fromEntries(depts.map((d) => [d.name, d.id]));

  // --- employees (no auth users; directory + org charts only) ---
  const empSpecs = [
    {
      code: "DEMO-001",
      name: "Amina Rahman",
      email: "amina.rahman@demo.seed.internal",
      title: "Front Desk Supervisor",
      dept: "[Demo] Front Office",
      status: "active",
      hire: "2022-03-15",
    },
    {
      code: "DEMO-002",
      name: "James Okafor",
      email: "james.okafor@demo.seed.internal",
      title: "Night Auditor",
      dept: "[Demo] Front Office",
      status: "active",
      hire: "2023-01-10",
    },
    {
      code: "DEMO-003",
      name: "Sofia Lindström",
      email: "sofia.lindstrom@demo.seed.internal",
      title: "Executive Housekeeper",
      dept: "[Demo] Housekeeping",
      status: "active",
      hire: "2021-07-01",
    },
    {
      code: "DEMO-004",
      name: "Marcus Chen",
      email: "marcus.chen@demo.seed.internal",
      title: "Room Attendant",
      dept: "[Demo] Housekeeping",
      status: "probation",
      hire: "2025-11-01",
    },
    {
      code: "DEMO-005",
      name: "Elena Vasquez",
      email: "elena.vasquez@demo.seed.internal",
      title: "Restaurant Manager",
      dept: "[Demo] Food & Beverage",
      status: "active",
      hire: "2020-05-20",
    },
    {
      code: "DEMO-006",
      name: "David Mensah",
      email: "david.mensah@demo.seed.internal",
      title: "Sous Chef",
      dept: "[Demo] Food & Beverage",
      status: "active",
      hire: "2024-02-14",
    },
    {
      code: "DEMO-007",
      name: "Yuki Tanaka",
      email: "yuki.tanaka@demo.seed.internal",
      title: "Chief Engineer",
      dept: "[Demo] Engineering",
      status: "active",
      hire: "2019-09-01",
    },
    {
      code: "DEMO-008",
      name: "Priya Nair",
      email: "priya.nair@demo.seed.internal",
      title: "Maintenance Tech",
      dept: "[Demo] Engineering",
      status: "on_leave",
      hire: "2023-08-22",
    },
  ];

  const employeePayload = empSpecs.map((e) => ({
    tenant_id: tenantId,
    department_id: byName[e.dept],
    employee_code: e.code,
    full_name: e.name,
    email: e.email,
    job_title: e.title,
    status: e.status,
    hire_date: e.hire,
  }));

  const { data: emps, error: eErr } = await supabase.from("employees").insert(employeePayload).select("id, full_name, employee_code");
  if (eErr || !emps?.length) {
    console.error("employees insert:", eErr?.message);
    process.exit(1);
  }

  const empByCode = Object.fromEntries(emps.map((r) => [r.employee_code, r.id]));

  // --- shifts (today + yesterday so dashboard / scheduling have signal) ---
  const shiftRows = [];
  const addShift = (code, date, start, end, type) => {
    const id = empByCode[code];
    if (!id) return;
    shiftRows.push({
      tenant_id: tenantId,
      employee_id: id,
      shift_date: date,
      start_time: start,
      end_time: end,
      shift_type: type,
    });
  };
  addShift("DEMO-001", today, "07:00:00", "15:00:00", "morning");
  addShift("DEMO-002", today, "23:00:00", "07:00:00", "night");
  addShift("DEMO-003", today, "08:00:00", "16:00:00", "morning");
  addShift("DEMO-004", today, "10:00:00", "18:00:00", "mid");
  addShift("DEMO-005", yesterday, "11:00:00", "22:00:00", "split");
  addShift("DEMO-006", today, "12:00:00", "20:00:00", "afternoon");
  addShift("DEMO-007", today, "09:00:00", "17:00:00", "day");
  addShift("DEMO-008", yesterday, "09:00:00", "17:00:00", "day");

  const { error: sErr } = await supabase.from("shifts").insert(shiftRows);
  if (sErr) {
    console.error("shifts insert:", sErr.message);
    process.exit(1);
  }

  // --- attendance punches (UTC “today” window matches dashboard stats) ---
  const punch = (code, type, iso) => ({
    tenant_id: tenantId,
    employee_id: empByCode[code],
    punch_type: type,
    punched_at: iso,
    source: "demo_seed",
  });
  const tMorning = `${today}T08:05:00.000Z`;
  const tLunchIn = `${today}T12:45:00.000Z`;
  const tOut = `${today}T16:02:00.000Z`;

  const punchRows = [
    punch("DEMO-001", "in", tMorning),
    punch("DEMO-001", "out", tOut),
    punch("DEMO-003", "in", `${today}T07:58:00.000Z`),
    punch("DEMO-003", "out", `${today}T12:00:00.000Z`),
    punch("DEMO-003", "in", tLunchIn),
    punch("DEMO-006", "in", `${today}T11:55:00.000Z`),
    punch("DEMO-007", "in", `${today}T08:30:00.000Z`),
  ].filter((r) => r.employee_id);

  const { error: pErr } = await supabase.from("attendance_logs").insert(punchRows);
  if (pErr) {
    console.error("attendance_logs insert:", pErr.message);
    process.exit(1);
  }

  // --- HRRM sample ---
  const { data: rt, error: rtErr } = await supabase
    .from("room_types")
    .insert([
      { tenant_id: tenantId, name: "[Demo] Standard Queen", capacity: 2 },
      { tenant_id: tenantId, name: "[Demo] Junior Suite", capacity: 3 },
    ])
    .select("id, name");

  if (rtErr || !rt?.length) {
    console.error("room_types insert:", rtErr?.message);
    process.exit(1);
  }
  const rtStandard = rt.find((x) => x.name.includes("Standard"))?.id;
  const rtSuite = rt.find((x) => x.name.includes("Suite"))?.id;

  const { data: roomsIns, error: roomErr } = await supabase
    .from("rooms")
    .insert([
      { tenant_id: tenantId, room_type_id: rtStandard, room_number: "D-101", floor: "1", building: "Main" },
      { tenant_id: tenantId, room_type_id: rtStandard, room_number: "D-102", floor: "1", building: "Main" },
      { tenant_id: tenantId, room_type_id: rtSuite, room_number: "D-201", floor: "2", building: "Main" },
    ])
    .select("id, room_number");

  if (roomErr || !roomsIns?.length) {
    console.error("rooms insert:", roomErr?.message);
    process.exit(1);
  }
  const room101 = roomsIns.find((r) => r.room_number === "D-101")?.id;
  const room201 = roomsIns.find((r) => r.room_number === "D-201")?.id;

  const { data: guestsIns, error: gErr } = await supabase
    .from("guests")
    .insert([
      { tenant_id: tenantId, full_name: "Demo Guest — Anna Müller", email: "anna.mueller@demo.seed.internal", loyalty_tier: "gold" },
      { tenant_id: tenantId, full_name: "Demo Guest — Omar Haddad", email: "omar.haddad@demo.seed.internal", loyalty_tier: "silver" },
    ])
    .select("id, full_name");

  if (gErr || !guestsIns?.length) {
    console.error("guests insert:", gErr?.message);
    process.exit(1);
  }
  const g1 = guestsIns[0].id;
  const g2 = guestsIns[1].id;

  const checkoutSoon = new Date();
  checkoutSoon.setDate(checkoutSoon.getDate() + 3);
  const in7 = new Date();
  in7.setDate(in7.getDate() + 7);
  const out10 = new Date();
  out10.setDate(out10.getDate() + 10);

  const toDate = (d) => d.toISOString().slice(0, 10);

  const { error: resErr } = await supabase.from("reservations").insert([
    {
      tenant_id: tenantId,
      guest_id: g1,
      room_id: room101,
      confirmation_code: "DEMO-RES-CHK",
      check_in: toDate(new Date()),
      check_out: toDate(checkoutSoon),
      status: "checked_in",
      balance_cents: 12500,
    },
    {
      tenant_id: tenantId,
      guest_id: g2,
      room_id: room201,
      confirmation_code: "DEMO-RES-BKD",
      check_in: toDate(in7),
      check_out: toDate(out10),
      status: "confirmed",
      balance_cents: 48900,
    },
  ]);

  if (resErr) {
    console.error("reservations insert:", resErr.message);
    process.exit(1);
  }

  console.log("Seeded successfully:\n");
  console.log(`  Departments: ${depts.length} ([Demo] …)`);
  console.log(`  Employees:   ${emps.length} (codes DEMO-001 … DEMO-008)`);
  console.log(`  Shifts:      ${shiftRows.length} (dates include ${today} and ${yesterday})`);
  console.log(`  Attendance:  ${punchRows.length} punches (UTC today)`);
  console.log(`  HRRM:        room types, rooms D-101/D-102/D-201, 2 guests, 2 reservations`);
  console.log("\nOpen HRMS as a user linked to this tenant: Employee directory, Org structure,");
  console.log("Dashboard, Scheduling, Attendance, and HRRM modules should show this data.\n");
  console.log("Re-run this script anytime; it removes only rows tagged [Demo] / DEMO- / demo.seed.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
