import type { Metadata } from "next";
import { panelData } from "@/components/dashboard/panel-data";
import { PanelShell } from "@/components/dashboard/panel-shell";

export const metadata: Metadata = {
  title: "درخواست‌ها | مدرسه بعثت",
};

export default function PanelPage() {
  return <PanelShell data={panelData.unitManager} activeKey="requests" />;
}
