import { useSyncExternalStore } from "react";

function subscribe() {
  // No external store to subscribe to -- this only exists so React has a
  // reason to re-check the snapshot once after hydration, which is what
  // actually flips the returned value from false to true.
  return () => {};
}

/**
 * True only after the component has mounted in the browser. Server render
 * and the first client render both return false (via getServerSnapshot),
 * so this is the standard guard for code that must never run during SSR --
 * e.g. an unconditionally rendered `createPortal(..., document.body)`
 * call, where `document` doesn't exist on the server at all.
 */
export function useMounted() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
