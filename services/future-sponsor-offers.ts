import "server-only";

import { SPONSORS } from "@/data/sponsors";
import {
  GAMEPLAY_RULES,
  isFutureSponsoringWindowOpen,
  isSponsoringUnlocked,
} from "@/lib/gameplay-rules";
import type { TeamSponsorCountryAffinity } from "@/lib/game/sponsor-nationality-affinity";
import { isSponsorEligibleForReputation } from "@/lib/game/sponsor-prestige";
import {
  getSponsorNegotiationBudgetCeiling,
  isSponsorObjectiveDifficulty,
  type SponsorObjectiveDifficulty,
} from "@/lib/game/sponsor-negotiation";
import { calculateSponsorRenewalBudget } from "@/lib/game/sponsor-renewal-budget";
import { resolveSponsorSportingPhilosophy } from "@/lib/game/sponsor-philosophy";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  ensureAndLoadSponsorObjectives,
  type SponsorOfferObjectiveContext,
} from "@/services/persisted-sponsor-objectives";
import type {
  PersistedSponsorOffer,
  SponsorOfferStatus,
} from "@/services/persisted-sponsor-offers";
import { generateSponsorProposals } from "@/services/sponsor-proposals";
import { loadTeamSponsorCountryAffinity } from "@/services/sponsor-team-affinity";
import type { Sponsor } from "@/types/sponsor";


const DEFAULT_PROPOSAL_COUNT = 3;
const RENEWAL_ALTERNATIVE_COUNT = 2;
const SPONSOR_OFFER_GENERATION_VERSION = 6;
const PREFERRED_SPONSOR_OFFER_GENERATION_VERSION = 7;

export type FutureSponsorOfferMode =
  | "renewal"
  | "replacement"
  | "first-contract";

export type FutureSponsorSeason = {
  id: string;
  name: string;
  gameYear: number;
};

export type FutureSponsorOfferPackage = {
  mode: FutureSponsorOfferMode;
  season: FutureSponsorSeason;
  offers: PersistedSponsorOffer[];
};

export type FutureSponsorOfferRequest = {
  authUserId: string;
  teamId: string;
  activeSeason: {
    id: string;
    name: string;
    gameYear: number;
    currentDayNumber: number;
    startsOn: string;
    endsOn: string;
  };
  mode: FutureSponsorOfferMode;
  currentSponsorCatalogKey: string | null;
  currentSponsorBudget: number | null;
  currentSponsorSatisfactionScore: number | null;
  excludedSponsorCatalogKey: string | null;
};

type SupabaseAdminClient = ReturnType<
  typeof createSupabaseAdminClient
>;

type SportingDirectorRow = {
  id: string;
  reputation_points: number;
  country_id: string | null;
};

type SeasonRow = {
  id: string;
  game_year: number;
  name: string;
  starts_on: string;
  ends_on: string;
  status: "planned" | "active" | "completed" | "cancelled";
  current_day_number: number | null;
};

type TeamSeasonRow = {
  registration_country_id: string;
  display_name: string;
  short_name: string | null;
  currency_code: string;
};

type SponsorRegistryRow = {
  id: string;
  catalog_key: string;
};

type SponsorOfferRow = {
  id: string;
  sponsor_id: string;
  budget_per_season: number | string;
  base_budget_per_season: number | string;
  negotiation_budget_ceiling: number | string;
  objective_difficulty: SponsorObjectiveDifficulty;
  contract_duration_seasons: number;
  status: SponsorOfferStatus;
  generation_version: number;
};

type SponsorContractRow = {
  sponsor_id: string;
  start_season_id: string;
  contract_duration_seasons: number;
  status: "planned" | "active";
};

type ContractStartSeasonRow = {
  id: string;
  game_year: number;
};

type GeneratedFutureProposal = {
  sponsor: Sponsor;
  proposedBudget: number;
  contractDurationSeasons: number;
  isRenewal: boolean;
};

type ReservedSponsorOfferRow = {
  sponsor_id: string;
};

export async function getOrCreateFutureSponsorOffersForAuthUser({
  authUserId,
  teamId,
  activeSeason,
  mode,
  currentSponsorCatalogKey,
  currentSponsorBudget,
  currentSponsorSatisfactionScore,
  excludedSponsorCatalogKey,
}: FutureSponsorOfferRequest): Promise<FutureSponsorOfferPackage> {
  const normalizedAuthUserId = authUserId.trim();
  const normalizedTeamId = teamId.trim();

  if (!normalizedAuthUserId) {
    throw new Error(
      "L’identifiant du joueur authentifié est obligatoire."
    );
  }

  if (!normalizedTeamId) {
    throw new Error(
      "L’identifiant de l’équipe est obligatoire."
    );
  }

  if (!isFutureSponsoringWindowOpen(activeSeason.currentDayNumber)) {
    throw new Error(
      `Les offres pour la saison suivante ouvrent au jour ${GAMEPLAY_RULES.futureSponsoringOpeningDay}.`
    );
  }

  const supabase = createSupabaseAdminClient();

  const {
    data: sportingDirector,
    error: sportingDirectorError,
  } = await supabase
    .from("sporting_directors")
    .select("id, reputation_points, country_id")
    .eq("auth_user_id", normalizedAuthUserId)
    .eq("status", "active")
    .maybeSingle<SportingDirectorRow>();

  if (sportingDirectorError || !sportingDirector) {
    throw new Error(
      "Impossible de retrouver le profil du Directeur Sportif."
    );
  }

  if (!isSponsoringUnlocked(sportingDirector.reputation_points)) {
    throw new Error(
      "Votre réputation ne permet pas encore d’accéder à de nouvelles offres de sponsoring."
    );
  }

  const targetSeason = await ensureNextSeason({
    supabase,
    activeSeason,
  });

  await ensureTeamSeason({
    supabase,
    teamId: normalizedTeamId,
    activeSeasonId: activeSeason.id,
    targetSeasonId: targetSeason.id,
  });

  const { data: existingOfferRows, error: existingOffersError } =
    await supabase
      .from("sponsor_offers")
      .select(
        `
          id,
          sponsor_id,
          budget_per_season,
          base_budget_per_season,
          negotiation_budget_ceiling,
          objective_difficulty,
          contract_duration_seasons,
          status,
          generation_version
        `
      )
      .eq("sporting_director_id", sportingDirector.id)
      .eq("season_id", targetSeason.id)
      .in("status", ["draft", "open"])
      .order("created_at", { ascending: true })
      .returns<SponsorOfferRow[]>();

  if (existingOffersError) {
    throw new Error(
      `Impossible de récupérer les offres de la saison suivante : ${existingOffersError.message}`
    );
  }

  const unavailableSponsorCatalogKeys =
    await getUnavailableSponsorCatalogKeysForGameYear({
      supabase,
      targetGameYear: targetSeason.gameYear,
      targetSeasonId: targetSeason.id,
      sportingDirectorId: sportingDirector.id,
    });
  const unavailableSponsorCatalogKeySet = new Set(
    unavailableSponsorCatalogKeys
  );
  const countryAffinity = await loadTeamSponsorCountryAffinity({
    supabase,
    teamId: normalizedTeamId,
    seasonId: activeSeason.id,
  });
  const generationVersion =
    countryAffinity.preferredSponsorIds.length > 0
      ? PREFERRED_SPONSOR_OFFER_GENERATION_VERSION
      : SPONSOR_OFFER_GENERATION_VERSION;

  if (
    existingOfferRows?.length === DEFAULT_PROPOSAL_COUNT &&
    existingOfferRows.every(
      (offer) => offer.generation_version >= generationVersion
    )
  ) {
    const existingOffers = await hydrateFutureSponsorOffersWithObjectives({
      supabase,
      seasonId: targetSeason.id,
      teamReputationPoints: sportingDirector.reputation_points,
      offerRows: existingOfferRows,
      renewalSponsorCatalogKey:
        mode === "renewal" ? currentSponsorCatalogKey : null,
    });

    if (
      existingOffers.every(
        (offer) =>
          isSponsorEligibleForReputation(
            offer.sponsor,
            sportingDirector.reputation_points
          ) &&
          (!unavailableSponsorCatalogKeySet.has(offer.sponsor.id) ||
            (mode === "renewal" &&
              offer.sponsor.id === currentSponsorCatalogKey))
      )
    ) {
      return {
        mode,
        season: targetSeason,
        offers: existingOffers,
      };
    }
  }

  if (existingOfferRows && existingOfferRows.length > 0) {
    const { error: withdrawIncompleteOffersError } = await supabase
      .from("sponsor_offers")
      .update({ status: "withdrawn" })
      .in(
        "id",
        existingOfferRows.map((offer) => offer.id)
      );

    if (withdrawIncompleteOffersError) {
      throw new Error(
        `Impossible de réinitialiser le lot incomplet d’offres : ${withdrawIncompleteOffersError.message}`
      );
    }
  }

  const generatedProposals = createFutureProposals({
    mode,
    directorReputation: sportingDirector.reputation_points,
    unavailableSponsorCatalogKeys,
    currentSponsorCatalogKey,
    currentSponsorBudget,
    currentSponsorSatisfactionScore,
    excludedSponsorCatalogKey,
    countryAffinity,
  });

  if (generatedProposals.length < DEFAULT_PROPOSAL_COUNT) {
    throw new Error(
      `Le catalogue ne contient que ${generatedProposals.length} sponsor(s) éligible(s), alors que ${DEFAULT_PROPOSAL_COUNT} offres sont nécessaires.`
    );
  }

  const proposedCatalogKeys = generatedProposals.map(
    (proposal) => proposal.sponsor.id
  );

  const {
    data: sponsorRegistryRows,
    error: sponsorRegistryError,
  } = await supabase
    .from("sponsors")
    .select("id, catalog_key")
    .in("catalog_key", proposedCatalogKeys)
    .eq("status", "active")
    .returns<SponsorRegistryRow[]>();

  if (sponsorRegistryError) {
    throw new Error(
      `Impossible de retrouver le registre des sponsors : ${sponsorRegistryError.message}`
    );
  }

  const sponsorRegistryByCatalogKey = new Map(
    (sponsorRegistryRows ?? []).map((sponsor) => [
      sponsor.catalog_key,
      sponsor.id,
    ])
  );

  const missingCatalogKeys = proposedCatalogKeys.filter(
    (catalogKey) => !sponsorRegistryByCatalogKey.has(catalogKey)
  );

  if (missingCatalogKeys.length > 0) {
    throw new Error(
      `Sponsors absents du registre Supabase : ${missingCatalogKeys.join(
        ", "
      )}. Lance npm run sponsors:sync.`
    );
  }

  const availableFrom = new Date().toISOString();

  const offerRowsToInsert = generatedProposals.map((proposal) => {
    const sponsorRegistryId = sponsorRegistryByCatalogKey.get(
      proposal.sponsor.id
    );

    if (!sponsorRegistryId) {
      throw new Error(
        `Identifiant Supabase introuvable pour ${proposal.sponsor.id}.`
      );
    }

    return {
      sponsor_id: sponsorRegistryId,
      season_id: targetSeason.id,
      sporting_director_id: sportingDirector.id,
      title: proposal.isRenewal
        ? `Renouvellement avec ${proposal.sponsor.name}`
        : `Proposition de ${proposal.sponsor.name}`,
      description: proposal.sponsor.description,
      budget_per_season: proposal.proposedBudget,
      base_budget_per_season: proposal.proposedBudget,
      negotiation_budget_ceiling: getSponsorNegotiationBudgetCeiling({
        baseBudget: proposal.proposedBudget,
        sponsorMaximumBudget: proposal.sponsor.budgetRange.max,
      }),
      objective_difficulty: "balanced",
      currency_code: "EUR",
      contract_duration_seasons:
        proposal.contractDurationSeasons,
      available_from: availableFrom,
      available_until: null,
      status: "open",
      generation_version: generationVersion,
    };
  });

  const {
    data: insertedOfferRows,
    error: insertOffersError,
  } = await supabase
    .from("sponsor_offers")
    .insert(offerRowsToInsert)
    .select(
      `
        id,
        sponsor_id,
        budget_per_season,
        base_budget_per_season,
        negotiation_budget_ceiling,
        objective_difficulty,
        contract_duration_seasons,
        status,
        generation_version
      `
    )
    .returns<SponsorOfferRow[]>();

  if (insertOffersError) {
    throw new Error(
      `Impossible d’enregistrer les offres de la saison suivante : ${insertOffersError.message}`
    );
  }

  return {
    mode,
    season: targetSeason,
    offers: await hydrateFutureSponsorOffersWithObjectives({
      supabase,
      seasonId: targetSeason.id,
      teamReputationPoints: sportingDirector.reputation_points,
      offerRows: insertedOfferRows ?? [],
      renewalSponsorCatalogKey:
        mode === "renewal"
          ? currentSponsorCatalogKey
          : null,
    }),
  };
}

function createFutureProposals({
  mode,
  directorReputation,
  unavailableSponsorCatalogKeys,
  currentSponsorCatalogKey,
  currentSponsorBudget,
  currentSponsorSatisfactionScore,
  excludedSponsorCatalogKey,
  countryAffinity,
}: {
  mode: FutureSponsorOfferMode;
  directorReputation: number;
  unavailableSponsorCatalogKeys: readonly string[];
  currentSponsorCatalogKey: string | null;
  currentSponsorBudget: number | null;
  currentSponsorSatisfactionScore: number | null;
  excludedSponsorCatalogKey: string | null;
  countryAffinity: TeamSponsorCountryAffinity;
}): GeneratedFutureProposal[] {
  const unavailableSponsorIds = new Set(
    unavailableSponsorCatalogKeys
  );

  if (excludedSponsorCatalogKey) {
    unavailableSponsorIds.add(excludedSponsorCatalogKey);
  }

  if (mode === "renewal") {
    if (!currentSponsorCatalogKey) {
      throw new Error(
        "Le sponsor à renouveler est introuvable."
      );
    }

    if (
      currentSponsorBudget === null ||
      currentSponsorSatisfactionScore === null
    ) {
      throw new Error(
        "Le budget et la satisfaction du sponsor à renouveler sont introuvables."
      );
    }

    const currentSponsor = SPONSORS.find(
      (sponsor) => sponsor.id === currentSponsorCatalogKey
    );

    if (!currentSponsor) {
      throw new Error(
        `Le sponsor "${currentSponsorCatalogKey}" est absent du catalogue TypeScript.`
      );
    }

    unavailableSponsorIds.add(currentSponsorCatalogKey);
    const renewalIsEligible = isSponsorEligibleForReputation(
      currentSponsor,
      directorReputation
    );

    const alternativeProposals = generateSponsorProposals({
      teamCountryCode: countryAffinity.teamCountryCode,
      leaderCountryCodes: countryAffinity.leaderCountryCodes,
      rosterMajorityCountryCode:
        countryAffinity.rosterMajorityCountryCode,
      preferredSponsorIds: countryAffinity.preferredSponsorIds,
      directorReputation,
      unavailableSponsorIds: [...unavailableSponsorIds],
      proposalCount: renewalIsEligible
        ? RENEWAL_ALTERNATIVE_COUNT
        : DEFAULT_PROPOSAL_COUNT,
    });

    return [
      ...(renewalIsEligible
        ? [
            createRenewalProposal(
              currentSponsor,
              currentSponsorBudget,
              currentSponsorSatisfactionScore,
            ),
          ]
        : []),
      ...alternativeProposals.map((proposal) => ({
        sponsor: proposal.sponsor,
        proposedBudget: proposal.proposedBudget,
        contractDurationSeasons:
          proposal.contractDurationSeasons,
        isRenewal: false,
      })),
    ];
  }

  const replacementProposals = generateSponsorProposals({
    teamCountryCode: countryAffinity.teamCountryCode,
    leaderCountryCodes: countryAffinity.leaderCountryCodes,
    rosterMajorityCountryCode:
      countryAffinity.rosterMajorityCountryCode,
    preferredSponsorIds: countryAffinity.preferredSponsorIds,
    directorReputation,
    unavailableSponsorIds: [...unavailableSponsorIds],
    proposalCount: DEFAULT_PROPOSAL_COUNT,
  });

  return replacementProposals.map((proposal) => ({
    sponsor: proposal.sponsor,
    proposedBudget: proposal.proposedBudget,
    contractDurationSeasons:
      proposal.contractDurationSeasons,
    isRenewal: false,
  }));
}

function createRenewalProposal(
  sponsor: Sponsor,
  currentBudget: number,
  satisfactionScore: number,
): GeneratedFutureProposal {
  return {
    sponsor,
    proposedBudget: calculateSponsorRenewalBudget({
      currentBudget,
      satisfactionScore,
    }),
    contractDurationSeasons: randomIntegerBetween(
      sponsor.contractDurationRange.min,
      sponsor.contractDurationRange.max
    ),
    isRenewal: true,
  };
}

async function ensureNextSeason({
  supabase,
  activeSeason,
}: {
  supabase: SupabaseAdminClient;
  activeSeason: FutureSponsorOfferRequest["activeSeason"];
}): Promise<FutureSponsorSeason> {
  const targetGameYear = activeSeason.gameYear + 1;

  const { data: existingSeason, error: existingSeasonError } =
    await supabase
      .from("seasons")
      .select(
        "id, game_year, name, starts_on, ends_on, status, current_day_number"
      )
      .eq("game_year", targetGameYear)
      .maybeSingle<SeasonRow>();

  if (existingSeasonError) {
    throw new Error(
      `Impossible de rechercher la saison suivante : ${existingSeasonError.message}`
    );
  }

  let season = existingSeason;

  if (!season) {
    const startsOn = addDays(activeSeason.endsOn, 1);
    const endsOn = addDays(startsOn, 27);

    const { data: insertedSeason, error: insertSeasonError } =
      await supabase
        .from("seasons")
        .insert({
          game_year: targetGameYear,
          name: `Saison ${targetGameYear}`,
          starts_on: startsOn,
          ends_on: endsOn,
          status: "planned",
          current_day_number: null,
        })
        .select(
          "id, game_year, name, starts_on, ends_on, status, current_day_number"
        )
        .maybeSingle<SeasonRow>();

    if (insertSeasonError) {
      if (insertSeasonError.code !== "23505") {
        throw new Error(
          `Impossible de créer la saison suivante : ${insertSeasonError.message}`
        );
      }

      const { data: concurrentSeason, error: concurrentSeasonError } =
        await supabase
          .from("seasons")
          .select(
            "id, game_year, name, starts_on, ends_on, status, current_day_number"
          )
          .eq("game_year", targetGameYear)
          .maybeSingle<SeasonRow>();

      if (concurrentSeasonError || !concurrentSeason) {
        throw new Error(
          "La saison suivante a été créée simultanément mais ne peut pas être rechargée."
        );
      }

      season = concurrentSeason;
    } else {
      season = insertedSeason;
    }
  }

  if (!season) {
    throw new Error(
      "La saison suivante n’a pas pu être préparée."
    );
  }

  if (season.status !== "planned") {
    throw new Error(
      "La saison suivante existe mais n’est pas dans l’état prévu pour les signatures anticipées."
    );
  }

  await ensureSeasonDays({
    supabase,
    season,
  });

  return {
    id: season.id,
    name: season.name,
    gameYear: season.game_year,
  };
}

async function ensureSeasonDays({
  supabase,
  season,
}: {
  supabase: SupabaseAdminClient;
  season: SeasonRow;
}): Promise<void> {
  const rows = Array.from({ length: 28 }, (_, index) => ({
    season_id: season.id,
    day_number: index + 1,
    calendar_date: addDays(season.starts_on, index),
    label: `Jour ${index + 1}`,
  }));

  const { error } = await supabase
    .from("season_days")
    .upsert(rows, {
      onConflict: "season_id,day_number",
      ignoreDuplicates: true,
    });

  if (error) {
    throw new Error(
      `Impossible de préparer les journées de la saison suivante : ${error.message}`
    );
  }
}

async function ensureTeamSeason({
  supabase,
  teamId,
  activeSeasonId,
  targetSeasonId,
}: {
  supabase: SupabaseAdminClient;
  teamId: string;
  activeSeasonId: string;
  targetSeasonId: string;
}): Promise<void> {
  const { data: existingTeamSeason, error: existingTeamSeasonError } =
    await supabase
      .from("team_seasons")
      .select("team_id")
      .eq("team_id", teamId)
      .eq("season_id", targetSeasonId)
      .maybeSingle<{ team_id: string }>();

  if (existingTeamSeasonError) {
    throw new Error(
      `Impossible de rechercher l’inscription future de l’équipe : ${existingTeamSeasonError.message}`
    );
  }

  if (existingTeamSeason) {
    return;
  }

  const { data: currentTeamSeason, error: currentTeamSeasonError } =
    await supabase
      .from("team_seasons")
      .select(
        `
          registration_country_id,
          display_name,
          short_name,
          currency_code
        `
      )
      .eq("team_id", teamId)
      .eq("season_id", activeSeasonId)
      .maybeSingle<TeamSeasonRow>();

  if (currentTeamSeasonError || !currentTeamSeason) {
    throw new Error(
      "Impossible de préparer l’inscription de l’équipe pour la saison suivante."
    );
  }

  const { error: insertTeamSeasonError } = await supabase
    .from("team_seasons")
    .insert({
      team_id: teamId,
      season_id: targetSeasonId,
      division_id: null,
      registration_country_id:
        currentTeamSeason.registration_country_id,
      display_name: currentTeamSeason.display_name,
      short_name: currentTeamSeason.short_name,
      points: 0,
      final_rank: null,
      operating_budget: 0,
      spent_budget: 0,
      currency_code: currentTeamSeason.currency_code,
      status: "planned",
    });

  if (
    insertTeamSeasonError &&
    insertTeamSeasonError.code !== "23505"
  ) {
    throw new Error(
      `Impossible d’inscrire l’équipe dans la saison suivante : ${insertTeamSeasonError.message}`
    );
  }
}

async function getUnavailableSponsorCatalogKeysForGameYear({
  supabase,
  targetGameYear,
  targetSeasonId,
  sportingDirectorId,
}: {
  supabase: SupabaseAdminClient;
  targetGameYear: number;
  targetSeasonId: string;
  sportingDirectorId: string;
}): Promise<string[]> {
  const [contractsResult, offersResult] = await Promise.all([
    supabase
      .from("team_sponsor_contracts")
      .select(
        `
          sponsor_id,
          start_season_id,
          contract_duration_seasons,
          status
        `
      )
      .eq("role", "principal")
      .in("status", ["planned", "active"])
      .returns<SponsorContractRow[]>(),
    supabase
      .from("sponsor_offers")
      .select("sponsor_id")
      .eq("season_id", targetSeasonId)
      .neq("sporting_director_id", sportingDirectorId)
      .in("status", ["draft", "open"])
      .returns<ReservedSponsorOfferRow[]>(),
  ]);

  const contractRows = contractsResult.data;
  const contractError = contractsResult.error;

  if (contractError) {
    throw new Error(
      `Impossible de vérifier la disponibilité des sponsors : ${contractError.message}`
    );
  }

  if (offersResult.error) {
    throw new Error(
      `Impossible de vérifier les offres sponsor réservées : ${offersResult.error.message}`
    );
  }

  const reservedSponsorRegistryIds = (offersResult.data ?? []).map(
    (offer) => offer.sponsor_id
  );

  if (!contractRows || contractRows.length === 0) {
    return loadSponsorCatalogKeys({
      supabase,
      sponsorRegistryIds: reservedSponsorRegistryIds,
    });
  }

  const startSeasonIds = [
    ...new Set(
      contractRows.map((contract) => contract.start_season_id)
    ),
  ];

  const { data: startSeasonRows, error: startSeasonError } =
    await supabase
      .from("seasons")
      .select("id, game_year")
      .in("id", startSeasonIds)
      .returns<ContractStartSeasonRow[]>();

  if (startSeasonError) {
    throw new Error(
      `Impossible de vérifier les saisons des contrats : ${startSeasonError.message}`
    );
  }

  const startGameYearBySeasonId = new Map(
    (startSeasonRows ?? []).map((season) => [
      season.id,
      season.game_year,
    ])
  );

  const unavailableSponsorRegistryIds = contractRows
    .filter((contract) => {
      const startGameYear = startGameYearBySeasonId.get(
        contract.start_season_id
      );

      if (startGameYear === undefined) {
        return false;
      }

      const endGameYear =
        startGameYear + contract.contract_duration_seasons - 1;

      return contract.status === "active" || (
        startGameYear <= targetGameYear && endGameYear >= targetGameYear
      );
    })
    .map((contract) => contract.sponsor_id);

  unavailableSponsorRegistryIds.push(...reservedSponsorRegistryIds);

  if (unavailableSponsorRegistryIds.length === 0) {
    return [];
  }

  return loadSponsorCatalogKeys({
    supabase,
    sponsorRegistryIds: unavailableSponsorRegistryIds,
  });
}

async function loadSponsorCatalogKeys({
  supabase,
  sponsorRegistryIds,
}: {
  supabase: SupabaseAdminClient;
  sponsorRegistryIds: readonly string[];
}): Promise<string[]> {
  const uniqueSponsorRegistryIds = [...new Set(sponsorRegistryIds)];

  if (uniqueSponsorRegistryIds.length === 0) return [];

  const { data: sponsorRows, error: sponsorError } =
    await supabase
      .from("sponsors")
      .select("id, catalog_key")
      .in("id", uniqueSponsorRegistryIds)
      .returns<SponsorRegistryRow[]>();

  if (sponsorError) {
    throw new Error(
      `Impossible de retrouver les sponsors indisponibles : ${sponsorError.message}`
    );
  }

  return (sponsorRows ?? []).map(
    (sponsor) => sponsor.catalog_key
  );
}

async function hydrateFutureSponsorOffersWithObjectives({
  supabase,
  seasonId,
  teamReputationPoints,
  offerRows,
  renewalSponsorCatalogKey,
}: {
  supabase: SupabaseAdminClient;
  seasonId: string;
  teamReputationPoints: number;
  offerRows: readonly SponsorOfferRow[];
  renewalSponsorCatalogKey: string | null;
}): Promise<PersistedSponsorOffer[]> {
  const hydratedOffers = await hydrateFutureSponsorOffers({
    supabase,
    offerRows,
    renewalSponsorCatalogKey,
  });

  const objectiveContexts: SponsorOfferObjectiveContext[] =
    hydratedOffers.map((offer) => ({
      offerId: offer.id,
      sponsor: offer.sponsor,
      proposedBudget: offer.baseBudget,
      relationshipYear: offer.isRenewal ? 2 : 1,
      objectiveDifficulty: offer.objectiveDifficulty,
    }));

  const objectivesByOfferId =
    await ensureAndLoadSponsorObjectives({
      supabase,
      seasonId,
      teamReputationPoints,
      offers: objectiveContexts,
    });

  return hydratedOffers.map((offer) => {
    const objectives = objectivesByOfferId.get(offer.id);

    if (!objectives) {
      throw new Error(
        `Les objectifs de l’offre ${offer.id} sont introuvables.`
      );
    }

    return {
      ...offer,
      sportingPhilosophy:
        objectives.find(
          (objective) => objective.targetDetails.sportingPhilosophy,
        )?.targetDetails.sportingPhilosophy ?? offer.sportingPhilosophy,
      objectives,
    };
  });
}

async function hydrateFutureSponsorOffers({
  supabase,
  offerRows,
  renewalSponsorCatalogKey,
}: {
  supabase: SupabaseAdminClient;
  offerRows: readonly SponsorOfferRow[];
  renewalSponsorCatalogKey: string | null;
}): Promise<Omit<PersistedSponsorOffer, "objectives">[]> {
  if (offerRows.length === 0) {
    return [];
  }

  const sponsorRegistryIds = [
    ...new Set(offerRows.map((offer) => offer.sponsor_id)),
  ];

  const { data: sponsorRegistryRows, error: sponsorRegistryError } =
    await supabase
      .from("sponsors")
      .select("id, catalog_key")
      .in("id", sponsorRegistryIds)
      .returns<SponsorRegistryRow[]>();

  if (sponsorRegistryError) {
    throw new Error(
      `Impossible de charger les sponsors des offres : ${sponsorRegistryError.message}`
    );
  }

  const catalogKeyBySponsorRegistryId = new Map(
    (sponsorRegistryRows ?? []).map((sponsor) => [
      sponsor.id,
      sponsor.catalog_key,
    ])
  );

  const sponsorByCatalogKey = new Map(
    SPONSORS.map((sponsor) => [sponsor.id, sponsor])
  );

  return offerRows.map((offerRow) => {
    const catalogKey = catalogKeyBySponsorRegistryId.get(
      offerRow.sponsor_id
    );

    if (!catalogKey) {
      throw new Error(
        `Clé catalogue introuvable pour le sponsor Supabase ${offerRow.sponsor_id}.`
      );
    }

    const sponsor = sponsorByCatalogKey.get(catalogKey);

    if (!sponsor) {
      throw new Error(
        `Le sponsor "${catalogKey}" existe dans Supabase mais pas dans le catalogue TypeScript.`
      );
    }

    const proposedBudget = Number(offerRow.budget_per_season);
    const baseBudget = Number(offerRow.base_budget_per_season);
    const storedBudgetCeiling = Number(
      offerRow.negotiation_budget_ceiling,
    );

    if (!Number.isFinite(proposedBudget)) {
      throw new Error(
        `Budget invalide pour l’offre ${offerRow.id}.`
      );
    }

    if (!Number.isFinite(baseBudget) || !Number.isFinite(storedBudgetCeiling)) {
      throw new Error(
        `Paramètres de négociation invalides pour l’offre ${offerRow.id}.`,
      );
    }

    if (!isSponsorObjectiveDifficulty(offerRow.objective_difficulty)) {
      throw new Error(
        `Difficulté d’objectifs invalide pour l’offre ${offerRow.id}.`,
      );
    }

    return {
      id: offerRow.id,
      sponsor,
      sportingPhilosophy: resolveSponsorSportingPhilosophy(sponsor.id),
      objectiveDifficulty: offerRow.objective_difficulty,
      baseBudget,
      negotiationBudgetCeiling: Math.max(
        storedBudgetCeiling,
        getSponsorNegotiationBudgetCeiling({
          baseBudget,
          sponsorMaximumBudget: sponsor.budgetRange.max,
        }),
      ),
      proposedBudget,
      contractDurationSeasons:
        offerRow.contract_duration_seasons,
      status: offerRow.status,
      isRenewal:
        renewalSponsorCatalogKey === sponsor.id,
    };
  });
}

function addDays(value: string, dayCount: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new Error(
      `La date de saison "${value}" est invalide.`
    );
  }

  date.setUTCDate(date.getUTCDate() + dayCount);
  return date.toISOString().slice(0, 10);
}

function randomIntegerBetween(min: number, max: number): number {
  const lowerBound = Math.ceil(min);
  const upperBound = Math.floor(max);

  return (
    Math.floor(
      Math.random() * (upperBound - lowerBound + 1)
    ) + lowerBound
  );
}
