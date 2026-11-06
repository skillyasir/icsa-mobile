import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { ams } from '@/api/client';
import type { Failure } from '@/api/session';

export type Loaded<T> = {
  data: T | null;
  failure: Failure | null;
  /** True until the first answer (or failure). */
  loading: boolean;
  /** True while a pull-to-refresh is running. */
  refreshing: boolean;
  refresh: () => void;
  reload: () => Promise<void>;
};

/**
 * One AMS read for a screen: loads when the screen comes into view (so a tab
 * shows today's figures each time it is opened), on pull-to-refresh, and on
 * reload() after a change. A slower, older answer never overwrites a newer one.
 * Keeps the last good data on a failure, and says what failed.
 * enabled = false asks nothing (the developer preview has no AMS account).
 */
export function useAmsGet<T>(path: string, enabled = true): Loaded<T> {
  const [data, setData] = useState<T | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const latest = useRef(0);

  const load = useCallback(
    async (pull: boolean) => {
      if (!enabled) return;
      const mine = ++latest.current;
      if (pull) setRefreshing(true);
      const r = await ams.request<T>('GET', path);
      if (mine !== latest.current) return;
      if (r.ok) {
        setData(r.value);
        setFailure(null);
      } else {
        setFailure(r.failure);
      }
      setLoading(false);
      setRefreshing(false);
    },
    [path, enabled],
  );

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load]),
  );

  return {
    data,
    failure,
    loading,
    refreshing,
    refresh: () => {
      load(true);
    },
    reload: () => load(false),
  };
}
