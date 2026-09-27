import "server-only";

import { SPONSORS } from "@/data/sponsors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  GAMEPLAY_RULES,
  isFutureSponsoringWindowOpen,
  isSponsoringUnlocked,
} from "@/lib/gameplay-rules";
import { ensureContinuingSponsorObjectivePlan } from "@/services/continuing-sponsor-objectives";
import {
  getOrCreateFutureSponsorOffersForAuthUser,
  type FutureSponsorOfferMode,
  type FutureSponsorSeason,
} from "@/services/future-sponsor-offers";
import type { PersistedSponsorOffer } from "@/services/persisted-sponsor-offers";
import { ensureAndLoadSponsorObjectives } from "@/services/persisted-sponsor-objectives";
import type { Sponsor } from "@/types/sponsor";
import type {
  SponsorObjectiveStatus,
  SponsorObjectiveTargetDetails,
} from "@/types/sponsor-objective";
import type { SponsorObjectiveAchievementLevel } from "@/lib/game/sponsor-objective-status";
import {
  resolveSponsorSportingPhilosophy,
  type SponsorSportingPhilosophy,
} from "@/lib/game/sponsor-philosophy";
import {
  calculateSponsorSatisfactionScore,
  isSponsorPerformanceSatisfactionEnabled,
} from "@/lib/game/sponsor-performance-satisfaction";
import type { SponsorBudgetHistoryPoint } from "@/lib/game/sponsor-budget-history";
import { getSponsorBudgetHistoryForTeam } from "@/services/sponsor-budget-history";



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
  status: SponsorObjectiveStatus;
  satisfactionPoints: number;
  targetDetails: SponsorObjectiveTargetDetails;
  currentValue: number | null;
  targetValue: number | null;
  progressStatus: "not_started" | "in_progress" | "achieved" | "failed" | null;
  achievementLevel: SponsorObjectiveAchievementLevel | null;
  partialSatisfactionPoints: number;
};

export type SponsorSatisfactionEvent = {
  id: string;
  eventType: "race_result" | "uci_ranking" | "pre_race_commitment";
  points: number;
  title: string;
  description: string;
  occurredAt: string;
};

export type PersistedSponsorContract = {
  id: string;
  sponsor: Sponsor;
  sportingPhilosophy: SponsorSportingPhilosophy;
  sponsorOfferId: string | null;
  budgetPerSeason: number;
  currencyCode: string;
  contractDurationSeasons: number;
  status: SponsorContractStatus;
  startSeasonId: string;
  startSeasonName: string;
  startGameYear: number;
  objectiveSeasonId: string;
  endGameYear: number;
  selectedJerseyId: string | null;
  selectedJerseyStyle: SponsorJerseyStyle | null;
  pendingJerseyId: string | null;
  pendingJerseyStyle: SponsorJerseyStyle | null;
  pendingJerseySeasonId: string | null;
  signedAt: string | null;
  activatedAt: string | null;
  completedAt: string | null;
  terminatedAt: string | null;
  terminationReason: string | null;
  objectiveSatisfactionScore: number;
  performanceSatisfactionEnabled: boolean;
  performanceSatisfactionBonus: number;
  commitmentSatisfactionBonus: number;
  satisfactionEvents: SponsorSatisfactionEvent[];
  satisfactionScore: number;
  reputationPenalty: number;
  reputationInvestmentCost: number;
  reputationBudgetBonusPercent: number;
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
      contract: PersistedSponsorContract;
      jerseySelectionOpen: boolean;
      objectivePlan: PersistedSponsorOffer | null;
      renewalBudgetIsFinal: boolean;
    }
  | {
      kind: "offers";
      mode: FutureSponsorOfferMode;
      season: FutureSponsorSeason;
      offers: PersistedSponsorOffer[];
      renewalBudgetIsFinal: boolean;
    }
  | {
      kind: "jersey-selection";
      mode: FutureSponsorOfferMode;
      season: FutureSponsorSeason;
      contract: PersistedSponsorContract;
      isRenewal: boolean;
      renewalBudgetIsFinal: boolean;
    }
  | {
      kind: "planned";
      mode: FutureSponsorOfferMode;
      season: FutureSponsorSeason;
      contract: PersistedSponsorContract;
      isRenewal: boolean;
      renewalBudgetIsFinal: boolean;
    };

type SponsoringTeamState =
  | {
      kind: "locked";
      currentReputation: number;
      requiredReputation: number;
    }
  | {
      kind: "amateur-qualified";
      currentSeasonName: string;
      future: FutureSponsoringState;
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

export type SponsoringState =
  | {
      kind: "onboarding";
    }
  | (SponsoringTeamState & {
      budgetHistory: SponsorBudgetHistoryPoint[];
    });

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
  objective_season_id: string | null;
  budget_per_season: number | string;
  currency_code: string;
  contract_duration_seasons: number;
  status: SponsorContractStatus;
  selected_jersey_id: string | null;
  selected_jersey_style: SponsorJerseyStyle | null;
  pending_jersey_id: string | null;
  pending_jersey_style: SponsorJerseyStyle | null;
  pending_jersey_season_id: string | null;
  signed_at: string | null;
  activated_at: string | null;
  completed_at: string | null;
  terminated_at: string | null;
  termination_reason: string | null;
  reputation_penalty: number;
  reputation_investment_cost: number;
  reputation_budget_bonus_percent: number;
  satisfaction_score: number;
};

type SponsorRegistryRow = {
  catalog_key: string;
};

type SponsorObjectiveProgressRow = {
  sponsor_objective_id: string;
  current_value: number | string;
  status: "not_started" | "in_progress" | "achieved" | "failed";
  details: Record<string, unknown> | null;
};

type SponsorObjectiveProgress = {
  currentValue: number;
  targetValue: number | null;
  status: SponsorObjectiveProgressRow["status"];
  achievementLevel: SponsorObjectiveAchievementLevel | null;
  partialSatisfactionPoints: number;
};

type SponsorSatisfactionEventRow = {
  id: string;
  event_type: SponsorSatisfactionEvent["eventType"];
  points: number;
  title: string;
  description: string;
  occurred_at: string;
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

  const [activeSeason, budgetHistory] = await Promise.all([
    resolveActiveSeason(supabase),
    getSponsorBudgetHistoryForTeam(teamId, supabase),
  ]);
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
      budgetHistory,
      contract: await hydrateSponsorContract({
        supabase,
        contractRow: currentPlannedContract,
        currentGameYear: activeSeason.game_year,
        teamReputationPoints: sportingDirector.reputation_points,
        neutralizeMissingObjectives: true,
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
      currentGameYear: activeSeason.game_year,
      teamReputationPoints: sportingDirector.reputation_points,
      neutralizeMissingObjectives: true,
    });

    return {
      kind: "active",
      budgetHistory,
      contract: activeContract,
      future: await resolveFutureSponsoringState({
        supabase,
        authUserId: normalizedAuthUserId,
        sportingDirectorId: sportingDirector.id,
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
        currentGameYear: activeSeason.game_year,
        teamReputationPoints: sportingDirector.reputation_points,
        neutralizeMissingObjectives: true,
      });

    return {
      kind: "terminated",
      budgetHistory,
      contract: terminatedContract,
      future: await resolveFutureSponsoringState({
        supabase,
        authUserId: normalizedAuthUserId,
        sportingDirectorId: sportingDirector.id,
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
      budgetHistory,
      currentReputation: sportingDirector.reputation_points,
      requiredReputation:
        GAMEPLAY_RULES.sponsoringUnlockReputation,
    };
  }

  return {
    kind: "amateur-qualified",
    budgetHistory,
    currentSeasonName: activeSeason.name,
    future: await resolveFutureSponsoringState({
      supabase,
      authUserId: normalizedAuthUserId,
      sportingDirectorId: sportingDirector.id,
      teamId,
      activeSeason,
      currentContract: null,
      terminatedContract: null,
      nextGameYear,
      targetSeasonName,
      currentReputation: sportingDirector.reputation_points,
    }),
  };
}

async function resolveFutureSponsoringState({
  supabase,
  authUserId,
  sportingDirectorId,
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
  sportingDirectorId: string;
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
        currentGameYear: activeSeason.game_year,
        teamReputationPoints: currentReputation,
        neutralizeMissingObjectives: false,
      });

      const mode = resolveFutureSponsorOfferMode({
        currentContract,
        terminatedContract,
      });
      const isRenewal =
        currentContract?.sponsor.id === futureContract.sponsor.id;
      const renewalBudgetIsFinal =
        activeSeason.current_day_number >=
        GAMEPLAY_RULES.sponsorRenewalBudgetFinalizationDay;

      if (
        !futureContract.selectedJerseyId ||
        !futureContract.selectedJerseyStyle
      ) {
        return {
          kind: "jersey-selection",
          mode,
          season: toFutureSeason(targetSeason),
          contract: futureContract,
          isRenewal,
          renewalBudgetIsFinal,
        };
      }

      return {
        kind: "planned",
        mode,
        season: toFutureSeason(targetSeason),
        contract: futureContract,
        isRenewal,
        renewalBudgetIsFinal,
      };
    }
  }

  if (
    currentContract &&
    currentContract.endGameYear >= nextGameYear
  ) {
    const jerseySelectionOpen = isFutureSponsoringWindowOpen(
      activeSeason.current_day_number,
    );
    const objectivePlan =
      jerseySelectionOpen && targetSeason && nextGameYear >= 3
        ? await ensureContinuingSponsorObjectivePlan({
            supabase,
            sportingDirectorId,
            teamId,
            teamReputationPoints: currentReputation,
            contract: currentContract,
            targetSeason,
          })
        : null;

    return {
      kind: "continuing",
      targetGameYear: nextGameYear,
      targetSeasonName,
      contractEndGameYear: currentContract.endGameYear,
      contract: currentContract,
      jerseySelectionOpen,
      objectivePlan,
      renewalBudgetIsFinal:
        activeSeason.current_day_number >=
        GAMEPLAY_RULES.sponsorRenewalBudgetFinalizationDay,
    };
  }

  if (!isFutureSponsoringWindowOpen(activeSeason.current_day_number)) {
    return {
      kind: "locked",
      currentDayNumber: activeSeason.current_day_number,
      opensOnDay: GAMEPLAY_RULES.futureSponsoringOpeningDay,
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

  const mode = resolveFutureSponsorOfferMode({
    currentContract,
    terminatedContract,
  });

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
      currentSponsorBudget:
        currentContract?.budgetPerSeason ?? null,
      currentSponsorSatisfactionScore:
        currentContract?.satisfactionScore ?? null,
      excludedSponsorCatalogKey:
        terminatedContract?.sponsor.id ?? null,
    });

  return {
    kind: "offers",
    mode: offerPackage.mode,
    season: offerPackage.season,
    offers: offerPackage.offers,
    renewalBudgetIsFinal:
      activeSeason.current_day_number >=
      GAMEPLAY_RULES.sponsorRenewalBudgetFinalizationDay,
  };
}

function resolveFutureSponsorOfferMode({
  currentContract,
  terminatedContract,
}: {
  currentContract: PersistedSponsorContract | null;
  terminatedContract: PersistedSponsorContract | null;
}): FutureSponsorOfferMode {
  if (currentContract) {
    return "renewal";
  }

  if (terminatedContract) {
    return "replacement";
  }

  return "first-contract";
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
    objective_season_id,
    budget_per_season,
    currency_code,
    contract_duration_seasons,
    status,
    selected_jersey_id,
    selected_jersey_style,
    pending_jersey_id,
    pending_jersey_style,
    pending_jersey_season_id,
    signed_at,
    activated_at,
    completed_at,
    terminated_at,
    termination_reason,
    reputation_penalty,
    reputation_investment_cost,
    reputation_budget_bonus_percent,
    satisfaction_score
  `;
}

async function hydrateSponsorContract({
  supabase,
  contractRow,
  currentGameYear,
  teamReputationPoints,
  neutralizeMissingObjectives,
}: {
  supabase: SupabaseAdminClient;
  contractRow: SponsorContractRow;
  currentGameYear: number;
  teamReputationPoints: number;
  neutralizeMissingObjectives: boolean;
}): Promise<PersistedSponsorContract> {
  const satisfactionSeasonId =
    contractRow.objective_season_id ?? contractRow.start_season_id;
  const [sponsorRegistryResult, startSeasonResult, satisfactionEventsResult] =
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
      supabase
        .from("sponsor_satisfaction_events")
        .select("id, event_type, points, title, description, occurred_at")
        .eq("team_sponsor_contract_id", contractRow.id)
        .eq("season_id", satisfactionSeasonId)
        .order("occurred_at", { ascending: false })
        .returns<SponsorSatisfactionEventRow[]>(),
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

  if (satisfactionEventsResult.error) {
    throw new Error(
      `Impossible de charger les gains sportifs de satisfaction : ${satisfactionEventsResult.error.message}`,
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

  let objectives: SponsorContractObjective[] = [];
  let sportingPhilosophy = resolveSponsorSportingPhilosophy(sponsor.id);
  let progressByObjectiveId = new Map<string, SponsorObjectiveProgress>();

  if (contractRow.sponsor_offer_id) {
    const objectiveSeasonId = satisfactionSeasonId;
    const objectiveContext = {
      supabase,
      seasonId: objectiveSeasonId,
      teamReputationPoints,
      offers: [
        {
          offerId: contractRow.sponsor_offer_id,
          sponsor,
          proposedBudget: Number(contractRow.budget_per_season),
          neutralizeMissingObjectives,
        },
      ],
    } as const;
    let objectivesByOffer =
      await ensureAndLoadSponsorObjectives(objectiveContext);

    if (contractRow.status === "active") {
      const { error: evaluationError } = await supabase.rpc(
        "evaluate_sponsor_objectives_for_contract",
        {
          p_contract_id: contractRow.id,
          p_finalize: false,
        },
      );

      if (evaluationError) {
        throw new Error(
          `Impossible d’évaluer les objectifs sponsor : ${evaluationError.message}`,
        );
      }

      [objectivesByOffer, progressByObjectiveId] = await Promise.all([
        ensureAndLoadSponsorObjectives(objectiveContext),
        loadSponsorObjectiveProgress({
          supabase,
          contractId: contractRow.id,
          objectiveIds: (
            objectivesByOffer.get(contractRow.sponsor_offer_id) ?? []
          ).map((objective) => objective.id),
        }),
      ]);
    } else {
      progressByObjectiveId = await loadSponsorObjectiveProgress({
        supabase,
        contractId: contractRow.id,
        objectiveIds: (
          objectivesByOffer.get(contractRow.sponsor_offer_id) ?? []
        ).map((objective) => objective.id),
      });
    }

    const persistedObjectives =
      objectivesByOffer.get(contractRow.sponsor_offer_id) ?? [];
    sportingPhilosophy =
      persistedObjectives.find(
        (objective) => objective.targetDetails.sportingPhilosophy,
      )?.targetDetails.sportingPhilosophy ?? sportingPhilosophy;
    objectives = persistedObjectives.map((objective) => {
      const progress = progressByObjectiveId.get(objective.id);

      return {
        id: objective.id,
        name: objective.name,
        description: objective.description,
        displayOrder: objective.displayOrder,
        status: objective.status,
        satisfactionPoints: objective.satisfactionPoints,
        targetDetails: objective.targetDetails,
        currentValue: progress?.currentValue ?? null,
        targetValue: progress?.targetValue ?? null,
        progressStatus: progress?.status ?? null,
        achievementLevel: progress?.achievementLevel ?? null,
        partialSatisfactionPoints: progress?.partialSatisfactionPoints ?? 0,
      };
    });
  }

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

  const objectiveSatisfactionScore = objectives.reduce(
    (total, objective) =>
      total +
      (objective.status === "completed"
        ? objective.satisfactionPoints
        : 0),
    0,
  );
  const satisfactionEvents = (satisfactionEventsResult.data ?? []).map(
    (event): SponsorSatisfactionEvent => ({
      id: event.id,
      eventType: event.event_type,
      points: Number(event.points),
      title: event.title,
      description: event.description,
      occurredAt: event.occurred_at,
    }),
  );
  const performanceSatisfactionBonus = satisfactionEvents.reduce(
    (total, event) => total + (event.eventType === "pre_race_commitment" ? 0 : event.points),
    0,
  );
  const commitmentSatisfactionBonus = satisfactionEvents.reduce(
    (total, event) => total + (event.eventType === "pre_race_commitment" ? event.points : 0),
    0,
  );
  const performanceSatisfactionEnabled =
    isSponsorPerformanceSatisfactionEnabled(currentGameYear);
  const satisfactionScore = calculateSponsorSatisfactionScore({
    objectivePoints: objectiveSatisfactionScore,
    performancePoints: performanceSatisfactionBonus,
    commitmentPoints: commitmentSatisfactionBonus,
    gameYear: currentGameYear,
  });
  return {
    id: contractRow.id,
    sponsor,
    sportingPhilosophy,
    sponsorOfferId: contractRow.sponsor_offer_id,
    budgetPerSeason,
    currencyCode: contractRow.currency_code,
    contractDurationSeasons:
      contractRow.contract_duration_seasons,
    status: contractRow.status,
    startSeasonId: startSeason.id,
    startSeasonName: startSeason.name,
    startGameYear: startSeason.game_year,
    objectiveSeasonId:
      contractRow.objective_season_id ?? startSeason.id,
    endGameYear,
    selectedJerseyId: contractRow.selected_jersey_id,
    selectedJerseyStyle:
      contractRow.selected_jersey_style,
    pendingJerseyId: contractRow.pending_jersey_id,
    pendingJerseyStyle: contractRow.pending_jersey_style,
    pendingJerseySeasonId: contractRow.pending_jersey_season_id,
    signedAt: contractRow.signed_at,
    activatedAt: contractRow.activated_at,
    completedAt: contractRow.completed_at,
    terminatedAt: contractRow.terminated_at,
    terminationReason: contractRow.termination_reason,
    reputationPenalty,
    reputationInvestmentCost: Number(contractRow.reputation_investment_cost ?? 0),
    reputationBudgetBonusPercent: Number(
      contractRow.reputation_budget_bonus_percent ?? 0,
    ),
    objectiveSatisfactionScore,
    performanceSatisfactionEnabled,
    performanceSatisfactionBonus,
    commitmentSatisfactionBonus,
    satisfactionEvents,
    satisfactionScore,
    objectives,
  };
}

async function loadSponsorObjectiveProgress({
  supabase,
  contractId,
  objectiveIds,
}: {
  supabase: SupabaseAdminClient;
  contractId: string;
  objectiveIds: string[];
}): Promise<Map<string, SponsorObjectiveProgress>> {
  if (objectiveIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("objective_progress")
    .select("sponsor_objective_id, current_value, status, details")
    .eq("team_sponsor_contract_id", contractId)
    .in("sponsor_objective_id", objectiveIds)
    .returns<SponsorObjectiveProgressRow[]>();

  if (error) {
    throw new Error(
      `Impossible de retrouver la progression des objectifs sponsor : ${error.message}`,
    );
  }

  return new Map(
    (data ?? []).flatMap((progress) => {
      const currentValue = Number(progress.current_value);

      if (!Number.isFinite(currentValue)) {
        return [];
      }

      const targetValue = readFiniteNumber(progress.details?.targetValue);
      const partialSatisfactionPoints = Math.max(
        0,
        readFiniteNumber(progress.details?.partialSatisfactionPoints) ?? 0,
      );
      const achievementLevel = readAchievementLevel(
        progress.details?.achievementLevel,
      );

      return [[
        progress.sponsor_objective_id,
        {
          currentValue,
          targetValue,
          status: progress.status,
          achievementLevel,
          partialSatisfactionPoints,
        },
      ] as const];
    }),
  );
}

function readFiniteNumber(value: unknown): number | null {
  const numericValue =
    typeof value === "number" || typeof value === "string"
      ? Number(value)
      : Number.NaN;

  return Number.isFinite(numericValue) ? numericValue : null;
}

function readAchievementLevel(
  value: unknown,
): SponsorObjectiveAchievementLevel | null {
  return value === "full" || value === "partial" || value === "missed"
    ? value
    : null;
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
