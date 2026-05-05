"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "react-qr-code";
import { Copy, Download, ExternalLink, QrCode } from "lucide-react";
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
  const [exportingPdf, setExportingPdf] = useState(false);
  const [origin, setOrigin] = useState("");
  const qrWrapRef = useRef<HTMLDivElement>(null);

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

  async function exportQrPdf() {
    const wrap = qrWrapRef.current;
    if (!wrap || !portfolioUrl || exportingPdf) return;
    const svg = wrap.querySelector("svg");
    if (!svg) return;

    setExportingPdf(true);
    try {
      const svgStr = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
      const objUrl = URL.createObjectURL(svgBlob);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to render QR"));
        img.src = objUrl;
      });
      URL.revokeObjectURL(objUrl);

      const scale = 4;
      const baseW = img.naturalWidth || img.width;
      const baseH = img.naturalHeight || img.height;
      const canvas = document.createElement("canvas");
      canvas.width = baseW * scale;
      canvas.height = baseH * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/png");

      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const margin = 18;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(16);
      pdf.text("Portfolio QR", margin, margin);

      const qrSizeMm = 75;
      const yQr = margin + 14;
      const xQr = (pageW - qrSizeMm) / 2;
      pdf.addImage(dataUrl, "PNG", xQr, yQr, qrSizeMm, qrSizeMm);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      const urlY = yQr + qrSizeMm + 8;
      const urlLines = pdf.splitTextToSize(portfolioUrl, pageW - margin * 2);
      pdf.text(urlLines, margin, urlY);

      const safeSlug = trimmedSlug.replace(/[^a-zA-Z0-9-_]/g, "_") || "portfolio";
      pdf.save(`portfolio-qr-${safeSlug}.pdf`);
    } catch {
      /* ignore */
    } finally {
      setExportingPdf(false);
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
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
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
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5"
                    onClick={exportQrPdf}
                    disabled={exportingPdf}
                    aria-label="Download QR code as PDF"
                  >
                    <Download className="h-3.5 w-3.5" strokeWidth={2} />
                    {exportingPdf ? "…" : "Export"}
                  </Button>
                </div>

                <div
                  ref={qrWrapRef}
                  className="mx-auto mt-5 flex justify-center rounded-xl bg-white p-4"
                >
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
