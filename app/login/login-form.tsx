"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import { dashboardPathForRole } from "@/lib/auth/roles";
import {
  isKnownDefaultPassword,
  PASSWORD_CHANGE_PROMPT_STORAGE_KEY,
} from "@/lib/constants/passwords";
import { isMissingDbColumnError } from "@/lib/supabase/schema-errors";
import { cn } from "@/lib/utils";

type Lang = "en" | "am";

const copy: Record<
  Lang,
  {
    unifiedSignIn: string;
    credentialsHint: string;
    email: string;
    password: string;
    rememberMe: string;
    forgotPassword: string;
    signingIn: string;
    signIn: string;
    orContinue: string;
    google: string;
    showPassword: string;
    hidePassword: string;
    backWelcome: string;
    couldNotSignIn: string;
    noProfile: string;
    genericError: string;
    invalidCredentialsHint: string;
  }
> = {
  en: {
    unifiedSignIn: "Unified sign-in",
    credentialsHint:
      "Enter your credentials — you'll be redirected to the right workspace from your profile.",
    email: "Email",
    password: "Password",
    rememberMe: "Remember me",
    forgotPassword: "Forgot password?",
    signingIn: "Signing in…",
    signIn: "Sign in",
    orContinue: "Or continue with",
    google: "Google",
    showPassword: "Show password",
    hidePassword: "Hide password",
    backWelcome: "← Back to welcome",
    couldNotSignIn: "Could not sign in.",
    noProfile:
      "Your account has no profile yet. Ask an administrator to provision your access.",
    genericError: "Something went wrong.",
    invalidCredentialsHint:
      "Invalid credentials. Migrations only touch the database — they do not register a password in Auth. Add your project's service role key to .env.local as SUPABASE_SERVICE_ROLE_KEY, then run: npm run seed:superadmin (from the web folder). Or create the user manually under Supabase → Authentication → Users.",
  },
  am: {
    unifiedSignIn: "የተዋሃደ ምልክት ግባ",
    credentialsHint:
      "መለያዎን ያስገቡ — ከመገለጫዎ በመነሻ የትክክለኛው የስራ ቦታ ይወስድዎታል።",
    email: "ኢሜይል",
    password: "የይለፍ ቃል",
    rememberMe: "አስታውሰኝ",
    forgotPassword: "የይለፍ ቃል ረሳኽው?",
    signingIn: "በመግባት ላይ…",
    signIn: "ግባ",
    orContinue: "ወይም በዚህ ይቀጥሉ",
    google: "Google",
    showPassword: "የይለፍ ቃል አሳይ",
    hidePassword: "የይለፍ ቃል ደብቅ",
    backWelcome: "← ወደ ሰላምታ ተመለስ",
    couldNotSignIn: "መግባት አልተቻለም።",
    noProfile:
      "ለመለያዎ መገለጫ የለም። የመዳረሻ ማብቃያ እንዲስጥ አስተዳዳሪ ያግኙ።",
    genericError: "ስህተት ተፈጥሯል።",
    invalidCredentialsHint:
      "የመግባት ዝርዝሮች ትክክል አይደሉም። የተጠቃሚውን በአስተዳዳሪ ይፍጠሩ ወይም በ Supabase Authentication ይመዝገቡ።",
  },
};

const oauthHint: Record<
  Lang,
  Record<
    "missing_code" | "exchange_failed" | "no_user" | "no_profile",
    string
  >
> = {
  en: {
    missing_code: "Sign-in was cancelled or incomplete. Try again.",
    exchange_failed: "Could not complete Google sign-in.",
    no_user: "No user returned after Google sign-in.",
    no_profile:
      "Your Google account is not provisioned yet. Ask an administrator to create your profile for this platform (same as email/password users).",
  },
  am: {
    missing_code: "መግባት ተቋርጧል ወይም አልተሟላም። እንደገና ይሞክሩ።",
    exchange_failed: "በ Google መግባት አልተጠናቀቀም።",
    no_user: "ከ Google በኋላ ተጠቃሚ አልተመለሰም።",
    no_profile:
      "የ Google መለያዎ እስካሁን አልተዘጋጀም። የመገለጫ እንዲፈጥርልዎ አስተዳዳሪ ያግኙ።",
  },
};

type LoginFormProps = {
  oauth?: string;
  oauthDetail?: string;
};

export function LoginForm({ oauth, oauthDetail }: LoginFormProps = {}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [lang, setLang] = useState<Lang>("en");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = copy[lang];

  useEffect(() => {
    if (!oauth) return;
    const hints = oauthHint[lang];
    let msg: string;
    if (oauth === "missing_code") msg = hints.missing_code;
    else if (oauth === "exchange_failed") msg = hints.exchange_failed;
    else if (oauth === "no_user") msg = hints.no_user;
    else if (oauth === "no_profile") msg = hints.no_profile;
    else msg = `Sign-in issue (${oauth}).`;

    if (oauth === "exchange_failed" && oauthDetail) {
      const detail =
        oauthDetail.length > 400 ? `${oauthDetail.slice(0, 400)}…` : oauthDetail;
      msg = `${msg} ${detail}`;
    }
    setError(msg);
  }, [oauth, oauthDetail, lang]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: auth, error: signError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signError) {
        const raw = signError.message;
        const invalid =
          /invalid login|invalid credentials|email not confirmed/i.test(raw);
        setError(
          invalid
            ? lang === "am"
              ? `${raw} ${t.invalidCredentialsHint}`
              : `${raw} ${copy.en.invalidCredentialsHint}`
            : raw,
        );
        setLoading(false);
        return;
      }
      if (!auth.user) {
        setError(t.couldNotSignIn);
        setLoading(false);
        return;
      }

      let profileRes = await supabase
        .from("profiles")
        .select("global_role, must_change_password")
        .eq("id", auth.user.id)
        .maybeSingle();

      if (profileRes.error && isMissingDbColumnError(profileRes.error)) {
        profileRes = await supabase
          .from("profiles")
          .select("global_role")
          .eq("id", auth.user.id)
          .maybeSingle();
      }

      const profile = profileRes.data as {
        global_role?: string | null;
        must_change_password?: boolean | null;
      } | null;
      const profileError = profileRes.error;

      if (profileError) {
        await supabase.auth.signOut();
        setError(profileError.message);
        setLoading(false);
        return;
      }

      const actualRole = profile?.global_role ?? null;
      if (!actualRole) {
        await supabase.auth.signOut();
        setError(t.noProfile);
        setLoading(false);
        return;
      }

      const needsPasswordChange =
        profile?.must_change_password === true || isKnownDefaultPassword(password);
      try {
        if (needsPasswordChange) {
          sessionStorage.setItem(PASSWORD_CHANGE_PROMPT_STORAGE_KEY, "1");
        } else {
          sessionStorage.removeItem(PASSWORD_CHANGE_PROMPT_STORAGE_KEY);
        }
      } catch {
        /* sessionStorage unavailable */
      }

      router.push(dashboardPathForRole(actualRole));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.genericError);
    } finally {
      setLoading(false);
    }
  }

  async function signInWithGoogle() {
    setError(null);
    setOauthLoading(true);
    try {
      const supabase = createClient();
      const origin =
        typeof window !== "undefined"
          ? window.location.origin
          : (process.env.NEXT_PUBLIC_SITE_URL ?? "");
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback`,
          queryParams: {
            prompt: "select_account",
          },
        },
      });
      if (oauthError) {
        setError(oauthError.message);
        setOauthLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
      setOauthLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div
        className="absolute inset-0 dark:hidden"
        style={{
          background:
            "linear-gradient(135deg, rgba(250,250,249,1) 0%, rgba(254,252,247,1) 45%, rgba(245,245,244,1) 100%)",
        }}
      />
      <div
        className="absolute inset-0 hidden dark:block"
        style={{
          background:
            "linear-gradient(135deg, rgba(15,60,65,0.85) 0%, rgba(8,12,18,0.95) 50%, rgba(10,10,12,1) 100%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-50 dark:hidden"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h30v30H0z' fill='%23000000' fill-opacity='0.04'/%3E%3C/svg%3E")`,
        }}
      />
      <div
        className="absolute inset-0 hidden opacity-30 dark:block"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h30v30H0z' fill='%23ffffff' fill-opacity='0.02'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <div
        lang={lang === "am" ? "am" : "en"}
        className={cn(
          "relative z-10 w-full max-w-md rounded-2xl border border-zinc-200/90 bg-white/90 p-8 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/70 dark:shadow-2xl",
          lang === "am" && "font-[family-name:var(--font-amharic)]",
        )}
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-[0.2em] text-gold [font-family:var(--font-outfit),system-ui,sans-serif]">
            ALLQIMEM
          </h1>
          <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.35em] text-foreground/80 dark:text-zinc-300">
            {t.unifiedSignIn}
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-foreground/85 dark:text-zinc-500">
          {t.credentialsHint}
        </p>

        <form className="mt-8 space-y-5" onSubmit={onSubmit}>
          {error ? (
            <div
              className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-center text-sm text-red-800 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-200"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          <div>
            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-foreground dark:text-zinc-300">
              {t.email}
            </label>
            <Input
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@property.com"
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-foreground dark:text-zinc-300">
              {t.password}
            </label>
            <div className="relative">
              <Input
                type={show ? "text" : "password"}
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="pr-12"
                required
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/55 hover:text-foreground dark:text-zinc-500 dark:hover:text-zinc-300"
                aria-label={show ? t.hidePassword : t.showPassword}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <label className="flex cursor-pointer items-center gap-2 text-foreground/90 dark:text-zinc-400">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-zinc-400 bg-white dark:border-zinc-600 dark:bg-zinc-800"
              />
              {t.rememberMe}
            </label>
            <button type="button" className="text-gold hover:underline">
              {t.forgotPassword}
            </button>
          </div>

          <Button
            type="submit"
            className="w-full uppercase tracking-widest"
            size="lg"
            disabled={loading || oauthLoading}
          >
            {loading ? t.signingIn : t.signIn}
          </Button>
        </form>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-300 dark:border-zinc-700" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase tracking-widest text-foreground/55">
            <span className="bg-white/95 px-3 dark:bg-zinc-900/90">{t.orContinue}</span>
          </div>
        </div>

        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-zinc-50 py-3 text-sm text-foreground hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-white dark:hover:bg-zinc-800"
          disabled={loading || oauthLoading}
          onClick={() => void signInWithGoogle()}
        >
          <span className="font-semibold text-blue-500 dark:text-blue-400">G</span>{" "}
          {oauthLoading ? (lang === "am" ? "በመመለስ ላይ…" : "Redirecting…") : t.google}
        </button>

        <p className="mt-8 text-center text-sm text-foreground/80 dark:text-zinc-500">
          <button
            type="button"
            onClick={() => setLang("en")}
            className={
              lang === "en"
                ? "text-gold"
                : "text-foreground/70 hover:text-foreground dark:text-zinc-400 dark:hover:text-white"
            }
          >
            English
          </button>
          <span className="mx-2 text-foreground/25 dark:text-zinc-600">|</span>
          <button
            type="button"
            onClick={() => setLang("am")}
            className={
              lang === "am"
                ? "text-gold"
                : "text-foreground/70 hover:text-foreground dark:text-zinc-400 dark:hover:text-white"
            }
          >
            አማርኛ
          </button>
        </p>

        <p className="mt-6 text-center text-xs text-foreground/65 dark:text-zinc-600">
          <Link href="/" className="hover:text-gold">
            {t.backWelcome}
          </Link>
        </p>
      </div>

      <footer className="pointer-events-none absolute bottom-0 left-0 right-0 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200/90 bg-white/80 px-6 py-3 text-[10px] text-foreground/55 dark:border-black/50 dark:bg-black/80 dark:text-zinc-600">
        <span>Version 0.1.0</span>
        <span>
          Powered by <span className="text-gold">Sovereign Standard</span>
        </span>
        <span className="flex gap-4">
          <span>Privacy</span>
          <span>Terms</span>
          <span>Security</span>
        </span>
      </footer>
    </div>
  );
}
