import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { PageMotion } from "@/components/layout/page-motion";
import type { ReactNode } from "react";

type PublicPageLayoutProps = {
  children: ReactNode;
};

export function PublicPageLayout({ children }: PublicPageLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <SiteHeader />
      <PageMotion>{children}</PageMotion>
      <SiteFooter />
    </div>
  );
}
