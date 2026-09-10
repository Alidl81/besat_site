"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

// SiteHeader and HomeSliderSection are siblings under PublicPageLayout, not
// parent/child -- there's no CSS trick that makes a `position: sticky`
// header visually overlap the hero image behind it (both just occupy their
// own normal-flow rows), so a transparent white-text header is only
// readable for as long as whatever is at the top of the page is genuinely
// dark. SiteHeader's transparent-on-home-page decision previously assumed
// that was always true; this lets HomeSliderSection report whether it
// actually rendered a dark populated hero or the short/light empty-state
// fallback, so the header can stay solid in the latter case instead of
// guessing.
type HeroVisibilityContextValue = {
  hasVisibleHero: boolean;
  setHasVisibleHero: (value: boolean) => void;
};

const HeroVisibilityContext = createContext<HeroVisibilityContextValue | null>(null);

export function HeroVisibilityProvider({ children }: { children: ReactNode }) {
  // Defaults true: every route except the home page has no hero section
  // reporting into this at all, and the header's own `isHome` check
  // already scopes the transparent-header behavior to the home page --
  // this only ever matters once HomeSliderSection actually mounts and
  // reports a real value.
  const [hasVisibleHero, setHasVisibleHero] = useState(true);
  return (
    <HeroVisibilityContext.Provider value={{ hasVisibleHero, setHasVisibleHero }}>
      {children}
    </HeroVisibilityContext.Provider>
  );
}

export function useHeroVisibility() {
  return useContext(HeroVisibilityContext) ?? { hasVisibleHero: true, setHasVisibleHero: () => {} };
}
