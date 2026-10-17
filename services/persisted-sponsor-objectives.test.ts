import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { repairLegacyRaceObjectives } from "./persisted-sponsor-objectives";

type RepairOptions = Parameters<typeof repairLegacyRaceObjectives>[0];

function raceObjective(id: string, status: RepairOptions["objectiveRows"][number]["status"], raceId: string): RepairOptions["objectiveRows"][number] {
  return {
    id, sponsor_offer_id: "offer", name: "Top 8 sur la course signée", description: "Condition signée.",
    objective_type: "race_result", status, priority: "important", evaluation_timing: "season_end",
    evaluation_day_number: null, display_order: 1, renewal_bonus_percent: 0, satisfaction_points: 10, is_provisional: true,
    target_details: { kind: "race_result", raceId, raceEditionId: `s4-${raceId}`, raceSlug: raceId, raceLabel: raceId, countryCode: "NL", targetRank: 8, requiredCount: 1, achievementType: "top_n" },
  };
}

describe("stabilité des courses des objectifs sponsor signés", () => {
  it.each(["active", "completed", "failed", "cancelled"] as const)(
    "conserve un objectif %s même si sa course a disparu du tirage ou du catalogue",
    async (status) => {
      const from = vi.fn(() => { throw new Error("Aucun objectif signé ne doit être réécrit"); });
      const random = vi.fn(() => { throw new Error("Aucun nouveau tirage après signature"); });
      const objective = raceObjective("signed-objective", status, "adriatique");
      const before = structuredClone(objective);
      await repairLegacyRaceObjectives({
        supabase: { from } as unknown as RepairOptions["supabase"],
        objectiveRows: [objective],
        sponsorCountryCode: "NL", sponsorPrestige: 3,
        targetSeasonGameYear: 4, teamReputationPoints: 0, raceCandidates: [], random,
      });
      expect(objective).toEqual(before);
      expect(from).not.toHaveBeenCalled();
      expect(random).not.toHaveBeenCalled();
    },
  );

  it("répare encore une cible provisoire invalide sans toucher au contrat signé voisin", async () => {
    const updates: unknown[] = [];
    const filters: unknown[] = [];
    const query = { eq: (key: string, value: string) => { filters.push([key, value]); return query; }, then: (resolve: (result: { error: null }) => unknown) => Promise.resolve(resolve({ error: null })) };
    const from = vi.fn(() => ({ update: (value: unknown) => { updates.push(value); return query; } }));
    await repairLegacyRaceObjectives({
      supabase: { from } as unknown as RepairOptions["supabase"],
      objectiveRows: [
        raceObjective("signed", "active", "signed-race"),
        raceObjective("draft", "draft", "obsolete"),
      ],
      sponsorCountryCode: "NL", sponsorPrestige: 3, targetSeasonGameYear: 4, teamReputationPoints: 200,
      raceCandidates: [{ raceId: "valid", raceEditionId: "s4-valid", raceSlug: "valid", raceLabel: "Course valide", countryCode: "NL", registrationPolicy: "open", minimumReputation: 0, categoryCode: "national", raceFormat: "one_day", profileTypes: ["flat"], competitionType: "standard", isMonument: false, isGrandTour: false }],
      random: () => 0.5,
    });
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ target_details: { raceId: "valid", targetRank: 8 } });
    expect(filters).toEqual([["id", "draft"], ["status", "draft"]]);
  });
});
