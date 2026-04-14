import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "gold" | "green" | "red" | "gray" | "orange";
};

export function Badge({ className, tone = "gray", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        tone === "gold" && "bg-gold/15 text-gold",
        tone === "green" && "bg-emerald-500/15 text-emerald-400",
        tone === "red" && "bg-red-500/15 text-red-400",
        tone === "orange" && "bg-amber-500/15 text-amber-400",
        tone === "gray" && "bg-zinc-700/50 text-zinc-300",
        className,
      )}
      {...props}
    />
  );
}
