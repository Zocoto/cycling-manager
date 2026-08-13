import "server-only";

import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  generateProvisionalSponsorObjectives,
  selectSponsorObjectiveRaces,
  type SponsorObjectiveRaceCandidate,
} from "@/services/sponsor-objectives";
import type { Sponsor } from "@/types/sponsor";
import type {
  PersistedSponsorObjective,
  SponsorObjectivePriority,
  SponsorObjectiveStatus,
  SponsorObjectiveTargetDetails,
  SponsorObjectiveType,
} from "@/types/sponsor-objective";

const OBJECTIVE_COUNT_PER_OFFER = 10;
const OBJECTIVE_COMPLETION_ATTEMPTS = 4;
const OBJECTIVE_COMPLETION_RETRY_DELAY_MS = 50;
const MAXIMUM_RENEWAL_BONUS_PERCENT = 7;

type SupabaseAdminClient = ReturnType<
  typeof createSupabaseAdminClient
>;

export type SponsorOfferObjectiveContext = {
  offerId: string;
  sponsor: Sponsor;
  relationshipYear?: number;
};

type SponsorObjectiveRow = {
  id: string;
  sponsor_offer_id: string;
  name: string;
  description: string | null;
  objective_type: SponsorObjectiveType;
  priority: SponsorObjectivePriority;
  evaluation_timing: string;
  evaluation_day_number: number | null;
  status: SponsorObjectiveStatus;
  display_order: number;
  renewal_bonus_percent: number | string;
  satisfaction_points: number;
  is_provisional: boolean;
  target_details: SponsorObjectiveTargetDetails;
};

type SponsorObjectiveInsertRow = {
  sponsor_offer_id: string;
  season_id: string;
  name: string;
  description: string;
  objective_type: SponsorObjectiveType;
  priority: SponsorObjectivePriority;
  evaluation_timing: "season_end";
  evaluation_day_number: null;
  status: "draft";
  display_order: number;
  renewal_bonus_percent: number;
  satisfaction_points: number;
  is_provisional: true;
  target_details: SponsorObjectiveTargetDetails;
};

type RaceEditionRow = {
  id: string;
  race_id: string;
  season_id: string;
  display_name: string;
  status: string;
  registration_policy: "open" | "criteria_pending" | "closed";
  minimum_reputation: number | null;
};

type RaceRow = {
  id: string;
  country_id: string;
  slug: string;
  race_format: "one_day" | "stage_race";
  competition_type: string;
  is_monument: boolean;
  is_grand_tour: boolean;
  status: string;
};

type CountryRow = {
  id: string;
  iso_alpha2: string;
};

type SeasonReferenceRow = {
  id: string;
};

export async function ensureAndLoadSponsorObjectives({
  supabase,
  seasonId,
  teamReputationPoints,
  offers,
}: {
  supabase: SupabaseAdminClient;
  seasonId: string;
  teamReputationPoints: number;
  offers: readonly SponsorOfferObjectiveContext[];
}): Promise<Map<string, PersistedSponsorObjective[]>> {
  if (offers.length === 0) {
    return new Map();
  }

  const offerIds = offers.map((offer) => offer.offerId);
  const raceCandidates = await loadSponsorObjectiveRaceCandidates({
    supabase,
    seasonId,
  });

  const existingObjectiveRows =
    await loadSponsorObjectiveRows(
      supabase,
      offerIds,
      seasonId
    );

  const existingRowsByOfferId = groupRowsByOfferId(
    existingObjectiveRows
  );

  const rowsToInsert: SponsorObjectiveInsertRow[] = [];

  for (const offer of offers) {
    let existingRows =
      existingRowsByOfferId.get(offer.offerId) ?? [];

    if (
      existingRows.length > 0 &&
      existingRows.length < OBJECTIVE_COUNT_PER_OFFER &&
      existingRows.every((objective) => objective.status === "draft")
    ) {
      const { error: resetError } = await supabase
        .from("sponsor_objectives")
        .delete()
        .eq("sponsor_offer_id", offer.offerId)
        .eq("season_id", seasonId);

      if (resetError) {
        throw new Error(
          `Impossible de moderniser les objectifs de l’offre ${offer.offerId} : ${resetError.message}`
        );
      }

      existingRows = [];
    }


    const existingDisplayOrders = new Set(
      existingRows.map(
        (objective) => objective.display_order
      )
    );

    const generatedObjectives =
      generateProvisionalSponsorObjectives({
        sponsorCountryCode:
          offer.sponsor.countryCode,
        sponsorPrestige:
          offer.sponsor.prestige,
        sponsorCatalogKey:
          offer.sponsor.id,
        sponsorSector:
          offer.sponsor.sector,
        relationshipYear: offer.relationshipYear ?? 1,
        teamReputationPoints,
        raceCandidates,
        random: createSeededRandom(
          `${offer.offerId}:${offer.sponsor.id}`
        ),
      });

    const missingDisplayOrders = Array.from(
      { length: OBJECTIVE_COUNT_PER_OFFER },
      (_, index) => index + 1
    ).filter((displayOrder) => !existingDisplayOrders.has(displayOrder));
    const existingSignatures = new Set(
      existingRows.map((objective) =>
        getObjectiveSignature(objective.target_details)
      )
    );
    const existingFamilyCounts = countObjectiveFamilies(
      existingRows.map((objective) => objective.target_details),
    );
    const generatedFamilyCounts = countObjectiveFamilies(
      generatedObjectives.map((objective) => objective.targetDetails),
    );
    const missingFamilyCounts = new Map(
      [...generatedFamilyCounts].map(([family, desiredCount]) => [
        family,
        Math.max(0, desiredCount - (existingFamilyCounts.get(family) ?? 0)),
      ]),
    );
    const objectivesToInsert =
      existingRows.length === 0
        ? generatedObjectives
        : generatedObjectives
            .filter((objective) => {
              const signature = getObjectiveSignature(objective.targetDetails);
              const family = getObjectiveFamily(objective.targetDetails);
              const remainingCount = missingFamilyCounts.get(family) ?? 0;

              if (existingSignatures.has(signature) || remainingCount <= 0) {
                return false;
              }

              existingSignatures.add(signature);
              missingFamilyCounts.set(family, remainingCount - 1);
              return true;
            })
            .slice(0, missingDisplayOrders.length)
            .map((objective, index) => ({
              ...objective,
              displayOrder: missingDisplayOrders[index],
            }));

    if (objectivesToInsert.length !== missingDisplayOrders.length) {
      throw new Error(
        `Impossible de compléter l’offre ${offer.offerId} avec dix objectifs distincts.`
      );
    }


    await repairLegacyRaceObjectives({
      supabase,
      objectiveRows: existingRows,
      sponsorCountryCode: offer.sponsor.countryCode,
      teamReputationPoints,
      raceCandidates,
      random: createSeededRandom(
        `${offer.offerId}:${offer.sponsor.id}:race-repair`
      ),
    });

    for (const objective of objectivesToInsert) {
      if (
        existingDisplayOrders.has(
          objective.displayOrder
        )
      ) {
        continue;
      }

      rowsToInsert.push({
        sponsor_offer_id: offer.offerId,
        season_id: seasonId,
        name: objective.name,
        description: objective.description,
        objective_type:
          objective.objectiveType,
        priority: objective.priority,
        evaluation_timing:
          objective.evaluationTiming,
        evaluation_day_number:
          objective.evaluationDayNumber,
        status: "draft",
        display_order:
          objective.displayOrder,
        renewal_bonus_percent:
          objective.renewalBonusPercent,
        satisfaction_points:
          objective.satisfactionPoints,
        is_provisional:
          objective.isProvisional,
        target_details:
          objective.targetDetails,
      });
    }
  }

  if (rowsToInsert.length > 0) {
    const { error: upsertError } = await supabase
      .from("sponsor_objectives")
      .upsert(rowsToInsert, {
        onConflict: "sponsor_offer_id,display_order",
        ignoreDuplicates: true,
      });

    if (upsertError) {
      throw new Error(
        `Impossible d’enregistrer les objectifs des offres : ${upsertError.message}`
      );
    }
  }

  let completeObjectiveRows =
    await loadSponsorObjectiveRows(
      supabase,
      offerIds,
      seasonId
    );

  for (
    let attempt = 0;
    attempt < OBJECTIVE_COMPLETION_ATTEMPTS;
    attempt += 1
  ) {
    const rowsByOfferId = groupRowsByOfferId(completeObjectiveRows);
    const everyOfferIsComplete = offerIds.every(
      (offerId) =>
        (rowsByOfferId.get(offerId)?.length ?? 0) ===
        OBJECTIVE_COUNT_PER_OFFER
    );

    if (everyOfferIsComplete) break;
    if (attempt + 1 >= OBJECTIVE_COMPLETION_ATTEMPTS) break;

    await new Promise((resolve) =>
      setTimeout(resolve, OBJECTIVE_COMPLETION_RETRY_DELAY_MS)
    );
    const refreshedRows = await loadSponsorObjectiveRows(
      supabase,
      offerIds,
      seasonId
    );
    completeObjectiveRows.splice(
      0,
      completeObjectiveRows.length,
      ...refreshedRows
    );
  }

  await normalizeObjectiveSatisfactionWeights(
    supabase,
    completeObjectiveRows
  );

  completeObjectiveRows = await loadSponsorObjectiveRows(
    supabase,
    offerIds,
    seasonId
  );
  await syncRaceResultObjectiveLinks(
    supabase,
    completeObjectiveRows
  );

  const completeRowsByOfferId = groupRowsByOfferId(
    completeObjectiveRows
  );

  const objectivesByOfferId = new Map<
    string,
    PersistedSponsorObjective[]
  >();

  for (const offer of offers) {
    const offerObjectiveRows =
      completeRowsByOfferId.get(offer.offerId) ?? [];

    if (
      offerObjectiveRows.length !==
      OBJECTIVE_COUNT_PER_OFFER
    ) {
      throw new Error(
        `L’offre ${offer.offerId} contient ${offerObjectiveRows.length} objectif(s), alors que ${OBJECTIVE_COUNT_PER_OFFER} sont requis.`
      );
    }

    objectivesByOfferId.set(
      offer.offerId,
      offerObjectiveRows
        .map(hydrateSponsorObjective)
        .sort(
          (firstObjective, secondObjective) =>
            firstObjective.displayOrder -
            secondObjective.displayOrder
        )
    );
  }

  return objectivesByOfferId;
}

async function loadSponsorObjectiveRows(
  supabase: SupabaseAdminClient,
  offerIds: readonly string[],
  seasonId: string
): Promise<SponsorObjectiveRow[]> {
  const {
    data: objectiveRows,
    error: objectivesError,
  } = await supabase
    .from("sponsor_objectives")
    .select(
      `
        id,
        sponsor_offer_id,
        name,
        description,
        objective_type,
        priority,
        evaluation_timing,
        evaluation_day_number,
        status,
        display_order,
        renewal_bonus_percent,
        is_provisional,
        satisfaction_points,
        target_details
      `
    )
    .in("sponsor_offer_id", [...offerIds])
    .eq("season_id", seasonId)
    .order("display_order", {
      ascending: true,
    })
    .returns<SponsorObjectiveRow[]>();

  if (objectivesError) {
    throw new Error(
      `Impossible de récupérer les objectifs des offres : ${objectivesError.message}`
    );
  }

  return objectiveRows ?? [];
}

function groupRowsByOfferId(
  objectiveRows: readonly SponsorObjectiveRow[]
): Map<string, SponsorObjectiveRow[]> {
  const rowsByOfferId = new Map<
    string,
    SponsorObjectiveRow[]
  >();

  for (const objectiveRow of objectiveRows) {
    const currentRows =
      rowsByOfferId.get(
        objectiveRow.sponsor_offer_id
      ) ?? [];

    currentRows.push(objectiveRow);

    rowsByOfferId.set(
      objectiveRow.sponsor_offer_id,
      currentRows
    );
  }

  return rowsByOfferId;
}



async function normalizeObjectiveSatisfactionWeights(
  supabase: SupabaseAdminClient,
  objectiveRows: readonly SponsorObjectiveRow[]
): Promise<void> {
  const rowsByOfferId = groupRowsByOfferId(objectiveRows);

  for (const rows of rowsByOfferId.values()) {
    if (rows.length !== OBJECTIVE_COUNT_PER_OFFER) continue;

    const rawTotal = rows.reduce(
      (total, row) => total + Math.max(1, Number(row.satisfaction_points)),
      0
    );
    const allocations = rows.map((row) => {
      const exact =
        (Math.max(1, Number(row.satisfaction_points)) * 100) / rawTotal;

      return {
        row,
        points: Math.max(1, Math.floor(exact)),
        fraction: exact - Math.floor(exact),
      };
    });
    let remaining =
      100 -
      allocations.reduce((total, allocation) => total + allocation.points, 0);

    for (const allocation of [...allocations].sort(
      (first, second) =>
        second.fraction - first.fraction ||
        first.row.display_order - second.row.display_order
    )) {
      if (remaining <= 0) break;
      allocation.points += 1;
      remaining -= 1;
    }

    for (const allocation of allocations) {
      const renewalBonusPercent = Number(
        (
          allocation.points *
          (MAXIMUM_RENEWAL_BONUS_PERCENT / 100)
        ).toFixed(2)
      );
      const priority: SponsorObjectivePriority =
        allocation.points >= 17
          ? "mandatory"
          : allocation.points >= 11
            ? "important"
            : allocation.points >= 6
              ? "standard"
              : "optional";

      if (
        Number(allocation.row.satisfaction_points) === allocation.points &&
        Number(allocation.row.renewal_bonus_percent) === renewalBonusPercent &&
        allocation.row.priority === priority
      ) {
        continue;
      }

      const { error } = await supabase
        .from("sponsor_objectives")
        .update({
          satisfaction_points: allocation.points,
          renewal_bonus_percent: renewalBonusPercent,
          priority,
        })
        .eq("id", allocation.row.id);

      if (error) {
        throw new Error(
          `Impossible de normaliser la satisfaction de l’objectif ${allocation.row.id} : ${error.message}`
        );
      }
    }
  }
}


function getObjectiveSignature(
  details: SponsorObjectiveTargetDetails
): string {
  if (details.kind === "race_result") {
    return `race_result:${details.raceId}`;
  }

  if (details.kind === "season_wins") {
    return `season_wins:${details.winScope}`;
  }

  return details.kind;
}

function hydrateSponsorObjective(
  objectiveRow: SponsorObjectiveRow
): PersistedSponsorObjective {
  if (
    objectiveRow.evaluation_timing !==
    "season_end"
  ) {
    throw new Error(
      `Période d’évaluation non prise en charge pour l’objectif ${objectiveRow.id}.`
    );
  }

  if (
    objectiveRow.evaluation_day_number !== null
  ) {
    throw new Error(
      `Jour d’évaluation inattendu pour l’objectif ${objectiveRow.id}.`
    );
  }

  if (!objectiveRow.is_provisional) {
    throw new Error(
      `L’objectif ${objectiveRow.id} n’est pas un objectif provisoire de l’EPIC 5.`
    );
  }

  const renewalBonusPercent = Number(
    objectiveRow.renewal_bonus_percent
  );

  if (!Number.isFinite(renewalBonusPercent)) {
    throw new Error(
      `Bonus de renouvellement invalide pour l’objectif ${objectiveRow.id}.`
    );
  }

  const satisfactionPoints = Number(
    objectiveRow.satisfaction_points
  );

  if (!Number.isInteger(satisfactionPoints) || satisfactionPoints <= 0) {
    throw new Error(
      `Poids de satisfaction invalide pour l’objectif ${objectiveRow.id}.`
    );
  }

  return {
    id: objectiveRow.id,
    displayOrder: objectiveRow.display_order,
    name: objectiveRow.name,
    description:
      objectiveRow.description ?? "",
    objectiveType:
      objectiveRow.objective_type,
    priority: objectiveRow.priority,
    evaluationTiming: "season_end",
    evaluationDayNumber: null,
    renewalBonusPercent,
    satisfactionPoints,
    isProvisional: true,
    targetDetails:
      objectiveRow.target_details,
    status: objectiveRow.status,
  };
}

function createSeededRandom(
  seedValue: string
): () => number {
  let seed = 2_166_136_261;

  for (
    let index = 0;
    index < seedValue.length;
    index += 1
  ) {
    seed ^= seedValue.charCodeAt(index);
    seed = Math.imul(seed, 16_777_619);
  }

  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;

    let value = state;

    value = Math.imul(
      value ^ (value >>> 15),
      value | 1
    );

    value ^=
      value +
      Math.imul(
        value ^ (value >>> 7),
        value | 61
      );

    return (
      ((value ^ (value >>> 14)) >>> 0) /
      4_294_967_296
    );
  };
}

async function loadSponsorObjectiveRaceCandidates({
  supabase,
  seasonId,
}: {
  supabase: SupabaseAdminClient;
  seasonId: string;
}): Promise<SponsorObjectiveRaceCandidate[]> {
  const targetSeasonRows = await loadRaceEditionRows(
    supabase,
    seasonId
  );
  let sourceRows = targetSeasonRows;

  if (targetSeasonRows.length < 3) {
    const { data: activeSeasonRows, error: activeSeasonError } =
      await supabase
        .from("seasons")
        .select("id")
        .eq("status", "active")
        .neq("id", seasonId)
        .limit(1)
        .returns<SeasonReferenceRow[]>();

    if (activeSeasonError) {
      throw new Error(
        `Impossible de rechercher le calendrier de référence des objectifs sponsor : ${activeSeasonError.message}`
      );
    }

    const fallbackSeasonId = activeSeasonRows?.[0]?.id;

    if (fallbackSeasonId) {
      sourceRows = [
        ...targetSeasonRows,
        ...(await loadRaceEditionRows(supabase, fallbackSeasonId)),
      ];
    }
  }

  const raceIds = [...new Set(sourceRows.map((row) => row.race_id))];

  if (raceIds.length === 0) {
    throw new Error(
      "Aucune course existante n’est disponible pour générer les objectifs sponsor."
    );
  }

  const { data: raceRows, error: raceError } = await supabase
    .from("races")
    .select("id, country_id, slug, status, race_format, competition_type, is_monument, is_grand_tour")
    .in("id", raceIds)
    .eq("status", "active")
    .returns<RaceRow[]>();

  if (raceError) {
    throw new Error(
      `Impossible de charger les courses des objectifs sponsor : ${raceError.message}`
    );
  }

  const countryIds = [
    ...new Set((raceRows ?? []).map((race) => race.country_id)),
  ];
  const { data: countryRows, error: countryError } = await supabase
    .from("countries")
    .select("id, iso_alpha2")
    .in("id", countryIds)
    .returns<CountryRow[]>();

  if (countryError) {
    throw new Error(
      `Impossible de charger les pays des courses sponsor : ${countryError.message}`
    );
  }

  const raceById = new Map((raceRows ?? []).map((race) => [race.id, race]));
  const countryCodeById = new Map(
    (countryRows ?? []).map((country) => [country.id, country.iso_alpha2])
  );
  const candidatesByRaceId = new Map<
    string,
    SponsorObjectiveRaceCandidate
  >();

  for (const edition of sourceRows) {
    if (edition.status === "cancelled") {
      continue;
    }

    const race = raceById.get(edition.race_id);
    const countryCode = race
      ? countryCodeById.get(race.country_id)
      : undefined;

    if (!race || !countryCode) {
      continue;
    }

    const candidate: SponsorObjectiveRaceCandidate = {
      raceId: race.id,
      raceEditionId: edition.season_id === seasonId ? edition.id : null,
      raceSlug: race.slug,
      raceLabel: edition.display_name,
      countryCode,
      registrationPolicy: edition.registration_policy,
      minimumReputation: edition.minimum_reputation,
      raceFormat: race.race_format,
      competitionType: race.competition_type,
      isMonument: race.is_monument,
      isGrandTour: race.is_grand_tour,
    };
    const existingCandidate = candidatesByRaceId.get(race.id);

    if (!existingCandidate || candidate.raceEditionId !== null) {
      candidatesByRaceId.set(race.id, candidate);
    }
  }

  return [...candidatesByRaceId.values()];
}

async function loadRaceEditionRows(
  supabase: SupabaseAdminClient,
  seasonId: string
): Promise<RaceEditionRow[]> {
  const { data, error } = await supabase
    .from("race_editions")
    .select(
      "id, race_id, season_id, display_name, status, registration_policy, minimum_reputation"
    )
    .eq("season_id", seasonId)
    .neq("status", "cancelled")
    .returns<RaceEditionRow[]>();

  if (error) {
    throw new Error(
      `Impossible de charger le calendrier des objectifs sponsor : ${error.message}`
    );
  }

  return data ?? [];
}

async function repairLegacyRaceObjectives({
  supabase,
  objectiveRows,
  sponsorCountryCode,
  teamReputationPoints,
  raceCandidates,
  random,
}: {
  supabase: SupabaseAdminClient;
  objectiveRows: readonly SponsorObjectiveRow[];
  sponsorCountryCode: string;
  teamReputationPoints: number;
  raceCandidates: readonly SponsorObjectiveRaceCandidate[];
  random: () => number;
}): Promise<void> {
  const raceObjectiveRows = objectiveRows.filter(
    (objective) => objective.objective_type === "race_result"
  );

  if (raceObjectiveRows.length === 0) {
    return;
  }

  const selectedRaces = selectSponsorObjectiveRaces({
    sponsorCountryCode,
    teamReputationPoints,
    raceCandidates,
    count: raceObjectiveRows.length,
    random,
  });
  const existingCandidateByRaceId = new Map(
    raceCandidates.map((candidate) => [candidate.raceId, candidate])
  );
  const retainedRaceIds = new Set(
    raceObjectiveRows.flatMap((objective) => {
      const details = objective.target_details;

      return details.kind === "race_result" &&
        existingCandidateByRaceId.has(details.raceId)
        ? [details.raceId]
        : [];
    })
  );
  const replacementRaces = selectedRaces.filter(
    (race) => !retainedRaceIds.has(race.raceId)
  );
  let replacementIndex = 0;

  for (const objective of raceObjectiveRows) {
    const details = objective.target_details;
    const isAlreadyLinked =
      details.kind === "race_result" &&
      existingCandidateByRaceId.has(details.raceId);

    if (isAlreadyLinked) {
      continue;
    }

    const replacement = replacementRaces[replacementIndex];
    replacementIndex += 1;

    if (!replacement) {
      throw new Error(
        `Aucune course de remplacement n’est disponible pour l’objectif ${objective.id}.`
      );
    }

    const achievementType =
      details.kind === "race_result" && details.achievementType === "win"
        ? "win"
        : "top_n";
    const targetRank =
      achievementType === "top_n" &&
      details.kind === "race_result" &&
      typeof details.targetRank === "number" &&
      details.targetRank > 0
        ? details.targetRank
        : achievementType === "top_n"
          ? 10
          : null;
    const requiredCount =
      details.kind === "race_result" && details.requiredCount > 0
        ? details.requiredCount
        : 1;
    const name =
      achievementType === "win"
        ? `Remporter ${replacement.raceLabel}`
        : `Top ${targetRank} sur ${replacement.raceLabel}`;
    const description =
      achievementType === "win"
        ? `Obtenir la victoire sur ${replacement.raceLabel} pendant la saison.`
        : `Placer au moins un coureur parmi les ${targetRank} premiers de ${replacement.raceLabel}.`;
    const { error } = await supabase
      .from("sponsor_objectives")
      .update({
        name,
        description,
        target_details: {
          kind: "race_result",
          raceId: replacement.raceId,
          raceEditionId: replacement.raceEditionId,
          raceSlug: replacement.raceSlug,
          raceLabel: replacement.raceLabel,
          countryCode: replacement.countryCode,
          achievementType,
          targetRank,
          requiredCount,
        },
      })
      .eq("id", objective.id);

    if (error) {
      throw new Error(
        `Impossible de relier l’objectif ${objective.id} à une course existante : ${error.message}`
      );
    }
  }
}

async function syncRaceResultObjectiveLinks(
  supabase: SupabaseAdminClient,
  objectiveRows: readonly SponsorObjectiveRow[]
): Promise<void> {
  for (const objective of objectiveRows) {
    if (
      objective.objective_type !== "race_result" ||
      objective.target_details.kind !== "race_result"
    ) {
      continue;
    }

    const details = objective.target_details;

    if (!details.raceEditionId) {
      continue;
    }

    const { error } = await supabase
      .from("race_result_objectives")
      .upsert(
        {
          objective_id: objective.id,
          race_edition_id: details.raceEditionId,
          stage_id: null,
          target_scope: "race_final",
          achievement_type: details.achievementType,
          target_rank: details.targetRank,
          required_count: details.requiredCount,
        },
        { onConflict: "objective_id" }
      );

    if (error) {
      throw new Error(
        `Impossible de synchroniser la course de l’objectif ${objective.id} : ${error.message}`
      );
    }
  }
}
function getObjectiveFamily(
  details: SponsorObjectiveTargetDetails,
): string {
  if (details.kind === "race_result") {
    return "race_result";
  }

  return getObjectiveSignature(details);
}

function countObjectiveFamilies(
  detailsList: readonly SponsorObjectiveTargetDetails[],
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const details of detailsList) {
    const family = getObjectiveFamily(details);
    counts.set(family, (counts.get(family) ?? 0) + 1);
  }

  return counts;
}
