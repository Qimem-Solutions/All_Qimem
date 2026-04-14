import { createClient } from "@/lib/supabase/server";

export type UserContext = {
  userId: string;
  globalRole: string | null;
  tenantId: string | null;
  fullName: string | null;
};

export async function getUserContext(): Promise<UserContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("global_role, tenant_id, full_name")
    .eq("id", user.id)
    .maybeSingle();

  return {
    userId: user.id,
    globalRole: profile?.global_role ?? null,
    tenantId: profile?.tenant_id ?? null,
    fullName: profile?.full_name ?? null,
  };
}

export async function requireTenantId(): Promise<string | null> {
  const ctx = await getUserContext();
  return ctx?.tenantId ?? null;
}
