import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/queries/context";

export type SubscriptionBillingEventRow = {
  id: string;
  tenant_id: string;
  tenant_name: string | null;
  tenant_slug: string | null;
  subscription_id: string | null;
  /** YYYY-MM-DD (first of month) */
  service_month: string;
  plan: string;
  source: string;
  created_at: string | null;
};

export async function fetchSubscriptionBillingEventsForSuperadmin(): Promise<{
  rows: SubscriptionBillingEventRow[];
  error: string | null;
}> {
  const ctx = await getUserContext();
  if (!ctx || ctx.globalRole !== "superadmin") {
    return { rows: [], error: null };
  }

  const supabase = await createClient();
  const { data: events, error: evErr } = await supabase
    .from("subscription_billing_events")
    .select("id, tenant_id, subscription_id, service_month, plan, source, created_at")
    .order("created_at", { ascending: false });

  if (evErr) {
    const msg = evErr.message ?? "";
    if (msg.includes("relation") || msg.includes("does not exist") || msg.includes("schema cache")) {
      return {
        rows: [],
        error:
          "Billing ledger table missing — run migration subscription_billing_events (subscription_billing_events).",
      };
    }
    return { rows: [], error: msg };
  }

  const tenantIds = [...new Set((events ?? []).map((e) => e.tenant_id).filter(Boolean))] as string[];
  let nameById = new Map<string, { name: string; slug: string }>();
  if (tenantIds.length > 0) {
    const { data: tenants } = await supabase.from("tenants").select("id, name, slug").in("id", tenantIds);
    nameById = new Map(
      (tenants ?? []).map((t) => [t.id as string, { name: t.name as string, slug: t.slug as string }]),
    );
  }

  const rows: SubscriptionBillingEventRow[] = (events ?? []).map((e) => {
    const t = nameById.get(e.tenant_id as string);
    const sm = e.service_month as string;
    return {
      id: e.id as string,
      tenant_id: e.tenant_id as string,
      tenant_name: t?.name ?? null,
      tenant_slug: t?.slug ?? null,
      subscription_id: (e.subscription_id as string | null) ?? null,
      service_month: typeof sm === "string" ? sm.slice(0, 10) : String(sm),
      plan: String(e.plan ?? ""),
      source: String(e.source ?? ""),
      created_at: (e.created_at as string | null) ?? null,
    };
  });

  return { rows, error: null };
}
