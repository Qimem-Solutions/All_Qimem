import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/queries/context";
import { canManageHrStaff } from "@/lib/auth/can-manage-hr-staff";
import { fetchJobRequisitions, fetchJobCandidates } from "@/lib/queries/hrms-extended";
import { fetchTenantDepartmentsForSelect } from "@/lib/queries/tenant-data";
import { HrmsRecruitmentClient } from "@/components/hrms/hrms-recruitment-client";
import { toUserFacingError } from "@/lib/errors/user-facing";

export default async function HrmsRecruitmentPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  const tenantId = ctx.tenantId;
  if (!tenantId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
          Recruitment
        </h1>
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          Assign a tenant to load recruitment.
        </p>
      </div>
    );
  }

  const [manage, reqs, cands, depts] = await Promise.all([
    canManageHrStaff(ctx),
    fetchJobRequisitions(tenantId),
    fetchJobCandidates(tenantId),
    fetchTenantDepartmentsForSelect(tenantId),
  ]);

  const err = reqs.error || cands.error;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
          Recruitment
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Submit applications with CV and department, track status, and promote passes into the employee directory.
        </p>
      </div>

      {err ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          {toUserFacingError(err)}
        </p>
      ) : null}

      <HrmsRecruitmentClient
        tenantId={tenantId}
        canManage={manage}
        canApply
        requisitions={reqs.rows}
        candidates={cands.rows}
        departments={depts.rows}
      />
    </div>
  );
}
