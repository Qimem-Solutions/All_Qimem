/**
 * Detect Postgres "column does not exist" (migration not applied yet).
 * Lets auth flows fall back when optional columns are missing.
 */
export function isMissingDbColumnError(err: {
  message?: string | null;
  code?: string | null;
} | null): boolean {
  if (!err) return false;
  if (String(err.code) === "42703") return true;
  const m = (err.message ?? "").toLowerCase();
  return m.includes("column") && m.includes("does not exist");
}
