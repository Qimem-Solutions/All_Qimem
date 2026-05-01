import { HeaderProfileMenu } from "@/components/layout/header-profile-menu";
import { ThemeToggle } from "@/components/theme-toggle";

type Props = {
  children: React.ReactNode;
  /** Hotel display name (sidebar/header branding). */
  tenantName: string;
  logoUrl: string | null;
};

/**
 * Minimal shell for tenant staff (non–hotel-admin): no sidebar, only header + module picker pages.
 */
export function StaffModuleShell({ children, tenantName, logoUrl }: Props) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border bg-sidebar px-6">
        <div className="flex min-w-0 items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="h-9 w-auto max-w-[140px] shrink-0 object-contain object-left"
            />
          ) : null}
          <span className="truncate text-sm font-semibold tracking-wide text-gold [font-family:var(--font-outfit),system-ui,sans-serif]">
            {tenantName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle size="sm" />
          <HeaderProfileMenu />
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
