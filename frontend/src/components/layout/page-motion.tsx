"use client";

import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

export function PageMotion({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // `besat-page-enter` animates `transform` with `animation-fill-mode:
  // both`. Even ending the keyframe on `transform: none`, the animation's
  // held/filled value stays an equivalent identity matrix rather than the
  // literal `none` keyword (confirmed via real browser measurement, not
  // just spec reading) -- which still counts as "a transform value other
  // than none" and keeps <main> a containing block for every
  // position:fixed descendant on the page, indefinitely, not just during
  // the 650ms entrance. Dropping the animation class once it finishes
  // removes the animation (and its held transform) entirely, so <main>
  // reverts to its true unanimated computed style -- literal `none` --
  // with no visual change, since the class carries no other properties.
  const [animating, setAnimating] = useState(true);

  return (
    <main
      key={pathname}
      id="main-content"
      tabIndex={-1}
      className={animating ? "besat-page-enter flex-1" : "flex-1"}
      onAnimationEnd={() => setAnimating(false)}
    >
      {children}
    </main>
  );
}
