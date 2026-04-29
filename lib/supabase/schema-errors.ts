/**
 * Detect Postgres / PostgREST "column missing" (migration not applied or schema cache stale).
 * PostgREST often puts the long text in `details`, not `message` — scan all fields.
 */
function columnErrorBlob(err: {
  message?: string | null;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
} | null): string {
  if (!err) return "";
  return [err.message, err.details, err.hint, String(err.code ?? "")]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function isMissingDbColumnError(err: {
  message?: string | null;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
} | null): boolean {
  if (!err) return false;
  if (String(err.code) === "42703") return true;
  const m = columnErrorBlob(err);
  if (m.includes("column") && m.includes("does not exist")) return true;
  if (m.includes("could not find") && m.includes("column")) return true;
  if (m.includes("schema cache") && (m.includes("column") || m.includes("profiles"))) return true;
  /** Definite signal: cache doesn’t know this column name yet */
  if (m.includes("must_change_password") && (m.includes("schema cache") || m.includes("could not find"))) {
    return true;
  }
  return false;
}
