import type { Metadata } from "next";
import { dashboardPages } from "@/components/dashboard/dashboard-data";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export const metadata: Metadata = {
  title: "مدیا | مدرسه بعثت",
};

export default function DashboardPage() {
  return <DashboardShell panel="media" data={dashboardPages.media} activeKey="media" />;
}