"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  Lock,
  ChevronLeft,
  Upload,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createTenantAction } from "../actions";
import { ETHIOPIA_REGIONS } from "@/lib/tenant-onboarding-options";

const steps = [
  { id: 1, label: "Hotel info", key: "hotel" },
  { id: 2, label: "Branding", key: "branding" },
  { id: 3, label: "Confirmation", key: "confirm" },
] as const;

const PROPERTY_GALLERY_MAX_FILES = 12;
const PROPERTY_GALLERY_MAX_BYTES = 5 * 1024 * 1024;
const PROPERTY_GALLERY_ACCEPT = new Set(["image/jpeg", "image/png", "image/webp"]);

export default function TenantCreationOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    hotelName: "",
    subdomain: "",
    region: "",
    description: "",
    primaryColor: "#e8c547",
  });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!coverFile) {
      setCoverPreview(null);
      return;
    }
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview(null);
      return;
    }
    const url = URL.createObjectURL(logoFile);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  useEffect(() => {
    if (galleryFiles.length === 0) {
      setGalleryPreviews([]);
      return;
    }
    const urls = galleryFiles.map((f) => URL.createObjectURL(f));
    setGalleryPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [galleryFiles]);

  function next() {
    if (step === 1) {
      if (!form.hotelName.trim() || !form.subdomain.trim()) {
        setActionError("Enter hotel name and subdomain before continuing.");
        return;
      }
    }
    setActionError(null);
    setStep((s) => Math.min(3, s + 1));
  }
  function back() {
    if (step <= 1) {
      router.push("/superadmin/tenants");
      return;
    }
    setStep((s) => s - 1);
  }

  async function completeProvisioning() {
    setActionError(null);
    const name = form.hotelName.trim();
    const slug = form.subdomain.trim();
    if (!name || !slug) {
      setActionError("Go back to step 1 and enter both hotel name and subdomain.");
      return;
    }
    setSubmitting(true);
    const fd = new FormData();
    fd.set("name", name);
    fd.set("slug", slug);
    if (form.region) fd.set("region", form.region);
    fd.set("description", form.description.trim());
    if (coverFile) fd.set("coverImage", coverFile);
    if (logoFile) fd.set("logoImage", logoFile);
    for (const f of galleryFiles) {
      fd.append("galleryImage", f);
    }
    fd.set("primaryBrandColor", form.primaryColor.trim());
    const result = await createTenantAction(fd);
    setSubmitting(false);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    router.push("/superadmin/tenants");
    router.refresh();
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] text-foreground">
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-2">
        <div className="mb-10 text-center">
          <p className="text-2xl font-semibold text-gold [font-family:var(--font-outfit),system-ui,sans-serif]">
            All Qimem
          </p>
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.35em] text-zinc-400">
            Tenant creation onboarding
          </p>
        </div>

        <div className="mb-10 flex flex-wrap items-center justify-center gap-2 sm:gap-4">
          {steps.map((s) => {
            const active = step === s.id;
            const done = step > s.id;
            return (
              <div key={s.id} className="flex items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                      active
                        ? "bg-gold text-gold-foreground"
                        : done
                          ? "bg-emerald-600/30 text-emerald-400"
                          : "bg-zinc-800 text-zinc-500",
                    )}
                  >
                    {done ? <Check className="h-4 w-4" /> : s.id}
                  </span>
                  <span
                    className={cn(
                      "hidden text-sm font-medium sm:inline",
                      active ? "text-gold" : "text-zinc-500",
                    )}
                  >
                    {s.label}
                  </span>
                </div>
                {s.id < 3 ? (
                  <div
                    className={cn(
                      "hidden h-px w-8 sm:block",
                      step > s.id ? "bg-gold/50" : "bg-zinc-800",
                    )}
                  />
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="grid gap-8 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <div className="rounded-2xl border border-border bg-surface-elevated/60 p-6 shadow-xl backdrop-blur-sm sm:p-8">
              {actionError && step !== 3 ? (
                <p className="mb-6 rounded-lg border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
                  {actionError}
                </p>
              ) : null}
              {step === 1 && (
                <>
                  <h2 className="text-lg font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
                    Hotel identity
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Define the core properties of the new tenant system.
                  </p>
                  <div className="mt-8 space-y-6">
                    <div>
                      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-gold">
                        Hotel name
                      </label>
                      <Input
                        value={form.hotelName}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, hotelName: e.target.value }))
                        }
                        placeholder="Grand Qimem Resort"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-gold">
                        Domain access
                      </label>
                      <div className="flex rounded-lg border border-border bg-background overflow-hidden">
                        <input
                          className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-500 focus:outline-none"
                          value={form.subdomain}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              subdomain: e.target.value
                                .toLowerCase()
                                .replace(/[^a-z0-9-]/g, ""),
                            }))
                          }
                          placeholder="grand-qimem"
                          aria-label="Subdomain"
                        />
                        <span className="flex items-center border-l border-border bg-zinc-900/80 px-3 text-sm text-zinc-500">
                          .qimem.com
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-gold">
                        Region in Ethiopia
                      </label>
                      <select
                        className="flex h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60"
                        value={form.region}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, region: e.target.value }))
                        }
                      >
                        <option value="">Select federal region or chartered city</option>
                        {ETHIOPIA_REGIONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-gold">
                        Hotel description
                      </label>
                      <textarea
                        className="min-h-[100px] w-full resize-y rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60"
                        placeholder="Describe the property, location, and character — shown on internal listings and marketing."
                        value={form.description}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, description: e.target.value }))
                        }
                        maxLength={4000}
                        rows={4}
                      />
                      <p className="mt-1 text-xs text-zinc-600">
                        Optional. Up to 4,000 characters.
                      </p>
                    </div>
                    <div>
                      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-gold">
                        Hotel image
                      </label>
                      <p className="mb-2 text-xs text-zinc-500">
                        Main photo for this property (hero or exterior). JPEG, PNG, WebP, or GIF, max
                        3MB.
                      </p>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                        <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-zinc-600 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-300 transition hover:border-gold/50 hover:text-gold">
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            className="sr-only"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) setCoverFile(f);
                            }}
                          />
                          {coverFile ? "Replace image" : "Choose file"}
                        </label>
                        {coverFile ? (
                          <div className="flex flex-1 items-center gap-2">
                            <span className="min-w-0 truncate text-xs text-zinc-400">
                              {coverFile.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setCoverFile(null);
                              }}
                              className="shrink-0 text-xs text-zinc-500 underline hover:text-gold"
                            >
                              Remove
                            </button>
                          </div>
                        ) : null}
                      </div>
                      {coverPreview ? (
                        <div className="mt-3 overflow-hidden rounded-lg border border-border">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={coverPreview}
                            alt="Cover preview"
                            className="max-h-40 w-full object-cover"
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <h2 className="text-lg font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
                    Branding
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Logo and primary color are saved with the tenant. Staff—including hotel admins—see
                    these accents across the hotel workspace; branded sign-in uses them when opened with
                    your subdomain or <span className="font-mono">?property=slug</span>.
                  </p>
                  <div className="mt-8 space-y-6">
                    <div>
                      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-gold">
                        Primary brand color
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={form.primaryColor}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, primaryColor: e.target.value }))
                          }
                          className="h-12 w-14 cursor-pointer rounded border border-border bg-transparent p-1"
                        />
                        <Input
                          value={form.primaryColor}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, primaryColor: e.target.value }))
                          }
                          className="font-mono text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-gold">
                        Property logo
                      </label>
                      <p className="mb-2 text-xs text-zinc-500">
                        Shown on the hotel sign-in page (when using your subdomain or{" "}
                        <span className="font-mono text-zinc-400">/login?property=slug</span>) and in
                        the hotel workspace header. Square PNG or SVG-style artwork works best; JPEG, PNG,
                        WebP, or GIF, max 3MB.
                      </p>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                        <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-zinc-600 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-300 transition hover:border-gold/50 hover:text-gold">
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            className="sr-only"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) setLogoFile(f);
                            }}
                          />
                          {logoFile ? "Replace logo" : "Choose logo"}
                        </label>
                        {logoFile ? (
                          <div className="flex flex-1 items-center gap-2">
                            <span className="min-w-0 truncate text-xs text-zinc-400">
                              {logoFile.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => setLogoFile(null)}
                              className="shrink-0 text-xs text-zinc-500 underline hover:text-gold"
                            >
                              Remove
                            </button>
                          </div>
                        ) : null}
                      </div>
                      {logoPreview ? (
                        <div className="mt-3 flex items-center gap-4 rounded-lg border border-border bg-zinc-950/40 px-4 py-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={logoPreview}
                            alt="Logo preview"
                            className="h-14 w-14 shrink-0 object-contain"
                          />
                            <p className="text-xs text-zinc-500">Preview — appears on staff login and in the app header.</p>
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-xl border border-border/70 bg-zinc-950/25 p-5">
                      <h3 className="text-sm font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
                        Property gallery
                      </h3>
                      <p className="mt-1 text-sm text-zinc-500">
                        Photos shown on your Portfolio page below &quot;About this property&quot; with a slideshow.
                      </p>
                      <p className="mt-2 text-sm text-zinc-400">
                        Upload photos of your property. They appear on the Portfolio page below &quot;About this
                        property&quot; with a slideshow guests and staff can browse.
                      </p>
                      <p className="mt-2 text-xs text-zinc-600">
                        Optional. Add photos — select multiple for the slideshow (JPEG, PNG, or WebP · max 5 MB each ·
                        up to {PROPERTY_GALLERY_MAX_FILES} total). They upload when you complete provisioning.
                      </p>
                      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                          <input
                            ref={galleryInputRef}
                            type="file"
                            multiple
                            accept="image/jpeg,image/png,image/webp"
                            className="sr-only"
                            onChange={(e) => {
                              const list = e.target.files;
                              if (!list?.length) return;
                              setGalleryFiles((prev) => {
                                const next = [...prev];
                                for (let i = 0; i < list.length; i++) {
                                  const f = list[i];
                                  if (next.length >= PROPERTY_GALLERY_MAX_FILES) break;
                                  if (!PROPERTY_GALLERY_ACCEPT.has(f.type)) continue;
                                  if (f.size > PROPERTY_GALLERY_MAX_BYTES) continue;
                                  next.push(f);
                                }
                                return next;
                              });
                              e.target.value = "";
                            }}
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            className="shrink-0"
                            onClick={() => galleryInputRef.current?.click()}
                          >
                            Choose files
                          </Button>
                          <span className="truncate text-xs text-zinc-500">
                            {galleryFiles.length === 0
                              ? "No files chosen"
                              : `${galleryFiles.length} photo${galleryFiles.length === 1 ? "" : "s"} queued`}
                          </span>
                        </div>
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-zinc-900/50 text-zinc-400"
                          title="Included in final provisioning step"
                        >
                          <Upload className="h-4 w-4" />
                        </div>
                      </div>
                      {galleryPreviews.length > 0 ? (
                        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                          {galleryPreviews.map((src, idx) => (
                            <li
                              key={`${src}-${idx}`}
                              className="relative overflow-hidden rounded-lg border border-border bg-black/20"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={src} alt="" className="aspect-square w-full object-cover" />
                              <button
                                type="button"
                                onClick={() =>
                                  setGalleryFiles((prev) => prev.filter((_, j) => j !== idx))
                                }
                                className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full border border-red-500/40 bg-black/75 text-red-200 shadow-md backdrop-blur-sm hover:bg-red-950/90"
                                aria-label="Remove photo"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <h2 className="text-lg font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
                    Confirmation
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Review and provision the tenant. This saves the property to Supabase (tenant +
                    default subscription). Add hotel admins from <strong>Admins → Create admin</strong>.
                  </p>
                  {actionError ? (
                    <p className="mt-4 rounded-lg border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-200">
                      {actionError}
                    </p>
                  ) : null}
                  <dl className="mt-8 space-y-4 text-sm">
                    <div className="flex justify-between border-b border-border/60 py-2">
                      <dt className="text-zinc-500">Hotel</dt>
                      <dd className="font-medium text-white">{form.hotelName}</dd>
                    </div>
                    <div className="flex justify-between border-b border-border/60 py-2">
                      <dt className="text-zinc-500">Domain</dt>
                      <dd className="font-mono text-gold">
                        {form.subdomain}.qimem.com
                      </dd>
                    </div>
                    <div className="flex justify-between border-b border-border/60 py-2">
                      <dt className="text-zinc-500">Region (Ethiopia)</dt>
                      <dd className="text-right text-zinc-300">{form.region || "—"}</dd>
                    </div>
                    <div className="flex justify-between py-2">
                      <dt className="text-zinc-500">Primary color</dt>
                      <dd className="flex items-center gap-2">
                        <span
                          className="h-5 w-5 rounded border border-white/20"
                          style={{ backgroundColor: form.primaryColor }}
                        />
                        {form.primaryColor}
                      </dd>
                    </div>
                    <div className="border-b border-border/60 py-2">
                      <dt className="text-zinc-500">Description</dt>
                      <dd className="mt-1 max-w-md text-left text-sm text-zinc-300">
                        {form.description.trim() ? (
                          <span className="whitespace-pre-wrap">{form.description.trim()}</span>
                        ) : (
                          <span className="text-zinc-500">—</span>
                        )}
                      </dd>
                    </div>
                    <div className="border-b border-border/60 py-2">
                      <dt className="text-zinc-500">Hotel image</dt>
                      <dd className="mt-2">
                        {coverPreview ? (
                          <div className="max-w-xs overflow-hidden rounded-lg border border-border">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={coverPreview}
                              alt=""
                              className="max-h-32 w-full object-cover"
                            />
                          </div>
                        ) : (
                          <span className="text-sm text-zinc-500">None selected</span>
                        )}
                      </dd>
                    </div>
                    <div className="border-b border-border/60 py-2">
                      <dt className="text-zinc-500">Logo</dt>
                      <dd className="mt-2">
                        {logoPreview ? (
                          <div className="flex items-center gap-3 rounded-lg border border-border bg-zinc-950/30 px-3 py-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={logoPreview} alt="" className="h-12 w-12 object-contain" />
                          </div>
                        ) : (
                          <span className="text-sm text-zinc-500">None selected</span>
                        )}
                      </dd>
                    </div>
                    <div className="py-2">
                      <dt className="text-zinc-500">Property gallery</dt>
                      <dd className="mt-2">
                        {galleryPreviews.length > 0 ? (
                          <ul className="grid max-w-lg grid-cols-4 gap-2">
                            {galleryPreviews.map((src, i) => (
                              <li key={i} className="overflow-hidden rounded-md border border-border">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={src} alt="" className="aspect-square w-full object-cover" />
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-sm text-zinc-500">None — optional</span>
                        )}
                      </dd>
                    </div>
                  </dl>
                </>
              )}

              <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={back}
                  className="flex items-center gap-1 text-sm text-zinc-500 hover:text-gold"
                >
                  <ChevronLeft className="h-4 w-4" />
                  {step === 1 ? "Cancel" : "Back"}
                </button>
                {step < 3 ? (
                  <Button type="button" onClick={next} className="gap-2">
                    {step === 1 ? "Continue to branding" : "Review"}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    disabled={submitting}
                    onClick={() => void completeProvisioning()}
                  >
                    {submitting ? "Saving…" : "Complete provisioning"}
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6 lg:col-span-2">
            <div
              className={cn(
                "rounded-2xl border border-border bg-surface-elevated/40 p-5",
                step < 2 && "opacity-90",
              )}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/15">
                  <Lock className="h-5 w-5 text-gold" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Branding configuration</p>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                    Customize the guest experience with bespoke logos and brand colors.
                  </p>
                  <div className="mt-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gold">
                      Primary brand color
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className="h-8 w-8 rounded border border-white/10"
                        style={{ backgroundColor: form.primaryColor }}
                      />
                      <span className="text-xs text-zinc-400">{form.primaryColor}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border">
              <div className="relative aspect-[16/10] bg-gradient-to-br from-zinc-800 via-zinc-900 to-black">
                {coverPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={coverPreview}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : null}
                <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/85 via-black/20 to-transparent p-6">
                  {logoPreview ? (
                    <div className="mb-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={logoPreview}
                        alt=""
                        className="h-12 w-auto max-w-[140px] object-contain drop-shadow-md"
                      />
                    </div>
                  ) : null}
                  <p className="line-clamp-2 text-lg font-semibold text-gold [font-family:var(--font-outfit),system-ui,sans-serif]">
                    {form.hotelName.trim() || "Property name"}
                  </p>
                  <p className="mt-2 line-clamp-3 text-sm text-zinc-200">
                    {form.description.trim() ||
                      "Add a description in step 1 to preview the guest-facing story here."}
                  </p>
                </div>
              </div>
            </div>

            <Link
              href="/superadmin/tenants"
              className="block text-center text-xs text-zinc-600 hover:text-gold"
            >
              Return to tenants list
            </Link>
          </div>
        </div>
      </div>

      <p className="mt-8 text-center text-[10px] font-medium uppercase tracking-[0.25em] text-zinc-600">
        Powered by Qimem OS · Secure superadmin environment
      </p>
    </div>
  );
}
