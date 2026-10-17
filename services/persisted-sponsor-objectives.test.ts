import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { loadSignedSponsorObjectives, repairLegacyRaceObjectives } from "./persisted-sponsor-objectives";

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

describe("lecture des engagements sponsor signés", () => {
  function signedClient(rows: RepairOptions["objectiveRows"], error: { message: string } | null = null) {
    const queries: { table: string; filters: unknown[] }[] = [];
    const from = vi.fn((table: string) => {
      if (!["sponsor_objectives", "sponsor_main_objective_terms"].includes(table)) {
        throw new Error(`Un contrat signé ne doit pas charger un catalogue ni générer des objectifs : ${table}`);
      }
      const filters: unknown[] = [];
      queries.push({ table, filters });
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn((key: string, value: unknown) => { filters.push([key, value]); return query; }),
        in: vi.fn((key: string, value: unknown) => { filters.push([key, value]); return query; }),
        order: vi.fn(() => query),
        returns: vi.fn(async () => table === "sponsor_objectives"
          ? { data: rows, error }
          : { data: [{ sponsor_objective_id: rows[0]?.id, cash_reward: "14000", currency_code: "EUR", reputation_penalty: "7", race_category_code: "continental", settlement_status: "pending" }], error: null }),
      };
      // No mutation methods: the test fails if the read path attempts a write.
      return query;
    });
    return { supabase: { from } as unknown as RepairOptions["supabase"], from, queries };
  }

  it.each(["draft", "active", "completed", "failed", "cancelled"] as const)(
    "préserve les cibles, les poids et les récompenses d’un contrat signé (statut %s)",
    async (status) => {
      const rows = Array.from({ length: 10 }, (_, index) => ({
        ...raceObjective(`signed-${index}`, status, `signed-race-${index}`),
        display_order: 10 - index, satisfaction_points: 3 + index,
        renewal_bonus_percent: 2, is_provisional: false,
      }));
      const before = structuredClone(rows);
      const { supabase, from, queries } = signedClient(rows);
      const first = await loadSignedSponsorObjectives({ supabase, seasonId: "signed-season", offerId: "offer" });
      const second = await loadSignedSponsorObjectives({ supabase, seasonId: "signed-season", offerId: "offer" });
      expect(second).toEqual(first);
      expect(rows).toEqual(before);
      expect(first.map((objective) => objective.displayOrder)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      for (const row of before) {
        expect(first.find((objective) => objective.id === row.id)).toMatchObject({
          name: row.name, description: row.description, priority: row.priority,
          status: row.status, satisfactionPoints: row.satisfaction_points,
          renewalBonusPercent: row.renewal_bonus_percent, targetDetails: row.target_details,
        });
      }
      expect(first.find((objective) => objective.id === rows[0].id)?.mainObjectiveTerms).toEqual({
        cashReward: 14000, currencyCode: "EUR", reputationPenalty: 7,
        raceCategoryCode: "continental", settlementStatus: "pending",
      });
      expect(from.mock.calls.map(([table]) => table)).toEqual([
        "sponsor_objectives", "sponsor_main_objective_terms", "sponsor_objectives", "sponsor_main_objective_terms",
      ]);
      expect(queries[0].filters).toEqual([["sponsor_offer_id", ["offer"]], ["season_id", "signed-season"]]);
    },
  );

  it("n’ajoute aucun engagement à un ancien contrat qui en possède moins de dix", async () => {
    const rows = [raceObjective("historical", "active", "adriatique")];
    const { supabase } = signedClient(rows);
    const objectives = await loadSignedSponsorObjectives({ supabase, seasonId: "signed-season", offerId: "offer" });
    expect(objectives).toHaveLength(1);
    expect(objectives[0].targetDetails).toEqual(rows[0].target_details);
  });

  it("remonte une erreur de lecture sans inventer de nouveaux objectifs", async () => {
    const { supabase } = signedClient([], { message: "unavailable" });
    await expect(loadSignedSponsorObjectives({ supabase, seasonId: "signed-season", offerId: "offer" })).rejects.toThrow("unavailable");
  });
});
