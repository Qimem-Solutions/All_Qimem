import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getUserContext } from "@/lib/queries/context";
import { fetchAdminsForSuperadmin, fetchTenantsForSelect } from "@/lib/queries/superadmin";
import { CreateAdminButton } from "./create-admin-button";
import { AdminRowActions } from "@/components/superadmin/admin-row-actions";

function formatRole(role: string | null) {
  if (!role) return "—";
  return role.replace(/_/g, " ");
}

export default async function HotelAdminsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  if (ctx.globalRole !== "superadmin") redirect("/");

  const sp = await searchParams;
  const notice = sp.notice ? decodeURIComponent(sp.notice) : null;

  const [{ rows, error }, { rows: tenantOptions } ] = await Promise.all([
    fetchAdminsForSuperadmin(),
    fetchTenantsForSelect(),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
            Hotel admins
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Create hotel admins with a login email and default password, assign them to a hotel, or
            use pending rows from tenant provisioning.
          </p>
        </div>
        <CreateAdminButton tenants={tenantOptions} />
      </div>

      {notice ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
          {notice}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Assignments</CardTitle>
          <CardDescription>
            Active users are Supabase Auth profiles linked to a hotel. Use <strong>Create admin</strong>{" "}
            to add a password-based account (default password <strong>Admin@123</strong> unless you
            change it).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 && !error ? (
            <p className="text-sm text-zinc-500">
              No admins yet. Create a tenant first, then click <strong>Create admin</strong> and pick
              the hotel.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-zinc-500">
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Email</th>
                  <th className="pb-3 font-medium">Tenant</th>
                  <th className="pb-3 font-medium">Role</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 w-[4rem] font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="py-3 text-white">{r.full_name ?? "—"}</td>
                    <td className="py-3 font-mono text-xs text-zinc-400">
                      {r.admin_email ?? "—"}
                    </td>
                    <td className="py-3">{r.tenant_name ?? "—"}</td>
                    <td className="py-3 capitalize">{formatRole(r.global_role)}</td>
                    <td className="py-3">
                      {r.status === "pending_invite" ? (
                        <Badge tone="orange">Pending invite</Badge>
                      ) : r.auth_banned ? (
                        <Badge tone="red">Inactive</Badge>
                      ) : (
                        <Badge tone="green">Active</Badge>
                      )}
                    </td>
                    <td className="py-3 text-right align-middle">
                      <AdminRowActions row={r} tenants={tenantOptions} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
