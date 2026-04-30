import {
  LayoutDashboard,
  Building2,
  UserCog,
  CreditCard,
  Wallet,
  BarChart3,
  ClipboardList,
} from "lucide-react";

/** Superadmin portal — matches Superadmin shell (Overview … Reports; Settings/Support in footer). */
export const superadminNav = [
  { href: "/superadmin/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/superadmin/tenants", label: "Tenants", icon: Building2 },
  { href: "/superadmin/admins", label: "Admins", icon: UserCog },
  { href: "/superadmin/hotel-admin-requests", label: "Admin requests", icon: ClipboardList },
  { href: "/superadmin/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/superadmin/billing", label: "Billing", icon: Wallet },
  { href: "/superadmin/reports", label: "Reports", icon: BarChart3 },
] as const;
