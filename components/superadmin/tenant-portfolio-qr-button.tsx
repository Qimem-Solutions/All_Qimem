"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "react-qr-code";
import { Copy, ExternalLink, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  hasPortfolioQrFlag,
  setPortfolioQrFlag,
} from "@/lib/superadmin/tenant-portfolio-qr-flag";
import { getPublicSiteOrigin } from "@/lib/site-public-url";

type Props = {
  tenantId: string;
  slug: string;
};

export function TenantPortfolioQrButton({ tenantId, slug }: Props) {
  const [hydrated, setHydrated] = useState(false);
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState(false);
  const [copyDone, setCopyDone] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setSaved(hasPortfolioQrFlag(tenantId));
    setHydrated(true);
    setOrigin(getPublicSiteOrigin());
  }, [tenantId]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const trimmedSlug = slug.trim();
  const portfolioUrl =
    origin && trimmedSlug ? `${origin}/p/${encodeURIComponent(trimmedSlug)}` : "";

  function handleOpen() {
    if (!portfolioUrl) return;
    if (!hasPortfolioQrFlag(tenantId)) {
      setPortfolioQrFlag(tenantId);
      setSaved(true);
    }
    setCopyDone(false);
    setOpen(true);
  }

  async function copyUrl() {
    if (!portfolioUrl || typeof navigator === "undefined") return;
    try {
      await navigator.clipboard.writeText(portfolioUrl);
      setCopyDone(true);
      window.setTimeout(() => setCopyDone(false), 2000);
    } catch {
      setCopyDone(false);
    }
  }

  if (!trimmedSlug) {
    return <span className="text-xs text-zinc-600">—</span>;
  }

  const label = hydrated && saved ? "View code" : "Create QR code";

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="gap-1.5 font-normal"
        onClick={handleOpen}
        disabled={!hydrated || !portfolioUrl}
      >
        <QrCode className="h-3.5 w-3.5" strokeWidth={2} />
        {hydrated ? label : "…"}
      </Button>

      {typeof document !== "undefined" && open && portfolioUrl
        ? createPortal(
            <div
              className="fixed inset-0 isolate z-[10055] flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby={`tenant-qr-title-${tenantId}`}
            >
              <button
                type="button"
                className="absolute inset-0 z-0 cursor-default bg-black/70"
                aria-label="Close"
                onClick={() => setOpen(false)}
              />
              <div
                className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-zinc-950 p-6 shadow-2xl ring-1 ring-white/10"
                onClick={(e) => e.stopPropagation()}
              >
                <h2
                  id={`tenant-qr-title-${tenantId}`}
                  className="text-lg font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]"
                >
                  Portfolio QR
                </h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Uses <span className="font-mono text-zinc-400">NEXT_PUBLIC_SITE_URL</span> when set;
                  otherwise matches the host in your address bar (localhost vs your live domain).
                </p>

                <div className="mx-auto mt-5 flex justify-center rounded-xl bg-white p-4">
                  <QRCode value={portfolioUrl} size={200} level="M" />
                </div>

                <p className="mt-4 break-all rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-[11px] leading-relaxed text-zinc-300">
                  {portfolioUrl}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={copyUrl}>
                    <Copy className="h-3.5 w-3.5" />
                    {copyDone ? "Copied" : "Copy URL"}
                  </Button>
                  <a
                    href={portfolioUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface-elevated px-3 text-xs font-medium text-foreground transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open portfolio
                  </a>
                </div>

                <div className="mt-6 flex justify-end">
                  <Button type="button" size="sm" onClick={() => setOpen(false)}>
                    Close
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
