"use client";

import { useActionState, useMemo } from "react";
import Link from "next/link";
import { ChevronRight, CreditCard, ImageIcon, Phone, Building2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { HotelTenantSettings } from "@/lib/queries/tenant-data";
import { HOTEL_TIMEZONES, HOTEL_CURRENCIES } from "@/lib/constants/hotel-settings";
import {
  updateHotelGeneralSettings,
  updateHotelBrandingSettings,
  updateHotelContactSettings,
  type HotelSettingsActionState,
} from "@/lib/actions/hotel-settings";
import { HotelGallerySettings } from "@/components/hotel/hotel-gallery-settings";

const control =
  "flex w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-gold/60";
const textareaClass = cn(control, "min-h-[100px] resize-y");
const labelClass = "mb-1.5 block text-xs font-medium text-muted";

function FormMessage({ state }: { state: HotelSettingsActionState }) {
  if (!state) return null;
  if (state.ok && state.message) {
    return <p className="text-sm text-emerald-400">{state.message}</p>;
  }
  if (!state.ok && state.error) {
    return <p className="text-sm text-red-300">{state.error}</p>;
  }
  return null;
}

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-1 flex items-start gap-2">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="mt-0.5 text-xs">{description}</CardDescription>
      </div>
    </div>
  );
}

export function HotelSettingsForms({ settings }: { settings: HotelTenantSettings }) {
  const [genState, genAction, genPending] = useActionState(updateHotelGeneralSettings, null);
  const [brandState, brandAction, brandPending] = useActionState(
    updateHotelBrandingSettings,
    null,
  );
  const [contactState, contactAction, contactPending] = useActionState(
    updateHotelContactSettings,
    null,
  );

  const timezoneOptions = useMemo(() => {
    if (HOTEL_TIMEZONES.some((z) => z.value === settings.timezone)) {
      return HOTEL_TIMEZONES;
    }
    return [{ value: settings.timezone, label: settings.timezone }, ...HOTEL_TIMEZONES];
  }, [settings.timezone]);

  const currencyOptions = useMemo(() => {
    if (HOTEL_CURRENCIES.some((c) => c.value === settings.default_currency)) {
      return HOTEL_CURRENCIES;
    }
    return [
      { value: settings.default_currency, label: settings.default_currency },
      ...HOTEL_CURRENCIES,
    ];
  }, [settings.default_currency]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <SectionHeader
            icon={Building2}
            title="General"
            description="Property profile, timezone, and default currency for this hotel."
          />
        </CardHeader>
        <CardContent>
          <form action={genAction} className="max-w-xl space-y-4">
            <div>
              <label className={labelClass} htmlFor="name">
                Property name
              </label>
              <Input
                id="name"
                name="name"
                defaultValue={settings.name}
                required
                autoComplete="organization"
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="region">
                Region / market
              </label>
              <Input
                id="region"
                name="region"
                defaultValue={settings.region ?? ""}
                placeholder="e.g. Dubai, MEA"
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="slug-disp">
                URL slug
              </label>
              <Input
                id="slug-disp"
                value={settings.slug}
                readOnly
                className="font-mono text-muted"
                title="Slugs are set by the platform. Contact support to change."
              />
              <p className="mt-1 text-[11px] text-muted">Read-only. Used in internal links and routing.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="timezone">
                  Timezone
                </label>
                <select id="timezone" name="timezone" className={cn(control, "h-10")} defaultValue={settings.timezone}>
                  {timezoneOptions.map((z) => (
                    <option key={z.value} value={z.value}>
                      {z.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="default_currency">
                  Default currency
                </label>
                <select
                  id="default_currency"
                  name="default_currency"
                  className={cn(control, "h-10")}
                  defaultValue={settings.default_currency}
                >
                  {currencyOptions.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <Button type="submit" variant="primary" disabled={genPending} className="w-full sm:w-auto">
                {genPending ? "Saving…" : "Save general"}
              </Button>
              <FormMessage state={genState} />
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <SectionHeader
            icon={ImageIcon}
            title="Branding"
            description="Listings copy, cover image, and logo (public URLs)."
          />
        </CardHeader>
        <CardContent>
          <form action={brandAction} className="max-w-2xl space-y-4">
            <div>
              <label className={labelClass} htmlFor="description">
                Short description
              </label>
              <textarea
                id="description"
                name="description"
                className={textareaClass}
                defaultValue={settings.description ?? ""}
                placeholder="How you describe the property to guests and staff."
                rows={4}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="cover_image_url">
                Cover image URL
              </label>
              <Input
                id="cover_image_url"
                name="cover_image_url"
                type="url"
                defaultValue={settings.cover_image_url ?? ""}
                placeholder="https://… (e.g. Supabase Storage or CDN)"
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="logo_url">
                Logo URL
              </label>
              <Input
                id="logo_url"
                name="logo_url"
                type="url"
                defaultValue={settings.logo_url ?? ""}
                placeholder="https://… square logo, transparent background recommended"
              />
            </div>
            {settings.logo_url ? (
              <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-surface-elevated/20 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={settings.logo_url}
                  alt=""
                  className="h-12 w-12 object-contain"
                />
                <p className="text-xs text-muted">Logo preview (saved value)</p>
              </div>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <Button type="submit" variant="primary" disabled={brandPending} className="w-full sm:w-auto">
                {brandPending ? "Saving…" : "Save branding"}
              </Button>
              <FormMessage state={brandState} />
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <SectionHeader
            icon={ImageIcon}
            title="Property gallery"
            description="Photos shown on your Portfolio page below “About this property” with a slideshow."
          />
        </CardHeader>
        <CardContent>
          <HotelGallerySettings initialUrls={settings.gallery_urls} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <SectionHeader
            icon={Phone}
            title="Contacts & policies"
            description="Default phone, reservations email, check-in/out times, and policy notes for your team."
          />
        </CardHeader>
        <CardContent>
          <form action={contactAction} className="max-w-2xl space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="contact_phone">
                  Main phone
                </label>
                <Input
                  id="contact_phone"
                  name="contact_phone"
                  type="tel"
                  defaultValue={settings.contact_phone ?? ""}
                  placeholder="+971 …"
                  autoComplete="tel"
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="reservations_email">
                  Reservations email
                </label>
                <Input
                  id="reservations_email"
                  name="reservations_email"
                  type="email"
                  defaultValue={settings.reservations_email ?? ""}
                  placeholder="reservations@…"
                  autoComplete="email"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="default_check_in_time">
                  Default check-in
                </label>
                <Input
                  id="default_check_in_time"
                  name="default_check_in_time"
                  defaultValue={settings.default_check_in_time ?? ""}
                  placeholder="15:00"
                />
                <p className="mt-1 text-[11px] text-muted">24-hour format (HH:MM).</p>
              </div>
              <div>
                <label className={labelClass} htmlFor="default_check_out_time">
                  Default check-out
                </label>
                <Input
                  id="default_check_out_time"
                  name="default_check_out_time"
                  defaultValue={settings.default_check_out_time ?? ""}
                  placeholder="11:00"
                />
                <p className="mt-1 text-[11px] text-muted">24-hour format (HH:MM).</p>
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="policies_notes">
                Policies & house rules
              </label>
              <textarea
                id="policies_notes"
                name="policies_notes"
                className={cn(textareaClass, "min-h-[140px]")}
                defaultValue={settings.policies_notes ?? ""}
                placeholder="Cancellation summary, pet policy, quiet hours — visible to your administrators here."
                rows={5}
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <Button
                type="submit"
                variant="primary"
                disabled={contactPending}
                className="w-full sm:w-auto"
              >
                {contactPending ? "Saving…" : "Save contacts & policies"}
              </Button>
              <FormMessage state={contactState} />
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <SectionHeader
            icon={CreditCard}
            title="Billing"
            description="View your plan, billing period, and subscription status for this property."
          />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-border/80 bg-surface-elevated/20 p-4 sm:flex-row sm:items-center">
            <p className="text-sm text-muted">
              Subscriptions, renewals, and plan details are managed on the{" "}
              <span className="text-foreground">Subscription</span> page.
            </p>
            <Link
              href="/hotel/subscription"
              className="inline-flex h-10 shrink-0 items-center justify-center gap-1 rounded-lg border border-border bg-surface-elevated px-4 text-sm font-medium text-foreground transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-800"
            >
              Open subscription
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
