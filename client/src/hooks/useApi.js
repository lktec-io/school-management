import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';

/**
 * Fetch `path` (with query `params`) and keep the result in state.
 * Pass `null` as path to skip fetching. Re-fetches when path/params change or reload() is called.
 */
export function useApi(path, params) {
  const paramsKey = JSON.stringify(params ?? {});
  const [version, setVersion] = useState(0);
  const requestKey = path ? `${path}?${paramsKey}#${version}` : null;
  const [state, setState] = useState({ key: null, data: null, error: null });

  useEffect(() => {
    if (!path) return undefined;
    const controller = new AbortController();
    const key = `${path}?${paramsKey}#${version}`;
    api.get(path, JSON.parse(paramsKey), { signal: controller.signal })
      .then((data) => setState({ key, data, error: null }))
      .catch((error) => {
        if (error.name !== 'AbortError') setState((previous) => ({ key, data: previous.data, error }));
      });
    return () => controller.abort();
  }, [path, paramsKey, version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);
  const setData = useCallback((updater) => {
    setState((previous) => ({
      ...previous,
      data: typeof updater === 'function' ? updater(previous.data) : updater,
    }));
  }, []);

  return {
    data: path ? state.data : null,
    error: state.key === requestKey ? state.error : null,
    loading: Boolean(path) && state.key !== requestKey,
    reload,
    setData,
  };
}
