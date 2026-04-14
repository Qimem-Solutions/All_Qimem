import {
  LayoutDashboard,
  Users,
  CalendarClock,
  FileBarChart,
  Umbrella,
  Briefcase,
  Coins,
} from "lucide-react";

export const hrmsNav = [
  { href: "/hrms/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/hrms/employees", label: "Employee Directory", icon: Users },
  { href: "/hrms/time", label: "Time & attendance", icon: CalendarClock },
  { href: "/hrms/leave", label: "Leave & Absence", icon: Umbrella },
  { href: "/hrms/recruitment", label: "Recruitment", icon: Briefcase },
  { href: "/hrms/payroll", label: "Payroll", icon: Coins },
  { href: "/hrms/reports", label: "HR Reports", icon: FileBarChart },
] as const;
