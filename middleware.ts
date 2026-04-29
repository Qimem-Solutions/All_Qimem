import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const { error: sessionError } = await supabase.auth.getUser();

  /** Stale cookies: refresh fails; clear session cookies to stop repeated client refresh errors. */
  if (sessionError) {
    const m = sessionError.message?.toLowerCase() ?? "";
    const code = String(sessionError.code ?? "");
    if (
      code === "refresh_token_not_found" ||
      (m.includes("refresh") && (m.includes("invalid") || m.includes("not found")))
    ) {
      await supabase.auth.signOut();
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/hrms/:path*",
    "/hrrm/:path*",
    "/hotel/:path*",
    "/superadmin/:path*",
  ],
};
