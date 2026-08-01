import type { ReactNode } from "react";
import { DashboardGuard } from "@/components/auth/dashboard-guard";

export default function DashboardSegmentLayout({ children }: { children: ReactNode }) {
  return <DashboardGuard segment="parents">{children}</DashboardGuard>;
}
