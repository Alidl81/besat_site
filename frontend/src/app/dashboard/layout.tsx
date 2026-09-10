import type { ReactNode } from "react";

// Every /dashboard/* route is a per-user, authenticated panel view (GM,
// content manager, unit manager, parent) -- none of it should ever be
// statically generated at build time and served as one shared HTML page.
export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return children;
}
