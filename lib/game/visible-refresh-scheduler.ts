/** Coalesce background invalidations without issuing requests from hidden tabs. */
export function createVisibleRefreshScheduler({
  refresh,
  isVisible,
  delayMs = 150,
}: {
  refresh: () => Promise<unknown>;
  isVisible: () => boolean;
  delayMs?: number;
}) {
  let active = true;
  let dirty = false;
  let inFlight = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function request(waitMs = delayMs) {
    if (!active) return;
    dirty = true;
    if (!isVisible() || inFlight || timer !== null) return;
    timer = setTimeout(() => void run(), waitMs);
  }

  async function run() {
    timer = null;
    if (!active || !dirty || !isVisible()) return;
    dirty = false;
    inFlight = true;
    try {
      await refresh();
    } catch {
      // A later invalidation or return to the tab will retry after a network error.
    } finally {
      inFlight = false;
      if (active && dirty) request();
    }
  }

  return {
    request,
    dispose() {
      active = false;
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
}
