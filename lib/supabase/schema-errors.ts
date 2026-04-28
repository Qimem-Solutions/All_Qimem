/**
 * Detect Postgres / PostgREST "column missing" (migration not applied or schema cache stale).
 * Matches plain Postgres errors and PostgREST schema-cache messages.
 */
export function isMissingDbColumnError(err: {
  message?: string | null;
  code?: string | null;
} | null): boolean {
  if (!err) return false;
  if (String(err.code) === "42703") return true;
  const m = (err.message ?? "").toLowerCase();
  if (m.includes("column") && m.includes("does not exist")) return true;
  if (m.includes("could not find") && m.includes("column")) return true;
  if (m.includes("schema cache") && (m.includes("column") || m.includes("'profiles'"))) return true;
  return false;
}
