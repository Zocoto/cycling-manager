import "server-only";

import { SPONSORS } from "@/data/sponsors";
import type { RaceCategoryCode } from "@/lib/game/race-calendar";
import {
  calculateSecondarySponsorObjectiveReward,
  getSecondarySponsorEligibleCategoryCodes,
  getSecondarySponsorObjectiveCount,
  getSecondarySponsorTargetRank,
  SECONDARY_SPONSOR_OFFER_COUNT,
  SECONDARY_SPONSOR_REPUTATION_THRESHOLD,
  SECONDARY_SPONSOR_START_GAME_YEAR,
  type SecondarySponsorIdentity,
  type SecondarySponsorLogoPlacement,
  type SecondarySponsorLogoVariant,
  type SecondarySponsorObjective,
} from "@/lib/game/secondary-sponsor";
import { stableHash } from "@/lib/game/sponsor-main-objective";
import { GAMEPLAY_RULES, isFutureSponsoringWindowOpen } from "@/lib/gameplay-rules";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Sponsor } from "@/types/sponsor";

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

export type SecondarySponsorOffer = {
  id: string;
  sponsor: SecondarySponsorIdentity;
  objectives: SecondarySponsorObjective[];
  totalMaximumReward: number;
};

export type SecondarySponsorBaseJersey = {
  sponsor: Sponsor;
  jersey: Sponsor["jerseys"][number];
  futureTeamName: string;
};

export type SecondarySponsorContract = {
  id: string;
  status: "planned" | "active" | "completed" | "terminated";
  seasonId: string;
  targetGameYear: number;
  targetSeasonName: string;
  sponsor: SecondarySponsorIdentity;
  objectives: SecondarySponsorObjective[];
  logoPlacement: SecondarySponsorLogoPlacement;
  baseJersey: SecondarySponsorBaseJersey | null;
};

type SecondarySponsoringStateWithActiveContract = {
  activeContract: SecondarySponsorContract | null;
};

export type SecondarySponsoringState = SecondarySponsoringStateWithActiveContract & (
  | {
      kind: "unavailable-season";
      targetGameYear: number;
      requiredGameYear: number;
    }
  | {
      kind: "window-locked";
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
      kind: "offers";
      countryCode: string;
      countryName: string;
      targetGameYear: number;
      targetSeasonName: string;
      offers: SecondarySponsorOffer[];
    }
  | {
      kind: "signed";
      contract: SecondarySponsorContract;
    }
);

type DirectorRow = {
  id: string;
  reputation_points: number | string;
};

type AssignmentRow = { team_id: string };
type TeamRow = { home_country_id: string };
type CountryRow = { id: string; name: string; iso_alpha2: string };
type SeasonRow = {
  id: string;
  game_year: number;
  name: string;
  current_day_number: number | null;
  status: string;
};

type CatalogRow = {
  id: string;
  country_id: string;
  name: string;
  prestige: number;
  primary_color: string;
  accent_color: string;
  logo_variant: SecondarySponsorLogoVariant;
};

type OfferRow = {
  id: string;
  secondary_sponsor_id: string;
  status: "open" | "accepted" | "withdrawn" | "expired";
};

type ObjectiveRow = {
  id: string;
  offer_id: string;
  display_order: number;
  race_slug: string;
  race_label: string;
  race_category_code: RaceCategoryCode;
  target_rank: number;
  cash_reward: number | string;
  status: SecondarySponsorObjective["status"];
  best_rank: number | null;
};

type ContractRow = {
  id: string;
  offer_id: string;
  season_id: string;
  secondary_sponsor_id: string;
  status: SecondarySponsorContract["status"];
  logo_x_percent: number | string;
  logo_y_percent: number | string;
  logo_scale: number | string;
  logo_rotation_degrees: number | string;
};

type RaceEditionRow = {
  id: string;
  race_id: string;
  race_category_id: string;
  display_name: string;
  registration_policy: string;
  minimum_reputation: number | null;
  status: string;
};

type RaceRow = { id: string; country_id: string; slug: string; status: string };
type RaceCategoryRow = { id: string; code: RaceCategoryCode };

type PrincipalContractRow = {
  sponsor_id: string;
  selected_jersey_id: string | null;
  pending_jersey_id: string | null;
  pending_jersey_season_id: string | null;
  start_season_id: string;
  end_season_id: string | null;
  contract_duration_seasons: number;
  status: "planned" | "active";
};

type SponsorRegistryRow = { id: string; catalog_key: string };

export async function getSecondarySponsoringStateForAuthUser(
  authUserId: string,
): Promise<SecondarySponsoringState | null> {
  const normalizedAuthUserId = authUserId.trim();
  if (!normalizedAuthUserId) return null;

  const supabase = createSupabaseAdminClient();
  const { data: director, error: directorError } = await supabase
    .from("sporting_directors")
    .select("id, reputation_points")
    .eq("auth_user_id", normalizedAuthUserId)
    .eq("status", "active")
    .maybeSingle<DirectorRow>();

  if (directorError) {
    throw new Error(
      `Impossible de charger l’accès au sponsor secondaire : ${directorError.message}`,
    );
  }
  if (!director) return null;

  const { data: assignment, error: assignmentError } = await supabase
    .from("team_manager_assignments")
    .select("team_id")
    .eq("sporting_director_id", director.id)
    .eq("role", "general_manager")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<AssignmentRow>();

  if (assignmentError) {
    throw new Error(
      `Impossible de charger l’équipe du sponsor secondaire : ${assignmentError.message}`,
    );
  }
  if (!assignment) return null;

  const [activeSeasonResult, teamResult] = await Promise.all([
    supabase
      .from("seasons")
      .select("id, game_year, name, current_day_number, status")
      .eq("status", "active")
      .maybeSingle<SeasonRow>(),
    supabase
      .from("teams")
      .select("home_country_id")
      .eq("id", assignment.team_id)
      .maybeSingle<TeamRow>(),
  ]);

  if (activeSeasonResult.error || !activeSeasonResult.data) {
    throw new Error("La saison active est indisponible pour le sponsor secondaire.");
  }
  if (teamResult.error || !teamResult.data) {
    throw new Error("L’identité nationale de l’équipe est indisponible.");
  }

  const activeSeason = activeSeasonResult.data;
  const targetGameYear = activeSeason.game_year + 1;
  const { data: targetSeason, error: targetSeasonError } = await supabase
    .from("seasons")
    .select("id, game_year, name, current_day_number, status")
    .eq("game_year", targetGameYear)
    .maybeSingle<SeasonRow>();

  if (targetSeasonError) {
    throw new Error(
      `Impossible de charger la saison du sponsor secondaire : ${targetSeasonError.message}`,
    );
  }

  const activeContractRow = await loadSecondaryContract({
    supabase,
    teamId: assignment.team_id,
    seasonId: activeSeason.id,
  });
  const activeContract = activeContractRow
    ? await hydrateSecondaryContract({
        supabase,
        contract: activeContractRow,
        targetSeason: activeSeason,
        teamId: assignment.team_id,
      })
    : null;

  if (!targetSeason || targetGameYear < SECONDARY_SPONSOR_START_GAME_YEAR) {
    return {
      kind: "unavailable-season",
      targetGameYear,
      requiredGameYear: SECONDARY_SPONSOR_START_GAME_YEAR,
      activeContract,
    };
  }

  const existingContract = await loadSecondaryContract({
    supabase,
    teamId: assignment.team_id,
    seasonId: targetSeason.id,
  });

  if (existingContract) {
    return {
      kind: "signed",
      activeContract,
      contract: await hydrateSecondaryContract({
        supabase,
        contract: existingContract,
        targetSeason,
        teamId: assignment.team_id,
      }),
    };
  }

  const currentDayNumber = activeSeason.current_day_number ?? 0;
  if (!isFutureSponsoringWindowOpen(currentDayNumber)) {
    return {
      kind: "window-locked",
      activeContract,
      currentDayNumber,
      opensOnDay: GAMEPLAY_RULES.futureSponsoringOpeningDay,
      targetGameYear,
      targetSeasonName: targetSeason.name,
    };
  }

  const reputationPoints = Number(director.reputation_points);
  if (reputationPoints < SECONDARY_SPONSOR_REPUTATION_THRESHOLD) {
    return {
      kind: "reputation-locked",
      activeContract,
      currentReputation: reputationPoints,
      requiredReputation: SECONDARY_SPONSOR_REPUTATION_THRESHOLD,
      targetGameYear,
      targetSeasonName: targetSeason.name,
    };
  }

  const { data: country, error: countryError } = await supabase
    .from("countries")
    .select("id, name, iso_alpha2")
    .eq("id", teamResult.data.home_country_id)
    .maybeSingle<CountryRow>();

  if (countryError || !country) {
    throw new Error("Le pays de l’équipe est indisponible pour les offres secondaires.");
  }

  const offers = await ensureAndLoadSecondarySponsorOffers({
    supabase,
    directorId: director.id,
    teamId: assignment.team_id,
    targetSeason,
    country,
    reputationPoints,
  });

  return {
    kind: "offers",
    activeContract,
    countryCode: country.iso_alpha2,
    countryName: country.name,
    targetGameYear,
    targetSeasonName: targetSeason.name,
    offers,
  };
}

async function ensureAndLoadSecondarySponsorOffers({
  supabase,
  directorId,
  teamId,
  targetSeason,
  country,
  reputationPoints,
}: {
  supabase: SupabaseAdminClient;
  directorId: string;
  teamId: string;
  targetSeason: SeasonRow;
  country: CountryRow;
  reputationPoints: number;
}): Promise<SecondarySponsorOffer[]> {
  let offerRows = await loadSecondaryOfferRows({
    supabase,
    directorId,
    targetSeasonId: targetSeason.id,
  });

  if (offerRows.length === 0) {
    const { data: catalogRows, error: catalogError } = await supabase
      .from("secondary_sponsor_catalog")
      .select(
        "id, country_id, name, prestige, primary_color, accent_color, logo_variant",
      )
      .eq("country_id", country.id)
      .returns<CatalogRow[]>();

    if (catalogError) {
      throw new Error(
        `Impossible de charger le catalogue secondaire : ${catalogError.message}`,
      );
    }

    const selectedCatalogRows = [...(catalogRows ?? [])]
      .sort(
        (first, second) =>
          stableHash(`${directorId}:${targetSeason.id}:${first.id}`) -
            stableHash(`${directorId}:${targetSeason.id}:${second.id}`) ||
          first.id.localeCompare(second.id),
      )
      .slice(0, SECONDARY_SPONSOR_OFFER_COUNT);

    if (selectedCatalogRows.length !== SECONDARY_SPONSOR_OFFER_COUNT) {
      throw new Error("Le catalogue secondaire du pays est incomplet.");
    }

    const { error: insertError } = await supabase
      .from("secondary_sponsor_offers")
      .insert(
        selectedCatalogRows.map((sponsor) => ({
          sporting_director_id: directorId,
          team_id: teamId,
          target_season_id: targetSeason.id,
          secondary_sponsor_id: sponsor.id,
        })),
      );

    if (insertError) {
      throw new Error(
        `Impossible de créer les offres secondaires : ${insertError.message}`,
      );
    }

    offerRows = await loadSecondaryOfferRows({
      supabase,
      directorId,
      targetSeasonId: targetSeason.id,
    });
  }

  const sponsorIds = offerRows.map((offer) => offer.secondary_sponsor_id);
  const { data: sponsors, error: sponsorsError } = await supabase
    .from("secondary_sponsor_catalog")
    .select(
      "id, country_id, name, prestige, primary_color, accent_color, logo_variant",
    )
    .in("id", sponsorIds)
    .returns<CatalogRow[]>();

  if (sponsorsError) {
    throw new Error(
      `Impossible de charger les sponsors secondaires : ${sponsorsError.message}`,
    );
  }

  const sponsorById = new Map((sponsors ?? []).map((sponsor) => [sponsor.id, sponsor]));
  const raceCandidates = await loadSecondaryRaceCandidates({
    supabase,
    seasonId: targetSeason.id,
    countryId: country.id,
    reputationPoints,
  });

  for (const offer of offerRows) {
    const sponsor = sponsorById.get(offer.secondary_sponsor_id);
    if (!sponsor) continue;

    const existingObjectives = await loadSecondaryObjectiveRows({
      supabase,
      offerIds: [offer.id],
    });
    if (existingObjectives.length > 0) continue;

    const objectiveCount = getSecondarySponsorObjectiveCount(
      toSponsorPrestige(sponsor.prestige),
    );
    const selectedRaces = selectSecondarySponsorRaces({
      offerId: offer.id,
      sponsorPrestige: toSponsorPrestige(sponsor.prestige),
      raceCandidates,
      count: objectiveCount,
    });

    if (selectedRaces.length !== objectiveCount) {
      throw new Error(
        `Le calendrier ne permet pas de créer ${objectiveCount} objectifs secondaires distincts.`,
      );
    }

    const { error: objectiveInsertError } = await supabase
      .from("secondary_sponsor_objectives")
      .insert(
        selectedRaces.map((race, index) => {
          const targetRank = getSecondarySponsorTargetRank({
            prestige: toSponsorPrestige(sponsor.prestige),
            categoryCode: race.categoryCode,
            index,
          });
          return {
            offer_id: offer.id,
            display_order: index + 1,
            race_edition_id: race.id,
            race_slug: race.slug,
            race_label: race.label,
            race_category_code: race.categoryCode,
            target_rank: targetRank,
            cash_reward: calculateSecondarySponsorObjectiveReward({
              prestige: toSponsorPrestige(sponsor.prestige),
              categoryCode: race.categoryCode,
              targetRank,
            }),
          };
        }),
      );

    if (objectiveInsertError) {
      throw new Error(
        `Impossible de créer les objectifs secondaires : ${objectiveInsertError.message}`,
      );
    }
  }

  const objectives = await loadSecondaryObjectiveRows({
    supabase,
    offerIds: offerRows.map((offer) => offer.id),
  });
  const objectivesByOfferId = groupObjectivesByOfferId(objectives);

  return offerRows
    .filter((offer) => offer.status === "open")
    .map((offer) => {
      const sponsor = sponsorById.get(offer.secondary_sponsor_id);
      if (!sponsor) {
        throw new Error("Une identité de sponsor secondaire est introuvable.");
      }
      const hydratedObjectives = (objectivesByOfferId.get(offer.id) ?? []).map(
        hydrateSecondaryObjective,
      );
      return {
        id: offer.id,
        sponsor: hydrateSecondarySponsor(sponsor, country),
        objectives: hydratedObjectives,
        totalMaximumReward: hydratedObjectives.reduce(
          (total, objective) => total + objective.cashReward,
          0,
        ),
      };
    });
}

async function loadSecondaryContract({
  supabase,
  teamId,
  seasonId,
}: {
  supabase: SupabaseAdminClient;
  teamId: string;
  seasonId: string;
}): Promise<ContractRow | null> {
  const { data, error } = await supabase
    .from("secondary_sponsor_contracts")
    .select(
      "id, offer_id, season_id, secondary_sponsor_id, status, logo_x_percent, logo_y_percent, logo_scale, logo_rotation_degrees",
    )
    .eq("team_id", teamId)
    .eq("season_id", seasonId)
    .in("status", ["planned", "active"])
    .maybeSingle<ContractRow>();

  if (error) {
    throw new Error(
      `Impossible de charger le contrat secondaire : ${error.message}`,
    );
  }
  return data;
}

async function hydrateSecondaryContract({
  supabase,
  contract,
  targetSeason,
  teamId,
}: {
  supabase: SupabaseAdminClient;
  contract: ContractRow;
  targetSeason: SeasonRow;
  teamId: string;
}): Promise<SecondarySponsorContract> {
  const [catalogResult, countryResult, objectiveRows, baseJersey] = await Promise.all([
    supabase
      .from("secondary_sponsor_catalog")
      .select(
        "id, country_id, name, prestige, primary_color, accent_color, logo_variant",
      )
      .eq("id", contract.secondary_sponsor_id)
      .maybeSingle<CatalogRow>(),
    loadContractCountry(supabase, contract.secondary_sponsor_id),
    loadSecondaryObjectiveRows({ supabase, offerIds: [contract.offer_id] }),
    loadFuturePrincipalJersey({ supabase, teamId, targetSeason }),
  ]);

  if (catalogResult.error || !catalogResult.data || !countryResult) {
    throw new Error("L’identité du sponsor secondaire signé est indisponible.");
  }

  return {
    id: contract.id,
    status: contract.status,
    seasonId: contract.season_id,
    targetGameYear: targetSeason.game_year,
    targetSeasonName: targetSeason.name,
    sponsor: hydrateSecondarySponsor(catalogResult.data, countryResult),
    objectives: objectiveRows.map(hydrateSecondaryObjective),
    logoPlacement: {
      xPercent: Number(contract.logo_x_percent),
      yPercent: Number(contract.logo_y_percent),
      scale: Number(contract.logo_scale),
      rotationDegrees: Number(contract.logo_rotation_degrees),
    },
    baseJersey,
  };
}

async function loadContractCountry(
  supabase: SupabaseAdminClient,
  sponsorId: string,
): Promise<CountryRow | null> {
  const { data: sponsor } = await supabase
    .from("secondary_sponsor_catalog")
    .select("country_id")
    .eq("id", sponsorId)
    .maybeSingle<{ country_id: string }>();
  if (!sponsor) return null;

  const { data } = await supabase
    .from("countries")
    .select("id, name, iso_alpha2")
    .eq("id", sponsor.country_id)
    .maybeSingle<CountryRow>();
  return data;
}

async function loadFuturePrincipalJersey({
  supabase,
  teamId,
  targetSeason,
}: {
  supabase: SupabaseAdminClient;
  teamId: string;
  targetSeason: SeasonRow;
}): Promise<SecondarySponsorBaseJersey | null> {
  const { data: contracts, error } = await supabase
    .from("team_sponsor_contracts")
    .select(
      "sponsor_id, selected_jersey_id, pending_jersey_id, pending_jersey_season_id, start_season_id, end_season_id, contract_duration_seasons, status",
    )
    .eq("team_id", teamId)
    .eq("role", "principal")
    .in("status", ["planned", "active"])
    .order("created_at", { ascending: false })
    .returns<PrincipalContractRow[]>();

  if (error) {
    throw new Error(`Impossible de charger le futur maillot principal : ${error.message}`);
  }

  const planned = (contracts ?? []).find(
    (candidate) =>
      candidate.status === "planned" && candidate.start_season_id === targetSeason.id,
  );
  const active = (contracts ?? []).find((candidate) => candidate.status === "active");
  const contract = planned ?? active;
  if (!contract) return null;

  if (!planned && contract.end_season_id) {
    const { data: endSeason } = await supabase
      .from("seasons")
      .select("game_year")
      .eq("id", contract.end_season_id)
      .maybeSingle<{ game_year: number }>();
    if (endSeason && endSeason.game_year < targetSeason.game_year) return null;
  }

  const { data: sponsorRegistry, error: sponsorError } = await supabase
    .from("sponsors")
    .select("id, catalog_key")
    .eq("id", contract.sponsor_id)
    .maybeSingle<SponsorRegistryRow>();
  if (sponsorError || !sponsorRegistry) return null;

  const sponsor = SPONSORS.find(
    (candidate) => candidate.id === sponsorRegistry.catalog_key,
  );
  if (!sponsor) return null;

  const jerseyId =
    contract.pending_jersey_season_id === targetSeason.id
      ? contract.pending_jersey_id
      : contract.selected_jersey_id;
  const jersey = sponsor.jerseys.find((candidate) => candidate.id === jerseyId);
  if (!jersey) return null;

  return { sponsor, jersey, futureTeamName: sponsor.name };
}

async function loadSecondaryOfferRows({
  supabase,
  directorId,
  targetSeasonId,
}: {
  supabase: SupabaseAdminClient;
  directorId: string;
  targetSeasonId: string;
}): Promise<OfferRow[]> {
  const { data, error } = await supabase
    .from("secondary_sponsor_offers")
    .select("id, secondary_sponsor_id, status")
    .eq("sporting_director_id", directorId)
    .eq("target_season_id", targetSeasonId)
    .returns<OfferRow[]>();
  if (error) {
    throw new Error(`Impossible de charger les offres secondaires : ${error.message}`);
  }
  return data ?? [];
}

async function loadSecondaryObjectiveRows({
  supabase,
  offerIds,
}: {
  supabase: SupabaseAdminClient;
  offerIds: readonly string[];
}): Promise<ObjectiveRow[]> {
  if (offerIds.length === 0) return [];
  const { data, error } = await supabase
    .from("secondary_sponsor_objectives")
    .select(
      "id, offer_id, display_order, race_slug, race_label, race_category_code, target_rank, cash_reward, status, best_rank",
    )
    .in("offer_id", [...offerIds])
    .order("display_order", { ascending: true })
    .returns<ObjectiveRow[]>();
  if (error) {
    throw new Error(`Impossible de charger les objectifs secondaires : ${error.message}`);
  }
  return data ?? [];
}

type SecondaryRaceCandidate = {
  id: string;
  slug: string;
  label: string;
  countryId: string;
  categoryCode: RaceCategoryCode;
  isDomestic: boolean;
};

async function loadSecondaryRaceCandidates({
  supabase,
  seasonId,
  countryId,
  reputationPoints,
}: {
  supabase: SupabaseAdminClient;
  seasonId: string;
  countryId: string;
  reputationPoints: number;
}): Promise<SecondaryRaceCandidate[]> {
  const { data: editions, error: editionError } = await supabase
    .from("race_editions")
    .select(
      "id, race_id, race_category_id, display_name, registration_policy, minimum_reputation, status",
    )
    .eq("season_id", seasonId)
    .neq("status", "cancelled")
    .returns<RaceEditionRow[]>();
  if (editionError) throw new Error(`Calendrier secondaire indisponible : ${editionError.message}`);

  const raceIds = [...new Set((editions ?? []).map((edition) => edition.race_id))];
  const categoryIds = [
    ...new Set((editions ?? []).map((edition) => edition.race_category_id)),
  ];
  const [racesResult, categoriesResult] = await Promise.all([
    supabase
      .from("races")
      .select("id, country_id, slug, status")
      .in("id", raceIds)
      .returns<RaceRow[]>(),
    supabase
      .from("race_categories")
      .select("id, code")
      .in("id", categoryIds)
      .returns<RaceCategoryRow[]>(),
  ]);
  if (racesResult.error || categoriesResult.error) {
    throw new Error("Le détail du calendrier secondaire est indisponible.");
  }

  const raceById = new Map((racesResult.data ?? []).map((race) => [race.id, race]));
  const categoryById = new Map(
    (categoriesResult.data ?? []).map((category) => [category.id, category.code]),
  );

  return (editions ?? []).flatMap((edition) => {
    const race = raceById.get(edition.race_id);
    const categoryCode = categoryById.get(edition.race_category_id);
    if (
      !race ||
      !categoryCode ||
      categoryCode === "regional" ||
      edition.registration_policy !== "open" ||
      edition.minimum_reputation === null ||
      reputationPoints < edition.minimum_reputation
    ) {
      return [];
    }
    return [
      {
        id: edition.id,
        slug: race.slug,
        label: edition.display_name,
        countryId: race.country_id,
        categoryCode,
        isDomestic: race.country_id === countryId,
      },
    ];
  });
}

function selectSecondarySponsorRaces({
  offerId,
  sponsorPrestige,
  raceCandidates,
  count,
}: {
  offerId: string;
  sponsorPrestige: Sponsor["prestige"];
  raceCandidates: readonly SecondaryRaceCandidate[];
  count: number;
}): SecondaryRaceCandidate[] {
  const eligibleCategoryCodes = new Set(
    getSecondarySponsorEligibleCategoryCodes(sponsorPrestige),
  );

  return raceCandidates
    .filter((candidate) => eligibleCategoryCodes.has(candidate.categoryCode))
    .slice()
    .sort((first, second) => {
      const firstScore = getSecondaryRaceScore(first, sponsorPrestige);
      const secondScore = getSecondaryRaceScore(second, sponsorPrestige);
      return (
        secondScore - firstScore ||
        stableHash(`${offerId}:${first.id}`) - stableHash(`${offerId}:${second.id}`)
      );
    })
    .slice(0, count);
}

function getSecondaryRaceScore(
  candidate: SecondaryRaceCandidate,
  prestige: Sponsor["prestige"],
): number {
  const categoryOrder: RaceCategoryCode[] =
    prestige >= 4
      ? ["elite", "world", "continental", "national", "regional"]
      : prestige >= 2
        ? ["continental", "world", "national", "elite", "regional"]
        : ["national", "continental", "world", "elite", "regional"];
  const categoryScore = categoryOrder.length - categoryOrder.indexOf(candidate.categoryCode);
  return (candidate.isDomestic ? 100 : 0) + categoryScore * 10;
}

function hydrateSecondarySponsor(
  sponsor: CatalogRow,
  country: CountryRow,
): SecondarySponsorIdentity {
  return {
    id: sponsor.id,
    name: sponsor.name,
    countryCode: country.iso_alpha2,
    countryName: country.name,
    prestige: toSponsorPrestige(sponsor.prestige),
    primaryColor: sponsor.primary_color,
    accentColor: sponsor.accent_color,
    logoVariant: sponsor.logo_variant,
  };
}

function hydrateSecondaryObjective(row: ObjectiveRow): SecondarySponsorObjective {
  return {
    id: row.id,
    name:
      row.target_rank === 1
        ? `Remporter ${row.race_label}`
        : `Top ${row.target_rank} sur ${row.race_label}`,
    raceLabel: row.race_label,
    raceSlug: row.race_slug,
    categoryCode: row.race_category_code,
    targetRank: row.target_rank,
    cashReward: Number(row.cash_reward),
    status: row.status,
    bestRank: row.best_rank,
  };
}

function groupObjectivesByOfferId(
  rows: readonly ObjectiveRow[],
): Map<string, ObjectiveRow[]> {
  const grouped = new Map<string, ObjectiveRow[]>();
  for (const row of rows) {
    const current = grouped.get(row.offer_id) ?? [];
    current.push(row);
    grouped.set(row.offer_id, current);
  }
  return grouped;
}

function toSponsorPrestige(value: number): Sponsor["prestige"] {
  if (value <= 1) return 1;
  if (value === 2) return 2;
  if (value === 3) return 3;
  if (value === 4) return 4;
  return 5;
}
