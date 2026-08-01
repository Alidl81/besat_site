"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function PageMotion({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="besat-page-enter flex-1">
      {children}
    </div>
  );
}
