"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getApiErrorMessage } from "@/lib/api/client";

export function usePanelRequest<T>(
  request: () => Promise<T>,
  dependencies: readonly unknown[],
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  // FE-PANEL-RETRY-DOUBLE-SUBMIT-001: `reload()` only ever bumped `version`
  // state, with no guard against a second same-tick call while the fetch a
  // previous `reload()` triggered is still in flight -- two rapid retry-
  // button activations (each a separate synchronous event dispatch) could
  // each read state as "not yet loading" before either commit landed, so
  // both proceeded and each started a real network request. Matches the
  // same synchronous-ref-guard pattern already established for every
  // mutation double-submit fix in this codebase; state alone always lags a
  // render behind a second synchronous call.
  const reloadingRef = useRef(false);
  const reload = useCallback(() => {
    if (reloadingRef.current) return;
    reloadingRef.current = true;
    setVersion((current) => current + 1);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => {
        if (active) {
          setLoading(true);
          setError(null);
        }
        return request();
      })
      .then((result) => {
        if (active) setData(result);
      })
      .catch((reason: unknown) => {
        if (active) setError(getApiErrorMessage(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
        reloadingRef.current = false;
      });

    return () => {
      active = false;
    };
    // Caller controls the dependency list, just like useEffect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, version]);

  return { data, loading, error, reload, setData };
}
