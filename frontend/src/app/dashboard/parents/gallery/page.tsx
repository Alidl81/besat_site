import { dashboardPages } from "@/components/dashboard/dashboard-data";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "پنل والدین | مدرسه بعثت",
};

export default function Page() {
  return <DashboardShell panel="parents" data={dashboardPages.parents} activeKey="gallery" />;
}
