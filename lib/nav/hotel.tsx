import {
  LayoutDashboard,
  UserCircle2,
  FileBarChart,
  Settings,
} from "lucide-react";

/** HRMS / HRRM are opened from module cards on `/hotel/dashboard`, not the sidebar. */
export const hotelNav = [
  { href: "/hotel/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/hotel/users", label: "Users", icon: UserCircle2 },
  { href: "/hotel/reports", label: "Reports", icon: FileBarChart },
  { href: "/hotel/settings", label: "Settings", icon: Settings },
] as const;
