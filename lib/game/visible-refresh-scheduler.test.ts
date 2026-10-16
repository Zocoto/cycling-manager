import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createVisibleRefreshScheduler } from "./visible-refresh-scheduler";

describe("visible refresh scheduler", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("coalesces a burst, including simultaneous focus and visibility events", async () => {
    const refresh = vi.fn(async () => undefined);
    const scheduler = createVisibleRefreshScheduler({ refresh, isVisible: () => true });
    scheduler.request(0);
    scheduler.request(0);
    scheduler.request();
    await vi.runAllTimersAsync();
    expect(refresh).toHaveBeenCalledTimes(1);
    scheduler.dispose();
  });

  it("does not overlap slow requests and performs only one trailing refresh", async () => {
    let finish!: () => void;
    const refresh = vi.fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }))
      .mockResolvedValue(undefined);
    const scheduler = createVisibleRefreshScheduler({ refresh, isVisible: () => true });
    scheduler.request();
    await vi.advanceTimersByTimeAsync(150);
    for (let index = 0; index < 100; index += 1) scheduler.request();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    finish();
    await vi.runAllTimersAsync();
    expect(refresh).toHaveBeenCalledTimes(2);
    scheduler.dispose();
  });

  it("defers hidden-tab notifications until the tab becomes visible", async () => {
    let visible = false;
    const refresh = vi.fn(async () => undefined);
    const scheduler = createVisibleRefreshScheduler({ refresh, isVisible: () => visible });
    for (let index = 0; index < 100; index += 1) scheduler.request();
    await vi.runAllTimersAsync();
    expect(refresh).not.toHaveBeenCalled();
    visible = true;
    scheduler.request(0);
    await vi.runAllTimersAsync();
    expect(refresh).toHaveBeenCalledTimes(1);
    scheduler.dispose();
  });

  it("rechecks visibility after the delay and does not poll after failure", async () => {
    let visible = true;
    const refresh = vi.fn().mockRejectedValue(new Error("offline"));
    const scheduler = createVisibleRefreshScheduler({ refresh, isVisible: () => visible });
    scheduler.request();
    visible = false;
    await vi.runAllTimersAsync();
    expect(refresh).not.toHaveBeenCalled();
    visible = true;
    scheduler.request(0);
    await vi.runAllTimersAsync();
    expect(refresh).toHaveBeenCalledTimes(1);
    scheduler.request(0);
    await vi.runAllTimersAsync();
    expect(refresh).toHaveBeenCalledTimes(2);
    scheduler.dispose();
  });

  it("keeps an in-flight invalidation deferred if the tab hides before completion", async () => {
    let visible = true;
    let finish!: () => void;
    const refresh = vi.fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }))
      .mockResolvedValue(undefined);
    const scheduler = createVisibleRefreshScheduler({ refresh, isVisible: () => visible });
    scheduler.request(0);
    await vi.advanceTimersByTimeAsync(0);
    scheduler.request();
    visible = false;
    finish();
    await vi.runAllTimersAsync();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    visible = true;
    scheduler.request(0);
    await vi.runAllTimersAsync();
    expect(refresh).toHaveBeenCalledTimes(2);
    scheduler.dispose();
  });

  it("cancels a pending refresh and ignores events after disposal", async () => {
    const refresh = vi.fn(async () => undefined);
    const scheduler = createVisibleRefreshScheduler({ refresh, isVisible: () => true });
    scheduler.request();
    scheduler.dispose();
    scheduler.request(0);
    await vi.runAllTimersAsync();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("does not schedule trailing work after unmount during a slow request", async () => {
    let finish!: () => void;
    const refresh = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const scheduler = createVisibleRefreshScheduler({ refresh, isVisible: () => true });
    scheduler.request(0);
    await vi.advanceTimersByTimeAsync(0);
    scheduler.request();
    scheduler.dispose();
    finish();
    await vi.runAllTimersAsync();
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
