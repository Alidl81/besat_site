"use client";

import { useCallback, useEffect, useState } from "react";
import { getApiErrorMessage } from "@/lib/api/client";

export function usePanelRequest<T>(
  request: () => Promise<T>,
  dependencies: readonly unknown[],
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((current) => current + 1), []);

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
      });

    return () => {
      active = false;
    };
    // Caller controls the dependency list, just like useEffect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, version]);

  return { data, loading, error, reload, setData };
}
