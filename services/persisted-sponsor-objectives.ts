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

const OBJECTIVE_COUNT_PER_OFFER = 7;

type SupabaseAdminClient = ReturnType<
  typeof createSupabaseAdminClient
>;

export type SponsorOfferObjectiveContext = {
  offerId: string;
  sponsor: Sponsor;
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
      offerIds
    );

  const existingRowsByOfferId = groupRowsByOfferId(
    existingObjectiveRows
  );

  const rowsToInsert: SponsorObjectiveInsertRow[] = [];

  for (const offer of offers) {
    const existingRows =
      existingRowsByOfferId.get(offer.offerId) ?? [];

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
        teamReputationPoints,
        raceCandidates,
        random: createSeededRandom(
          `${offer.offerId}:${offer.sponsor.id}`
        ),
      });

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

    for (const objective of generatedObjectives) {
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
        is_provisional:
          objective.isProvisional,
        target_details:
          objective.targetDetails,
      });
    }
  }

  if (rowsToInsert.length > 0) {
    const { error: insertError } = await supabase
      .from("sponsor_objectives")
      .insert(rowsToInsert);

    if (insertError) {
      throw new Error(
        `Impossible d’enregistrer les objectifs des offres : ${insertError.message}`
      );
    }
  }

  const completeObjectiveRows =
    await loadSponsorObjectiveRows(
      supabase,
      offerIds
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
  offerIds: readonly string[]
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
        target_details
      `
    )
    .in("sponsor_offer_id", [...offerIds])
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
    .select("id, country_id, slug, status")
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
  const eligibleCandidateByRaceId = new Map(
    raceCandidates
      .filter(
        (candidate) =>
          candidate.registrationPolicy === "open" &&
          candidate.minimumReputation !== null &&
          teamReputationPoints >= candidate.minimumReputation
      )
      .map((candidate) => [candidate.raceId, candidate])
  );
  const retainedRaceIds = new Set(
    raceObjectiveRows.flatMap((objective) => {
      const details = objective.target_details;

      return details.kind === "race_result" &&
        eligibleCandidateByRaceId.has(details.raceId)
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
      eligibleCandidateByRaceId.has(details.raceId);

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
