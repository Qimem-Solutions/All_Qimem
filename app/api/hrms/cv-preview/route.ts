import { NextRequest, NextResponse } from "next/server";
import { getUserContext } from "@/lib/queries/context";
import { canManageHrStaff } from "@/lib/auth/can-manage-hr-staff";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function contentTypeForPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lower.endsWith(".doc")) return "application/msword";
  return "application/octet-stream";
}

/**
 * Same-origin proxy for CV files so the browser can show them inline in an iframe.
 * Supabase signed URLs are cross-origin and often blocked or forced to download in iframes.
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("path");
  if (!raw) {
    return NextResponse.json({ error: "Missing path." }, { status: 400 });
  }

  let path: string;
  try {
    path = decodeURIComponent(raw);
  } catch {
    return NextResponse.json({ error: "Invalid path." }, { status: 400 });
  }

  if (path.includes("..") || path.startsWith("/") || path.includes("\\")) {
    return NextResponse.json({ error: "Invalid path." }, { status: 400 });
  }

  const ctx = await getUserContext();
  if (!ctx?.userId || !ctx.tenantId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!(await canManageHrStaff(ctx))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const tenantPrefix = `${ctx.tenantId}/`;
  if (!path.startsWith(tenantPrefix)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let admin: ReturnType<typeof createServiceRoleClient>;
  try {
    admin = createServiceRoleClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 503 });
  }

  const { data: blob, error } = await admin.storage.from("recruitment-cvs").download(path);
  if (error || !blob) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  const type = contentTypeForPath(path);

  return new NextResponse(blob, {
    status: 200,
    headers: {
      "Content-Type": type,
      /** Omit filename in Content-Disposition so clients that fetch→blob→blob: URL do not treat this as a forced download. */
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
    },
  });
}
