import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export const dynamic = "force-static";

export default function WelcomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-stone-50 text-foreground dark:bg-[#050506] dark:text-zinc-100">
      <div
        className="welcome-glow-left pointer-events-none absolute -left-32 top-0 h-[520px] w-[520px] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(232,197,71,0.2) 0%, transparent 65%)",
        }}
      />
      <div
        className="welcome-glow-right pointer-events-none absolute bottom-0 right-0 h-[420px] w-[480px] rounded-full blur-3xl dark:opacity-100"
        style={{
          background:
            "radial-gradient(circle, rgba(30,90,95,0.18) 0%, transparent 70%)",
        }}
      />
      <div
        className="welcome-grid-motion pointer-events-none absolute inset-0 opacity-[0.5] dark:opacity-[0.35]"
        style={{
          backgroundImage: `linear-gradient(var(--welcome-grid) 1px, transparent 1px), linear-gradient(90deg, var(--welcome-grid) 1px, transparent 1px)`,
          backgroundSize: "64px 64px",
        }}
      />

      <header className="welcome-animate-fade-up relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-8">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-gold/30 bg-gold/10 transition-transform duration-300 hover:scale-105">
            <Sparkles className="h-5 w-5 text-gold" aria-hidden />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-gold">
              All Qimem
            </p>
            <p className="text-xs text-foreground/75 dark:text-zinc-500">
              Luxury hotel management, simplified and digital
            </p>
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
        <p className="welcome-animate-fade-up welcome-delay-1 text-[11px] font-semibold uppercase tracking-[0.4em] text-gold/90">
          All Qimem luxury hotel management
        </p>
        <h1 className="welcome-animate-fade-up welcome-delay-2 mt-6 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight text-foreground [font-family:var(--font-outfit),system-ui,sans-serif] dark:text-white sm:text-5xl md:text-6xl">
          Make every hotel simpler to run and fully digital end to end
        </h1>
        <p className="welcome-animate-fade-up welcome-delay-3 mx-auto mt-6 max-w-2xl text-base leading-relaxed text-foreground/85 dark:text-zinc-400 sm:text-lg">
          All Qimem unifies reservations, rooms, rates, and your teams in one secure platform so
          management stays straightforward. Digitize workflows everywhere—from the front desk to the
          back office—and sign in to reach the workspace matched to your role and property.
        </p>

        <div className="welcome-animate-fade-up welcome-delay-4 mt-12 flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
          <Link
            href="/login"
            className="group inline-flex items-center gap-3 rounded-xl bg-gold px-8 py-4 text-base font-semibold text-gold-foreground shadow-lg shadow-gold/10 transition-all duration-300 hover:scale-[1.03] hover:bg-gold-dim hover:shadow-xl hover:shadow-gold/25 active:scale-[0.98]"
          >
            Sign in to the platform
            <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
          <p className="max-w-xs text-left text-xs leading-relaxed text-foreground/70 dark:text-zinc-500 sm:max-w-sm">
            Sign in with your credentials; you&apos;ll be routed to the right digital workspace for your
            hotel or platform role.
          </p>
        </div>

        <div className="mt-20 grid w-full max-w-3xl gap-4 border-t border-zinc-200 pt-12 dark:border-white/5 sm:grid-cols-2">
          {[
            [
              "Simple management, every property",
              "Each hotel stays organized in its own space—with clear data, roles, and controls so operations never feel scattered.",
            ],
            [
              "Digital everywhere",
              "Cloud-native tools for rooms, rates, guests, and staff: fewer manual steps, more consistency across every shift and department.",
            ],
          ].map(([title, body], i) => (
            <div
              key={title}
              className={`welcome-animate-fade-up rounded-xl border border-zinc-200 bg-white/80 p-5 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-gold/25 hover:shadow-md dark:border-white/5 dark:bg-white/[0.02] dark:shadow-none dark:hover:border-gold/20 ${i === 0 ? "welcome-delay-5" : "welcome-delay-6"}`}
            >
              <p className="text-sm font-semibold text-foreground dark:text-zinc-200">{title}</p>
              <p className="mt-2 text-sm leading-relaxed text-foreground/80 dark:text-zinc-500">
                {body}
              </p>
            </div>
          ))}
        </div>
      </main>

      <footer className="welcome-animate-fade-in welcome-delay-7 relative z-10 border-t border-zinc-200 bg-white/60 px-6 py-6 text-center text-[11px] text-zinc-500 dark:border-white/5 dark:bg-black/40 dark:text-zinc-600">
        <span className="text-zinc-600 dark:text-zinc-500">Powered by </span>
        <span className="text-gold/90">All Qimem</span>
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
