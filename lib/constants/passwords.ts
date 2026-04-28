import { DEFAULT_HOTEL_ADMIN_PASSWORD } from "@/lib/constants/admin";
import { DEFAULT_STAFF_PASSWORD } from "@/lib/constants/staff";

/** Matches `web/scripts/seed-superadmin.mjs` — prompt until changed like other defaults. */
export const DEFAULT_SUPERADMIN_SEED_PASSWORD = "Qimem@123";

/** Session flag set after email/password login when a change is required (immediate UX before refetch). */
export const PASSWORD_CHANGE_PROMPT_STORAGE_KEY = "allqimem-force-password-change";

/** User dismissed the optional password-change modal until next login (tab session). */
export const PASSWORD_CHANGE_DISMISS_KEY = "allqimem-password-change-dismissed";

export function isKnownDefaultPassword(password: string): boolean {
  return (
    password === DEFAULT_HOTEL_ADMIN_PASSWORD ||
    password === DEFAULT_STAFF_PASSWORD ||
    password === DEFAULT_SUPERADMIN_SEED_PASSWORD
  );
}
