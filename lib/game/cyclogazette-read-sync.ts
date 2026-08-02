export const CYCLOGAZETTE_READ_EVENT = "cyclogazette:read";

export class CyclogazetteUnreadRefreshTracker {
  private version = 0;

  beginRefresh() {
    this.version += 1;
    return this.version;
  }

  invalidate() {
    this.version += 1;
  }

  isCurrent(requestVersion: number) {
    return requestVersion === this.version;
  }
}

export function notifyCyclogazetteRead(
  target: Pick<EventTarget, "dispatchEvent"> = window,
) {
  target.dispatchEvent(new Event(CYCLOGAZETTE_READ_EVENT));
}
