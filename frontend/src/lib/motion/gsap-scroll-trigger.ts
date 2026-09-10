import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

let registered = false;

/** GSAP plugin registration is a global, one-time side effect -- calling it
 * from every component that needs ScrollTrigger would re-run it on every
 * mount. Call this once at the top of a scroll-triggered effect instead. */
export function ensureScrollTriggerRegistered() {
  if (registered) return;
  gsap.registerPlugin(ScrollTrigger);
  registered = true;
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
