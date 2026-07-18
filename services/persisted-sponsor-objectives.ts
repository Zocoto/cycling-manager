import "server-only";

import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generateProvisionalSponsorObjectives } from "@/services/sponsor-objectives";
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

export async function ensureAndLoadSponsorObjectives({
  supabase,
  seasonId,
  offers,
}: {
  supabase: SupabaseAdminClient;
  seasonId: string;
  offers: readonly SponsorOfferObjectiveContext[];
}): Promise<Map<string, PersistedSponsorObjective[]>> {
  if (offers.length === 0) {
    return new Map();
  }

  const offerIds = offers.map((offer) => offer.offerId);

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
        random: createSeededRandom(
          `${offer.offerId}:${offer.sponsor.id}`
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