"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Clears Supabase cookies when refresh token is missing/invalid (avoids noisy AuthApiError retries in dev).
 */
export function StaleSessionCleanup() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.getUser();
      if (cancelled || !error) return;
      const m = error.message?.toLowerCase() ?? "";
      const code = String(error.code ?? "");
      if (
        code === "refresh_token_not_found" ||
        (m.includes("refresh") && (m.includes("invalid") || m.includes("not found")))
      ) {
        await supabase.auth.signOut();
        router.refresh();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
