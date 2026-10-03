let pending: Promise<void> | null = null;
let authFailed = false;
const failureListeners = new Set<() => void>();

export function googleMapsAuthFailed() { return authFailed; }
export function onGoogleMapsAuthFailure(listener: () => void) {
  failureListeners.add(listener);
  return () => failureListeners.delete(listener);
}

/** Load only the browser Maps JavaScript API. Route geometry remains contract-owned. */
export function loadGoogleMaps(browserKey: string): Promise<void> {
  if (authFailed) return Promise.reject(new Error("MAP_PROVIDER_AUTH_FAILED"));
  if (typeof google !== "undefined" && google.maps?.Map) return Promise.resolve();
  if (pending) return pending;
  pending = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    const authWindow = window as Window & {
      gm_authFailure?: () => void;
      __cargomeshGoogleMapsReady?: () => void;
    };
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve();
    };
    const timeout = window.setTimeout(() => finish(new Error("MAP_PROVIDER_TIMEOUT")), 12000);
    authWindow.gm_authFailure = () => {
      authFailed = true;
      finish(new Error("MAP_PROVIDER_AUTH_FAILED"));
      failureListeners.forEach((listener) => listener());
    };
    // With loading=async, the script load event can precede API readiness.
    // Google documents callback as the readiness signal for direct loading.
    authWindow.__cargomeshGoogleMapsReady = () => {
      if (typeof google !== "undefined" && google.maps?.Map) finish();
      else finish(new Error("MAP_PROVIDER_UNAVAILABLE"));
    };
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(browserKey)}&v=weekly&loading=async&callback=__cargomeshGoogleMapsReady`;
    script.onerror = () => finish(new Error("MAP_PROVIDER_UNAVAILABLE"));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    pending = null;
    throw error;
  });
  return pending;
}
