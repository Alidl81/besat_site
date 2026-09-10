import type { ReactNode } from "react";
import { DashboardGuard } from "@/components/auth/dashboard-guard";

// Every page under this segment is a redirect stub pointing to its real
// destination under /dashboard/content-manager (see each page.tsx) --
// "content-manager" is also the segment unit_manager is actually allowed
// into (rolesForDashboardSegment, auth-session.ts). Guarding with "admin"
// here meant the guard itself rejected unit_manager, sending them to the
// generic /dashboard/content-manager overview before any individual
// page's own more specific redirect target ever got a chance to run.
export default function DashboardSegmentLayout({ children }: { children: ReactNode }) {
  return <DashboardGuard segment="content-manager">{children}</DashboardGuard>;
}
