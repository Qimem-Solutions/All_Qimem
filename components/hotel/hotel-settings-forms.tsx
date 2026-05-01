"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { ChevronRight, CreditCard, ImageIcon, Phone, Building2, Palette } from "lucide-react";
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
import { ETHIOPIA_REGIONS } from "@/lib/tenant-onboarding-options";
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

function effectiveBrandHex(settings: HotelTenantSettings) {
  const p = settings.primary_brand_color?.trim();
  if (p && /^#[0-9a-fA-F]{6}$/.test(p)) return p;
  return "#e8c547";
}

function WorkspaceBrandingCard({
  settings,
  brandAction,
  brandPending,
  brandState,
}: {
  settings: HotelTenantSettings;
  brandAction: (formData: FormData) => void;
  brandPending: boolean;
  brandState: HotelSettingsActionState;
}) {
  const router = useRouter();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [accentDraft, setAccentDraft] = useState(() => effectiveBrandHex(settings));

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setAccentDraft(effectiveBrandHex(settings));
  }, [settings.primary_brand_color]);

  useEffect(() => {
    if (brandState?.ok) router.refresh();
  }, [brandState, router]);

  const prefLabel =
    theme === "light"
      ? "Light"
      : theme === "dark"
        ? "Dark"
        : theme === "system"
          ? "System (follow device)"
          : "Dark";

  return (
    <Card>
      <CardHeader>
        <SectionHeader
          icon={Palette}
          title="Branding"
          description="Your light/dark preference on this device, and the property accent colour everyone sees while signed into this hotel."
        />
      </CardHeader>
      <CardContent className="max-w-xl space-y-6">
        <div className="rounded-xl border border-border/80 bg-muted/20 px-4 py-3 dark:bg-muted/10">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">Current theme</p>
          <p className="mt-1 text-sm text-foreground">
            {mounted ? (
              <>
                Preference: <strong className="font-semibold capitalize">{prefLabel}</strong>
                {theme === "system" ? (
                  <>
                    {" · "}
                    <span className="text-muted">
                      Showing <strong className="text-foreground">{resolvedTheme}</strong> mode now.
                    </span>
                  </>
                ) : (
                  <>
                    {" · "}
                    <span className="text-muted">
                      Showing <strong className="text-foreground">{resolvedTheme}</strong>.
                    </span>
                  </>
                )}
              </>
            ) : (
              <span className="text-muted">Loading…</span>
            )}
          </p>
          <label className={`${labelClass} mt-3`} htmlFor="workspace-appearance">
            Workspace appearance
          </label>
          <select
            id="workspace-appearance"
            className={cn(control, "h-10")}
            disabled={!mounted}
            value={theme ?? "dark"}
            onChange={(e) => setTheme(e.target.value)}
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="system">System · match device</option>
          </select>
          <p className="mt-1.5 text-[11px] text-muted">
            Applies on this browser only. Other accounts can pick their own light or dark theme.
          </p>
        </div>

        <form action={brandAction} className="space-y-4">
          <input type="hidden" name="primary_brand_color" value={accentDraft} />
          <div>
            <label className={labelClass} htmlFor="primary_brand_color_picker">
              Property accent colour
            </label>
            <p className="mb-2 text-xs text-muted">
              Navigation and primary buttons for everyone at this property — pick a shade, save, and hotel
              nav/buttons refresh to match.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <input
                id="primary_brand_color_picker"
                type="color"
                aria-label="Pick accent colour"
                value={accentDraft}
                onChange={(e) => setAccentDraft(e.target.value)}
                className="h-12 w-[4.75rem] shrink-0 cursor-pointer rounded border border-border bg-transparent p-1"
              />
              <span className="font-mono text-sm text-muted tabular-nums">{accentDraft}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <Button type="submit" variant="primary" disabled={brandPending} className="w-full sm:w-auto">
              {brandPending ? "Saving…" : "Save accent colour"}
            </Button>
            <FormMessage state={brandState} />
          </div>
        </form>
      </CardContent>
    </Card>
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

  const regionOptions = useMemo(() => {
    const current = settings.region?.trim();
    const opts = ETHIOPIA_REGIONS.map((r) => ({ value: r, label: r }));
    if (!current) return opts;
    if ((ETHIOPIA_REGIONS as readonly string[]).includes(current)) return opts;
    return [
      {
        value: current,
        label: `${current} (current · not in catalog)`,
      },
      ...opts,
    ];
  }, [settings.region]);

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
              <select
                id="region"
                name="region"
                className={cn(control, "h-10")}
                defaultValue={settings.region ?? ""}
              >
                <option value="">Select federal region or chartered city…</option>
                {regionOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-muted">
                Same Ethiopian regions as platform onboarding — pick the property&apos;s area.
              </p>
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

      <WorkspaceBrandingCard
        settings={settings}
        brandAction={brandAction}
        brandPending={brandPending}
        brandState={brandState}
      />

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
