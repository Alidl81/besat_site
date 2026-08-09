import { dashboardPages } from "@/components/dashboard/dashboard-data";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export function ContentManagerPage({ activeKey }: { activeKey: string }) {
  return (
    <DashboardShell
      panel="contentManager"
      data={dashboardPages.contentManager}
      activeKey={activeKey}
    />
  );
}
