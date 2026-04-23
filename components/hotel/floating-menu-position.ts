import type { CSSProperties } from "react";

const MENU_W = 224;
const PADDING = 8;

/**
 * Place a menu under (or above) a trigger, aligned to the trigger's right edge, clamped to the viewport.
 * Used for table row kebab menus so they escape overflow/stacking; pair with a portal to document.body.
 */
export function getFloatingMenuStyle(trigger: HTMLElement, menuHeightEstimate = 200): CSSProperties {
  const r = trigger.getBoundingClientRect();
  const left = Math.min(
    window.innerWidth - MENU_W - PADDING,
    Math.max(PADDING, r.right - MENU_W),
  );
  const gap = 6;
  const spaceBelow = window.innerHeight - r.bottom - gap;
  const openDown = spaceBelow >= 100 || r.bottom < window.innerHeight * 0.4;
  const top = openDown
    ? r.bottom + gap
    : Math.max(PADDING, r.top - menuHeightEstimate - gap);
  return {
    position: "fixed",
    top,
    left,
    width: MENU_W,
    zIndex: 500,
  };
}
