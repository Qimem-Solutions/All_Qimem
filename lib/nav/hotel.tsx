import {
  Building2,
  LayoutGrid,
  UserCircle2,
  FileBarChart,
  CreditCard,
  Settings,
} from "lucide-react";

/**
 * Portfolio = property story + cover ( `/hotel/dashboard` ).
 * Modules = HRMS / HRRM / reporting cards ( `/hotel/modules` ).
 */
export const hotelNav = [
  { href: "/hotel/dashboard", label: "Portfolio", icon: Building2 },
  { href: "/hotel/modules", label: "Modules", icon: LayoutGrid },
  { href: "/hotel/users", label: "Users", icon: UserCircle2 },
  { href: "/hotel/reports", label: "Reports", icon: FileBarChart },
  { href: "/hotel/subscription", label: "Subscription", icon: CreditCard },
  { href: "/hotel/settings", label: "Settings", icon: Settings },
] as const;
