"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { Briefcase, Building2, Clock, Home, Images, MessageSquare, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  PortfolioBookingSection,
  scrollToPortfolioBooking,
} from "@/components/hotel/portfolio-booking-section";
import { HotelPropertyGalleryCarousel } from "@/components/hotel/hotel-property-gallery-carousel";
import {
  PortfolioApplyModalPortal,
  PortfolioContactPanel,
  type PortfolioContactInfo,
} from "@/components/hotel/hotel-portfolio-tabs";
import { submitPublicJobApplicationAction } from "@/lib/actions/hrms-modules";
import type { JobRequisitionRow } from "@/lib/queries/hrms-extended";
import type { PublicTenantPortfolio } from "@/lib/queries/tenant-branding-public";
import { PublicPortfolioFooter } from "@/components/hotel/public-portfolio-footer";
import { formatDate, formatGuestTimeAmPm } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Horizontal padding — tighter sides so main columns read wider on desktop */
const PAGE_GUTTER = "px-3 sm:px-4 md:px-5 lg:px-8";

type TabId = "home" | "jobs" | "contact";

export function PublicPortfolioClient({
  portfolio,
  jobs,
}: {
  portfolio: PublicTenantPortfolio;
  jobs: JobRequisitionRow[];
}) {
  const accent = portfolio.primaryBrandColor;
  const [tab, setTab] = useState<TabId>("home");
  const [bookingOpen, setBookingOpen] = useState(false);
  const [applyJob, setApplyJob] = useState<JobRequisitionRow | null>(null);
  const closeApplyModal = useCallback(() => setApplyJob(null), []);

  const openBooking = useCallback(() => {
    setBookingOpen((wasOpen) => {
      if (wasOpen) {
        queueMicrotask(() => scrollToPortfolioBooking());
      }
      return true;
    });
  }, []);

  useEffect(() => {
    if (!bookingOpen) return;
    const t = window.setTimeout(() => scrollToPortfolioBooking(), 0);
    return () => window.clearTimeout(t);
  }, [bookingOpen]);

  const checkInAmPm = formatGuestTimeAmPm(portfolio.default_check_in_time);
  const checkOutAmPm = formatGuestTimeAmPm(portfolio.default_check_out_time);
  const hasStayTimes = !!(checkInAmPm || checkOutAmPm);

  const contact: PortfolioContactInfo = {
    propertyName: portfolio.name,
    region: portfolio.region,
    phone: portfolio.contact_phone,
    email: portfolio.reservations_email,
    policiesNotes: null,
  };

  const tabBtn = (id: TabId, label: string, Icon: typeof Home) => (
    <button
      key={id}
      type="button"
      role="tab"
      aria-selected={tab === id}
      onClick={() => setTab(id)}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors sm:px-4 sm:text-sm",
        tab === id
          ? "bg-gold/15 text-gold ring-1 ring-gold/40"
          : "text-zinc-400 hover:bg-white/5 hover:text-white",
      )}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-80" strokeWidth={1.75} />
      {label}
    </button>
  );

  return (
    <div
      className="dark min-h-screen bg-[#050506] text-zinc-100"
      style={
        accent ? ({ "--portfolio-accent": accent } as CSSProperties) : undefined
      }
    >
      <header className="border-b border-white/5 bg-black/30 backdrop-blur-sm">
        <div
          className={cn(
            "flex w-full flex-wrap items-center justify-between gap-3 py-4 sm:gap-4 sm:py-5",
            PAGE_GUTTER,
          )}
        >
          <Link href="/" className="flex min-w-0 max-w-[min(100%,220px)] items-center gap-3 sm:max-w-none">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gold/30 bg-gold/10">
              {portfolio.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={portfolio.logo_url} alt="" className="h-8 w-8 rounded object-contain" />
              ) : (
                <Sparkles className="h-5 w-5 text-gold" aria-hidden />
              )}
            </span>
            <span className="min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-[0.35em] text-gold">
                All Qimem
              </span>
              <span className="mt-0.5 block truncate text-sm font-medium text-white">{portfolio.name}</span>
            </span>
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <Button
              type="button"
              onClick={openBooking}
              className={cn(
                "order-first h-10 rounded-xl bg-gold px-4 text-xs font-bold uppercase tracking-wide text-black shadow-md shadow-gold/20 sm:order-none sm:text-sm",
                "hover:bg-gold/90",
              )}
            >
              Book now
            </Button>
            <nav className="flex flex-wrap gap-2" role="tablist" aria-label="Portfolio sections">
              {tabBtn("home", "Home", Home)}
              {tabBtn("jobs", "Jobs", Briefcase)}
              {tabBtn("contact", "Contact us", MessageSquare)}
            </nav>
          </div>
        </div>
      </header>

      <main>
        <section className="relative min-h-[min(52vh,560px)] overflow-hidden border-b border-white/5">
          {portfolio.cover_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={portfolio.cover_image_url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div
              className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950"
              aria-hidden
            />
          )}
          <div
            className="absolute inset-0 bg-gradient-to-t from-[#050506] via-[#050506]/80 to-transparent"
            aria-hidden
          />
          <div
            className={cn(
              "relative z-10 flex w-full flex-col justify-end pb-12 pt-28 sm:pb-16 sm:pt-36",
              PAGE_GUTTER,
            )}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-zinc-400">
              Property portfolio
            </p>
            <h1 className="mt-3 w-full text-3xl font-semibold leading-tight tracking-tight text-white [font-family:var(--font-outfit),system-ui,sans-serif] sm:text-4xl md:text-5xl">
              {portfolio.name}
            </h1>
            <p className="mt-2 font-mono text-xs text-gold/90">/{portfolio.slug}</p>
            {portfolio.region ? <p className="mt-3 text-sm text-zinc-400">{portfolio.region}</p> : null}
            {hasStayTimes ? (
              <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/10 pt-5 text-sm text-zinc-300">
                <span className="inline-flex items-center gap-2 text-zinc-400">
                  <Clock className="h-4 w-4 shrink-0 text-gold/85" strokeWidth={1.75} aria-hidden />
                  <span className="font-medium uppercase tracking-[0.12em] text-[11px] text-zinc-500">
                    Availability
                  </span>
                </span>
                <span className="flex flex-wrap gap-x-6 gap-y-1">
                  {checkInAmPm ? (
                    <span>
                      Check-in from{" "}
                      <span className="font-semibold text-white">{checkInAmPm}</span>
                    </span>
                  ) : null}
                  {checkOutAmPm ? (
                    <span>
                      Check-out by{" "}
                      <span className="font-semibold text-white">{checkOutAmPm}</span>
                    </span>
                  ) : null}
                </span>
              </div>
            ) : null}
          </div>
        </section>

        {bookingOpen ? (
          <PortfolioBookingSection tenantId={portfolio.id} portfolioSlug={portfolio.slug} />
        ) : null}

        <div className={cn("w-full space-y-12 py-12", PAGE_GUTTER)}>
          {tab === "home" ? (
            <div className="mx-auto w-full max-w-7xl space-y-10">
              <header className="space-y-2 border-b border-white/10 pb-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gold">Overview</p>
                <h2 className="flex flex-wrap items-center gap-3 text-xl font-semibold tracking-tight text-white sm:text-2xl [font-family:var(--font-outfit),system-ui,sans-serif]">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gold/10">
                    <Building2 className="h-5 w-5 text-gold" strokeWidth={1.75} aria-hidden />
                  </span>
                  About this property
                </h2>
                <p className="max-w-3xl text-sm leading-relaxed text-zinc-500 md:text-base">
                  Discover what makes this address distinct — hours for arriving guests and highlights from the property team.
                </p>
              </header>

              <div className="space-y-6">
                {hasStayTimes ? (
                  <div className="rounded-2xl border border-emerald-500/15 bg-emerald-950/[0.15] px-5 py-5 sm:px-6">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-emerald-400/90" strokeWidth={1.75} aria-hidden />
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-400/90">
                        Guest hours
                      </p>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                      {checkInAmPm ? (
                        <>
                          Check-in from <span className="font-semibold text-white">{checkInAmPm}</span>
                        </>
                      ) : null}
                      {checkInAmPm && checkOutAmPm ? (
                        <span className="text-zinc-600"> · </span>
                      ) : null}
                      {checkOutAmPm ? (
                        <>
                          Check-out by <span className="font-semibold text-white">{checkOutAmPm}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                ) : null}

                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-7">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Story & details
                  </h3>
                  {portfolio.description?.trim() ? (
                    <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300 sm:text-base">
                      {portfolio.description.trim()}
                    </p>
                  ) : (
                    <p className="mt-4 text-sm leading-relaxed text-zinc-500">
                      This property hasn&apos;t added a description yet. Browse photos below or contact the team for more
                      information.
                    </p>
                  )}
                </div>
              </div>

              {portfolio.gallery_urls.length > 0 ? (
                <section className="space-y-4 pt-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
                      <Images className="h-4 w-4 text-gold/90" strokeWidth={1.75} aria-hidden />
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-white">Gallery</h3>
                      <p className="text-xs text-zinc-500">Photos from the property collection</p>
                    </div>
                  </div>
                  <HotelPropertyGalleryCarousel
                    urls={portfolio.gallery_urls}
                    label="Property photos"
                    edgeToEdge
                  />
                </section>
              ) : null}
            </div>
          ) : null}

          {tab === "jobs" ? (
            <div className="mx-auto w-full max-w-5xl space-y-8">
              <header className="space-y-2 border-b border-white/10 pb-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gold">Careers</p>
                <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">Join our team</h2>
                <p className="max-w-3xl text-sm leading-relaxed text-zinc-500">
                  Open roles at this property. Select a position to apply — our HR team receives applications in Recruitment.
                </p>
              </header>

              {jobs.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-16 text-center"
                  role="status"
                  aria-live="polite"
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-gold/25 bg-gold/10">
                    <Briefcase className="h-7 w-7 text-gold/90" strokeWidth={1.5} aria-hidden />
                  </span>
                  <p className="mt-6 text-base font-medium text-zinc-200">No job posting now.</p>
                  <p className="mt-2 max-w-sm text-sm text-zinc-500">
                    Check back later or reach out through Contact us if you&apos;d like to send a general inquiry.
                  </p>
                </div>
              ) : (
                <ul className="space-y-3 pb-4">
                  {jobs.map((job) => (
                    <li key={job.id}>
                      <button
                        type="button"
                        onClick={() => setApplyJob(job)}
                        className={cn(
                          "group w-full rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left transition-all",
                          "hover:border-gold/35 hover:bg-gold/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050506]",
                        )}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <span className="text-base font-semibold text-white group-hover:text-gold/95">
                            {job.title}
                          </span>
                          <Badge tone="green">Open</Badge>
                        </div>
                        {job.department_name ? (
                          <p className="mt-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                            {job.department_name}
                          </p>
                        ) : null}
                        {job.description?.trim() ? (
                          <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-zinc-400">
                            {job.description.trim()}
                          </p>
                        ) : null}
                        {job.created_at ? (
                          <p className="mt-4 border-t border-white/5 pt-3 text-xs text-zinc-600">
                            Posted {formatDate(job.created_at)}
                          </p>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {tab === "contact" ? (
            <div className="mx-auto w-full max-w-6xl">
              <PortfolioContactPanel contact={contact} variant="portfolio" />
            </div>
          ) : null}
        </div>
      </main>

      {typeof document !== "undefined" && applyJob ? (
        <PortfolioApplyModalPortal
          key={applyJob.id}
          tenantId={portfolio.id}
          job={applyJob}
          onClose={closeApplyModal}
          applicationAction={submitPublicJobApplicationAction}
          portfolioSlug={portfolio.slug}
        />
      ) : null}

      <PublicPortfolioFooter portfolio={portfolio} onNavigate={setTab} />
    </div>
  );
}
