import { afterEach, describe, expect, it, vi } from "vitest";

import { getCurrentSeasonFiveGalaContext } from "./season-five-gala-registration";

type Client = Parameters<typeof getCurrentSeasonFiveGalaContext>[0];
const riderId = "00000000-0000-4000-8000-000000000001";
const rawContext = {
  isOpen: true,
  closesAt: "2026-12-03T17:00:00Z",
  team: { id: "00000000-0000-4000-8000-000000000002", name: "Fixture S5" },
  program: null,
  selections: {},
  riders: [{
    rider_id: riderId, first_name: "Fixture", last_name: "Rider", mountain: 81.125,
    hills: 70, flat: 70, time_trial: 70, cobbles: 70, sprint: 70, frozen_admission: true,
  }],
  courseCounts: { "pt-zoncolan": 0 },
};
function clientWith(result: unknown) {
  const abortSignal = vi.fn().mockResolvedValue(result);
  const rpc = vi.fn(() => ({ abortSignal }));
  return { client: { rpc } as unknown as Client, rpc, abortSignal };
}
afterEach(() => vi.restoreAllMocks());

describe("season five gala context read", () => {
  it("performs one authenticated context RPC bounded to eight seconds", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const { client, rpc, abortSignal } = clientWith({ data: rawContext, error: null });
    const result = await getCurrentSeasonFiveGalaContext(client);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("get_current_season_five_gala_context");
    expect(timeout).toHaveBeenCalledExactlyOnceWith(8000);
    expect(abortSignal).toHaveBeenCalledExactlyOnceWith(expect.any(AbortSignal));
    expect(result.riders[0]).toMatchObject({ mountain: 81.125, continentalAdmitted: true });
  });

  it.each([
    { data: null, error: { message: "relation private.fixture does not exist" } },
    { data: { ...rawContext, riders: [{ rider_id: riderId }] }, error: null },
    { data: { ...rawContext, courseCounts: { "foreign-course": 1 } }, error: null },
  ])("reports a controlled failure for database errors or invalid data", async (response) => {
    const { client, rpc } = clientWith(response);
    await expect(getCurrentSeasonFiveGalaContext(client)).rejects.toThrow("Les inscriptions du gala sont temporairement indisponibles.");
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("reports an uncertain timeout without leaking technical errors or retrying", async () => {
    const { client, rpc, abortSignal } = clientWith(null);
    abortSignal.mockRejectedValue(new Error("AbortError: fixture connection reset"));
    await expect(getCurrentSeasonFiveGalaContext(client)).rejects.toThrow("Les inscriptions du gala sont temporairement indisponibles.");
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
