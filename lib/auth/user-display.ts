/**
 * Human-readable labels for shell sidebars (logged-in user chip).
 */
export function displayNameFromProfile(fullName: string | null, email: string | null): string {
  const n = fullName?.trim();
  if (n) return n;
  const local = email?.split("@")[0]?.trim();
  if (local) return local;
  return "User";
}

export function globalRoleLabel(role: string | null): string {
  const r = (role ?? "").toLowerCase();
  switch (r) {
    case "superadmin":
      return "Platform superadmin";
    case "hotel_admin":
      return "Hotel administrator";
    case "hrms":
      return "HR manager";
    case "hrrm":
      return "Rooms & guest ops";
    case "user":
      return "Team member";
    default:
      return r ? r.charAt(0).toUpperCase() + r.slice(1).replace(/_/g, " ") : "Member";
  }
}
