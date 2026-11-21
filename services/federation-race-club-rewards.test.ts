import { describe, expect, it, vi } from "vitest";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { settleFederationRaceClubRewards, usesFederationClubRewards } from "./federation-race-club-rewards";

vi.mock("server-only", () => ({}));

describe("gains des sélections nationales", () => {
  it.each(["continental_championship", "world_championship", "nations_cup"] as const)("verse %s sans exiger une inscription de club", async (competitionType) => {
    const abortSignal = vi.fn().mockResolvedValue({ error: null });
    const rpc = vi.fn(() => ({ abortSignal }));
    const admin = { rpc } as unknown as ReturnType<typeof createSupabaseAdminClient>;
    await settleFederationRaceClubRewards(admin, { id: "edition", name: "Sélection internationale", competitionType }, 5);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("settle_federation_race_club_rewards", { p_race_edition_id: "edition" });
    expect(abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it("préserve le règlement dédié des Jeux et les chemins historiques et nationaux", () => {
    const common = { id: "edition", name: "Championnat" };
    expect(usesFederationClubRewards({ ...common, competitionType: "continental_championship" }, 2)).toBe(false);
    expect(usesFederationClubRewards({ ...common, competitionType: "continental_championship" }, 3)).toBe(false);
    for (const competitionType of ["national_road", "national_time_trial", "standard"] as const)
      expect(usesFederationClubRewards({ ...common, competitionType }, 5)).toBe(false);
    expect(usesFederationClubRewards({ ...common, name: "Jeux quadriennaux · Course en ligne", competitionType: "nations_cup" }, 8)).toBe(false);
  });

  it("empêche la clôture silencieuse si le versement atomique échoue", async () => {
    const rpc = vi.fn(() => ({ abortSignal: vi.fn().mockResolvedValue({ error: { message: "compte manquant" } }) }));
    await expect(settleFederationRaceClubRewards({ rpc } as unknown as ReturnType<typeof createSupabaseAdminClient>, {
      id: "edition", name: "CC Europe", competitionType: "continental_championship",
    }, 5)).rejects.toThrow("compte manquant");
  });
});
