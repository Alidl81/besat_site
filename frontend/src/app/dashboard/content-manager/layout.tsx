import type { ReactNode } from "react";
import { DashboardGuard } from "@/components/auth/dashboard-guard";

export default function ContentManagerLayout({ children }: { children: ReactNode }) {
  return <DashboardGuard segment="content-manager">{children}</DashboardGuard>;
}
