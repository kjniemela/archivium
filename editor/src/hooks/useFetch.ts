import { useCallback, useEffect, useState } from 'react';

export type FetchState<T> = {
  data: T | undefined,
  error: Error | undefined,
  loading: boolean,
  refetch: () => void,
};

export function useFetch<T = unknown>(url: string | null): FetchState<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<Error>();
  const [loading, setLoading] = useState(url !== null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (url === null) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(undefined);
    (async () => {
      try {
        const response = await fetch(url, {
          credentials: 'include',
          headers: { 'Accept': 'application/json' },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
        setData(await response.json());
        setLoading(false);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [url, nonce]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  return { data, error, loading, refetch };
}
