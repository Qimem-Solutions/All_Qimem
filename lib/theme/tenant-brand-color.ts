import type { CSSProperties } from "react";

const HEX6 = /^#?([0-9a-fA-F]{6})$/;

/** Normalize to lowercase `#rrggbb` or null if invalid. */
export function normalizePrimaryBrandHex(input: string): string | null {
  const t = input.trim();
  const m = t.match(HEX6);
  if (!m) return null;
  return `#${m[1].toLowerCase()}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const n = normalizePrimaryBrandHex(hex);
  if (!n) return null;
  const h = n.slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function relativeLuminance(rgb: { r: number; g: number; b: number }): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const R = lin(rgb.r);
  const G = lin(rgb.g);
  const B = lin(rgb.b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("")}`;
}

function darken(rgb: { r: number; g: number; b: number }, factor: number): string {
  return rgbToHex(rgb.r * factor, rgb.g * factor, rgb.b * factor);
}

export function deriveTenantGoldPalette(primaryHex: string): {
  gold: string;
  goldDim: string;
  goldForeground: string;
} | null {
  const gold = normalizePrimaryBrandHex(primaryHex);
  if (!gold) return null;
  const rgb = hexToRgb(gold);
  if (!rgb) return null;
  const L = relativeLuminance(rgb);
  const goldDim = darken(rgb, 0.82);
  const goldForeground = L > 0.55 ? "#0a0a0b" : "#fafaf9";
  return { gold, goldDim, goldForeground };
}

/** CSS custom properties consumed by globals.css / Tailwind theme tokens. */
export function tenantBrandCssVariables(primaryHex: string): Record<string, string> | null {
  const p = deriveTenantGoldPalette(primaryHex);
  if (!p) return null;
  return {
    "--gold": p.gold,
    "--gold-dim": p.goldDim,
    "--gold-foreground": p.goldForeground,
    "--color-gold": p.gold,
    "--color-gold-dim": p.goldDim,
    "--color-gold-foreground": p.goldForeground,
  };
}

export function tenantBrandInlineStyle(primaryHex: string): CSSProperties | undefined {
  const vars = tenantBrandCssVariables(primaryHex);
  if (!vars) return undefined;
  return vars as CSSProperties;
}
