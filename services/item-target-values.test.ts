import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { getCurrentTeamItemTargetRiders } from "./item-target-values";

describe("item target passport metadata", () => {
  it.each([false, true])("preserves eligibility through the existing RPC (Halloween=%s)", async (halloween) => {
    const rpc = vi.fn().mockResolvedValue({ error: null, data: [true, false, undefined].map((eligible, index) => ({
      id: `rider-${index}`, firstName: "Rider", lastName: String(index), countryName: "Belgique",
      canNaturalizeWithPassport: eligible,
    })) });
    const result = await getCurrentTeamItemTargetRiders({ rpc } as unknown as SupabaseClient, halloween);
    expect(result.map(rider => rider.canNaturalizeWithPassport)).toEqual([true, false, false]);
    expect(result).toHaveLength(3); // Other consumables retain the entire roster.
    expect(rpc).toHaveBeenCalledExactlyOnceWith(halloween ? "get_current_halloween_item_target_values" : "get_current_team_item_target_values");
  });

  it("does not replace a loading failure with an apparently eligible roster", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: { message: "Unavailable" }, data: null });
    await expect(getCurrentTeamItemTargetRiders({ rpc } as unknown as SupabaseClient)).rejects.toThrow("Unavailable");
  });
});
