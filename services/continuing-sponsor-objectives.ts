import "server-only";

import {
  getSponsorNegotiationBudgetCeiling,
  isSponsorObjectiveDifficulty,
  type SponsorObjectiveDifficulty,
} from "@/lib/game/sponsor-negotiation";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensureAndLoadSponsorObjectives } from "@/services/persisted-sponsor-objectives";
import type { PersistedSponsorOffer } from "@/services/persisted-sponsor-offers";
import type { PersistedSponsorContract } from "@/services/sponsoring-workflow";

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

type ContinuingSponsorOfferRow = {
  id: string;
  budget_per_season: number | string;
  base_budget_per_season: number | string;
  negotiation_budget_ceiling: number | string;
  objective_difficulty: string;
  status: "accepted";
};

export async function ensureContinuingSponsorObjectivePlan({
  supabase,
  sportingDirectorId,
  teamId,
  teamReputationPoints,
  contract,
  targetSeason,
}: {
  supabase: SupabaseAdminClient;
  sportingDirectorId: string;
  teamId: string;
  teamReputationPoints: number;
  contract: PersistedSponsorContract;
  targetSeason: {
    id: string;
    game_year: number;
  };
}): Promise<PersistedSponsorOffer> {
  const baseBudget = contract.budgetPerSeason;
  const budgetCeiling = getSponsorNegotiationBudgetCeiling({
    baseBudget,
    sponsorMaximumBudget: contract.sponsor.budgetRange.max,
  });
  const { data: offerId, error: preparationError } = await supabase.rpc(
    "ensure_continuing_sponsor_offer",
    {
      p_contract_id: contract.id,
      p_sporting_director_id: sportingDirectorId,
      p_base_budget: baseBudget,
      p_budget_ceiling: budgetCeiling,
    },
  );

  if (preparationError || typeof offerId !== "string") {
    throw new Error(
      `Impossible de préparer les objectifs annuels du sponsor : ${preparationError?.message ?? "offre annuelle introuvable"}`,
    );
  }

  const { data: offerRow, error: offerError } = await supabase
    .from("sponsor_offers")
    .select(
      `
        id,
        budget_per_season,
        base_budget_per_season,
        negotiation_budget_ceiling,
        objective_difficulty,
        status
      `,
    )
    .eq("id", offerId)
    .eq("continuing_contract_id", contract.id)
    .eq("season_id", targetSeason.id)
    .maybeSingle<ContinuingSponsorOfferRow>();

  if (offerError || !offerRow) {
    throw new Error(
      `Impossible de charger les objectifs annuels du sponsor : ${offerError?.message ?? "offre annuelle absente"}`,
    );
  }

  if (!isSponsorObjectiveDifficulty(offerRow.objective_difficulty)) {
    throw new Error("Le niveau d’ambition annuel du sponsor est invalide.");
  }

  const proposedBudget = Number(offerRow.budget_per_season);
  const persistedBaseBudget = Number(offerRow.base_budget_per_season);
  const persistedBudgetCeiling = Number(offerRow.negotiation_budget_ceiling);

  if (
    !Number.isFinite(proposedBudget) ||
    !Number.isFinite(persistedBaseBudget) ||
    !Number.isFinite(persistedBudgetCeiling)
  ) {
    throw new Error(
      "Les paramètres budgétaires annuels du sponsor sont invalides.",
    );
  }

  const objectiveDifficulty: SponsorObjectiveDifficulty =
    offerRow.objective_difficulty;
  const objectivesByOfferId = await ensureAndLoadSponsorObjectives({
    supabase,
    seasonId: targetSeason.id,
    teamReputationPoints,
    teamId,
    offers: [
      {
        offerId,
        sponsor: contract.sponsor,
        proposedBudget: persistedBaseBudget,
        relationshipYear: Math.max(
          2,
          targetSeason.game_year - contract.startGameYear + 1,
        ),
        objectiveDifficulty,
        includeRiderRecruitmentObjective: true,
      },
    ],
  });
  const objectives = objectivesByOfferId.get(offerId);

  if (!objectives) {
    throw new Error("Les objectifs annuels du sponsor sont introuvables.");
  }

  return {
    id: offerId,
    sponsor: contract.sponsor,
    sportingPhilosophy:
      objectives.find(
        (objective) => objective.targetDetails.sportingPhilosophy,
      )?.targetDetails.sportingPhilosophy ?? contract.sportingPhilosophy,
    objectiveDifficulty,
    baseBudget: persistedBaseBudget,
    negotiationBudgetCeiling: Math.max(
      persistedBudgetCeiling,
      budgetCeiling,
    ),
    proposedBudget,
    contractDurationSeasons: 1,
    status: offerRow.status,
    isRenewal: true,
    objectives,
  };
}
