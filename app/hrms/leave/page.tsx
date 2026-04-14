import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/queries/context";
import { canManageHrStaff } from "@/lib/auth/can-manage-hr-staff";
import { fetchLeaveRequests, fetchEmployeeOptions } from "@/lib/queries/hrms-extended";
import { HrmsLeaveClient } from "@/components/hrms/hrms-leave-client";
import { HrmsLinkButton } from "@/components/hrms/hrms-link-button";

export default async function HrmsLeavePage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  const tenantId = ctx.tenantId;
  if (!tenantId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
          Leave & absence
        </h1>
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          Assign a tenant to use leave requests.
        </p>
      </div>
    );
  }

  const [manage, leaveRes, empRes] = await Promise.all([
    canManageHrStaff(ctx),
    fetchLeaveRequests(tenantId),
    fetchEmployeeOptions(tenantId),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
            Leave & absence
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Create and approve leave requests. Data is stored in <code className="text-zinc-400">leave_requests</code>.
          </p>
        </div>
        <HrmsLinkButton href="/hrms/time" variant="secondary">
          Time & attendance
        </HrmsLinkButton>
      </div>

      {leaveRes.error ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          {leaveRes.error} — run the latest Supabase migration if tables are missing.
        </p>
      ) : null}

      <HrmsLeaveClient
        tenantId={tenantId}
        canManage={manage}
        rows={leaveRes.rows}
        employees={empRes.rows}
      />
    </div>
  );
}
