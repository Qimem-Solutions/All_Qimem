/**
 * Creates or updates the Supabase Auth user for the platform superadmin,
 * then sets public.profiles.global_role = 'superadmin'.
 *
 * SQL migrations do NOT create auth.users rows — only this Admin API can.
 *
 * Usage (from the `web` folder):
 *   1. Add to .env.local:
 *        SUPABASE_SERVICE_ROLE_KEY=<from Supabase → Project Settings → API → service_role>
 *   2. node --env-file=.env.local scripts/seed-superadmin.mjs
 *
 * Or: npm run seed:superadmin
 */

import { createClient } from "@supabase/supabase-js";

const EMAIL = "superadmin@qimem.com";
const PASSWORD = "Qimem@123";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "\nMissing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Add SUPABASE_SERVICE_ROLE_KEY to web/.env.local (Dashboard → Settings → API → service_role secret).\n",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) {
    console.error("listUsers:", listErr.message);
    process.exit(1);
  }

  const existing = list.users.find(
    (u) => u.email?.toLowerCase() === EMAIL.toLowerCase(),
  );

  let userId;

  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "Platform Superadmin" },
    });
    if (error) {
      console.error("updateUserById:", error.message);
      process.exit(1);
    }
    userId = data.user.id;
    console.log("Updated existing Auth user:", EMAIL);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "Platform Superadmin" },
    });
    if (error) {
      console.error("createUser:", error.message);
      process.exit(1);
    }
    userId = data.user.id;
    console.log("Created Auth user:", EMAIL);
  }

  const { error: profErr } = await supabase.from("profiles").upsert(
    {
      id: userId,
      full_name: "Platform Superadmin",
      global_role: "superadmin",
      tenant_id: null,
      must_change_password: true,
    },
    { onConflict: "id" },
  );

  if (profErr) {
    console.error("profiles upsert:", profErr.message);
    process.exit(1);
  }

  console.log("profiles.global_role set to superadmin.");
  console.log("\nYou can sign in at /login with Superadmin tab selected.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
