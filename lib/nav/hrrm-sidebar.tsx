import {
  LayoutDashboard,
  Boxes,
  BadgeDollarSign,
  CalendarRange,
  Grid3X3,
  ClipboardList,
  Sparkles,
  BrushCleaning,
} from "lucide-react";

export const hrrmSidebarNav = [
  { href: "/hrrm/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/hrrm/inventory", label: "Inventory", icon: Boxes },
  { href: "/hrrm/rates", label: "Rates & Pricing", icon: BadgeDollarSign },
  { href: "/hrrm/reservations", label: "Reservations", icon: CalendarRange },
  { href: "/hrrm/availability", label: "Availability", icon: Grid3X3 },
  { href: "/hrrm/front-desk", label: "Front Desk", icon: ClipboardList },
  { href: "/hrrm/concierge", label: "Concierge", icon: Sparkles },
  { href: "/hrrm/housekeeping", label: "Housekeeping", icon: BrushCleaning },
] as const;
