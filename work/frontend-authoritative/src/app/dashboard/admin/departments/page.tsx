import { dashboardPages } from "@/components/dashboard/dashboard-data";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "پنل مدیریت | مدرسه بعثت",
};

export default function Page() {
  return <DashboardShell panel="admin" data={dashboardPages.admin} activeKey="departments" />;
}
