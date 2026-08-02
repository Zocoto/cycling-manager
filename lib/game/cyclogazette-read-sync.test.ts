import { describe, expect, it, vi } from "vitest";

import {
  CYCLOGAZETTE_READ_EVENT,
  CyclogazetteUnreadRefreshTracker,
  notifyCyclogazetteRead,
} from "./cyclogazette-read-sync";

describe("synchronisation de lecture de La Cyclogazette", () => {
  it("ignore une réponse non lue devenue obsolète après la consultation", () => {
    const tracker = new CyclogazetteUnreadRefreshTracker();
    const staleRequest = tracker.beginRefresh();

    tracker.invalidate();

    expect(tracker.isCurrent(staleRequest)).toBe(false);
    expect(tracker.isCurrent(tracker.beginRefresh())).toBe(true);
  });

  it("notifie le raccourci après confirmation de la lecture", () => {
    const dispatchEvent = vi.fn<(event: Event) => boolean>(() => true);

    notifyCyclogazetteRead({ dispatchEvent });

    expect(dispatchEvent).toHaveBeenCalledOnce();
    expect(dispatchEvent.mock.calls[0]?.[0].type).toBe(
      CYCLOGAZETTE_READ_EVENT,
    );
  });
});
