import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BedDouble, Lock, Users } from "lucide-react";
import type { ServiceAccessLevel } from "@/lib/auth/service-access";

export type StaffModuleItem = {
  title: string;
  desc: string;
  href: string;
  locked: boolean;
  badge: string;
  badgeTone: "gold" | "gray" | "orange";
};

type Props = {
  notice: string | null;
  modules: StaffModuleItem[];
};

/**
 * Centered “popup” panel with module cards (staff landing — no hotel admin sidebar).
 */
export function StaffModulePicker({ notice, modules }: Props) {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-4 py-8">
      {notice ? (
        <p className="mb-6 max-w-lg rounded-lg border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-center text-sm text-amber-100">
          {notice}
        </p>
      ) : null}

      <div className="w-full max-w-5xl rounded-2xl border border-border bg-surface-elevated p-6 shadow-2xl ring-1 ring-foreground/5 dark:ring-white/5 lg:p-8">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif] lg:text-2xl">
            Choose a module
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Open the suite you have access to. Contact your hotel admin to change permissions.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {modules.map((m) => {
            const inner = (
              <Card
                className={`h-full ${m.locked ? "opacity-60" : "transition-colors hover:border-gold/40"}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      {m.title === "HRMS" ? (
                        <Users className="h-5 w-5 text-gold" />
                      ) : m.title === "HRRM" ? (
                        <BedDouble className="h-5 w-5 text-gold" />
                      ) : (
                        <Lock className="h-5 w-5 text-zinc-500" />
                      )}
                      {m.title}
                    </CardTitle>
                    <Badge tone={m.badgeTone}>{m.badge}</Badge>
                  </div>
                  <CardDescription className="text-zinc-400">{m.desc}</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="text-sm font-medium text-gold">
                    {m.locked ? "Upgrade to unlock" : "Open module →"}
                  </span>
                </CardContent>
              </Card>
            );
            return m.locked ? (
              <div key={m.title}>{inner}</div>
            ) : (
              <Link key={m.title} href={m.href} className="block">
                {inner}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function badgeToneForAccess(
  access: ServiceAccessLevel,
): "gold" | "gray" | "orange" {
  if (access === "none") return "gray";
  if (access === "view") return "orange";
  return "gold";
}

function badgeLabelForAccess(access: ServiceAccessLevel): string {
  if (access === "none") return "No access";
  if (access === "view") return "View only";
  return "Subscribed";
}

export function buildStaffModuleItems(input: {
  hrmsAccess: ServiceAccessLevel;
  hrrmAccess: ServiceAccessLevel;
}): StaffModuleItem[] {
  const { hrmsAccess, hrrmAccess } = input;
  return [
    {
      title: "HRMS",
      desc: "Employee directory, org structure, scheduling, attendance.",
      href: "/hrms/dashboard",
      locked: hrmsAccess === "none",
      badge: badgeLabelForAccess(hrmsAccess),
      badgeTone: badgeToneForAccess(hrmsAccess),
    },
    {
      title: "HRRM",
      desc: "Reservations, inventory, rates, front desk, housekeeping.",
      href: "/hrrm/dashboard",
      locked: hrrmAccess === "none",
      badge: badgeLabelForAccess(hrrmAccess),
      badgeTone: badgeToneForAccess(hrrmAccess),
    },
    {
      title: "Cross-service analytics",
      desc: "Advanced reporting across HRMS and HRRM.",
      href: "/hotel/reports",
      locked: true,
      badge: "Advanced tier",
      badgeTone: "gray",
    },
  ];
}
