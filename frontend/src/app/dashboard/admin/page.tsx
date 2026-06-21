import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export const metadata: Metadata = {
  title: "پنل مدیر کل | مدرسه بعثت",
};

export default function AdminDashboardPage() {
  return <DashboardShell panel="admin" />;
}
