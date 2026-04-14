import { redirect } from "next/navigation";

/** Org structure lives on the HRMS dashboard; keep this route for bookmarks. */
export default function OrgStructurePage() {
  redirect("/hrms/dashboard");
}
