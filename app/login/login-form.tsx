"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { dashboardPathForRole } from "@/lib/auth/roles";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
            ? `${raw} Migrations only touch the database — they do not register a password in Auth. Add your project’s service role key to .env.local as SUPABASE_SERVICE_ROLE_KEY, then run: npm run seed:superadmin (from the web folder). Or create the user manually under Supabase → Authentication → Users.`
            : raw,
        );
        setLoading(false);
        return;
      }
      if (!auth.user) {
        setError("Could not sign in.");
        setLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("global_role")
        .eq("id", auth.user.id)
        .maybeSingle();

      if (profileError) {
        await supabase.auth.signOut();
        setError(profileError.message);
        setLoading(false);
        return;
      }

      const actualRole = profile?.global_role ?? null;
      if (!actualRole) {
        await supabase.auth.signOut();
        setError(
          "Your account has no profile yet. Ask an administrator to provision your access.",
        );
        setLoading(false);
        return;
      }

      router.push(dashboardPathForRole(actualRole));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, rgba(15,60,65,0.85) 0%, rgba(8,12,18,0.95) 50%, rgba(10,10,12,1) 100%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h30v30H0z' fill='%23ffffff' fill-opacity='0.02'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900/70 p-8 shadow-2xl backdrop-blur-xl">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-[0.2em] text-gold [font-family:var(--font-outfit),system-ui,sans-serif]">
            ALLQIMEM
          </h1>
          <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.35em] text-zinc-300">
            Unified sign-in
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-500">
          Enter your credentials — you&apos;ll be redirected to the right workspace from your
          profile.
        </p>

        <form className="mt-8 space-y-5" onSubmit={onSubmit}>
          {error ? (
            <div
              className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-center text-sm text-red-200"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          <div>
            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-zinc-300">
              Email
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
            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-zinc-300">
              Password
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                aria-label={show ? "Hide password" : "Show password"}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <label className="flex cursor-pointer items-center gap-2 text-zinc-400">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-zinc-600 bg-zinc-800"
              />
              Remember me
            </label>
            <button type="button" className="text-gold hover:underline">
              Forgot password?
            </button>
          </div>

          <Button
            type="submit"
            className="w-full uppercase tracking-widest"
            size="lg"
            disabled={loading}
          >
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-700" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase tracking-widest text-zinc-500">
            <span className="bg-zinc-900/90 px-3">Or continue with</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/80 py-3 text-sm text-white hover:bg-zinc-800"
            onClick={() => setError("Connect Google in Supabase Auth → Providers, then wire OAuth.")}
          >
            <span className="font-semibold text-blue-400">G</span> Google
          </button>
          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/80 py-3 text-sm text-white hover:bg-zinc-800"
            onClick={() =>
              setError("Connect Microsoft in Supabase Auth → Providers, then wire OAuth.")
            }
          >
            <span className="text-xs font-bold text-orange-400">■</span> Microsoft
          </button>
        </div>

        <p className="mt-8 text-center text-sm text-zinc-500">
          <button
            type="button"
            onClick={() => setLang("en")}
            className={lang === "en" ? "text-gold" : "text-zinc-400 hover:text-white"}
          >
            English
          </button>
          <span className="mx-2 text-zinc-600">|</span>
          <button
            type="button"
            onClick={() => setLang("ar")}
            className={lang === "ar" ? "text-gold" : "text-zinc-400 hover:text-white"}
          >
            العربية
          </button>
        </p>

        <p className="mt-6 text-center text-xs text-zinc-600">
          <Link href="/" className="hover:text-gold">
            ← Back to welcome
          </Link>
        </p>
      </div>

      <footer className="pointer-events-none absolute bottom-0 left-0 right-0 flex flex-wrap items-center justify-between gap-2 border-t border-black/50 bg-black/80 px-6 py-3 text-[10px] text-zinc-600">
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
