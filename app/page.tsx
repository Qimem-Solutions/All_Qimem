import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function WelcomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-stone-50 text-foreground dark:bg-[#050506] dark:text-zinc-100">
      <div
        className="pointer-events-none absolute -left-32 top-0 h-[520px] w-[520px] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(232,197,71,0.2) 0%, transparent 65%)",
        }}
      />
      <div
        className="pointer-events-none absolute bottom-0 right-0 h-[420px] w-[480px] rounded-full blur-3xl dark:opacity-100"
        style={{
          background:
            "radial-gradient(circle, rgba(30,90,95,0.18) 0%, transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.5] dark:opacity-[0.35]"
        style={{
          backgroundImage: `linear-gradient(var(--welcome-grid) 1px, transparent 1px), linear-gradient(90deg, var(--welcome-grid) 1px, transparent 1px)`,
          backgroundSize: "64px 64px",
        }}
      />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-8">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-gold/30 bg-gold/10">
            <Sparkles className="h-5 w-5 text-gold" aria-hidden />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-gold">
              All Qimem
            </p>
            <p className="text-xs text-foreground/75 dark:text-zinc-500">Luxury hospitality management</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle size="sm" />
          <Link
            href="/login"
            className="text-sm font-medium text-foreground transition-colors hover:text-gold dark:text-zinc-400"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-6 pb-24 pt-10 text-center sm:pt-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-gold/90">
          Sovereign operations suite
        </p>
        <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight text-foreground [font-family:var(--font-outfit),system-ui,sans-serif] dark:text-white sm:text-5xl md:text-6xl">
          Welcome to a single canvas for your property
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-foreground/85 dark:text-zinc-400 sm:text-lg">
          Orchestrate reservations, rooms, rates, and your people from one secure platform.
          After you sign in, you&apos;ll land in the workspace tied to your account.
        </p>

        <div className="mt-12 flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
          <Link
            href="/login"
            className="group inline-flex items-center gap-3 rounded-xl bg-gold px-8 py-4 text-base font-semibold text-gold-foreground shadow-lg shadow-gold/10 transition-all hover:bg-gold-dim hover:shadow-gold/20"
          >
            Sign in to the platform
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <p className="max-w-xs text-left text-xs leading-relaxed text-foreground/70 dark:text-zinc-500 sm:max-w-sm">
            Use the email and password you were given. Routing is based on your profile in
            the system.
          </p>
        </div>

        <div className="mt-20 grid w-full max-w-3xl gap-4 border-t border-zinc-200 pt-12 dark:border-white/5 sm:grid-cols-2">
          {[
            ["Multi-tenant platform", "Isolate each property with tenant-scoped data and entitlements."],
            ["HRRM & HRMS", "Reservations and people workflows, gated by subscription tier."],
          ].map(([title, body]) => (
            <div
              key={title}
              className="rounded-xl border border-zinc-200 bg-white/80 p-5 text-left shadow-sm dark:border-white/5 dark:bg-white/[0.02] dark:shadow-none"
            >
              <p className="text-sm font-semibold text-foreground dark:text-zinc-200">{title}</p>
              <p className="mt-2 text-sm leading-relaxed text-foreground/80 dark:text-zinc-500">{body}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="relative z-10 border-t border-zinc-200 bg-white/60 px-6 py-6 text-center text-[11px] text-zinc-500 dark:border-white/5 dark:bg-black/40 dark:text-zinc-600">
        <span className="text-zinc-600 dark:text-zinc-500">Powered by </span>
        <span className="text-gold/90">Sovereign Standard</span>
        <span className="mx-3 text-zinc-300 dark:text-zinc-700">·</span>
        <span>Privacy</span>
        <span className="mx-3 text-zinc-300 dark:text-zinc-700">·</span>
        <span>Terms</span>
        <span className="mx-3 text-zinc-300 dark:text-zinc-700">·</span>
        <span>Security</span>
      </footer>
    </div>
  );
}
