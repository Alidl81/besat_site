import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export const metadata: Metadata = {
  title: "پنل همکار رسانه | مدرسه بعثت",
};

export default function MediaDashboardPage() {
  return <DashboardShell panel="media" />;
}
