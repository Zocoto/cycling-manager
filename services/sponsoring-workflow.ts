import "server-only";

import { SPONSORS } from "@/data/sponsors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  GAMEPLAY_RULES,
  isSponsoringUnlocked,
} from "@/lib/gameplay-rules";
import {
  getOrCreateFutureSponsorOffersForAuthUser,
  type FutureSponsorOfferMode,
  type FutureSponsorSeason,
} from "@/services/future-sponsor-offers";
import {
  getOrCreateSponsorOffersForAuthUser,
  type PersistedSponsorOffer,
} from "@/services/persisted-sponsor-offers";
import { ensureAndLoadSponsorObjectives } from "@/services/persisted-sponsor-objectives";
import type { Sponsor } from "@/types/sponsor";

const FUTURE_SPONSORING_OPENING_DAY = 21;

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
  startSeasonId: string;
  startSeasonName: string;
  startGameYear: number;
  endGameYear: number;
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

export type FutureSponsoringState =
  | {
      kind: "locked";
      currentDayNumber: number;
      opensOnDay: number;
      targetGameYear: number;
      targetSeasonName: string;
    }
  | {
      kind: "reputation-locked";
      currentReputation: number;
      requiredReputation: number;
      targetGameYear: number;
      targetSeasonName: string;
    }
  | {
      kind: "continuing";
      targetGameYear: number;
      targetSeasonName: string;
      contractEndGameYear: number;
    }
  | {
      kind: "offers";
      mode: FutureSponsorOfferMode;
      season: FutureSponsorSeason;
      offers: PersistedSponsorOffer[];
    }
  | {
      kind: "jersey-selection";
      mode: FutureSponsorOfferMode;
      season: FutureSponsorSeason;
      contract: PersistedSponsorContract;
    }
  | {
      kind: "planned";
      mode: FutureSponsorOfferMode;
      season: FutureSponsorSeason;
      contract: PersistedSponsorContract;
    };

export type SponsoringState =
  | {
      kind: "onboarding";
    }
  | {
      kind: "locked";
      currentReputation: number;
      requiredReputation: number;
    }
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
      future: FutureSponsoringState;
    }
  | {
      kind: "terminated";
      contract: PersistedSponsorContract;
      future: FutureSponsoringState;
    };

type SupabaseAdminClient = ReturnType<
  typeof createSupabaseAdminClient
>;

type SportingDirectorRow = {
  id: string;
  reputation_points: number;
};

type TeamAssignmentRow = {
  team_id: string;
};

type InitialCareerGenerationRow = {
  team_id: string;
};

type ActiveSeasonRow = {
  id: string;
  game_year: number;
  name: string;
  starts_on: string;
  ends_on: string;
  current_day_number: number | null;
};

type SeasonRow = {
  id: string;
  game_year: number;
  name: string;
};

type SponsorContractRow = {
  id: string;
  sponsor_id: string;
  sponsor_offer_id: string | null;
  start_season_id: string;
  budget_per_season: number | string;
  currency_code: string;
  contract_duration_seasons: number;
  status: SponsorContractStatus;
  selected_jersey_id: string | null;
  selected_jersey_style: SponsorJerseyStyle | null;
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

export async function getSponsoringStateForAuthUser(
  authUserId: string
): Promise<SponsoringState> {
  const normalizedAuthUserId = authUserId.trim();

  if (!normalizedAuthUserId) {
    throw new Error(
      "L’identifiant du joueur authentifié est obligatoire."
    );
  }

  const supabase = createSupabaseAdminClient();

  const {
    data: sportingDirector,
    error: sportingDirectorError,
  } = await supabase
    .from("sporting_directors")
    .select("id, reputation_points")
    .eq("auth_user_id", normalizedAuthUserId)
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

  const teamId = await resolveCurrentTeamId({
    supabase,
    sportingDirectorId: sportingDirector.id,
  });

  if (!teamId) {
    return { kind: "onboarding" };
  }

  const activeSeason = await resolveActiveSeason(supabase);
  const nextGameYear = activeSeason.game_year + 1;
  const targetSeasonName = `Saison ${nextGameYear}`;

  const currentPlannedContract =
    await loadPrincipalContract({
      supabase,
      teamId,
      status: "planned",
      startSeasonId: activeSeason.id,
    });

  if (currentPlannedContract) {
    return {
      kind: "jersey-selection",
      contract: await hydrateSponsorContract({
        supabase,
        contractRow: currentPlannedContract,
        teamReputationPoints: sportingDirector.reputation_points,
      }),
    };
  }

  const activeContractRow = await loadPrincipalContract({
    supabase,
    teamId,
    status: "active",
  });

  if (activeContractRow) {
    const activeContract = await hydrateSponsorContract({
      supabase,
      contractRow: activeContractRow,
      teamReputationPoints: sportingDirector.reputation_points,
    });

    return {
      kind: "active",
      contract: activeContract,
      future: await resolveFutureSponsoringState({
        supabase,
        authUserId: normalizedAuthUserId,
        teamId,
        activeSeason,
        currentContract: activeContract,
        terminatedContract: null,
        nextGameYear,
        targetSeasonName,
        currentReputation: sportingDirector.reputation_points,
      }),
    };
  }

  const terminatedContractRow =
    await loadTerminatedPrincipalContractForSeason({
      supabase,
      teamId,
      seasonId: activeSeason.id,
    });

  if (terminatedContractRow) {
    const terminatedContract =
      await hydrateSponsorContract({
        supabase,
        contractRow: terminatedContractRow,
        teamReputationPoints: sportingDirector.reputation_points,
      });

    return {
      kind: "terminated",
      contract: terminatedContract,
      future: await resolveFutureSponsoringState({
        supabase,
        authUserId: normalizedAuthUserId,
        teamId,
        activeSeason,
        currentContract: null,
        terminatedContract,
        nextGameYear,
        targetSeasonName,
        currentReputation: sportingDirector.reputation_points,
      }),
    };
  }

  if (!isSponsoringUnlocked(sportingDirector.reputation_points)) {
    return {
      kind: "locked",
      currentReputation: sportingDirector.reputation_points,
      requiredReputation:
        GAMEPLAY_RULES.sponsoringUnlockReputation,
    };
  }

  const offers = await getOrCreateSponsorOffersForAuthUser(
    normalizedAuthUserId
  );

  return {
    kind: "offers",
    offers,
  };
}

async function resolveFutureSponsoringState({
  supabase,
  authUserId,
  teamId,
  activeSeason,
  currentContract,
  terminatedContract,
  nextGameYear,
  targetSeasonName,
  currentReputation,
}: {
  supabase: SupabaseAdminClient;
  authUserId: string;
  teamId: string;
  activeSeason: ActiveSeasonRow & {
    current_day_number: number;
  };
  currentContract: PersistedSponsorContract | null;
  terminatedContract: PersistedSponsorContract | null;
  nextGameYear: number;
  targetSeasonName: string;
  currentReputation: number;
}): Promise<FutureSponsoringState> {
  const targetSeason = await loadSeasonByGameYear({
    supabase,
    gameYear: nextGameYear,
  });

  if (targetSeason) {
    const futureContractRow = await loadPrincipalContract({
      supabase,
      teamId,
      status: "planned",
      startSeasonId: targetSeason.id,
    });

    if (futureContractRow) {
      const futureContract = await hydrateSponsorContract({
        supabase,
        contractRow: futureContractRow,
        teamReputationPoints: currentReputation,
      });

      const mode: FutureSponsorOfferMode = currentContract
        ? "renewal"
        : "replacement";

      if (
        !futureContract.selectedJerseyId ||
        !futureContract.selectedJerseyStyle
      ) {
        return {
          kind: "jersey-selection",
          mode,
          season: toFutureSeason(targetSeason),
          contract: futureContract,
        };
      }

      return {
        kind: "planned",
        mode,
        season: toFutureSeason(targetSeason),
        contract: futureContract,
      };
    }
  }

  if (
    currentContract &&
    currentContract.endGameYear >= nextGameYear
  ) {
    return {
      kind: "continuing",
      targetGameYear: nextGameYear,
      targetSeasonName,
      contractEndGameYear: currentContract.endGameYear,
    };
  }

  if (
    activeSeason.current_day_number <
    FUTURE_SPONSORING_OPENING_DAY
  ) {
    return {
      kind: "locked",
      currentDayNumber: activeSeason.current_day_number,
      opensOnDay: FUTURE_SPONSORING_OPENING_DAY,
      targetGameYear: nextGameYear,
      targetSeasonName,
    };
  }

  if (!isSponsoringUnlocked(currentReputation)) {
    return {
      kind: "reputation-locked",
      currentReputation,
      requiredReputation:
        GAMEPLAY_RULES.sponsoringUnlockReputation,
      targetGameYear: nextGameYear,
      targetSeasonName,
    };
  }

  const mode: FutureSponsorOfferMode = currentContract
    ? "renewal"
    : "replacement";

  const offerPackage =
    await getOrCreateFutureSponsorOffersForAuthUser({
      authUserId,
      teamId,
      activeSeason: {
        id: activeSeason.id,
        name: activeSeason.name,
        gameYear: activeSeason.game_year,
        currentDayNumber:
          activeSeason.current_day_number,
        startsOn: activeSeason.starts_on,
        endsOn: activeSeason.ends_on,
      },
      mode,
      currentSponsorCatalogKey:
        currentContract?.sponsor.id ?? null,
      excludedSponsorCatalogKey:
        terminatedContract?.sponsor.id ?? null,
    });

  return {
    kind: "offers",
    mode: offerPackage.mode,
    season: offerPackage.season,
    offers: offerPackage.offers,
  };
}

async function loadPrincipalContract({
  supabase,
  teamId,
  status,
  startSeasonId,
}: {
  supabase: SupabaseAdminClient;
  teamId: string;
  status: "planned" | "active";
  startSeasonId?: string;
}): Promise<SponsorContractRow | null> {
  let query = supabase
    .from("team_sponsor_contracts")
    .select(contractSelection())
    .eq("team_id", teamId)
    .eq("role", "principal")
    .eq("status", status);

  if (startSeasonId) {
    query = query.eq("start_season_id", startSeasonId);
  }

  const { data: contractRows, error: contractError } =
    await query
      .order("created_at", { ascending: false })
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
  const { data: contractRows, error: contractError } =
    await supabase
      .from("team_sponsor_contracts")
      .select(contractSelection())
      .eq("team_id", teamId)
      .eq("role", "principal")
      .eq("status", "terminated")
      .eq("termination_season_id", seasonId)
      .order("terminated_at", { ascending: false })
      .limit(1)
      .returns<SponsorContractRow[]>();

  if (contractError) {
    throw new Error(
      `Impossible de charger l’historique du contrat sponsor : ${contractError.message}`
    );
  }

  return contractRows?.[0] ?? null;
}

function contractSelection(): string {
  return `
    id,
    sponsor_id,
    sponsor_offer_id,
    start_season_id,
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
  `;
}

async function hydrateSponsorContract({
  supabase,
  contractRow,
  teamReputationPoints,
}: {
  supabase: SupabaseAdminClient;
  contractRow: SponsorContractRow;
  teamReputationPoints: number;
}): Promise<PersistedSponsorContract> {
  const [sponsorRegistryResult, startSeasonResult] =
    await Promise.all([
      supabase
        .from("sponsors")
        .select("catalog_key")
        .eq("id", contractRow.sponsor_id)
        .maybeSingle<SponsorRegistryRow>(),
      supabase
        .from("seasons")
        .select("id, game_year, name")
        .eq("id", contractRow.start_season_id)
        .maybeSingle<SeasonRow>(),
    ]);

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

  if (startSeasonResult.error || !startSeasonResult.data) {
    throw new Error(
      "Impossible de retrouver la saison de départ du contrat sponsor."
    );
  }

  const sponsorCatalogKey =
    sponsorRegistryResult.data.catalog_key;

  const sponsor = SPONSORS.find(
    (catalogSponsor) =>
      catalogSponsor.id === sponsorCatalogKey
  );

  if (!sponsor) {
    throw new Error(
      `Le sponsor "${sponsorCatalogKey}" existe dans Supabase mais pas dans le catalogue TypeScript.`
    );
  }

  const objectives = contractRow.sponsor_offer_id
    ? (
        await ensureAndLoadSponsorObjectives({
          supabase,
          seasonId: startSeasonResult.data.id,
          teamReputationPoints,
          offers: [
            {
              offerId: contractRow.sponsor_offer_id,
              sponsor,
            },
          ],
        })
      )
        .get(contractRow.sponsor_offer_id)
        ?.map((objective) => ({
          id: objective.id,
          name: objective.name,
          description: objective.description,
          displayOrder: objective.displayOrder,
          status: objective.status,
        })) ?? []
    : [];

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

  const startSeason = startSeasonResult.data;
  const endGameYear =
    startSeason.game_year +
    contractRow.contract_duration_seasons -
    1;

  return {
    id: contractRow.id,
    sponsor,
    sponsorOfferId: contractRow.sponsor_offer_id,
    budgetPerSeason,
    currencyCode: contractRow.currency_code,
    contractDurationSeasons:
      contractRow.contract_duration_seasons,
    status: contractRow.status,
    startSeasonId: startSeason.id,
    startSeasonName: startSeason.name,
    startGameYear: startSeason.game_year,
    endGameYear,
    selectedJerseyId: contractRow.selected_jersey_id,
    selectedJerseyStyle:
      contractRow.selected_jersey_style,
    signedAt: contractRow.signed_at,
    activatedAt: contractRow.activated_at,
    completedAt: contractRow.completed_at,
    terminatedAt: contractRow.terminated_at,
    terminationReason: contractRow.termination_reason,
    reputationPenalty,
    objectives,
  };
}

async function resolveActiveSeason(
  supabase: SupabaseAdminClient
): Promise<ActiveSeasonRow & { current_day_number: number }> {
  const { data: activeSeason, error: activeSeasonError } =
    await supabase
      .from("seasons")
      .select(
        "id, game_year, name, starts_on, ends_on, current_day_number"
      )
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

  if (
    activeSeason.current_day_number === null ||
    activeSeason.current_day_number < 1 ||
    activeSeason.current_day_number > 28
  ) {
    throw new Error(
      "Le jour courant de la saison active est invalide."
    );
  }

  return {
    ...activeSeason,
    current_day_number: activeSeason.current_day_number,
  };
}

async function loadSeasonByGameYear({
  supabase,
  gameYear,
}: {
  supabase: SupabaseAdminClient;
  gameYear: number;
}): Promise<SeasonRow | null> {
  const { data: season, error } = await supabase
    .from("seasons")
    .select("id, game_year, name")
    .eq("game_year", gameYear)
    .maybeSingle<SeasonRow>();

  if (error) {
    throw new Error(
      `Impossible de rechercher la saison ${gameYear} : ${error.message}`
    );
  }

  return season;
}

function toFutureSeason(
  season: SeasonRow
): FutureSponsorSeason {
  return {
    id: season.id,
    name: season.name,
    gameYear: season.game_year,
  };
}

async function resolveCurrentTeamId({
  supabase,
  sportingDirectorId,
}: {
  supabase: SupabaseAdminClient;
  sportingDirectorId: string;
}): Promise<string | null> {
  const { data: assignmentRows, error: assignmentError } =
    await supabase
      .from("team_manager_assignments")
      .select("team_id")
      .eq("sporting_director_id", sportingDirectorId)
      .eq("role", "general_manager")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .returns<TeamAssignmentRow[]>();

  if (assignmentError) {
    throw new Error(
      `Impossible de charger l’affectation de l’équipe : ${assignmentError.message}`
    );
  }

  const assignedTeamId = assignmentRows?.[0]?.team_id;

  if (assignedTeamId) {
    return assignedTeamId;
  }

  const { data: careerGeneration, error: careerGenerationError } =
    await supabase
      .from("initial_career_generations")
      .select("team_id")
      .eq("sporting_director_id", sportingDirectorId)
      .maybeSingle<InitialCareerGenerationRow>();

  if (careerGenerationError) {
    throw new Error(
      `Impossible de retrouver l’équipe générée pour ce Directeur Sportif : ${careerGenerationError.message}`
    );
  }

  if (careerGeneration?.team_id) {
    return careerGeneration.team_id;
  }

  return null;
}
