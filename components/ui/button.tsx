import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" &&
          "bg-gold text-gold-foreground hover:bg-gold-dim",
        variant === "secondary" &&
          "bg-surface-elevated text-foreground border border-border hover:bg-zinc-800",
        variant === "ghost" && "bg-transparent text-muted hover:text-foreground hover:bg-white/5",
        variant === "outline" &&
          "border border-gold bg-transparent text-gold hover:bg-gold/10",
        size === "sm" && "h-8 px-3 text-xs",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-12 px-6 text-base",
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
