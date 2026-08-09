import type { Metadata } from "next";
import { dashboardPages } from "@/components/dashboard/dashboard-data";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export const metadata: Metadata = { title: "ثبت‌نام | مدرسه بعثت" };

export default function Page() {
  return <DashboardShell panel="parents" data={dashboardPages.parents} activeKey="registration" />;
}
