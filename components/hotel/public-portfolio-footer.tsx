"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Grid3x3, Sparkles } from "lucide-react";
import type { PublicTenantPortfolio } from "@/lib/queries/tenant-branding-public";
import { formatGuestTimeAmPm } from "@/lib/format";
import { cn } from "@/lib/utils";

export type PublicPortfolioFooterNavTab = "home" | "jobs" | "contact";

type Props = {
  portfolio: PublicTenantPortfolio;
  onNavigate: (tab: PublicPortfolioFooterNavTab) => void;
};

function SocialGlyphFacebook({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("h-5 w-5 fill-current", className)}>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function SocialGlyphInstagram({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("h-5 w-5 fill-current", className)}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function SocialGlyphLinkedIn({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("h-5 w-5 fill-current", className)}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

const colHeading =
  "text-[11px] font-semibold uppercase tracking-[0.2em] text-muted dark:text-zinc-400";
const linkClass =
  "block text-left text-sm text-foreground/90 transition-colors hover:text-foreground hover:underline underline-offset-4 dark:text-white/90 dark:hover:text-white";

/** Ensures mailto: stays intact and bare domains get https:// */
function outboundHref(raw: string): string {
  const t = raw.trim();
  if (!t) return "#";
  if (/^(https?:|mailto:)/i.test(t)) return t;
  return `https://${t}`;
}

const socialIconBtn =
  "inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface-elevated text-foreground/90 transition-colors hover:border-gold/35 hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold/60 dark:border-white/18 dark:bg-white/[0.06] dark:text-white/88 dark:hover:border-gold/35 dark:hover:bg-white/10 dark:hover:text-white";

const socialIconPlaceholder =
  "inline-flex h-11 w-11 cursor-default items-center justify-center rounded-full border border-border bg-muted/50 text-muted dark:border-white/10 dark:bg-white/[0.03] dark:text-white/30";

function SocialIconLink({
  url,
  label,
  children,
}: {
  url: string | null | undefined;
  label: string;
  children: React.ReactNode;
}) {
  const trimmed = url?.trim();
  if (trimmed) {
    return (
      <a
        href={outboundHref(trimmed)}
        target="_blank"
        rel="noopener noreferrer"
        className={socialIconBtn}
        aria-label={`${label} (opens in new tab)`}
      >
        {children}
      </a>
    );
  }
  return (
    <span
      className={socialIconPlaceholder}
      title="Property team can add this link in Property settings"
      aria-label={`${label} — not linked yet`}
    >
      {children}
    </span>
  );
}

export function PublicPortfolioFooter({ portfolio, onNavigate }: Props) {
  const locationBlock = useMemo(() => {
    const m = portfolio.mailing_address?.trim();
    if (m) return m;
    const lines = [portfolio.name, portfolio.region, portfolio.contact_phone].filter(
      (x): x is string => typeof x === "string" && x.trim().length > 0,
    );
    return lines.length > 0 ? lines.join("\n") : "—";
  }, [portfolio]);

  const tagline =
    portfolio.public_footer_tagline?.trim() ||
    (portfolio.region?.trim() ? portfolio.region.trim() : null);

  const checkInFooter = formatGuestTimeAmPm(portfolio.default_check_in_time);
  const checkOutFooter = formatGuestTimeAmPm(portfolio.default_check_out_time);
  const hasFooterGuestTimes = !!(checkInFooter || checkOutFooter);

  return (
    <footer className="relative mt-auto overflow-hidden border-t border-border bg-sidebar text-foreground dark:border-transparent dark:bg-[#141414] dark:text-white">
      {/* Subtle geometric texture (inspired by premium hotel group footers) */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        aria-hidden
        style={{
          backgroundImage: `
            radial-gradient(ellipse 55% 85% at 30% 40%, rgba(255,255,255,0.5) 0%, transparent 52%),
            radial-gradient(ellipse 55% 85% at 70% 60%, rgba(255,255,255,0.45) 0%, transparent 52%)
          `,
          backgroundSize: "56px 72px, 56px 72px",
          backgroundPosition: "0 0, 28px 36px",
        }}
      />
      <div className="relative z-10 px-4 py-14 sm:px-6 md:px-10 lg:px-14">
        {/* Brand block */}
        <div className="flex flex-col items-center border-b border-border pb-12 text-center dark:border-white/10">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-surface-elevated dark:border-white/15 dark:bg-white/5">
            {portfolio.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={portfolio.logo_url} alt="" className="h-10 w-10 rounded-full object-contain" />
            ) : (
              <Sparkles className="h-7 w-7 text-muted dark:text-white/80" aria-hidden />
            )}
          </div>
          <p className="mt-5 text-xl font-bold uppercase tracking-[0.28em] text-foreground sm:text-2xl dark:text-white">
            {portfolio.name}
          </p>
          {tagline ? (
            <p className="mt-2 text-xs font-medium uppercase tracking-[0.35em] text-muted dark:text-zinc-400">
              {tagline}
            </p>
          ) : null}
        </div>

        {/* Columns */}
        <div className="mx-auto mt-12 grid max-w-6xl gap-10 sm:grid-cols-2 lg:grid-cols-5 lg:gap-8">
          <div>
            <h3 className={colHeading}>Location</h3>
            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-foreground/85 dark:text-white/85">
              {locationBlock}
            </p>
            {hasFooterGuestTimes ? (
              <>
                <h3 className={cn(colHeading, "mt-8")}>Availability</h3>
                <ul className="mt-4 space-y-2 text-sm leading-relaxed text-foreground/85 dark:text-white/85">
                  {checkInFooter ? (
                    <li>
                      Check-in from{" "}
                      <span className="font-semibold text-foreground dark:text-white">{checkInFooter}</span>
                    </li>
                  ) : null}
                  {checkOutFooter ? (
                    <li>
                      Check-out by{" "}
                      <span className="font-semibold text-foreground dark:text-white">{checkOutFooter}</span>
                    </li>
                  ) : null}
                </ul>
              </>
            ) : null}
          </div>

          <div>
            <h3 className={colHeading}>Menu</h3>
            <nav className="mt-4 flex flex-col gap-2.5">
              <button type="button" className={linkClass} onClick={() => onNavigate("home")}>
                Home
              </button>
              <Link href="/" className={linkClass}>
                All Qimem
              </Link>
            </nav>
          </div>

          <div>
            <h3 className={colHeading}>Join us</h3>
            <nav className="mt-4 flex flex-col gap-2.5">
              <button type="button" className={linkClass} onClick={() => onNavigate("jobs")}>
                Careers
              </button>
              <button type="button" className={linkClass} onClick={() => onNavigate("jobs")}>
                Vacancies
              </button>
            </nav>
          </div>

          <div>
            <h3 className={colHeading}>About us</h3>
            <nav className="mt-4 flex flex-col gap-2.5">
              <button type="button" className={linkClass} onClick={() => onNavigate("contact")}>
                Contact us
              </button>
            </nav>
          </div>

          <div>
            <h3 className={colHeading}>Socials</h3>
            <ul className="mt-4 flex flex-wrap gap-3">
              <li>
                <SocialIconLink url={portfolio.social_facebook_url} label="Facebook">
                  <SocialGlyphFacebook />
                </SocialIconLink>
              </li>
              <li>
                <SocialIconLink url={portfolio.social_instagram_url} label="Instagram">
                  <SocialGlyphInstagram />
                </SocialIconLink>
              </li>
              <li>
                <SocialIconLink url={portfolio.social_linkedin_url} label="LinkedIn">
                  <SocialGlyphLinkedIn />
                </SocialIconLink>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mx-auto mt-14 flex max-w-6xl flex-col gap-6 border-t border-border pt-10 dark:border-white/10 sm:flex-row sm:items-center sm:justify-end">
          <p className="flex items-center gap-2 text-xs text-muted dark:text-zinc-500">
            <Grid3x3 className="h-4 w-4 shrink-0 text-muted dark:text-zinc-600" aria-hidden />
            <span>
              Website by{" "}
              <a
                href="https://qimem-portfolio.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline-offset-4 transition-colors hover:text-gold hover:underline dark:text-zinc-400 dark:hover:text-white"
              >
                Qimem Solutions
              </a>
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}
