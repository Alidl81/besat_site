import type { ReactNode } from "react";

// Every /unit-manager/* page is a redirect-only shim to
// /dashboard/content-manager/* -- nothing here should be statically generated.
export const dynamic = "force-dynamic";

export default function UnitManagerRedirectLayout({ children }: { children: ReactNode }) {
  return children;
}
