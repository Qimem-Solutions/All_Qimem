import { NextRequest, NextResponse } from "next/server";
import { getUserContext } from "@/lib/queries/context";
import { getServiceAccessForLayout } from "@/lib/auth/service-access";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function contentTypeForPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "application/octet-stream";
}

/** Inline image for &lt;img&gt; / same-origin use (private bucket). */
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

  const hrmsLevel = await getServiceAccessForLayout(ctx, "hrms");
  if (hrmsLevel === "none") {
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

  const { data: blob, error } = await admin.storage.from("employee-photos").download(path);
  if (error || !blob) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  const type = contentTypeForPath(path);

  return new NextResponse(blob, {
    status: 200,
    headers: {
      "Content-Type": type,
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=300",
    },
  });
}
