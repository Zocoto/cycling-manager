import "server-only";

import { SPONSORS } from "@/data/sponsors";
import type { RaceCategoryCode } from "@/lib/game/race-calendar";
import {
  calculateSecondarySponsorObjectiveReward,
  calculateSecondarySponsorNationalityReward,
  getSecondarySponsorFundingProfiles,
  getSecondarySponsorObjectiveDifficulty,
  priceSecondarySponsorOffers,
  getSecondarySponsorFailurePenalty,
  getSecondarySponsorNationalityTarget,
  getSecondarySponsorEligibleCategoryCodes,
  getSecondarySponsorObjectiveCount,
  getSecondarySponsorTargetRank,
  SECONDARY_SPONSOR_OFFER_COUNT,
  SECONDARY_SPONSOR_GENERATION_VERSION,
  SECONDARY_SPONSOR_PLAN_VERSION,
  SECONDARY_SPONSOR_REPUTATION_THRESHOLD,
  SECONDARY_SPONSOR_START_GAME_YEAR,
  type SecondarySponsorIdentity,
  type SecondarySponsorLogoPlacement,
  type SecondarySponsorLogoVariant,
  type SecondarySponsorObjective,
} from "@/lib/game/secondary-sponsor";
import { stableHash } from "@/lib/game/sponsor-main-objective";
import { getSecondarySponsorLibraryBrand } from "@/lib/game/secondary-sponsor-library";
import { getSecondarySponsorLogoBackgroundColor } from "@/lib/game/secondary-sponsor-logo-backgrounds";
import { getSecondarySponsorPrincipalJerseyId } from "@/lib/game/secondary-sponsor-jersey";
import { selectSecondarySponsorCountryCodes } from "@/lib/game/secondary-sponsor-nationality";
import { resolveSponsorObjectiveSportingLevel } from "@/lib/game/sponsor-objective-sporting-level";
import { loadSponsorObjectiveSportingContext } from "@/services/sponsor-objective-sporting-context";
import { loadTeamSponsorCountryAffinity } from "@/services/sponsor-team-affinity";
import { GAMEPLAY_RULES, isFutureSponsoringWindowOpen } from "@/lib/gameplay-rules";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  collectChunkedPaginatedRows,
  collectPaginatedRows,
} from "@/lib/supabase/pagination";
import type { Sponsor } from "@/types/sponsor";

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

const SECONDARY_CALENDAR_PAGE_SIZE = 500;
const SECONDARY_RELATION_BATCH_SIZE = 75;

export type SecondarySponsorOffer = {
  id: string;
  sponsor: SecondarySponsorIdentity;
  objectives: SecondarySponsorObjective[];
  totalMaximumReward: number;
  principalCountryCode?: string | null;
  principalBudgetPerSeason?: number | null;
  maximumRewardBudget?: number | null;
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
  principalCountryCode?: string | null;
  principalTeamName?: string | null;
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
      kind: "principal-required";
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
  country_id: string | null;
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
  catalog_key: string;
  source_sponsor_id: string | null;
  available_for_offers: boolean;
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
  generation_version: number;
  principal_country_id: string | null;
  principal_budget_per_season: number | string | null;
  maximum_reward_budget: number | string | null;
};

type ObjectiveRow = {
  id: string;
  offer_id: string;
  display_order: number;
  objective_kind: "race_result" | "roster_nationality";
  race_edition_id: string | null;
  race_slug: string | null;
  race_label: string | null;
  race_category_code: RaceCategoryCode | null;
  target_rank: number | null;
  target_country_id: string | null;
  required_rider_count: number | null;
  current_rider_count: number | null;
  reputation_penalty: number | string;
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
  logo_color_mode: SecondarySponsorLogoPlacement["colorMode"];
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

type RaceRow = { id: string; country_id: string; slug: string; status: string;
  race_format?: "one_day" | "stage_race"; is_grand_tour?: boolean; is_monument?: boolean };
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
    .select("id, reputation_points, country_id")
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
    currentSeasonId: activeSeason.id,
    directorCountryId: director.country_id,
  });

  if (offers === null) {
    return { kind: "principal-required", activeContract, targetGameYear, targetSeasonName: targetSeason.name };
  }
  if (offers.length === 0) {
    const signed = await loadSecondaryContract({ supabase, teamId: assignment.team_id, seasonId: targetSeason.id });
    if (signed) return { kind: "signed", activeContract,
      contract: await hydrateSecondaryContract({ supabase, contract: signed, targetSeason, teamId: assignment.team_id }) };
  }

  return {
    kind: "offers",
    activeContract,
    countryCode: offers[0]?.sponsor.countryCode ?? country.iso_alpha2,
    countryName: offers[0]?.sponsor.countryName ?? country.name,
    targetGameYear,
    targetSeasonName: targetSeason.name,
    offers,
  };
}

type SecondaryOfferContext = {
  roster_size: number;
  roster_country_counts: Record<string, number>;
  principal_country_id: string | null;
  principal_budget_per_season: number | string | null;
  principal_sponsor_id?: string | null;
};
const SECONDARY_CATALOG_COLUMNS = "id, catalog_key, source_sponsor_id, available_for_offers, country_id, name, prestige, primary_color, accent_color, logo_variant";

async function loadSecondaryCatalog(supabase: SupabaseAdminClient, ids?: string[]): Promise<CatalogRow[]> {
  if (ids && ids.length === 0) return [];
  const { data, error } = await collectPaginatedRows({
    pageSize: SECONDARY_CALENDAR_PAGE_SIZE,
    fetchPage: async (from, to) => {
      let query = supabase.from("secondary_sponsor_catalog").select(SECONDARY_CATALOG_COLUMNS);
      if (ids) query = query.in("id", ids);
      else query = query.eq("available_for_offers", true).not("source_sponsor_id", "is", null);
      return await query.order("id", { ascending: true }).range(from, to).returns<CatalogRow[]>();
    },
  });
  if (error) throw new Error(`Impossible de charger le catalogue secondaire : ${error.message}`);
  return data ?? [];
}

async function loadSecondaryCountries(supabase: SupabaseAdminClient, ids: readonly string[]): Promise<Map<string, CountryRow>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const { data, error } = await collectChunkedPaginatedRows({
    values: unique, chunkSize: SECONDARY_RELATION_BATCH_SIZE,
    pageSize: SECONDARY_CALENDAR_PAGE_SIZE, maxConcurrency: 1,
    fetchPage: async (batch, from, to) => await supabase.from("countries")
      .select("id, name, iso_alpha2").in("id", batch).order("id", { ascending: true })
      .range(from, to).returns<CountryRow[]>(),
  });
  if (error) throw new Error(`Impossible de charger les nationalités des partenaires : ${error.message}`);
  return new Map((data ?? []).map(country => [country.id, country]));
}

async function ensureAndLoadSecondarySponsorOffers({
  supabase, directorId, teamId, targetSeason, reputationPoints, currentSeasonId, directorCountryId,
}: {
  supabase: SupabaseAdminClient;
  directorId: string;
  teamId: string;
  targetSeason: SeasonRow;
  country: CountryRow;
  reputationPoints: number;
  currentSeasonId: string;
  directorCountryId: string | null;
}): Promise<SecondarySponsorOffer[] | null> {
  let offerRows = await loadSecondaryOfferRows({ supabase, directorId, teamId, targetSeasonId: targetSeason.id });
  let sponsors = await loadSecondaryCatalog(supabase, offerRows.map(offer => offer.secondary_sponsor_id));
  let objectives = await loadSecondaryObjectiveRows({ supabase, offerIds: offerRows.map(offer => offer.id) });
  let sponsorById = new Map(sponsors.map(sponsor => [sponsor.id, sponsor]));
  const objectivesByOffer = groupObjectivesByOfferId(objectives);
  const needsGeneration = !offerRows.some(offer => offer.status === "accepted") && (
    offerRows.filter(offer => offer.status === "open").length !== SECONDARY_SPONSOR_OFFER_COUNT ||
    offerRows.some(offer => offer.status === "open" && (
      offer.generation_version < SECONDARY_SPONSOR_GENERATION_VERSION ||
      !isSelectableLibrarySponsor(sponsorById.get(offer.secondary_sponsor_id)) ||
      (objectivesByOffer.get(offer.id)?.length ?? 0) < getSecondarySponsorObjectiveCount(toSponsorPrestige(sponsorById.get(offer.secondary_sponsor_id)?.prestige ?? 1))
    )) || new Set(offerRows.filter(offer => offer.status === "open").map(offer => sponsorById.get(offer.secondary_sponsor_id)?.source_sponsor_id)).size !== SECONDARY_SPONSOR_OFFER_COUNT
  );

  if (!needsGeneration && offerRows.some(offer => offer.status === "open" && (
    !Number.isFinite(Number(offer.principal_budget_per_season)) || Number(offer.principal_budget_per_season) <= 0
    || !Number.isFinite(Number(offer.maximum_reward_budget)) || Number(offer.maximum_reward_budget) <= 0
  ))) return null;

  if (needsGeneration) {
    const contextResult = await supabase.rpc("get_secondary_sponsor_offer_context", {
      p_team_id: teamId, p_target_season_id: targetSeason.id,
    });
    if (contextResult.error || !contextResult.data) throw new Error("Le contexte des objectifs secondaires est indisponible.");
    const context = contextResult.data as SecondaryOfferContext;
    const principalBudget = Number(context.principal_budget_per_season);
    if (!Number.isFinite(principalBudget) || principalBudget <= 0) return null;
    const [catalogRows, affinity, snapshot] = await Promise.all([
      loadSecondaryCatalog(supabase),
      loadTeamSponsorCountryAffinity({ supabase, teamId, seasonId: currentSeasonId, directorCountryId }),
      loadSponsorObjectiveSportingContext({ supabase, teamId, seasonId: targetSeason.id, targetSeasonGameYear: targetSeason.game_year }),
    ]);
    const catalog = catalogRows.filter(sponsor => isSelectableLibrarySponsor(sponsor)
      && sponsor.source_sponsor_id !== context.principal_sponsor_id);
    const countries = await loadSecondaryCountries(supabase, [
      ...catalog.map(sponsor => sponsor.country_id), ...(context.principal_country_id ? [context.principal_country_id] : []),
    ]);
    const principalCountry = context.principal_country_id ? countries.get(context.principal_country_id) : null;
    const level = resolveSponsorObjectiveSportingLevel({
      context: snapshot.teamSportingContext, ratings: snapshot.teamRiderCandidates.map(rider => rider.ratings),
    });
    const sportingReputation = Math.max(reputationPoints, level?.division === "elite" ? 10_000 : level?.division === "world" ? 5_000 : reputationPoints);
    const seed = `${directorId}:${teamId}:${targetSeason.id}:v${SECONDARY_SPONSOR_PLAN_VERSION}`;
    const pricingSeed = `${seed}:pricing-v${SECONDARY_SPONSOR_GENERATION_VERSION}`;
    const countrySlots = selectSecondarySponsorCountryCodes({
      affinity, seed, availableCountryCodes: catalog.flatMap(sponsor => {
        const country = countries.get(sponsor.country_id);
        return country ? [country.iso_alpha2] : [];
      }),
    });
    const selectedIds = new Set<string>();
    const selectedNames = new Set<string>();
    const targetPrestige = level?.division === "elite" ? 5 : level?.division === "world" ? 4 : 3;
    const rankedCatalog = [...catalog].sort((first, second) => Math.abs(first.prestige - targetPrestige) - Math.abs(second.prestige - targetPrestige)
      || stableHash(`${seed}:${first.id}`) - stableHash(`${seed}:${second.id}`) || first.id.localeCompare(second.id));
    const selectedSponsors = countrySlots.map(code => {
      const unused = (candidate: CatalogRow) => !selectedIds.has(candidate.source_sponsor_id!) && !selectedNames.has(candidate.name.trim().toLowerCase());
      const sponsor = rankedCatalog.find(candidate => countries.get(candidate.country_id)?.iso_alpha2.trim().toUpperCase() === code && unused(candidate))
        ?? rankedCatalog.find(unused);
      if (!sponsor) throw new Error("Le catalogue secondaire ne contient pas trois partenaires distincts adaptés à l’équipe.");
      selectedIds.add(sponsor.source_sponsor_id!);
      selectedNames.add(sponsor.name.trim().toLowerCase());
      return sponsor;
    });
    if (selectedSponsors.length !== SECONDARY_SPONSOR_OFFER_COUNT) throw new Error("Le catalogue secondaire est incomplet.");
    const raceCandidates = await loadSecondaryRaceCandidates({ supabase, seasonId: targetSeason.id, reputationPoints });
    const fundingProfiles = getSecondarySponsorFundingProfiles(pricingSeed, selectedSponsors.map(sponsor => sponsor.id));
    const draftProposals = selectedSponsors.map(sponsor => {
      const sponsorCountry = countries.get(sponsor.country_id);
      if (!sponsorCountry) throw new Error("La nationalité d’un partenaire est indisponible.");
      const prestige = toSponsorPrestige(sponsor.prestige);
      const requiredRiderCount = getSecondarySponsorNationalityTarget({
        rosterSize: context.roster_size, prestige, sponsorCountryCode: sponsorCountry.iso_alpha2,
        principalCountryCode: principalCountry?.iso_alpha2 ?? null,
      });
      const objectiveCount = getSecondarySponsorObjectiveCount(prestige);
      const selectedRaces = selectSecondarySponsorRaces({
        offerId: `${seed}:${sponsor.id}`, raceCandidates, count: objectiveCount - Number(requiredRiderCount > 0),
        sportingReputation, sponsorCountryId: sponsor.country_id, eliteEligible: level?.division === "elite",
      });
      if (selectedRaces.length !== objectiveCount - Number(requiredRiderCount > 0)) {
        throw new Error(`Le calendrier ne permet pas de créer ${objectiveCount} objectifs secondaires distincts et adaptés.`);
      }
      const rewardWeights: { weight: number; difficulty: number }[] = [];
      const goals: Record<string, unknown>[] = selectedRaces.map((race, index) => {
        const targetRank = getSecondarySponsorTargetRank({ prestige, categoryCode: race.categoryCode, index,
          fundingProfile: fundingProfiles.get(sponsor.id) });
        const reward = calculateSecondarySponsorObjectiveReward({ prestige, categoryCode: race.categoryCode, targetRank, reputationPoints: sportingReputation });
        const difficulty = getSecondarySponsorObjectiveDifficulty({ categoryCode: race.categoryCode, targetRank,
          raceFormat: race.raceFormat, isGrandTour: race.isGrandTour, isMonument: race.isMonument });
        rewardWeights.push({ weight: reward * difficulty, difficulty });
        return { objective_kind: "race_result", race_edition_id: race.id, race_slug: race.slug,
          race_label: race.label, race_category_code: race.categoryCode, target_rank: targetRank,
          cash_reward: reward, reputation_penalty: getSecondarySponsorFailurePenalty(reward) };
      });
      if (requiredRiderCount > 0) {
        const reward = calculateSecondarySponsorNationalityReward({ targetCount: requiredRiderCount, prestige, reputationPoints: sportingReputation });
        const difficulty = 0.5 + requiredRiderCount * 0.12;
        rewardWeights.push({ weight: reward * difficulty, difficulty });
        goals.push({ objective_kind: "roster_nationality", target_country_id: sponsor.country_id,
          required_rider_count: requiredRiderCount, cash_reward: reward, reputation_penalty: getSecondarySponsorFailurePenalty(reward) });
      }
      return { secondary_sponsor_id: sponsor.id, objectives: goals, rewardWeights };
    });
    const rewards = priceSecondarySponsorOffers({ principalBudgetPerSeason: principalBudget, seed: pricingSeed,
      offers: draftProposals.map(offer => ({ id: offer.secondary_sponsor_id, objectives: offer.rewardWeights })) });
    const proposals = draftProposals.map((offer, offerIndex) => ({ secondary_sponsor_id: offer.secondary_sponsor_id,
      objectives: offer.objectives.map((goal, index) => ({ ...goal, cash_reward: rewards[offerIndex][index],
        reputation_penalty: getSecondarySponsorFailurePenalty(rewards[offerIndex][index]),
      })) }));
    const { error } = await supabase.rpc("replace_secondary_sponsor_offers", {
      p_director_id: directorId, p_team_id: teamId, p_target_season_id: targetSeason.id,
      p_offers: proposals, p_generation_version: SECONDARY_SPONSOR_GENERATION_VERSION,
    });
    if (error) throw new Error(`Impossible d’actualiser les propositions secondaires : ${error.message}`);
    // The atomic RPC may preserve a concurrently signed contract or already complete proposals.
    offerRows = await loadSecondaryOfferRows({ supabase, directorId, teamId, targetSeasonId: targetSeason.id });
    sponsors = await loadSecondaryCatalog(supabase, offerRows.map(offer => offer.secondary_sponsor_id));
    sponsorById = new Map(sponsors.map(sponsor => [sponsor.id, sponsor]));
    objectives = await loadSecondaryObjectiveRows({ supabase, offerIds: offerRows.map(offer => offer.id) });
  }
  const countries = await loadSecondaryCountries(supabase, [
    ...sponsors.map(sponsor => sponsor.country_id),
    ...offerRows.flatMap(offer => offer.principal_country_id ? [offer.principal_country_id] : []),
    ...objectives.flatMap(objective => objective.target_country_id ? [objective.target_country_id] : []),
  ]);
  const objectivesByOfferId = groupObjectivesByOfferId(objectives);
  return offerRows.filter(offer => offer.status === "open").map(offer => {
    const sponsor = sponsorById.get(offer.secondary_sponsor_id);
    const country = sponsor ? countries.get(sponsor.country_id) : null;
    if (!sponsor || !country) throw new Error("Une identité de sponsor secondaire est introuvable.");
    const hydratedObjectives = (objectivesByOfferId.get(offer.id) ?? []).map(row => hydrateSecondaryObjective(row, countries));
    return { id: offer.id, sponsor: hydrateSecondarySponsor(sponsor, country), objectives: hydratedObjectives,
      principalCountryCode: offer.principal_country_id ? countries.get(offer.principal_country_id)?.iso_alpha2 ?? null : null,
      principalBudgetPerSeason: offer.principal_budget_per_season === null ? null : Number(offer.principal_budget_per_season),
      maximumRewardBudget: offer.maximum_reward_budget === null ? null : Number(offer.maximum_reward_budget),
      totalMaximumReward: hydratedObjectives.reduce((total, objective) => total + Math.round(objective.cashReward * 100), 0) / 100 };
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
      "id, offer_id, season_id, secondary_sponsor_id, status, logo_x_percent, logo_y_percent, logo_scale, logo_rotation_degrees, logo_color_mode",
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
  const [catalogResult, countryResult, objectiveRows, principalIdentity] = await Promise.all([
    supabase
      .from("secondary_sponsor_catalog")
      .select(SECONDARY_CATALOG_COLUMNS)
      .eq("id", contract.secondary_sponsor_id)
      .maybeSingle<CatalogRow>(),
    loadContractCountry(supabase, contract.secondary_sponsor_id),
    loadSecondaryObjectiveRows({ supabase, offerIds: [contract.offer_id] }),
    loadFuturePrincipalJersey({ supabase, teamId, targetSeason }),
  ]);

  if (catalogResult.error || !catalogResult.data || !countryResult) {
    throw new Error("L’identité du sponsor secondaire signé est indisponible.");
  }

  const objectiveCountries = await loadSecondaryCountries(supabase, objectiveRows.flatMap(row => row.target_country_id ? [row.target_country_id] : []));
  return {
    id: contract.id,
    status: contract.status,
    seasonId: contract.season_id,
    targetGameYear: targetSeason.game_year,
    targetSeasonName: targetSeason.name,
    sponsor: hydrateSecondarySponsor(catalogResult.data, countryResult),
    objectives: objectiveRows.map(row => hydrateSecondaryObjective(row, objectiveCountries)),
    principalCountryCode: principalIdentity?.sponsor.countryCode ?? null,
    principalTeamName: principalIdentity?.sponsor.name ?? null,
    logoPlacement: {
      xPercent: Number(contract.logo_x_percent),
      yPercent: Number(contract.logo_y_percent),
      scale: Number(contract.logo_scale),
      rotationDegrees: Number(contract.logo_rotation_degrees),
      colorMode: contract.logo_color_mode ?? "original",
    },
    baseJersey: principalIdentity?.jersey ? { ...principalIdentity, jersey: principalIdentity.jersey } : null,
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
}): Promise<Omit<SecondarySponsorBaseJersey, "jersey"> & { jersey: SecondarySponsorBaseJersey["jersey"] | null } | null> {
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

  const planned = targetSeason.status === "planned" ? (contracts ?? []).find(
    (candidate) =>
      candidate.status === "planned" && candidate.start_season_id === targetSeason.id,
  ) : undefined;
  const active = (contracts ?? []).find((candidate) => candidate.status === "active");
  const contract = planned ?? active;
  if (!contract) return null;

  const years = new Map<string, number>([[targetSeason.id, targetSeason.game_year]]);
  const missingSeasonIds = [...new Set([contract.start_season_id, contract.end_season_id]
    .filter((id): id is string => Boolean(id)))].filter(id => !years.has(id));
  if (missingSeasonIds.length > 0) {
    const { data: periodSeasons, error: periodError } = await supabase
      .from("seasons")
      .select("id, game_year")
      .in("id", missingSeasonIds)
      .returns<Array<{ id: string; game_year: number }>>();
    if (periodError) throw new Error("La période du contrat principal est indisponible.");
    for (const season of periodSeasons ?? []) years.set(season.id, season.game_year);
  }
  const startYear = years.get(contract.start_season_id);
  const endYear = contract.end_season_id
    ? years.get(contract.end_season_id)
    : startYear === undefined ? undefined : startYear + contract.contract_duration_seasons - 1;
  if (startYear === undefined || endYear === undefined
    || targetSeason.game_year < startYear || targetSeason.game_year > endYear) return null;

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

  const jerseyId = getSecondarySponsorPrincipalJerseyId(contract, targetSeason);
  const jersey = sponsor.jerseys.find((candidate) => candidate.id === jerseyId) ?? null;

  return { sponsor, jersey, futureTeamName: sponsor.name };
}

async function loadSecondaryOfferRows({
  supabase,
  directorId,
  teamId,
  targetSeasonId,
}: {
  supabase: SupabaseAdminClient;
  directorId: string;
  teamId: string;
  targetSeasonId: string;
}): Promise<OfferRow[]> {
  const { data, error } = await supabase
    .from("secondary_sponsor_offers")
    .select("id, secondary_sponsor_id, status, generation_version, principal_country_id, principal_budget_per_season, maximum_reward_budget")
    .eq("sporting_director_id", directorId)
    .eq("team_id", teamId)
    .eq("target_season_id", targetSeasonId)
    .in("status", ["open", "accepted"])
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
      "id, offer_id, display_order, race_edition_id, race_slug, race_label, race_category_code, target_rank, cash_reward, status, best_rank, objective_kind, target_country_id, required_rider_count, current_rider_count, reputation_penalty",
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
  raceFormat: "one_day" | "stage_race";
  isGrandTour: boolean;
  isMonument: boolean;
};

async function loadSecondaryRaceCandidates({
  supabase,
  seasonId,
  reputationPoints,
}: {
  supabase: SupabaseAdminClient;
  seasonId: string;
  reputationPoints: number;
}): Promise<SecondaryRaceCandidate[]> {
  const { data: editions, error: editionError } = await collectPaginatedRows({
    pageSize: SECONDARY_CALENDAR_PAGE_SIZE,
    fetchPage: async (from, to) => await supabase
      .from("race_editions")
      .select(
        "id, race_id, race_category_id, display_name, registration_policy, minimum_reputation, status",
      )
      .eq("season_id", seasonId)
      .neq("status", "cancelled")
      .eq("registration_policy", "open")
      // This column is integer; floor keeps the exact eligibility rule for
      // fractional director reputation without sending an invalid SQL literal.
      .lte("minimum_reputation", Math.floor(reputationPoints))
      .order("id", { ascending: true })
      .range(from, to)
      .returns<RaceEditionRow[]>(),
  });
  if (editionError) throw new Error(`Calendrier secondaire indisponible : ${editionError.message}`);

  const raceIds = [...new Set((editions ?? []).map((edition) => edition.race_id))];
  if (raceIds.length === 0) return [];
  const categoryIds = [
    ...new Set((editions ?? []).map((edition) => edition.race_category_id)),
  ];
  const [racesResult, categoriesResult] = await Promise.all([
    collectChunkedPaginatedRows({
      values: raceIds,
      chunkSize: SECONDARY_RELATION_BATCH_SIZE,
      pageSize: SECONDARY_CALENDAR_PAGE_SIZE,
      maxConcurrency: 1,
      fetchPage: async (ids, from, to) => await supabase
        .from("races")
        .select("id, country_id, slug, status, race_format, is_grand_tour, is_monument")
        .in("id", ids)
        .order("id", { ascending: true })
        .range(from, to)
        .returns<RaceRow[]>(),
    }),
    supabase
      .from("race_categories")
      .select("id, code")
      .in("id", categoryIds)
      .returns<RaceCategoryRow[]>(),
  ]);
  if (racesResult.error || categoriesResult.error) {
    const error = racesResult.error ?? categoriesResult.error;
    console.error("secondary_sponsor_calendar_read_failed", {
      relation: racesResult.error ? "races" : "race_categories",
      code: error?.code,
      message: error?.message.slice(0, 200),
    });
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
        raceFormat: race.race_format ?? "one_day",
        isGrandTour: race.is_grand_tour === true,
        isMonument: race.is_monument === true,
      },
    ];
  });
}

function selectSecondarySponsorRaces({
  offerId, raceCandidates, count, sportingReputation, sponsorCountryId, eliteEligible,
}: {
  offerId: string; raceCandidates: readonly SecondaryRaceCandidate[]; count: number;
  sportingReputation: number; sponsorCountryId: string; eliteEligible: boolean;
}): SecondaryRaceCandidate[] {
  const categories = new Set(getSecondarySponsorEligibleCategoryCodes(sportingReputation));
  const categoryRank: Record<RaceCategoryCode, number> = { elite: 3, world: 2, continental: 1, national: 0, regional: -1, local: -2 };
  const compare = (first: SecondaryRaceCandidate, second: SecondaryRaceCandidate) =>
    categoryRank[second.categoryCode] - categoryRank[first.categoryCode]
      || Number(second.countryId === sponsorCountryId) - Number(first.countryId === sponsorCountryId)
      || stableHash(`${offerId}:${first.id}`) - stableHash(`${offerId}:${second.id}`)
      || first.id.localeCompare(second.id);
  const core = raceCandidates.filter(candidate => categories.has(candidate.categoryCode)
    && (candidate.categoryCode !== "elite" || eliteEligible)).sort(compare).slice(0, count);
  if (core.length < count) {
    const domesticNational = raceCandidates.filter(candidate => candidate.categoryCode === "national"
      && candidate.countryId === sponsorCountryId).sort(compare)[0];
    if (domesticNational) core.push(domesticNational);
  }
  return core;
}

function hydrateSecondarySponsor(
  sponsor: CatalogRow,
  country: CountryRow,
): SecondarySponsorIdentity {
  const brand = getSecondarySponsorLibraryBrand(sponsor.catalog_key);
  if (sponsor.source_sponsor_id && (!brand || brand.countryCode !== country.iso_alpha2 || brand.name !== sponsor.name)) {
    throw new Error("L’identité nationale d’un sponsor secondaire est incohérente avec la bibliothèque.");
  }
  return {
    id: sponsor.id,
    name: sponsor.name,
    countryCode: country.iso_alpha2,
    countryName: country.name,
    prestige: toSponsorPrestige(sponsor.prestige),
    primaryColor: sponsor.primary_color,
    accentColor: sponsor.accent_color,
    logoVariant: sponsor.logo_variant,
    ...(brand ? { logoPath: brand.logoPath, sector: brand.sector,
      logoBackgroundColor: getSecondarySponsorLogoBackgroundColor(brand.logoPath) } : {}),
  };
}

function isSelectableLibrarySponsor(sponsor: CatalogRow | undefined): sponsor is CatalogRow {
  return Boolean(sponsor?.available_for_offers && sponsor.source_sponsor_id
    && getSecondarySponsorLibraryBrand(sponsor.catalog_key)?.name === sponsor.name);
}

function hydrateSecondaryObjective(row: ObjectiveRow, countries: ReadonlyMap<string, CountryRow>): SecondarySponsorObjective {
  const common = { id: row.id, cashReward: Number(row.cash_reward), reputationPenalty: Number(row.reputation_penalty ?? 0), status: row.status, bestRank: row.best_rank };
  if (row.objective_kind === "roster_nationality") {
    const country = row.target_country_id ? countries.get(row.target_country_id) : null;
    if (!country || !row.required_rider_count) throw new Error("L’objectif de contingent secondaire est incomplet.");
    return { ...common, kind: "roster_nationality", name: `${row.required_rider_count} coureurs de nationalité ${country.iso_alpha2}`,
      raceLabel: null, raceSlug: null, raceEditionId: null, categoryCode: null, targetRank: null,
      nationalityCountryCode: country.iso_alpha2, nationalityCountryName: country.name,
      requiredRiderCount: row.required_rider_count, currentRiderCount: Number(row.current_rider_count ?? 0) };
  }
  if (!row.race_label || !row.race_slug || !row.race_edition_id || !row.race_category_code || !row.target_rank) throw new Error("L’objectif de course secondaire est incomplet.");
  return { ...common, kind: "race_result", name: row.target_rank === 1 ? `Remporter ${row.race_label}` : `Top ${row.target_rank} sur ${row.race_label}`,
    raceLabel: row.race_label, raceSlug: row.race_slug, raceEditionId: row.race_edition_id,
    categoryCode: row.race_category_code, targetRank: row.target_rank };
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
