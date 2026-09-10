import { redirect } from "next/navigation";

// Same situation as students/page.tsx -- no staff management screen
// exists anywhere in the dashboard yet, for any role. Redirecting to the
// content-manager overview (a real, reachable destination) instead of
// /dashboard/admin (a shell unit_manager isn't allowed into).
export default function Page() {
  redirect("/dashboard/content-manager");
}
