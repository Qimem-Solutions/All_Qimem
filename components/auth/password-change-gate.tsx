"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  PASSWORD_CHANGE_DISMISS_KEY,
  PASSWORD_CHANGE_PROMPT_STORAGE_KEY,
} from "@/lib/constants/passwords";
import { isMissingDbColumnError } from "@/lib/supabase/schema-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * After login with a default password or when `profiles.must_change_password` is true,
 * prompts for password update (optional — user can skip for this session).
 */
export function PasswordChangeGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [checking, setChecking] = useState(true);
  const [currentPw, setCurrentPw] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!pathname || pathname.startsWith("/login")) {
      setOpen(false);
      setChecking(false);
      return;
    }

    let cancelled = false;
    async function run() {
      setChecking(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) {
        if (!cancelled) setOpen(false);
        setChecking(false);
        return;
      }

      const sessionFlag =
        typeof sessionStorage !== "undefined" &&
        sessionStorage.getItem(PASSWORD_CHANGE_PROMPT_STORAGE_KEY) === "1";

      const dismissedFlag =
        typeof sessionStorage !== "undefined" &&
        sessionStorage.getItem(PASSWORD_CHANGE_DISMISS_KEY) === "1";

      let dbFlag = false;
      const profRes = await supabase
        .from("profiles")
        .select("must_change_password")
        .eq("id", user.id)
        .maybeSingle();

      if (profRes.error && isMissingDbColumnError(profRes.error)) {
        dbFlag = false;
      } else if (!profRes.error && profRes.data) {
        dbFlag = profRes.data.must_change_password === true;
      }

      if (cancelled) return;

      const show = (sessionFlag || dbFlag) && !dismissedFlag;
      setOpen(show);
      setChecking(false);
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const skipForNow = useCallback(() => {
    try {
      sessionStorage.setItem(PASSWORD_CHANGE_DISMISS_KEY, "1");
      sessionStorage.removeItem(PASSWORD_CHANGE_PROMPT_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setCurrentPw("");
    setPw("");
    setPw2("");
    setError(null);
    setOpen(false);
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (!open || loading) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") skipForNow();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, skipForNow]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!currentPw.trim()) {
      setError("Enter your current password.");
      return;
    }
    if (pw.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (pw !== pw2) {
      setError("New passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) {
        setError("Your session has no email; sign out and sign in again.");
        setLoading(false);
        return;
      }

      const { error: verifyErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPw,
      });
      if (verifyErr) {
        setError("Current password is incorrect.");
        setLoading(false);
        return;
      }

      const { error: authErr } = await supabase.auth.updateUser({ password: pw });
      if (authErr) {
        setError(authErr.message);
        setLoading(false);
        return;
      }

      const { error: profErr } = await supabase
        .from("profiles")
        .update({ must_change_password: false })
        .eq("id", user.id);

      if (profErr && !isMissingDbColumnError(profErr)) {
        setError(
          `Password updated, but profile flag failed: ${profErr.message}. Try signing out and back in.`,
        );
        setLoading(false);
        return;
      }

      try {
        sessionStorage.removeItem(PASSWORD_CHANGE_PROMPT_STORAGE_KEY);
        sessionStorage.removeItem(PASSWORD_CHANGE_DISMISS_KEY);
      } catch {
        /* ignore */
      }
      setCurrentPw("");
      setPw("");
      setPw2("");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    const supabase = createClient();
    try {
      sessionStorage.removeItem(PASSWORD_CHANGE_PROMPT_STORAGE_KEY);
      sessionStorage.removeItem(PASSWORD_CHANGE_DISMISS_KEY);
    } catch {
      /* ignore */
    }
    await supabase.auth.signOut();
    setOpen(false);
    router.push("/login");
    router.refresh();
  }

  const showOverlay = mounted && open && !checking;

  return (
    <>
      {children}
      {showOverlay && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[10070] flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]"
              role="dialog"
              aria-modal="true"
              aria-labelledby="pw-change-title"
              aria-describedby="pw-change-desc"
            >
              <div className="relative w-full max-w-md rounded-xl border border-border bg-surface-elevated p-6 shadow-2xl">
                <h2
                  id="pw-change-title"
                  className="text-lg font-semibold text-foreground [font-family:var(--font-outfit),system-ui,sans-serif]"
                >
                  Change your password
                </h2>
                <p id="pw-change-desc" className="mt-2 text-sm text-muted">
                  For security, enter your <strong className="text-foreground">current</strong> password, then choose a new one. You can{" "}
                  <strong className="text-foreground">skip</strong> this for now and continue — we&apos;ll remind you next time you sign in if you still use a default password.
                </p>

                <form onSubmit={(e) => void onSubmit(e)} className="mt-5 space-y-3">
                  <div>
                    <label htmlFor="current-pw-gate" className="text-xs font-medium text-muted">
                      Current password
                    </label>
                    <Input
                      id="current-pw-gate"
                      type="password"
                      autoComplete="current-password"
                      value={currentPw}
                      onChange={(e) => setCurrentPw(e.target.value)}
                      className="mt-1.5"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label htmlFor="new-pw-gate" className="text-xs font-medium text-muted">
                      New password
                    </label>
                    <Input
                      id="new-pw-gate"
                      type="password"
                      autoComplete="new-password"
                      value={pw}
                      onChange={(e) => setPw(e.target.value)}
                      className="mt-1.5"
                      minLength={8}
                    />
                  </div>
                  <div>
                    <label htmlFor="confirm-pw-gate" className="text-xs font-medium text-muted">
                      Confirm new password
                    </label>
                    <Input
                      id="confirm-pw-gate"
                      type="password"
                      autoComplete="new-password"
                      value={pw2}
                      onChange={(e) => setPw2(e.target.value)}
                      className="mt-1.5"
                      minLength={8}
                    />
                  </div>
                  {error ? (
                    <p className="text-sm text-red-400" role="alert">
                      {error}
                    </p>
                  ) : null}
                  <div className="flex flex-col gap-2 pt-2">
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Updating…" : "Save new password"}
                    </Button>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Button type="button" variant="secondary" disabled={loading} onClick={skipForNow}>
                        Skip for now
                      </Button>
                      <Button type="button" variant="ghost" disabled={loading} onClick={() => void signOut()}>
                        Sign out
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted">Press Escape to skip.</p>
                  </div>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
