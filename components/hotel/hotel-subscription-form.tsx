"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { updateHotelSubscriptionPlanAction } from "@/lib/actions/hotel-subscription";
import { cn } from "@/lib/utils";

const OPTIONS: { value: string; label: string; blurb: string }[] = [
  {
    value: "basic",
    label: "Basic",
    blurb: "HRRM core and HRMS directory — good for a single property getting started.",
  },
  {
    value: "pro",
    label: "Pro",
    blurb: "Adds advanced rates, scheduling, and attendance workflows.",
  },
  {
    value: "advanced",
    label: "Advanced",
    blurb: "Cross-service reporting and full API — for multi-site or integrated ops.",
  },
];

type Props = {
  initialPlan: string;
};

export function HotelSubscriptionForm({ initialPlan }: Props) {
  const router = useRouter();
  const [plan, setPlan] = useState(
    OPTIONS.some((o) => o.value === initialPlan) ? initialPlan : "basic",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    setLoading(true);
    const r = await updateHotelSubscriptionPlanAction({ plan });
    setLoading(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setDone(true);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <fieldset className="space-y-3">
        <legend className="sr-only">Choose a plan</legend>
        {OPTIONS.map((o) => (
          <label
            key={o.value}
            className={cn(
              "flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors",
              plan === o.value
                ? "border-gold bg-gold/5 ring-1 ring-gold/40"
                : "border-border bg-surface hover:border-foreground/15",
            )}
          >
            <input
              type="radio"
              name="plan"
              value={o.value}
              checked={plan === o.value}
              onChange={() => setPlan(o.value)}
              className="mt-1 h-4 w-4 shrink-0 border-border text-gold focus:ring-gold"
            />
            <span>
              <span className="font-medium text-foreground">{o.label}</span>
              <span className="mt-1 block text-sm text-muted">{o.blurb}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      {done ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">Plan updated.</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving…" : "Save plan"}
        </Button>
      </div>
    </form>
  );
}
