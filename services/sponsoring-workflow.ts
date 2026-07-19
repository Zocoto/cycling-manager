import "server-only";

import { SPONSORS } from "@/data/sponsors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getOrCreateSponsorOffersForAuthUser,
  type PersistedSponsorOffer,
} from "@/services/persisted-sponsor-offers";
import type { Sponsor } from "@/types/sponsor";

export type SponsorJerseyStyle =
  | "classic"
  | "modern"
  | "bold";

export type SponsorContractStatus =
  | "planned"
  | "active"
  | "completed"
  | "terminated";

export type SponsorContractObjective = {
  id: string;
  name: string;
  description: string | null;
  displayOrder: number;
  status: string;
};

export type PersistedSponsorContract = {
  id: string;
  sponsor: Sponsor;
  sponsorOfferId: string | null;
  budgetPerSeason: number;
  currencyCode: string;
  contractDurationSeasons: number;
  status: SponsorContractStatus;
  selectedJerseyId: string | null;
  selectedJerseyStyle: SponsorJerseyStyle | null;
  signedAt: string | null;
  activatedAt: string | null;
  completedAt: string | null;
  terminatedAt: string | null;
  terminationReason: string | null;
  reputationPenalty: number;
  objectives: SponsorContractObjective[];
};

export type SponsoringState =
  | {
      kind: "offers";
      offers: PersistedSponsorOffer[];
    }
  | {
      kind: "jersey-selection";
      contract: PersistedSponsorContract;
    }
  | {
      kind: "active";
      contract: PersistedSponsorContract;
    }
  | {
      kind: "terminated";
      contract: PersistedSponsorContract;
    };

type SupabaseAdminClient = ReturnType<
  typeof createSupabaseAdminClient
>;

type SportingDirectorRow = {
  id: string;
};

type TeamAssignmentRow = {
  team_id: string;
};

type InitialCareerGenerationRow = {
  team_id: string;
};

type ActiveSeasonRow = {
  id: string;
};

type SponsorContractRow = {
  id: string;
  sponsor_id: string;
  sponsor_offer_id: string | null;
  budget_per_season: number | string;
  currency_code: string;
  contract_duration_seasons: number;
  status: SponsorContractStatus;
  selected_jersey_id: string | null;
  selected_jersey_style:
    | SponsorJerseyStyle
    | null;
  signed_at: string | null;
  activated_at: string | null;
  completed_at: string | null;
  terminated_at: string | null;
  termination_reason: string | null;
  reputation_penalty: number;
};

type SponsorRegistryRow = {
  catalog_key: string;
};

type SponsorObjectiveRow = {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
  status: string;
};

export async function getSponsoringStateForAuthUser(
  authUserId: string
): Promise<SponsoringState> {
  const normalizedAuthUserId =
    authUserId.trim();

  if (!normalizedAuthUserId) {
    throw new Error(
      "L’identifiant du joueur authentifié est obligatoire."
    );
  }

  const supabase =
    createSupabaseAdminClient();

  const {
    data: sportingDirector,
    error: sportingDirectorError,
  } = await supabase
    .from("sporting_directors")
    .select("id")
    .eq(
      "auth_user_id",
      normalizedAuthUserId
    )
    .eq("status", "active")
    .maybeSingle<SportingDirectorRow>();

  if (sportingDirectorError) {
    throw new Error(
      `Impossible de retrouver le profil du Directeur Sportif : ${sportingDirectorError.message}`
    );
  }

  if (!sportingDirector) {
    throw new Error(
      "Impossible de retrouver le profil du Directeur Sportif."
    );
  }

  const teamId =
    await resolveCurrentTeamId({
      supabase,
      sportingDirectorId:
        sportingDirector.id,
    });

  const activeSeasonId =
    await resolveActiveSeasonId(supabase);

  const currentContract =
    await loadCurrentPrincipalContract({
      supabase,
      teamId,
    });

  if (currentContract) {
    const contract =
      await hydrateSponsorContract({
        supabase,
        contractRow: currentContract,
      });

    if (
      contract.status === "planned" ||
      !contract.selectedJerseyId ||
      !contract.selectedJerseyStyle
    ) {
      return {
        kind: "jersey-selection",
        contract,
      };
    }

    return {
      kind: "active",
      contract,
    };
  }

  const terminatedContract =
    await loadTerminatedPrincipalContractForSeason({
      supabase,
      teamId,
      seasonId: activeSeasonId,
    });

  if (terminatedContract) {
    return {
      kind: "terminated",
      contract:
        await hydrateSponsorContract({
          supabase,
          contractRow:
            terminatedContract,
        }),
    };
  }

  const offers =
    await getOrCreateSponsorOffersForAuthUser(
      normalizedAuthUserId
    );

  return {
    kind: "offers",
    offers,
  };
}

async function loadCurrentPrincipalContract({
  supabase,
  teamId,
}: {
  supabase: SupabaseAdminClient;
  teamId: string;
}): Promise<SponsorContractRow | null> {
  const {
    data: contractRows,
    error: contractError,
  } = await supabase
    .from("team_sponsor_contracts")
    .select(
      `
        id,
        sponsor_id,
        sponsor_offer_id,
        budget_per_season,
        currency_code,
        contract_duration_seasons,
        status,
        selected_jersey_id,
        selected_jersey_style,
        signed_at,
        activated_at,
        completed_at,
        terminated_at,
        termination_reason,
        reputation_penalty
      `
    )
    .eq("team_id", teamId)
    .eq("role", "principal")
    .in("status", ["planned", "active"])
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .returns<SponsorContractRow[]>();

  if (contractError) {
    throw new Error(
      `Impossible de charger le contrat sponsor : ${contractError.message}`
    );
  }

  return contractRows?.[0] ?? null;
}

async function loadTerminatedPrincipalContractForSeason({
  supabase,
  teamId,
  seasonId,
}: {
  supabase: SupabaseAdminClient;
  teamId: string;
  seasonId: string;
}): Promise<SponsorContractRow | null> {
  const {
    data: contractRows,
    error: contractError,
  } = await supabase
    .from("team_sponsor_contracts")
    .select(
      `
        id,
        sponsor_id,
        sponsor_offer_id,
        budget_per_season,
        currency_code,
        contract_duration_seasons,
        status,
        selected_jersey_id,
        selected_jersey_style,
        signed_at,
        activated_at,
        completed_at,
        terminated_at,
        termination_reason,
        reputation_penalty
      `
    )
    .eq("team_id", teamId)
    .eq("role", "principal")
    .eq("status", "terminated")
    .eq("termination_season_id", seasonId)
    .order("terminated_at", {
      ascending: false,
    })
    .limit(1)
    .returns<SponsorContractRow[]>();

  if (contractError) {
    throw new Error(
      `Impossible de charger l’historique du contrat sponsor : ${contractError.message}`
    );
  }

  return contractRows?.[0] ?? null;
}

async function hydrateSponsorContract({
  supabase,
  contractRow,
}: {
  supabase: SupabaseAdminClient;
  contractRow: SponsorContractRow;
}): Promise<PersistedSponsorContract> {
  const sponsorRegistryResult =
    await supabase
      .from("sponsors")
      .select("catalog_key")
      .eq("id", contractRow.sponsor_id)
      .maybeSingle<SponsorRegistryRow>();

  if (sponsorRegistryResult.error) {
    throw new Error(
      `Impossible de retrouver le sponsor associé au contrat : ${sponsorRegistryResult.error.message}`
    );
  }

  if (!sponsorRegistryResult.data) {
    throw new Error(
      "Impossible de retrouver le sponsor associé au contrat."
    );
  }

  const sponsorCatalogKey =
    sponsorRegistryResult.data.catalog_key;

  const sponsor = SPONSORS.find(
    (catalogSponsor) =>
      catalogSponsor.id ===
      sponsorCatalogKey
  );

  if (!sponsor) {
    throw new Error(
      `Le sponsor "${sponsorCatalogKey}" existe dans Supabase mais pas dans le catalogue TypeScript.`
    );
  }

  const objectives =
    await loadContractObjectives({
      supabase,
      sponsorOfferId:
        contractRow.sponsor_offer_id,
    });

  const budgetPerSeason = Number(
    contractRow.budget_per_season
  );

  if (!Number.isFinite(budgetPerSeason)) {
    throw new Error(
      "Le budget du contrat sponsor est invalide."
    );
  }

  const reputationPenalty = Number(
    contractRow.reputation_penalty
  );

  if (
    !Number.isFinite(reputationPenalty) ||
    reputationPenalty < 0
  ) {
    throw new Error(
      "La pénalité de réputation du contrat sponsor est invalide."
    );
  }

  return {
    id: contractRow.id,
    sponsor,
    sponsorOfferId:
      contractRow.sponsor_offer_id,
    budgetPerSeason,
    currencyCode:
      contractRow.currency_code,
    contractDurationSeasons:
      contractRow.contract_duration_seasons,
    status: contractRow.status,
    selectedJerseyId:
      contractRow.selected_jersey_id,
    selectedJerseyStyle:
      contractRow.selected_jersey_style,
    signedAt: contractRow.signed_at,
    activatedAt:
      contractRow.activated_at,
    completedAt:
      contractRow.completed_at,
    terminatedAt:
      contractRow.terminated_at,
    terminationReason:
      contractRow.termination_reason,
    reputationPenalty,
    objectives,
  };
}

async function loadContractObjectives({
  supabase,
  sponsorOfferId,
}: {
  supabase: SupabaseAdminClient;
  sponsorOfferId: string | null;
}): Promise<SponsorContractObjective[]> {
  if (!sponsorOfferId) {
    return [];
  }

  const {
    data: objectiveRows,
    error: objectiveError,
  } = await supabase
    .from("sponsor_objectives")
    .select(
      `
        id,
        name,
        description,
        display_order,
        status
      `
    )
    .eq(
      "sponsor_offer_id",
      sponsorOfferId
    )
    .order("display_order", {
      ascending: true,
    })
    .returns<SponsorObjectiveRow[]>();

  if (objectiveError) {
    throw new Error(
      `Impossible de charger les objectifs du contrat : ${objectiveError.message}`
    );
  }

  return (objectiveRows ?? []).map(
    (objective) => ({
      id: objective.id,
      name: objective.name,
      description: objective.description,
      displayOrder:
        objective.display_order,
      status: objective.status,
    })
  );
}

async function resolveActiveSeasonId(
  supabase: SupabaseAdminClient
): Promise<string> {
  const {
    data: activeSeason,
    error: activeSeasonError,
  } = await supabase
    .from("seasons")
    .select("id")
    .eq("status", "active")
    .maybeSingle<ActiveSeasonRow>();

  if (activeSeasonError) {
    throw new Error(
      `Impossible de retrouver la saison active : ${activeSeasonError.message}`
    );
  }

  if (!activeSeason) {
    throw new Error(
      "Aucune saison active n’est disponible."
    );
  }

  return activeSeason.id;
}

async function resolveCurrentTeamId({
  supabase,
  sportingDirectorId,
}: {
  supabase: SupabaseAdminClient;
  sportingDirectorId: string;
}): Promise<string> {
  const {
    data: assignmentRows,
    error: assignmentError,
  } = await supabase
    .from("team_manager_assignments")
    .select("team_id")
    .eq(
      "sporting_director_id",
      sportingDirectorId
    )
    .eq("role", "general_manager")
    .eq("status", "active")
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .returns<TeamAssignmentRow[]>();

  if (assignmentError) {
    throw new Error(
      `Impossible de charger l’affectation de l’équipe : ${assignmentError.message}`
    );
  }

  const assignedTeamId =
    assignmentRows?.[0]?.team_id;

  if (assignedTeamId) {
    return assignedTeamId;
  }

  const {
    data: careerGeneration,
    error: careerGenerationError,
  } = await supabase
    .from("initial_career_generations")
    .select("team_id")
    .eq(
      "sporting_director_id",
      sportingDirectorId
    )
    .maybeSingle<InitialCareerGenerationRow>();

  if (careerGenerationError) {
    throw new Error(
      `Impossible de retrouver l’équipe générée pour ce Directeur Sportif : ${careerGenerationError.message}`
    );
  }

  if (careerGeneration?.team_id) {
    return careerGeneration.team_id;
  }

  throw new Error(
    "Aucune équipe n’est rattachée à ce Directeur Sportif. Terminez d’abord la création de votre carrière."
  );
}
