import { SuperadminShell } from "@/components/layout/superadmin-shell";

export default function SuperadminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SuperadminShell>{children}</SuperadminShell>;
}
