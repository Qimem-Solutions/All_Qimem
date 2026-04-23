"use client";

import { useEffect, useMemo, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { HrrmShell } from "@/components/layout/hrrm-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  pathAllowedForEffective,
  getDefaultRedirectFor,
  filterHrrmNavByEffective,
  toHrrmShellItems,
} from "@/lib/auth/hrrm-nav";
import type { HrrmEffective, HrrmScope } from "@/lib/auth/hrrm-nav";
import { setHrrmWorkstationModeAction } from "@/lib/actions/hrrm-station";

function HrrmRouteGuard({ effective, children }: { effective: HrrmEffective; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (!pathAllowedForEffective(pathname, effective)) {
      router.replace(getDefaultRedirectFor(effective));
    }
  }, [pathname, effective, router]);
  return <>{children}</>;
}

function StationWorkstationPicker({
  effective,
  orgScope,
  canSwitch,
}: {
  effective: HrrmEffective;
  orgScope: HrrmScope;
  canSwitch: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function setMode(mode: "all" | "front_desk" | "inventory") {
    start(() => {
      void (async () => {
        const r = await setHrrmWorkstationModeAction(mode);
        if (r.ok) router.refresh();
      })();
    });
  }

  if (!canSwitch) {
    return (
      <div className="rounded-lg bg-foreground/5 px-2 py-2 text-[10px] text-sidebar-muted">
        <p className="font-semibold uppercase tracking-wider text-foreground/80">Workstation</p>
        <p className="mt-0.5 text-foreground/90">
          {orgScope === "front_desk" ? "Front desk" : "Inventory management"}
        </p>
        <p className="text-[9px] text-muted-foreground/90">Assigned by your hotel admin.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="px-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted">Staffs</p>
      <p className="px-1 text-[9px] leading-snug text-muted-foreground/90">Choose a station to show only that area in the app.</p>
      <div className="grid grid-cols-1 gap-1">
        {(
          [
            { mode: "all" as const, label: "All areas" },
            { mode: "front_desk" as const, label: "Front desk" },
            { mode: "inventory" as const, label: "Inventory mgmt" },
          ] as const
        ).map(({ mode, label }) => (
          <Button
            key={mode}
            type="button"
            size="sm"
            disabled={pending}
            variant="secondary"
            className={cn(
              "h-8 w-full justify-center text-xs font-medium",
              effective === mode && "border border-gold/50 bg-gold/10 text-gold",
            )}
            onClick={() => setMode(mode)}
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function HrrmAppChrome({
  children,
  readOnly,
  orgScope,
  effective,
  canSwitch,
  brand = { title: "All Qimem HRRM", subtitle: "Operational Suite" },
}: {
  children: ReactNode;
  readOnly?: boolean;
  orgScope: HrrmScope;
  effective: HrrmEffective;
  canSwitch: boolean;
  brand?: { title: string; subtitle?: string };
}) {
  const activePath = usePathname();
  const navItems = useMemo(
    () => toHrrmShellItems(filterHrrmNavByEffective(effective)),
    [effective],
  );
  return (
    <HrrmRouteGuard effective={effective}>
      <HrrmShell
        brand={brand}
        activePath={activePath}
        sidebarItems={navItems}
        readOnly={readOnly}
        stationControls={
          <StationWorkstationPicker effective={effective} orgScope={orgScope} canSwitch={canSwitch} />
        }
      >
        {children}
      </HrrmShell>
    </HrrmRouteGuard>
  );
}
