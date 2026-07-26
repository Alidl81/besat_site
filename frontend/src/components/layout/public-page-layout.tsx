import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { PageMotion } from "@/components/layout/page-motion";
import type { ReactNode } from "react";

type PublicPageLayoutProps = {
  children: ReactNode;
};

export function PublicPageLayout({ children }: PublicPageLayoutProps) {
  return (
    <>
      <SiteHeader />
      <PageMotion>{children}</PageMotion>
      <SiteFooter />
    </>
  );
}
