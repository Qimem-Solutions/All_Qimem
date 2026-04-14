/** Maps `profiles.global_role` to the default dashboard after sign-in. */
export function dashboardPathForRole(role: string | null | undefined): string {
  switch (role) {
    case "superadmin":
      return "/superadmin/dashboard";
    case "hotel_admin":
      return "/hotel/dashboard";
    case "hrrm":
      return "/hrrm/dashboard";
    case "hrms":
      return "/hrms/dashboard";
    case "user":
    default:
      return "/hotel/dashboard";
  }
}
