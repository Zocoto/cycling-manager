import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDashboardHalloweenEdition } from "./dashboard-halloween";

const { query, from } = vi.hoisted(() => {
  const query = { select: vi.fn(), eq: vi.fn(), lte: vi.fn(), gt: vi.fn(), abortSignal: vi.fn(), maybeSingle: vi.fn() };
  return { query, from: vi.fn(() => query) };
});
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ from }) }));

describe("shared dashboard Halloween edition", () => {
  beforeEach(() => {
    for (const name of ["select", "eq", "lte", "gt", "abortSignal"] as const) query[name].mockReturnValue(query);
    query.maybeSingle.mockReset();
  });
  it("reads just the active edition and shop deadline, with a bounded timeout", async () => {
    query.maybeSingle.mockResolvedValue({ data: { id: "halloween-2026", shop_ends_at: "2026-11-05T23:00:00Z" }, error: null });
    expect(await getDashboardHalloweenEdition()).toEqual({ id: "halloween-2026", shopEndsAt: "2026-11-05T23:00:00Z" });
    expect(from).toHaveBeenCalledWith("halloween_editions");expect(query.select).toHaveBeenCalledWith("id,shop_ends_at");
    expect(query.eq).toHaveBeenCalledWith("enabled", true);expect(query.lte).toHaveBeenCalledWith("starts_at", "now");
    expect(query.gt).toHaveBeenCalledWith("shop_ends_at", "now");expect(query.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  });
  it.each([null, { id:"halloween-2026",shop_ends_at:"invalid" }])("does not invent a deadline for absent or invalid event data (%j)", async data => {
    query.maybeSingle.mockResolvedValue({ data, error: null });
    expect(await getDashboardHalloweenEdition()).toBeNull();
  });
  it("does not fail the dashboard when the optional event query fails", async () => {
    query.maybeSingle.mockRejectedValue(new Error("unavailable"));
    expect(await getDashboardHalloweenEdition()).toBeNull();
  });
});
