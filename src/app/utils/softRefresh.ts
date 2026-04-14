export type SoftRefreshScope =
  | 'all'
  | 'dashboard'
  | 'market-prices'
  | 'irrigation'
  | 'doctor-verification'
  | 'disease-detection';

export type SoftRefreshPayload = {
  scope: SoftRefreshScope;
  reason?: string;
  at: string;
};

const SOFT_REFRESH_EVENT = 'sf:soft-refresh';

export function triggerSoftRefresh(scope: SoftRefreshScope, reason = 'manual') {
  if (typeof window === 'undefined') return;

  const payload: SoftRefreshPayload = {
    scope,
    reason,
    at: new Date().toISOString(),
  };

  window.dispatchEvent(new CustomEvent<SoftRefreshPayload>(SOFT_REFRESH_EVENT, { detail: payload }));
}

export function subscribeSoftRefresh(
  scopes: SoftRefreshScope | SoftRefreshScope[],
  handler: (payload: SoftRefreshPayload) => void,
) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const acceptedScopes = new Set(Array.isArray(scopes) ? scopes : [scopes]);

  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<SoftRefreshPayload>;
    const payload = customEvent.detail;
    if (!payload) return;

    if (payload.scope === 'all' || acceptedScopes.has('all') || acceptedScopes.has(payload.scope)) {
      handler(payload);
    }
  };

  window.addEventListener(SOFT_REFRESH_EVENT, listener as EventListener);

  return () => {
    window.removeEventListener(SOFT_REFRESH_EVENT, listener as EventListener);
  };
}
