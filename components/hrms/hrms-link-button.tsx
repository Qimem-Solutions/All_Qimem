import Link from "next/link";
import { cn } from "@/lib/utils";

type Props = {
  href: string;
  variant?: "primary" | "secondary" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  className?: string;
  children: React.ReactNode;
};

/** Next.js `<Link>` styled like `Button` — use for navigable HRMS actions (no dead `disabled` buttons). */
export function HrmsLinkButton({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
}: Props) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
        variant === "primary" && "bg-gold text-gold-foreground hover:bg-gold-dim",
        variant === "secondary" &&
          "bg-surface-elevated text-foreground border border-border hover:bg-zinc-800",
        variant === "ghost" && "bg-transparent text-muted hover:bg-white/5 hover:text-foreground",
        variant === "outline" && "border border-gold bg-transparent text-gold hover:bg-gold/10",
        size === "sm" && "h-8 px-3 text-xs",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-12 px-6 text-base",
        className,
      )}
    >
      {children}
    </Link>
  );
}
