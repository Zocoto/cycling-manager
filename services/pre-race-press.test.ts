import { describe, expect, it, vi } from "vitest";
import { getPreRacePressConferences } from "./pre-race-press";

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));
const row = {
  conference_id: "press", team_name: "Team", director_name: "DS", leader_rider_id: "rider", leader_name: "Leader",
  ambition: "top_10", race_intent: "attack", public_statement: "Nous visons le top 10.", status: "settled",
  target_met: false, leader_final_rank: 15, reputation_delta: 1, commitment_amount: 0, sponsor_bonus: 0,
  submitted_at: "2026-10-11", is_own: true, achievement_level: "partial", achievement_percent: 40, sponsor_bonus_awarded: 0,
};
type Client = Parameters<typeof getPreRacePressConferences>[0];
describe("pre-race conference hydration", () => {
  it("loads the stored partial verdict, not an inferred full success", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [row], error: null });
    expect(await getPreRacePressConferences({ rpc } as unknown as Client, "race")).toMatchObject([{
      targetMet: false, achievementLevel: "partial", achievementPercent: 40, reputationDelta: 1, sponsorBonusAwarded: 0,
    }]);
    expect(rpc).toHaveBeenCalledWith("get_pre_race_press_conferences", { p_race_edition_id: "race" });
  });
  it("preserves legacy verdicts and filters unknown declarations", async () => {
    const legacy = { ...row, achievement_level: undefined, achievement_percent: undefined, sponsor_bonus_awarded: undefined };
    const rpc = vi.fn().mockResolvedValue({ data: [legacy, { ...row, ambition: "invalid" }], error: null });
    expect(await getPreRacePressConferences({ rpc } as unknown as Client, "race")).toMatchObject([{
      targetMet: false, achievementLevel: null, achievementPercent: 0,
    }]);
  });
  it("reports an RPC error instead of hiding the room", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "unavailable" } });
    await expect(getPreRacePressConferences({ rpc } as unknown as Client, "race")).rejects.toThrow("unavailable");
  });
});
