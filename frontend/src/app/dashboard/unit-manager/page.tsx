import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export const metadata: Metadata = {
  title: "پنل مدیر واحد | مدرسه بعثت",
};

export default function UnitManagerDashboardPage() {
  return <DashboardShell panel="unitManager" />;
}
