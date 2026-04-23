import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BedDouble, Lock, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ServiceAccessLevel } from "@/lib/auth/service-access";

const modules = (opts: {
  hrmsAccess: ServiceAccessLevel;
  hrrmAccess: ServiceAccessLevel;
  isAdvanced: boolean;
}) =>
  [
    {
      title: "HRMS",
      desc: "Employee directory, org structure, scheduling, attendance.",
      href: "/hrms/dashboard",
      locked: opts.hrmsAccess === "none",
      badge:
        opts.hrmsAccess === "none"
          ? "No access"
          : opts.hrmsAccess === "view"
            ? "View only"
            : "Subscribed",
    },
    {
      title: "HRRM",
      desc: "Reservations, inventory, rates, front desk, housekeeping.",
      href: "/hrrm/dashboard",
      locked: opts.hrrmAccess === "none",
      badge:
        opts.hrrmAccess === "none"
          ? "No access"
          : opts.hrrmAccess === "view"
            ? "View only"
            : "Subscribed",
    },
    {
      title: "Cross-service analytics",
      desc: "Advanced reporting across HRMS and HRRM.",
      href: "/hotel/reports",
      locked: !opts.isAdvanced,
      badge: opts.isAdvanced ? "Advanced tier" : "Advanced tier",
    },
  ] as const;

type Props = {
  hrmsAccess: ServiceAccessLevel;
  hrrmAccess: ServiceAccessLevel;
  isAdvanced: boolean;
};

export function HotelAdminModuleCards({ hrmsAccess, hrrmAccess, isAdvanced }: Props) {
  const list = modules({ hrmsAccess, hrrmAccess, isAdvanced });
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {list.map((m) => {
        const inner = (
          <Card
            className={cn(
              "h-full",
              m.locked ? "opacity-60" : "transition-colors hover:border-gold/40",
            )}
          >
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="flex items-center gap-2">
                  {m.title === "HRMS" ? (
                    <Users className="h-5 w-5 text-gold" />
                  ) : m.title === "HRRM" ? (
                    <BedDouble className="h-5 w-5 text-gold" />
                  ) : (
                    <Lock className="h-5 w-5 text-zinc-500" />
                  )}
                  {m.title}
                </CardTitle>
                <Badge tone={m.locked ? "gray" : "gold"}>{m.badge}</Badge>
              </div>
              <CardDescription>{m.desc}</CardDescription>
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
          <Link key={m.title} href={m.href}>
            {inner}
          </Link>
        );
      })}
    </div>
  );
}
