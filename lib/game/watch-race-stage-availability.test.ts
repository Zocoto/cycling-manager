import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { watchRaceStageAvailability } from "./watch-race-stage-availability";

const pending = { cancelled: false, resultsAvailable: false, simulationAvailable: false };
const options = {
  stageId: "stage-id",
  intervalMs: 5_000,
  checkResults: true,
  checkSimulation: false,
  refreshOnPhaseChange: false,
};

const fetchAvailability = vi.fn<typeof fetch>();
let visibility: EventTarget & { visibilityState: "visible" | "hidden" };
let stop: (() => void) | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  visibility = Object.assign(new EventTarget(), { visibilityState: "visible" as const });
  vi.stubGlobal("document", visibility);
  vi.stubGlobal("fetch", fetchAvailability);
  fetchAvailability.mockImplementation(async () => Response.json(pending));
});

afterEach(() => {
  stop?.();
  stop = undefined;
  fetchAvailability.mockReset();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function setVisibility(state: typeof visibility.visibilityState) {
  visibility.visibilityState = state;
  visibility.dispatchEvent(new Event("visibilitychange"));
}

describe("race stage availability polling", () => {
  it("checks every five seconds and waits for the result even when the replay is already stored", async () => {
    const refresh = vi.fn();
    fetchAvailability.mockResolvedValueOnce(Response.json({ ...pending, simulationAvailable: true }));
    fetchAvailability.mockResolvedValueOnce(Response.json({ ...pending, resultsAvailable: true }));
    stop = watchRaceStageAvailability({ ...options, refresh });

    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetchAvailability).toHaveBeenCalledOnce();
    expect(refresh).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(refresh).toHaveBeenCalledExactlyOnceWith("results");
  });

  it("waits while hidden and checks for the replay as soon as the tab becomes visible", async () => {
    const refresh = vi.fn();
    setVisibility("hidden");
    fetchAvailability.mockResolvedValueOnce(Response.json({ ...pending, simulationAvailable: true }));
    stop = watchRaceStageAvailability({ ...options, intervalMs: 15_000, checkResults: false, checkSimulation: true, refresh });

    await vi.advanceTimersByTimeAsync(15_000);
    expect(fetchAvailability).not.toHaveBeenCalled();
    setVisibility("visible");
    await vi.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledExactlyOnceWith("simulation");
  });

  it("requests the phase transition without a redundant availability check", () => {
    const refresh = vi.fn();
    stop = watchRaceStageAvailability({ ...options, refreshOnPhaseChange: true, refresh });
    expect(fetchAvailability).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledExactlyOnceWith("phase");
  });

  it("allows a recovery refresh after persistent missing results", async () => {
    const refresh = vi.fn();
    stop = watchRaceStageAvailability({ ...options, refresh });
    await vi.advanceTimersByTimeAsync(55_000);
    expect(refresh).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(refresh).toHaveBeenCalledExactlyOnceWith("recovery");
  });

  it("keeps the recovery path when two checks fail", async () => {
    const refresh = vi.fn();
    fetchAvailability.mockRejectedValueOnce(new Error("offline"));
    fetchAvailability.mockResolvedValueOnce(new Response(null, { status: 503 }));
    stop = watchRaceStageAvailability({ ...options, refresh });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(refresh).toHaveBeenCalledExactlyOnceWith("recovery");
  });

  it("aborts a pending check when the tab becomes hidden", async () => {
    const refresh = vi.fn();
    let complete!: (response: Response) => void;
    fetchAvailability.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
    stop = watchRaceStageAvailability({ ...options, refresh });

    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetchAvailability).toHaveBeenCalledOnce();
    setVisibility("hidden");
    expect(fetchAvailability.mock.calls[0][1]?.signal?.aborted).toBe(true);
    complete(Response.json({ ...pending, resultsAvailable: true }));
    await vi.advanceTimersByTimeAsync(0);
    expect(refresh).not.toHaveBeenCalled();
  });
});
