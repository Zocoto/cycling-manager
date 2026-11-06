import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  subscribe: null as null | ((onChange: () => void) => () => void),
  snapshot: null as null | (() => boolean),
  serverSnapshot: null as null | (() => boolean),
}));

vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useCallback: (callback: unknown) => callback,
  useSyncExternalStore: (subscribe: NonNullable<typeof runtime.subscribe>, snapshot: () => boolean, serverSnapshot: () => boolean) => {
    runtime.subscribe = subscribe;
    runtime.snapshot = snapshot;
    runtime.serverSnapshot = serverSnapshot;
    return snapshot();
  },
}));

import { DraftBannerLifetime } from "./draft-banner-lifetime";

describe("draft banner expiry without polling or requests", () => {
  let cleanup: (() => void) | undefined;
  const midnight = Date.parse("2026-11-07T00:00:00+01:00");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(midnight - 1000);
    vi.stubGlobal("window", { setTimeout, clearTimeout });
    vi.stubGlobal("document", Object.assign(new EventTarget(), { hidden: false }));
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("keeps the server snapshot stable and hides the banner at exactly midnight with one timer", () => {
    expect(DraftBannerLifetime({ expiresAt: midnight, children: "Draft" })).toBe("Draft");
    expect(runtime.serverSnapshot!()).toBe(true);
    const changed = vi.fn();
    cleanup = runtime.subscribe!(changed);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(999);
    expect(changed).not.toHaveBeenCalled();
    expect(runtime.snapshot!()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(changed).toHaveBeenCalledOnce();
    expect(runtime.snapshot!()).toBe(false);
    expect(DraftBannerLifetime({ expiresAt: midnight, children: "Draft" })).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("checks expiry when a suspended tab becomes visible without polling", () => {
    DraftBannerLifetime({ expiresAt: midnight, children: "Draft" });
    const changed = vi.fn();
    cleanup = runtime.subscribe!(changed);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(changed).not.toHaveBeenCalled();
    vi.setSystemTime(midnight + 1000);
    Object.assign(document, { hidden: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(changed).not.toHaveBeenCalled();
    Object.assign(document, { hidden: false });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(changed).toHaveBeenCalledOnce();
    expect(runtime.snapshot!()).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("cleans up its timer and visibility listener when unmounted", () => {
    DraftBannerLifetime({ expiresAt: midnight, children: "Draft" });
    const changed = vi.fn();
    cleanup = runtime.subscribe!(changed);
    cleanup();
    cleanup = undefined;
    expect(vi.getTimerCount()).toBe(0);
    vi.setSystemTime(midnight + 1000);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(changed).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
