"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { requestHotelPlanChangeAction } from "@/lib/actions/hotel-subscription";
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
  /** When true, a request is already pending on the server — form is read-only and button shows "Requested". */
  hasPendingRequest: boolean;
  /** Requested plan from the pending row (keeps the radio selection aligned). */
  requestedPlanForPending?: string | null;
};

export function HotelSubscriptionForm({
  initialPlan,
  hasPendingRequest,
  requestedPlanForPending,
}: Props) {
  const router = useRouter();
  const [plan, setPlan] = useState(() => {
    if (
      hasPendingRequest &&
      requestedPlanForPending &&
      OPTIONS.some((o) => o.value === requestedPlanForPending)
    ) {
      return requestedPlanForPending;
    }
    return OPTIONS.some((o) => o.value === initialPlan) ? initialPlan : "basic";
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  /** True immediately after a successful submit until the page refreshes with server pending state. */
  const [submittedLock, setSubmittedLock] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (hasPendingRequest) {
      return;
    }
    setError(null);
    setDone(false);
    setLoading(true);
    const r = await requestHotelPlanChangeAction({
      plan,
      message: message.trim() || undefined,
    });
    setLoading(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setDone(true);
    setSubmittedLock(true);
    setMessage("");
    router.refresh();
  }

  const isLocked = hasPendingRequest || submittedLock;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <p className="text-sm text-muted">
        {isLocked
          ? "You already have a plan change request waiting for a superadmin. You can’t send another until it’s approved or declined."
          : "Your choice is sent to the platform team for review. The plan on your account does not change until a superadmin approves the request."}
      </p>
      <fieldset className="space-y-3" disabled={isLocked}>
        <legend className="sr-only">Requested plan</legend>
        {OPTIONS.map((o) => (
          <label
            key={o.value}
            className={cn(
              "flex gap-3 rounded-xl border p-4 transition-colors",
              isLocked ? "cursor-not-allowed opacity-75" : "cursor-pointer",
              plan === o.value
                ? "border-gold bg-gold/5 ring-1 ring-gold/40"
                : cn("border-border bg-surface", !isLocked && "hover:border-foreground/15"),
            )}
          >
            <input
              type="radio"
              name="plan"
              value={o.value}
              checked={plan === o.value}
              onChange={() => setPlan(o.value)}
              className="mt-1 h-4 w-4 shrink-0 border-border text-gold focus:ring-gold disabled:cursor-not-allowed"
            />
            <span>
              <span className="font-medium text-foreground">{o.label}</span>
              <span className="mt-1 block text-sm text-muted">{o.blurb}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div>
        <label className="mb-2 block text-xs font-medium text-muted" htmlFor="plan-request-msg">
          Note to platform admin (optional)
        </label>
        <textarea
          id="plan-request-msg"
          name="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={isLocked}
          rows={3}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60 disabled:cursor-not-allowed disabled:opacity-60"
          placeholder="e.g. contract signed for Pro, effective next billing cycle"
        />
      </div>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      {done && !isLocked ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400" role="status">
          Request sent. You’ll see it as pending until a superadmin approves or declines.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={loading || isLocked} variant={isLocked ? "secondary" : "primary"}>
          {isLocked ? "Requested" : loading ? "Sending…" : "Request plan change"}
        </Button>
      </div>
    </form>
  );
}
