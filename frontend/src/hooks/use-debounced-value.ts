import { useEffect, useState } from "react";

/**
 * Returns `value`, but delayed by `delayMs` after it stops changing. Use
 * this to debounce an *effect* driven by a value (a fetch, a URL write),
 * while the input itself stays a plain, immediately-controlled value with
 * no separate local "draft" state to keep in sync -- that split (local
 * draft + a resync effect pulling it back to the confirmed value) is a
 * common source of subtle bugs when the confirmed value can also change
 * for reasons other than the debounce firing (e.g. a route-level remount
 * resetting state). Debouncing the derived value instead avoids that
 * class of bug entirely.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
