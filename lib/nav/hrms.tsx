import {
  LayoutDashboard,
  Users,
  Network,
  CalendarClock,
  Clock,
  FileBarChart,
} from "lucide-react";

export const hrmsNav = [
  { href: "/hrms/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/hrms/employees", label: "Employee Directory", icon: Users },
  { href: "/hrms/org-structure", label: "Org Structure", icon: Network },
  { href: "/hrms/scheduling", label: "Scheduling", icon: CalendarClock },
  { href: "/hrms/attendance", label: "Time & Attendance", icon: Clock },
  { href: "/hrms/reports", label: "HR Reports", icon: FileBarChart },
] as const;
