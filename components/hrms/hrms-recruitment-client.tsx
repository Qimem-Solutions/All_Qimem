"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Briefcase,
  Building2,
  ClipboardList,
  FileText,
  ListChecks,
  Loader2,
  Mail,
  Megaphone,
  Phone,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  createJobRequisitionAction,
  updateJobRequisitionStatusAction,
  updateJobCandidateStageAction,
  submitRecruitmentApplicationAction,
} from "@/lib/actions/hrms-modules";
import type { JobRequisitionRow, JobCandidateRow } from "@/lib/queries/hrms-extended";

const STAGES = ["submitted", "on_interview", "passed", "rejected"] as const;

function fileNameFromCvPath(path: string): string {
  const seg = path.split("/").pop();
  return seg && seg.length > 0 ? seg : "document";
}

const STATUS_LABEL: Record<string, string> = {
  submitted: "Submitted",
  on_interview: "On interview",
  passed: "Passed",
  rejected: "Rejected",
};

function StatusBadge({ stage }: { stage: string }) {
  const label = STATUS_LABEL[stage] ?? stage;
  switch (stage) {
    case "submitted":
      return <Badge tone="orange">{label}</Badge>;
    case "on_interview":
      return <Badge tone="gold">{label}</Badge>;
    case "passed":
      return <Badge tone="green">{label}</Badge>;
    case "rejected":
      return <Badge tone="red">{label}</Badge>;
    default:
      return <Badge tone="gray">{label}</Badge>;
  }
}

type Props = {
  tenantId: string;
  canManage: boolean;
  canApply: boolean;
  requisitions: JobRequisitionRow[];
  candidates: JobCandidateRow[];
  departments: { id: string; name: string }[];
};

type RecruitmentTab = "recruitment" | "applications" | "job-postings" | "posting-status";

export function HrmsRecruitmentClient({
  tenantId,
  canManage,
  canApply,
  requisitions,
  candidates,
  departments,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<RecruitmentTab>("recruitment");
  const [applyDeptId, setApplyDeptId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cvPreview, setCvPreview] = useState<{ storagePath: string } | null>(null);
  const [cvBlobUrl, setCvBlobUrl] = useState<string | null>(null);
  const [cvBlobLoading, setCvBlobLoading] = useState(false);
  const [cvBlobError, setCvBlobError] = useState<string | null>(null);
  const cvBlobUrlRef = useRef<string | null>(null);
  const [applyState, applyAction, applyPending] = useActionState(submitRecruitmentApplicationAction, null);

  useEffect(() => {
    if (applyState?.ok) router.refresh();
  }, [applyState?.ok, router]);

  useEffect(() => {
    if (!canManage && (tab === "job-postings" || tab === "posting-status")) {
      setTab("recruitment");
    }
  }, [canManage, tab]);

  useEffect(() => {
    if (!cvPreview) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCvPreview(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [cvPreview]);

  useEffect(() => {
    if (!cvPreview) {
      if (cvBlobUrlRef.current) {
        URL.revokeObjectURL(cvBlobUrlRef.current);
        cvBlobUrlRef.current = null;
      }
      setCvBlobUrl(null);
      setCvBlobLoading(false);
      setCvBlobError(null);
      return;
    }

    let cancelled = false;

    if (cvBlobUrlRef.current) {
      URL.revokeObjectURL(cvBlobUrlRef.current);
      cvBlobUrlRef.current = null;
    }
    setCvBlobUrl(null);
    setCvBlobError(null);
    setCvBlobLoading(true);

    (async () => {
      try {
        const res = await fetch(
          `/api/hrms/cv-preview?path=${encodeURIComponent(cvPreview.storagePath)}`,
          { credentials: "include" },
        );
        if (!res.ok) {
          let msg = "Could not load CV.";
          try {
            const j = await res.json();
            if (j && typeof j.error === "string") msg = j.error;
          } catch {
            /* ignore */
          }
          if (!cancelled) setCvBlobError(msg);
          return;
        }
        const blob = await res.blob();
        const isPdf = cvPreview.storagePath.toLowerCase().endsWith(".pdf");
        const typed =
          isPdf && (!blob.type || blob.type === "application/octet-stream")
            ? new Blob([blob], { type: "application/pdf" })
            : blob;
        const url = URL.createObjectURL(typed);
        cvBlobUrlRef.current = url;
        if (!cancelled) setCvBlobUrl(url);
      } catch (e) {
        if (!cancelled) {
          setCvBlobError(e instanceof Error ? e.message : "Failed to load CV.");
        }
      } finally {
        if (!cancelled) setCvBlobLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (cvBlobUrlRef.current) {
        URL.revokeObjectURL(cvBlobUrlRef.current);
        cvBlobUrlRef.current = null;
      }
    };
  }, [cvPreview]);

  const openPostings = useMemo(
    () => requisitions.filter((r) => r.status === "open"),
    [requisitions],
  );

  const postingsForDepartment = useMemo(() => {
    if (!applyDeptId) return [];
    return openPostings.filter(
      (r) => r.department_id === applyDeptId || r.department_id == null,
    );
  }, [openPostings, applyDeptId]);

  async function onReq(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!canManage) return;
    setErr(null);
    setLoading(true);
    const fd = new FormData(form);
    const res = await createJobRequisitionAction({
      tenantId,
      title: String(fd.get("title")),
      departmentId: String(fd.get("departmentId") ?? "") || null,
      description: String(fd.get("description") ?? "") || null,
    });
    setLoading(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    form.reset();
    router.refresh();
  }

  async function reqStatus(id: string, status: "open" | "paused" | "closed") {
    if (!canManage) return;
    const res = await updateJobRequisitionStatusAction({ tenantId, id, status });
    if (!res.ok) setErr(res.error);
    else router.refresh();
  }

  async function candStage(id: string, stage: string) {
    if (!canManage) return;
    const res = await updateJobCandidateStageAction({ tenantId, candidateId: id, stage });
    if (!res.ok) setErr(res.error);
    else router.refresh();
  }

  function openCv(path: string) {
    if (!canManage) return;
    setCvPreview({ storagePath: path });
  }

  const cvPreviewIsPdf = cvPreview?.storagePath.toLowerCase().endsWith(".pdf") ?? false;

  const applyError = applyState && !applyState.ok ? applyState.error : null;
  const applyOk = applyState?.ok === true;

  return (
    <div className="space-y-8">
      {cvPreview ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cv-preview-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/75 backdrop-blur-[2px]"
            onClick={() => setCvPreview(null)}
            aria-label="Close CV preview"
          />
          <div className="relative z-10 flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl ring-1 ring-white/5">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <h2 id="cv-preview-title" className="text-sm font-semibold text-zinc-100">
                CV preview
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!cvBlobUrl}
                  className="text-xs font-medium text-gold hover:text-gold/90 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => {
                    if (cvBlobUrl) window.open(cvBlobUrl, "_blank", "noopener,noreferrer");
                  }}
                >
                  Open in new tab
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-zinc-400 hover:text-white"
                  onClick={() => setCvPreview(null)}
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="min-h-0 flex-1 bg-zinc-900/80">
              {cvBlobLoading ? (
                <div className="flex h-[min(78vh,800px)] flex-col items-center justify-center gap-3 text-zinc-500">
                  <Loader2 className="h-8 w-8 animate-spin text-gold/80" aria-hidden />
                  <span className="text-sm">Loading document…</span>
                </div>
              ) : null}
              {cvBlobError ? (
                <div className="flex h-[min(78vh,800px)] items-center justify-center px-4">
                  <p className="text-center text-sm text-red-300">{cvBlobError}</p>
                </div>
              ) : null}
              {!cvBlobLoading && !cvBlobError && cvBlobUrl && cvPreviewIsPdf ? (
                <embed
                  src={cvBlobUrl}
                  type="application/pdf"
                  className="h-[min(78vh,800px)] w-full bg-zinc-950"
                  aria-label="CV PDF preview"
                />
              ) : null}
              {!cvBlobLoading && !cvBlobError && cvBlobUrl && cvPreview && !cvPreviewIsPdf ? (
                <div className="flex h-[min(78vh,800px)] flex-col items-center justify-center gap-4 px-6 text-center">
                  <p className="max-w-md text-sm text-zinc-400">
                    In-browser preview works best for PDFs. Download this file to open it in Word or another app.
                  </p>
                  <a
                    href={cvBlobUrl}
                    download={fileNameFromCvPath(cvPreview.storagePath)}
                    className="rounded-lg border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-medium text-gold hover:bg-gold/20"
                  >
                    Download file
                  </a>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {(err || applyError) && (
        <p className="rounded-xl border border-red-500/30 bg-red-950/25 px-4 py-3 text-sm text-red-100">
          {err ?? applyError}
        </p>
      )}

      {applyOk ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-100">
          Application received. Your status is <strong>Submitted</strong>. HR will update it as you move through the
          process.
        </p>
      ) : null}

      <div className="flex flex-col gap-2" role="tablist" aria-label="Recruitment sections">
        <div className="flex w-full flex-wrap gap-1 rounded-xl border border-white/10 bg-zinc-950/70 p-1">
          <button
            type="button"
            role="tab"
            id="tab-recruitment"
            aria-selected={tab === "recruitment"}
            aria-controls="panel-recruitment"
            className={cn(
              "flex min-w-[calc(50%-4px)] flex-1 items-center justify-center gap-2 rounded-lg px-2.5 py-2.5 text-sm font-medium transition-colors [font-family:var(--font-outfit),system-ui,sans-serif] sm:min-w-0",
              tab === "recruitment"
                ? "bg-gold/15 text-gold shadow-sm ring-1 ring-gold/25"
                : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300",
            )}
            onClick={() => setTab("recruitment")}
          >
            <Briefcase className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            <span className="truncate">Recruitment</span>
          </button>
          <button
            type="button"
            role="tab"
            id="tab-applications"
            aria-selected={tab === "applications"}
            aria-controls="panel-applications"
            className={cn(
              "flex min-w-[calc(50%-4px)] flex-1 items-center justify-center gap-2 rounded-lg px-2.5 py-2.5 text-sm font-medium transition-colors [font-family:var(--font-outfit),system-ui,sans-serif] sm:min-w-0",
              tab === "applications"
                ? "bg-gold/15 text-gold shadow-sm ring-1 ring-gold/25"
                : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300",
            )}
            onClick={() => setTab("applications")}
          >
            <ClipboardList className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            <span className="truncate">Applications</span>
            <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-400">
              {candidates.length}
            </span>
          </button>
          {canManage ? (
            <>
              <button
                type="button"
                role="tab"
                id="tab-job-postings"
                aria-selected={tab === "job-postings"}
                aria-controls="panel-job-postings"
                className={cn(
                  "flex min-w-[calc(50%-4px)] flex-1 items-center justify-center gap-2 rounded-lg px-2.5 py-2.5 text-sm font-medium transition-colors [font-family:var(--font-outfit),system-ui,sans-serif] sm:min-w-0",
                  tab === "job-postings"
                    ? "bg-gold/15 text-gold shadow-sm ring-1 ring-gold/25"
                    : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300",
                )}
                onClick={() => setTab("job-postings")}
              >
                <Megaphone className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                <span className="truncate">Job postings</span>
                <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-400">
                  {requisitions.length}
                </span>
              </button>
              <button
                type="button"
                role="tab"
                id="tab-posting-status"
                aria-selected={tab === "posting-status"}
                aria-controls="panel-posting-status"
                className={cn(
                  "flex min-w-[calc(50%-4px)] flex-1 items-center justify-center gap-2 rounded-lg px-2.5 py-2.5 text-sm font-medium transition-colors [font-family:var(--font-outfit),system-ui,sans-serif] sm:min-w-0",
                  tab === "posting-status"
                    ? "bg-gold/15 text-gold shadow-sm ring-1 ring-gold/25"
                    : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300",
                )}
                onClick={() => setTab("posting-status")}
              >
                <ListChecks className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                <span className="truncate">Posting status</span>
              </button>
            </>
          ) : null}
        </div>
      </div>

      {tab === "recruitment" ? (
        <div id="panel-recruitment" role="tabpanel" aria-labelledby="tab-recruitment" className="space-y-10">
          {/* Apply — open to all tenant users */}
          {canApply && departments.length > 0 && openPostings.length === 0 ? (
            <p className="rounded-xl border border-amber-500/25 bg-amber-950/15 px-4 py-3 text-sm text-amber-100/90">
              There are no <strong className="text-amber-200">open</strong> job postings yet. HR can create one under{" "}
              <strong className="text-amber-200">Job postings</strong> (set status to Open).
            </p>
          ) : null}

          {canApply && departments.length > 0 && openPostings.length > 0 ? (
        <section className="relative overflow-hidden rounded-2xl border border-gold/20 bg-gradient-to-br from-zinc-900/90 via-zinc-950 to-black p-1 shadow-xl shadow-black/40">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gold/5 blur-3xl" aria-hidden />
          <div className="relative rounded-[14px] border border-white/5 bg-zinc-950/80 p-6 md:p-8">
            <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold">
                  <Sparkles className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
                    Apply for a role
                  </h2>
                  <p className="mt-1 max-w-xl text-sm text-zinc-500">
                    Submit your details and CV. Status starts as <span className="text-zinc-300">Submitted</span> after
                    you send this form.
                  </p>
                </div>
              </div>
            </div>

            <form action={applyAction} className="grid gap-5 md:grid-cols-2">
              <input type="hidden" name="tenantId" value={tenantId} />

              <label className="md:col-span-2 flex flex-col gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
                <span className="flex items-center gap-1.5 normal-case text-zinc-300">
                  <User className="h-3.5 w-3.5 text-gold/80" aria-hidden />
                  Full name
                </span>
                <Input
                  className="h-11 border-white/10 bg-black/40"
                  name="fullName"
                  required
                  placeholder="Jane Doe"
                  autoComplete="name"
                />
              </label>

              <label className="flex flex-col gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
                <span className="flex items-center gap-1.5 normal-case text-zinc-300">
                  <Mail className="h-3.5 w-3.5 text-gold/80" aria-hidden />
                  Email
                </span>
                <Input
                  className="h-11 border-white/10 bg-black/40"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </label>

              <label className="flex flex-col gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
                <span className="flex items-center gap-1.5 normal-case text-zinc-300">
                  <Phone className="h-3.5 w-3.5 text-gold/80" aria-hidden />
                  Phone
                </span>
                <Input className="h-11 border-white/10 bg-black/40" name="phone" type="tel" placeholder="+1 …" />
              </label>

              <label className="flex flex-col gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
                <span className="flex items-center gap-1.5 normal-case text-zinc-300">
                  <Building2 className="h-3.5 w-3.5 text-gold/80" aria-hidden />
                  Department
                </span>
                <select
                  required
                  value={applyDeptId}
                  onChange={(e) => setApplyDeptId(e.target.value)}
                  className="h-11 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-sm text-zinc-100 outline-none ring-gold/30 focus:ring-2"
                >
                  <option value="">Select department…</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
                <span className="flex items-center gap-1.5 normal-case text-zinc-300">
                  <Briefcase className="h-3.5 w-3.5 text-gold/80" aria-hidden />
                  Open position
                </span>
                <select
                  key={applyDeptId || "none"}
                  name="requisitionId"
                  required
                  disabled={!applyDeptId || postingsForDepartment.length === 0}
                  className="h-11 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-sm text-zinc-100 outline-none ring-gold/30 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">
                    {!applyDeptId
                      ? "Choose a department first…"
                      : postingsForDepartment.length === 0
                        ? "No open positions for this department"
                        : "Select a posting…"}
                  </option>
                  {postingsForDepartment.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                      {r.department_name ? ` · ${r.department_name}` : ""}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] font-normal normal-case text-zinc-600">
                  Only postings with status <span className="text-zinc-400">Open</span> are listed.
                </span>
              </label>

              <label className="md:col-span-2 flex flex-col gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
                <span className="flex items-center gap-1.5 normal-case text-zinc-300">
                  <FileText className="h-3.5 w-3.5 text-gold/80" aria-hidden />
                  CV / résumé
                </span>
                <input
                  name="cv"
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf"
                  className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-gold/15 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-gold hover:file:bg-gold/25"
                />
                <span className="text-[11px] font-normal normal-case text-zinc-600">PDF or Word, up to 10 MB.</span>
              </label>

              <label className="md:col-span-2 flex flex-col gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
                <span className="normal-case text-zinc-300">Notes (optional)</span>
                <textarea
                  name="notes"
                  rows={3}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none ring-gold/30 focus:ring-2"
                  placeholder="Cover letter highlights, availability…"
                />
              </label>

              <div className="md:col-span-2 flex flex-wrap items-center gap-3 pt-1">
                <Button
                  type="submit"
                  disabled={
                    applyPending ||
                    !applyDeptId ||
                    postingsForDepartment.length === 0
                  }
                  className="gap-2"
                >
                  {applyPending ? "Sending…" : "Submit application"}
                  <ArrowRight className="h-4 w-4 opacity-80" aria-hidden />
                </Button>
                <span className="text-xs text-zinc-600">Initial status: Submitted</span>
              </div>
            </form>
          </div>
        </section>
      ) : canApply && departments.length === 0 ? (
        <p className="rounded-xl border border-amber-500/25 bg-amber-950/15 px-4 py-3 text-sm text-amber-100/90">
          Add at least one department (Hotel → Users or org settings) before applications can be submitted.
        </p>
      ) : null}

          {!canManage ? (
            <p className="text-sm text-zinc-600">
              HR managers can create postings, change application status, and open CVs. Passed hires sync to the employee
              directory for that department.
            </p>
          ) : null}
        </div>
      ) : null}

      {tab === "applications" ? (
        <div id="panel-applications" role="tabpanel" aria-labelledby="tab-applications" className="space-y-4">
          <div className="flex flex-col gap-1 border-b border-white/5 pb-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
                Application pipeline
              </h2>
              <p className="text-sm text-zinc-500">
                Submitted → On interview → Passed (adds to employee directory) or Rejected.
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/5 bg-zinc-950/50 shadow-inner">
            {candidates.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-zinc-500">No applications yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/5 bg-black/30 text-xs uppercase tracking-wider text-zinc-500">
                      <th className="px-4 py-3 font-medium">Applicant</th>
                      <th className="px-4 py-3 font-medium">Department</th>
                      <th className="px-4 py-3 font-medium">Role</th>
                      <th className="px-4 py-3 font-medium">Contact</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">CV</th>
                      {canManage ? <th className="px-4 py-3 font-medium">Update</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((c) => (
                      <tr key={c.id} className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]">
                        <td className="px-4 py-4">
                          <div className="font-medium text-zinc-100">{c.full_name}</div>
                          {c.hired_employee_id ? (
                            <div className="mt-0.5 text-[11px] text-emerald-500/90">In employee directory</div>
                          ) : null}
                        </td>
                        <td className="px-4 py-4 text-zinc-400">{c.department_name ?? "—"}</td>
                        <td className="px-4 py-4 text-zinc-400">{c.requisition_title ?? "—"}</td>
                        <td className="px-4 py-4">
                          <div className="space-y-0.5 text-zinc-500">
                            {c.email ? <div>{c.email}</div> : null}
                            {c.phone ? <div className="text-zinc-600">{c.phone}</div> : null}
                            {!c.email && !c.phone ? <span className="text-zinc-600">—</span> : null}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge stage={c.stage} />
                        </td>
                        <td className="px-4 py-4">
                          {c.cv_storage_path && canManage ? (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="text-xs"
                              onClick={() => openCv(c.cv_storage_path!)}
                            >
                              View CV
                            </Button>
                          ) : c.cv_storage_path ? (
                            <span className="text-xs text-zinc-600">Attached</span>
                          ) : (
                            <span className="text-xs text-zinc-600">—</span>
                          )}
                        </td>
                        {canManage ? (
                          <td className="px-4 py-4">
                            <select
                              className="h-9 min-w-[140px] rounded-lg border border-white/10 bg-black/50 px-2 text-xs text-zinc-200 outline-none ring-gold/20 focus:ring-2"
                              value={c.stage}
                              onChange={(e) => candStage(c.id, e.target.value)}
                              aria-label={`Status for ${c.full_name}`}
                            >
                              {STAGES.map((s) => (
                                <option key={s} value={s}>
                                  {STATUS_LABEL[s]}
                                </option>
                              ))}
                            </select>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {tab === "job-postings" && canManage ? (
        <div
          id="panel-job-postings"
          role="tabpanel"
          aria-labelledby="tab-job-postings"
          className="space-y-6"
        >
          <Card className="max-w-xl border-white/5 bg-zinc-950/40">
            <CardHeader>
              <CardTitle className="text-base text-zinc-100">Job postings</CardTitle>
              <CardDescription>Create requisitions tied to departments.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={onReq}>
                <label className="text-xs text-zinc-400">
                  Title
                  <Input
                    className="mt-1 border-white/10 bg-black/30"
                    name="title"
                    required
                    placeholder="e.g. Front desk agent"
                  />
                </label>
                <label className="text-xs text-zinc-400">
                  Department (optional)
                  <select
                    name="departmentId"
                    className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
                  >
                    <option value="">—</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-zinc-400">
                  Description
                  <textarea
                    name="description"
                    className="mt-1 min-h-[80px] w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                  />
                </label>
                <Button type="submit" disabled={loading}>
                  Create posting
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === "posting-status" && canManage ? (
        <div
          id="panel-posting-status"
          role="tabpanel"
          aria-labelledby="tab-posting-status"
          className="space-y-4"
        >
          {requisitions.length === 0 ? (
            <p className="rounded-2xl border border-white/5 bg-zinc-950/50 px-6 py-12 text-center text-sm text-zinc-500">
              No postings yet. Create one in the <strong className="text-zinc-400">Job postings</strong> tab.
            </p>
          ) : (
            <Card className="border-white/5 bg-zinc-950/40">
              <CardHeader>
                <CardTitle className="text-base text-zinc-100">Posting status</CardTitle>
                <CardDescription>Open, pause, or close each requisition.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase text-zinc-500">
                      <th className="pb-3">Title</th>
                      <th className="pb-3">Department</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {requisitions.map((r) => (
                      <tr key={r.id} className="border-b border-border/60">
                        <td className="py-3 text-white">{r.title}</td>
                        <td className="py-3 text-zinc-400">{r.department_name ?? "—"}</td>
                        <td className="py-3 capitalize text-zinc-300">{r.status}</td>
                        <td className="py-3">
                          <div className="flex flex-wrap gap-1">
                            <Button type="button" size="sm" variant="secondary" onClick={() => reqStatus(r.id, "open")}>
                              Open
                            </Button>
                            <Button type="button" size="sm" variant="ghost" onClick={() => reqStatus(r.id, "paused")}>
                              Pause
                            </Button>
                            <Button type="button" size="sm" variant="ghost" onClick={() => reqStatus(r.id, "closed")}>
                              Close
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}
    </div>
  );
}
