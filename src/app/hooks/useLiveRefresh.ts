import { useEffect, useRef } from 'react';
import { subscribeSoftRefresh, type SoftRefreshScope } from '../utils/softRefresh';

/**
 * Keeps a screen's data current without a manual reload:
 * - on a realtime soft-refresh signal for one of `scopes` (e.g. a new doctor application),
 * - when the tab becomes visible again (covers missed events while the free host was asleep),
 * - every `intervalMs` while the tab is visible, as a fallback if the realtime stream is down.
 * The callback should be a silent reload (no spinner, keep existing data on error).
 */
export function useLiveRefresh(
  reload: () => void | Promise<void>,
  scopes: SoftRefreshScope[],
  { enabled = true, intervalMs = 30000 }: { enabled?: boolean; intervalMs?: number } = {},
) {
  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  const scopesKey = scopes.join('|');

  useEffect(() => {
    if (!enabled) return;
    const run = () => { void reloadRef.current(); };

    const unsubscribe = subscribeSoftRefresh(scopes, run);
    const onVisible = () => { if (document.visibilityState === 'visible') run(); };
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') run();
    }, intervalMs);

    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, intervalMs, scopesKey]);
}
