import type { Metadata } from "next";
import { ContentManagerPage } from "@/components/dashboard/content-manager-page";

export const metadata: Metadata = { title: "مدیریت محتوا | مدرسه بعثت" };

export default function Page() {
  return <ContentManagerPage activeKey="overview" />;
}
