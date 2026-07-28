import type { Metadata } from "next";
import { dashboardPages } from "@/components/dashboard/dashboard-data";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export const metadata: Metadata = { title: "کادر آموزشی | مدرسه بعثت" };

export default function Page() {
  return <DashboardShell panel="admin" data={dashboardPages.admin} activeKey="staff" />;
}
