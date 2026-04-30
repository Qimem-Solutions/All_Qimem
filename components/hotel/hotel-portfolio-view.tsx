import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TenantPortfolio } from "@/lib/queries/tenant-data";
import type { JobRequisitionRow } from "@/lib/queries/hrms-extended";
import {
  HotelPortfolioTabs,
  type PortfolioContactInfo,
} from "@/components/hotel/hotel-portfolio-tabs";

type Props = {
  tenantId: string;
  portfolio: TenantPortfolio;
  planLabel: string | null;
  subscriptionStatus: string | null;
  subError: string | null;
  openJobs: JobRequisitionRow[];
  jobsError: string | null;
  contact: PortfolioContactInfo;
};

export function HotelPortfolioView({
  tenantId,
  portfolio,
  planLabel,
  subscriptionStatus,
  subError,
  openJobs,
  jobsError,
  contact,
}: Props) {
  const { name, description, cover_image_url, slug, gallery_urls } = portfolio;
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

      <HotelPortfolioTabs
        tenantId={tenantId}
        description={description}
        galleryUrls={Array.isArray(gallery_urls) ? gallery_urls : []}
        openJobs={openJobs}
        jobsError={jobsError}
        contact={contact}
      />
    </div>
  );
}
