import Link from "next/link";
import { ArrowRight, LayoutGrid } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TenantPortfolio } from "@/lib/queries/tenant-data";

type Props = {
  portfolio: TenantPortfolio;
  planLabel: string | null;
  subscriptionStatus: string | null;
  subError: string | null;
};

export function HotelPortfolioView({ portfolio, planLabel, subscriptionStatus, subError }: Props) {
  const { name, description, cover_image_url, slug } = portfolio;
  return (
    <div className="space-y-0">
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border border-border",
          "min-h-[min(52vh,640px)]",
        )}
      >
        {cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover_image_url}
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
          className="absolute inset-0 bg-gradient-to-t from-background via-background/75 to-transparent"
          aria-hidden
        />
        <div className="relative z-10 flex min-h-[min(52vh,640px)] flex-col justify-end p-6 sm:p-10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-muted">Property</p>
          <h1
            className="mt-2 max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-foreground [font-family:var(--font-outfit),system-ui,sans-serif] sm:text-4xl"
          >
            {name}
          </h1>
          <p className="mt-1 font-mono text-xs text-gold/90">/{slug}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted">
            {subError ? (
              <span className="text-amber-600 dark:text-amber-400">({subError})</span>
            ) : planLabel ? (
              <Badge tone="gold" className="font-normal">
                {planLabel} plan
                {subscriptionStatus ? ` · ${subscriptionStatus}` : null}
              </Badge>
            ) : (
              <span className="text-muted">No subscription on file — contact the platform team.</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr,280px]">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">About this property</h2>
          {description?.trim() ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted sm:text-base">
              {description.trim()}
            </p>
          ) : (
            <p className="text-sm text-muted">
              Add a short description in the superadmin console so guests and staff see it here. It
              is stored on your tenant and shown as your public portfolio.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-elevated/50 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">Operations</p>
          <p className="text-sm text-muted">
            Open HRMS, HRRM, and reporting from the modules hub. Sidebar links stay the same.
          </p>
          <Link
            href="/hotel/modules"
            className="inline-flex h-10 w-full items-center justify-between gap-2 rounded-lg bg-gold px-4 text-sm font-medium text-gold-foreground transition-colors hover:bg-gold-dim focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            <span className="inline-flex items-center gap-2">
              <LayoutGrid className="h-4 w-4" />
              Open modules
            </span>
            <ArrowRight className="h-4 w-4 opacity-80" />
          </Link>
        </div>
      </div>
    </div>
  );
}
