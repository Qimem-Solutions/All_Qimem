"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type SVGProps,
} from "react";
import { createPortal } from "react-dom";
import { Briefcase, Home, Loader2, MessageSquare, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { HotelPropertyGalleryCarousel } from "@/components/hotel/hotel-property-gallery-carousel";
import { submitRecruitmentApplicationAction } from "@/lib/actions/hrms-modules";
import type { JobRequisitionRow } from "@/lib/queries/hrms-extended";
import { formatDate } from "@/lib/format";

function PortfolioApplyModalPortal({
  tenantId,
  job,
  onClose,
}: {
  tenantId: string;
  job: JobRequisitionRow;
  onClose: () => void;
}) {
  const [applyState, applyAction, applyPending] = useActionState(submitRecruitmentApplicationAction, null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !applyPending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [applyPending, onClose]);

  return createPortal(
    <div
      className="fixed inset-0 isolate z-[10050] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="portfolio-apply-title"
    >
      <button
        type="button"
        className="absolute inset-0 z-0 cursor-default bg-black/65 backdrop-blur-[1px]"
        aria-label="Close"
        onClick={() => !applyPending && onClose()}
      />
      <div
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface-elevated p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="portfolio-apply-title" className="text-lg font-semibold text-foreground">
          Apply · {job.title}
        </h2>
        {job.department_name ? <p className="mt-1 text-sm text-muted">{job.department_name}</p> : null}
        {job.description?.trim() ? (
          <div className="mt-4 max-h-40 overflow-y-auto rounded-lg border border-border bg-background/50 p-3 text-sm text-muted">
            <p className="whitespace-pre-wrap">{job.description.trim()}</p>
          </div>
        ) : null}

        {applyState && !applyState.ok ? (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
            {applyState.error}
          </p>
        ) : null}
        {applyState?.ok ? (
          <p className="mt-4 text-sm text-emerald-600 dark:text-emerald-400" role="status">
            Application submitted. The HR team will see it in Recruitment.
          </p>
        ) : null}

        {!applyState?.ok ? (
          <form action={applyAction} className="mt-6 space-y-4">
            <input type="hidden" name="tenantId" value={tenantId} />
            <input type="hidden" name="requisitionId" value={job.id} />
            <div>
              <label className="mb-1 block text-xs font-medium text-muted" htmlFor="pf-fullName">
                Full name
              </label>
              <Input id="pf-fullName" name="fullName" required placeholder="Your name" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted" htmlFor="pf-email">
                Email
              </label>
              <Input id="pf-email" name="email" type="email" placeholder="you@example.com" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted" htmlFor="pf-phone">
                Phone
              </label>
              <Input id="pf-phone" name="phone" type="tel" placeholder="+251 …" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted" htmlFor="pf-notes">
                Cover note (optional)
              </label>
              <textarea
                id="pf-notes"
                name="notes"
                rows={3}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60"
                placeholder="Brief introduction or availability"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted" htmlFor="pf-cv">
                CV / resume (optional, max 10 MB)
              </label>
              <input
                id="pf-cv"
                name="cv"
                type="file"
                accept=".pdf,.doc,.docx,application/pdf"
                className="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-sm file:text-foreground"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" disabled={applyPending} onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={applyPending}>
                {applyPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Submit application
                  </>
                )}
              </Button>
            </div>
          </form>
        ) : (
          <div className="mt-6 flex justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

type TabId = "home" | "jobs" | "contact";

export type PortfolioContactInfo = {
  propertyName: string;
  /** City / region for “Based in” (tenant settings). */
  region: string | null;
  phone: string | null;
  email: string | null;
  policiesNotes: string | null;
};

type Props = {
  tenantId: string;
  description: string | null;
  galleryUrls: string[];
  openJobs: JobRequisitionRow[];
  jobsError: string | null;
  contact: PortfolioContactInfo;
};

function SocialGlyphFacebook(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 fill-current" {...props}>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function SocialGlyphInstagram(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 fill-current" {...props}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function SocialGlyphTwitter(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 fill-current" {...props}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function PortfolioContactPanel({ contact }: { contact: PortfolioContactInfo }) {
  const destinationEmail = contact.email?.trim() ?? "";
  const basedIn =
    contact.region?.trim() || contact.propertyName?.trim() || "—";

  const [fullName, setFullName] = useState("");
  const [visitorEmail, setVisitorEmail] = useState("");
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const submitViaMailto = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!destinationEmail) {
      setFormError("Add a reservations email under Property settings → Contact & policies.");
      return;
    }
    if (!fullName.trim()) {
      setFormError("Enter your full name.");
      return;
    }
    if (!visitorEmail.trim()) {
      setFormError("Enter your e-mail.");
      return;
    }
    const subject = encodeURIComponent(`Contact · ${contact.propertyName}`);
    const body = encodeURIComponent(
      `Name: ${fullName.trim()}\nE-mail: ${visitorEmail.trim()}\n\n${message.trim()}`,
    );
    window.location.href = `mailto:${destinationEmail}?subject=${subject}&body=${body}`;
  };

  const underline =
    "w-full border-0 border-b-2 border-border bg-transparent py-2 text-base text-foreground outline-none ring-0 placeholder:text-muted focus-visible:border-gold";

  return (
    <div className="rounded-2xl px-1 py-6 text-foreground sm:px-2 md:py-10">
      <h2 className="mb-8 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl md:text-6xl [font-family:var(--font-outfit),system-ui,sans-serif]">
        Contact Us
      </h2>

      <div className="relative rounded-2xl border border-border bg-surface-elevated/40 p-6 sm:p-10 md:p-12">
        <div className="grid gap-12 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] md:gap-14 lg:gap-20">
          <form onSubmit={submitViaMailto} className="space-y-8">
            <div>
              <label htmlFor="pc-full-name" className="block text-sm font-medium text-foreground">
                Full Name
              </label>
              <input
                id="pc-full-name"
                name="fullName"
                value={fullName}
                onChange={(ev) => setFullName(ev.target.value)}
                autoComplete="name"
                className={underline}
              />
            </div>
            <div>
              <label htmlFor="pc-email" className="block text-sm font-medium text-foreground">
                E-mail
              </label>
              <input
                id="pc-email"
                name="email"
                type="email"
                value={visitorEmail}
                onChange={(ev) => setVisitorEmail(ev.target.value)}
                autoComplete="email"
                className={underline}
              />
            </div>
            <div>
              <label htmlFor="pc-message" className="block text-sm font-medium text-foreground">
                Message
              </label>
              <textarea
                id="pc-message"
                name="message"
                rows={4}
                value={message}
                onChange={(ev) => setMessage(ev.target.value)}
                className={`${underline} resize-none`}
              />
            </div>

            {formError ? (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {formError}
              </p>
            ) : null}

            <Button
              type="submit"
              variant="primary"
              className="h-auto rounded-full px-10 py-3 text-sm font-medium uppercase tracking-wide"
            >
              Contact Us
            </Button>
          </form>

          <div className="space-y-10">
            <div>
              <p className="text-base font-bold text-foreground">Contact</p>
              {destinationEmail ? (
                <a
                  href={`mailto:${destinationEmail}`}
                  className="mt-2 inline-block break-all text-base text-foreground underline-offset-4 hover:text-gold hover:underline"
                >
                  {destinationEmail}
                </a>
              ) : (
                <p className="mt-2 text-base text-muted">Configure reservations email in settings.</p>
              )}
            </div>
            <div>
              <p className="text-base font-bold text-foreground">Based in</p>
              <p className="mt-2 text-base font-normal text-foreground">{basedIn}</p>
            </div>
          </div>
        </div>

        <div className="mt-12 flex justify-end gap-6 border-t border-border pt-8 sm:mt-14">
          <span className="text-muted transition-colors hover:text-gold" title="Facebook">
            <SocialGlyphFacebook />
          </span>
          <span className="text-muted transition-colors hover:text-gold" title="Instagram">
            <SocialGlyphInstagram />
          </span>
          <span className="text-muted transition-colors hover:text-gold" title="X">
            <SocialGlyphTwitter />
          </span>
        </div>
      </div>
    </div>
  );
}

export function HotelPortfolioTabs({
  tenantId,
  description,
  galleryUrls,
  openJobs,
  jobsError,
  contact,
}: Props) {
  const [tab, setTab] = useState<TabId>("home");
  const [applyJob, setApplyJob] = useState<JobRequisitionRow | null>(null);
  const closeApplyModal = useCallback(() => setApplyJob(null), []);

  const tabBtn = (id: TabId, label: string, Icon: typeof Home) => (
    <button
      key={id}
      type="button"
      role="tab"
      aria-selected={tab === id}
      onClick={() => setTab(id)}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
        tab === id
          ? "bg-gold/15 text-gold ring-1 ring-gold/40"
          : "text-muted hover:bg-foreground/5 hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-80" strokeWidth={1.75} />
      {label}
    </button>
  );

  return (
    <div className="mt-8">
      <div
        className="flex flex-wrap gap-2 border-b border-border pb-4"
        role="tablist"
        aria-label="Portfolio sections"
      >
        {tabBtn("home", "Home", Home)}
        {tabBtn("jobs", "Jobs", Briefcase)}
        {tabBtn("contact", "Contact us", MessageSquare)}
      </div>

      <div className="mt-8" role="tabpanel">
        {tab === "home" ? (
          <div className="space-y-8">
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">About this property</h2>
              {description?.trim() ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted sm:text-base">
                  {description.trim()}
                </p>
              ) : (
                <p className="text-sm text-muted">
                  Add a short description under Property settings → Branding so it appears here. Images below
                  come from Settings → Property gallery.
                </p>
              )}
            </div>
            <HotelPropertyGalleryCarousel urls={galleryUrls} />
          </div>
        ) : null}

        {tab === "jobs" ? (
          <div>
            {jobsError ? (
              <p className="py-16 text-center text-sm text-muted">Could not load job postings.</p>
            ) : openJobs.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted">No open positions right now.</p>
            ) : (
              <ul className="space-y-3">
                {openJobs.map((job) => (
                  <li key={job.id}>
                    <button
                      type="button"
                      onClick={() => setApplyJob(job)}
                      className="w-full rounded-xl border border-border bg-surface-elevated/40 p-4 text-left transition-colors hover:border-gold/35 hover:bg-gold/5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <span className="font-medium text-foreground">{job.title}</span>
                        <Badge tone="green">Open</Badge>
                      </div>
                      {job.department_name ? (
                        <p className="mt-1 text-xs text-muted">{job.department_name}</p>
                      ) : null}
                      {job.description?.trim() ? (
                        <p className="mt-2 line-clamp-2 text-sm text-muted">{job.description.trim()}</p>
                      ) : null}
                      {job.created_at ? (
                        <p className="mt-2 text-xs text-zinc-500">Posted {formatDate(job.created_at)}</p>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {tab === "contact" ? (
          <div className="mx-auto max-w-6xl">
            <PortfolioContactPanel contact={contact} />
          </div>
        ) : null}
      </div>

      {typeof document !== "undefined" && applyJob ? (
        <PortfolioApplyModalPortal
          key={applyJob.id}
          tenantId={tenantId}
          job={applyJob}
          onClose={closeApplyModal}
        />
      ) : null}
    </div>
  );
}
