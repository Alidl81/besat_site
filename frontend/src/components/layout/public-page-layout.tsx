import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import type { ReactNode } from "react";

type PublicPageLayoutProps = {
  children: ReactNode;
};

export function PublicPageLayout({ children }: PublicPageLayoutProps) {
  return (
    <>
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
