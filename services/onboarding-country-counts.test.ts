import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), abort: vi.fn() }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ rpc: mocks.rpc }),
}));
import { getOnboardingCountryDirectorCounts } from "./onboarding-country-counts";

describe("initial country choice counts", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.rpc.mockReturnValue({ abortSignal: mocks.abort });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("loads all countries in one bounded RPC and preserves real zeroes", async () => {
    mocks.abort.mockResolvedValue({ data: [
      { country_id: "fr", director_count: "12" },
      { country_id: "bw", director_count: 0 },
    ], error: null });
    expect(await getOnboardingCountryDirectorCounts()).toEqual({ fr: 12, bw: 0 });
    expect(mocks.rpc).toHaveBeenCalledWith("get_onboarding_country_director_counts");
    expect(mocks.abort).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it.each([
    { data: null, error: { message: "unavailable" } },
    { data: null, error: null },
    { data: [{ country_id: "fr", director_count: "invalid" }], error: null },
    { data: [{ country_id: "fr", director_count: -1 }], error: null },
  ])("keeps the form usable without displaying invented zeroes on failure", async (result) => {
    mocks.abort.mockResolvedValue(result);
    expect(await getOnboardingCountryDirectorCounts()).toBeNull();
  });

  it("handles network failure without blocking onboarding", async () => {
    mocks.abort.mockRejectedValue(new Error("timeout"));
    expect(await getOnboardingCountryDirectorCounts()).toBeNull();
  });
});
