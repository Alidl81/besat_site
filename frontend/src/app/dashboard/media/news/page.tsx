import type { Metadata } from "next";
import { dashboardPages } from "@/components/dashboard/dashboard-data";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export const metadata: Metadata = {
  title: "خبرها | مدرسه بعثت",
};

export default function DashboardPage() {
  return <DashboardShell data={dashboardPages.media} activeKey="news" />;
}
