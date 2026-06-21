import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export const metadata: Metadata = {
  title: "پنل والدین | مدرسه بعثت",
};

export default function ParentsDashboardPage() {
  return <DashboardShell panel="parents" />;
}
