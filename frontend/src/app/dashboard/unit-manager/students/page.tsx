import { redirect } from "next/navigation";

// There is no student-roster management screen anywhere in the dashboard
// yet, for any role -- it's not just missing for unit_manager, it isn't
// in dashboard-data.ts's admin menu either. Redirecting to /dashboard/admin
// (a shell unit_manager isn't even allowed into) was a dead end; the
// overview is at least a real, reachable destination until this feature
// exists. Building actual student-roster management is out of scope for
// this fix (new UI, and needs a source-current check for backend support).
export default function Page() {
  redirect("/dashboard/content-manager");
}
