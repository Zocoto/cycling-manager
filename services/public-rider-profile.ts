import "server-only";

import {
  normalizeEquipmentEffects,
  type EquipmentEffects,
  type EquipmentSlot,
} from "@/lib/game/equipment";
import {
  isSeasonPartOfRiderHistory,
  resolvePublicTeamName,
  type RiderRatings,
} from "@/lib/game/rider-profile";
import {
  isRiderSpecialAbility,
  type RiderSpecialAbility,
} from "@/lib/game/special-abilities";
import {
  getTeamDivisionLabel,
  normalizeTeamDivisionCode,
} from "@/lib/game/team-divisions";
import {
  RIDER_INJURY_DIAGNOSES,
  type RiderInjuryDiagnosisCode,
} from "@/lib/game/health-center";
import { indexLatestTrainingSessionsByRider } from "@/lib/game/training";
import {
  createStandardTransferScoutingReport,
  type TransferScoutingReport,
} from "@/lib/game/transfer-scouting";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type RiderEquipmentSlot = EquipmentSlot;

export type PublicRiderProfile = {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
  country: {
    id: string;
    name: string;
    code: string;
  };
  avatarProfileKey: string;
  avatarSeed: number | string;
  activeSeason: {
    id: string;
    name: string;
    gameYear: number;
  } | null;
  age: number | null;
  potentialSteps: number | null;
  ratings: RiderRatings | null;
  scoutingReport: TransferScoutingReport | null;
  condition: {
    form: number;
    dayNumber: number | null;
  };
  medical: {
    diagnosisCode: string;
    label: string;
    startedAt: string;
    expectedRecoveryAt: string;
    remainingHours: number;
  } | null;
  trainingReport: {
    dayNumber: number;
    status: string;
    intensity: number;
    domain: string;
    formDelta: number;
    progressMilli: Record<string, number>;
    declineMilli: Record<string, number>;
    ratingChanges: Record<string, number>;
  } | null;
  currentTeam: {
    id: string;
    displayName: string;
    shortName: string | null;
    divisionCode: string;
    divisionName: string;
  } | null;
  nationalTitles: Array<{
    type: "road" | "time_trial";
    seasonId: string;
    seasonName: string;
    countryName: string;
    countryCode: string;
    isActive: boolean;
  }>;
  history: Array<{
    seasonId: string;
    seasonName: string;
    gameYear: number;
    teamId: string;
    teamName: string;
    victories: number | null;
    points: number | null;
    uciRank: number | null;
    nationalTitles: Array<{
      type: "road" | "time_trial";
      countryName: string;
      countryCode: string;
    }>;
  }>;
  specialAbilities: RiderSpecialAbility[];
  equipment: Partial<Record<RiderEquipmentSlot, {
    id: string;
    name: string;
    catalogKey: string;
    imagePath: string;
    effectSummary: string;
    effects: EquipmentEffects;
  }>>;
  privateContract: {
    salaryPerSeason: number;
    currencyCode: string;
    startSeasonName: string;
    endSeasonName: string;
    status: string;
    signedAt: string | null;
  } | null;
  canManage: boolean;
};

type RiderRow = {
  id: string;
  country_id: string;
  first_name: string;
  last_name: string;
  status: string;
  avatar_profile_key: string;
  avatar_seed: number | string;
  potential_steps: number;
};

type CountryRow = {
  id: string;
  name: string;
  iso_alpha2: string;
};

type SeasonRow = {
  id: string;
  game_year: number;
  name: string;
  status: string;
  current_day_number: number | null;
};

type RatingRow = {
  season_id: string;
  age: number;
  mountain: number;
  hills: number;
  flat: number;
  time_trial: number;
  cobbles: number;
  sprint: number;
  acceleration: number;
  downhill: number;
  endurance: number;
  resistance: number;
  recovery: number;
  breakaway: number;
  prologue: number;
};

type ContractRow = {
  team_id: string;
  start_season_id: string;
  end_season_id: string;
  salary_per_season: number | string;
  currency_code: string;
  status: string;
  signed_at: string | null;
};

type SummaryRow = {
  season_id: string;
  victories: number | null;
  points: number | null;
  uci_rank: number | null;
};

type NationalChampionshipTitleRow = {
  country_id: string;
  season_id: string;
  championship_type: "road" | "time_trial";
  relinquished_at: string | null;
};

type TeamRow = {
  id: string;
  internal_name: string;
  amateur_name: string | null;
};

type TeamSeasonRow = {
  team_id: string;
  season_id: string;
  display_name: string;
  short_name: string | null;
  division_id: string | null;
};

type SeasonDayRow = {
  id: string;
  day_number: number;
};

type ConditionRow = {
  season_day_id: string;
  form: number;
};

type InjuryRow = {
  diagnosis_code: string;
  started_at: string;
  expected_recovery_at: string;
};

type TrainingSessionRow = {
  rider_id: string;
  season_day_id: string;
  status: string;
  intensity: number;
  domain: string;
  form_delta: number;
  progress_milli: Record<string, number>;
  decline_milli: Record<string, number>;
  rating_changes: Record<string, number>;
  processed_at: string;
};

type EquipmentAssignmentRow = {
  slot_type: RiderEquipmentSlot;
  equipment_item_id: string;
};

type RiderSpecialAbilityRow = {
  ability_code: string;
};

type EquipmentItemRow = {
  id: string;
  catalog_key: string;
  name: string;
  slot_type: RiderEquipmentSlot;
  image_path: string;
  effect_summary: string;
  effect_payload: unknown;
};

type SportingDirectorRow = {
  id: string;
};

type ManagerAssignmentRow = {
  id: string;
};

export type PublicTeamRider = {
  id: string;
  firstName: string;
  lastName: string;
  countryName: string;
  countryCode: string;
  avatarProfileKey: string;
  avatarSeed: number | string;
  age: number | null;
};

type PublicTeamRiderRow = RiderRow;

export async function getPublicRiderProfile({
  riderIdentifier,
  viewerAuthUserId,
}: {
  riderIdentifier: string;
  viewerAuthUserId: string;
}): Promise<PublicRiderProfile | null> {
  const riderId = riderIdentifier.trim().toLowerCase();

  if (!isUuid(riderId)) {
    return null;
  }

  const supabase = createSupabaseAdminClient();
  const { error: trainingSettlementError } = await supabase.rpc(
    "settle_due_training_sessions"
  );
  if (trainingSettlementError) {
    throw new Error(
      `Impossible de mettre à jour l’entraînement du coureur : ${trainingSettlementError.message}`
    );
  }

  const { error: settlementError } = await supabase.rpc(
    "settle_finished_race_conditions"
  );

  if (settlementError) {
    throw new Error(
      `Impossible de mettre à jour la forme après les courses : ${settlementError.message}`
    );
  }

  const { error: healthSettlementError } = await supabase.rpc(
    "settle_current_health_and_form"
  );
  if (healthSettlementError) {
    throw new Error(
      `Impossible de mettre à jour la santé du coureur : ${healthSettlementError.message}`
    );
  }

  const { data: rider, error: riderError } = await supabase
    .from("riders")
    .select(
      "id, country_id, first_name, last_name, status, avatar_profile_key, avatar_seed, potential_steps"
    )
    .eq("id", riderId)
    .maybeSingle<RiderRow>();

  if (riderError) {
    throw new Error(`Impossible de charger le coureur : ${riderError.message}`);
  }

  if (!rider) {
    return null;
  }

  const [
    countryResult,
    seasonsResult,
    ratingsResult,
    contractsResult,
    summariesResult,
    equipmentAssignmentsResult,
    specialAbilitiesResult,
    injuryResult,
    marketListingResult,
    nationalTitlesResult,
  ] = await Promise.all([
    supabase
      .from("countries")
      .select("id, name, iso_alpha2")
      .eq("id", rider.country_id)
      .maybeSingle<CountryRow>(),
    supabase
      .from("seasons")
      .select("id, game_year, name, status, current_day_number")
      .order("game_year", { ascending: false })
      .returns<SeasonRow[]>(),
    supabase
      .from("rider_season_ratings")
      .select(
        "season_id, age, mountain, hills, flat, time_trial, cobbles, sprint, acceleration, downhill, endurance, resistance, recovery, breakaway, prologue"
      )
      .eq("rider_id", rider.id)
      .returns<RatingRow[]>(),
    supabase
      .from("rider_contracts")
      .select(
        "team_id, start_season_id, end_season_id, salary_per_season, currency_code, status, signed_at"
      )
      .eq("rider_id", rider.id)
      .in("status", ["planned", "active", "completed", "terminated"])
      .returns<ContractRow[]>(),
    supabase
      .from("rider_season_summaries")
      .select("season_id, victories, points, uci_rank")
      .eq("rider_id", rider.id)
      .returns<SummaryRow[]>(),
    supabase
      .from("rider_equipment_assignments")
      .select("slot_type, equipment_item_id")
      .eq("rider_id", rider.id)
      .returns<EquipmentAssignmentRow[]>(),
    supabase
      .from("rider_special_abilities")
      .select("ability_code")
      .eq("rider_id", rider.id)
      .returns<RiderSpecialAbilityRow[]>(),
    supabase
      .from("rider_injuries")
      .select("diagnosis_code, started_at, expected_recovery_at")
      .eq("rider_id", rider.id)
      .eq("status", "active")
      .gt("expected_recovery_at", new Date().toISOString())
      .order("expected_recovery_at", { ascending: false })
      .limit(1)
      .maybeSingle<InjuryRow>(),
    supabase
      .from("transfer_market_listings")
      .select("id")
      .eq("rider_id", rider.id)
      .eq("status", "open")
      .limit(1)
      .maybeSingle<{ id: string }>(),
    supabase
      .from("rider_national_championship_titles")
      .select("country_id, season_id, championship_type, relinquished_at")
      .eq("rider_id", rider.id)
      .returns<NationalChampionshipTitleRow[]>(),
  ]);

  assertQuery(countryResult.error, "le pays du coureur");
  assertQuery(seasonsResult.error, "les saisons");
  assertQuery(ratingsResult.error, "les caractéristiques du coureur");
  assertQuery(contractsResult.error, "l’historique contractuel du coureur");
  assertQuery(summariesResult.error, "les bilans saisonniers du coureur");
  assertQuery(equipmentAssignmentsResult.error, "les équipements du coureur");
  assertQuery(specialAbilitiesResult.error, "les capacités spéciales du coureur");
  assertQuery(injuryResult.error, "la situation médicale du coureur");
  assertQuery(marketListingResult.error, "la présence du coureur sur le marché");
  assertQuery(nationalTitlesResult.error, "les titres nationaux du coureur");

  if (!countryResult.data) {
    throw new Error("Le pays du coureur est introuvable.");
  }

  const seasons = seasonsResult.data ?? [];
  const ratings = ratingsResult.data ?? [];
  const contracts = contractsResult.data ?? [];
  const summaries = summariesResult.data ?? [];
  const nationalTitleRows = nationalTitlesResult.data ?? [];
  const equipmentAssignments = equipmentAssignmentsResult.data ?? [];
  const specialAbilities = (specialAbilitiesResult.data ?? [])
    .map((row) => row.ability_code)
    .filter(isRiderSpecialAbility);
  const activeSeason = seasons.find((season) => season.status === "active") ?? null;
  const currentContract =
    contracts.find((contract) => contract.status === "active") ?? null;
  const currentRating =
    (activeSeason
      ? ratings.find((rating) => rating.season_id === activeSeason.id)
      : null) ??
    [...ratings].sort(
      (left, right) =>
        getSeasonYear(seasons, right.season_id) -
        getSeasonYear(seasons, left.season_id)
    )[0] ??
    null;

  const teamIds = [...new Set(contracts.map((contract) => contract.team_id))];
  const equipmentItemIds = [
    ...new Set(equipmentAssignments.map((assignment) => assignment.equipment_item_id)),
  ];

  const [teamsResult, teamSeasonsResult, equipmentItemsResult] =
    await Promise.all([
      teamIds.length > 0
        ? supabase
            .from("teams")
            .select("id, internal_name, amateur_name")
            .in("id", teamIds)
            .returns<TeamRow[]>()
        : Promise.resolve({ data: [] as TeamRow[], error: null }),
      teamIds.length > 0
        ? supabase
            .from("team_seasons")
            .select("team_id, season_id, display_name, short_name, division_id")
            .in("team_id", teamIds)
            .returns<TeamSeasonRow[]>()
        : Promise.resolve({ data: [] as TeamSeasonRow[], error: null }),
      equipmentItemIds.length > 0
        ? supabase
            .from("equipment_catalog_items")
            .select(
              "id, catalog_key, name, slot_type, image_path, effect_summary, effect_payload"
            )
            .in("id", equipmentItemIds)
            .eq("status", "active")
            .returns<EquipmentItemRow[]>()
        : Promise.resolve({ data: [] as EquipmentItemRow[], error: null }),
    ]);

  assertQuery(teamsResult.error, "les équipes du coureur");
  assertQuery(teamSeasonsResult.error, "les identités saisonnières des équipes");
  assertQuery(equipmentItemsResult.error, "le catalogue d’équipements");

  const teams = teamsResult.data ?? [];
  const teamSeasons = teamSeasonsResult.data ?? [];
  const divisionIds = [
    ...new Set(
      teamSeasons
        .map((teamSeason) => teamSeason.division_id)
        .filter((divisionId): divisionId is string => Boolean(divisionId))
    ),
  ];
  const { data: divisions, error: divisionsError } = divisionIds.length
    ? await supabase
        .from("divisions")
        .select("id, code")
        .in("id", divisionIds)
        .returns<Array<{ id: string; code: string }>>()
    : { data: [] as Array<{ id: string; code: string }>, error: null };
  assertQuery(divisionsError, "les divisions des équipes");
  const divisionCodeById = new Map(
    (divisions ?? []).map((division) => [division.id, division.code])
  );
  const currentTeamSeason = currentContract
    ? findTeamSeason({
        teamSeasons,
        teamId: currentContract.team_id,
        seasonId: activeSeason?.id ?? currentContract.end_season_id,
      })
    : null;
  const currentTeam = currentContract
    ? (() => {
        const divisionCode = normalizeTeamDivisionCode(
          currentTeamSeason?.division_id
            ? divisionCodeById.get(currentTeamSeason.division_id)
            : null
        );
        return {
          id: currentContract.team_id,
          displayName: resolvePublicTeamName({
            seasonDisplayName: currentTeamSeason?.display_name,
            amateurName: teams.find((team) => team.id === currentContract.team_id)
              ?.amateur_name,
            internalName: teams.find((team) => team.id === currentContract.team_id)
              ?.internal_name,
          }),
          shortName: currentTeamSeason?.short_name ?? null,
          divisionCode,
          divisionName: getTeamDivisionLabel(divisionCode),
        };
      })()
    : null;

  const [condition, canManage] = await Promise.all([
    getCurrentCondition({
      supabase,
      riderId: rider.id,
      activeSeason,
    }),
    currentContract
      ? viewerManagesTeam({
          supabase,
          viewerAuthUserId,
          teamId: currentContract.team_id,
        })
      : Promise.resolve(false),
  ]);
  const exactRatings = currentRating ? toRatings(currentRating) : null;
  const isTransferTarget =
    rider.status === "free_agent" || Boolean(marketListingResult.data);
  const mustUseScoutingReport =
    !canManage && isTransferTarget && Boolean(exactRatings);
  const scoutingReport =
    mustUseScoutingReport && exactRatings
      ? createStandardTransferScoutingReport({
          riderId: rider.id,
          seasonId:
            activeSeason?.id ?? currentRating?.season_id ?? "hors-saison",
          ratings: exactRatings,
          potentialSteps: rider.potential_steps,
        })
      : null;

  const seasonById = new Map(seasons.map((season) => [season.id, season]));
  const trainingReport =
    canManage && activeSeason
      ? await getLatestPrivateTrainingReport({
          supabase,
          riderId: rider.id,
          seasonId: activeSeason.id,
        })
      : null;
  const summaryBySeasonId = new Map(
    summaries.map((summary) => [summary.season_id, summary])
  );
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const history = contracts
    .filter((contract) => contract.status !== "planned")
    .flatMap((contract) => {
      const startYear = getSeasonYear(seasons, contract.start_season_id);
      const endYear = getSeasonYear(seasons, contract.end_season_id);

      return seasons
        .filter(
          (season) =>
            isSeasonPartOfRiderHistory(season.status) &&
            season.game_year >= startYear &&
            season.game_year <= endYear
        )
        .map((season) => {
          const teamSeason = findTeamSeason({
            teamSeasons,
            teamId: contract.team_id,
            seasonId: season.id,
          });
          const summary = summaryBySeasonId.get(season.id);

          return {
            seasonId: season.id,
            seasonName: season.name,
            gameYear: season.game_year,
            teamId: contract.team_id,
            teamName: resolvePublicTeamName({
              seasonDisplayName: teamSeason?.display_name,
              amateurName: teamById.get(contract.team_id)?.amateur_name,
              internalName: teamById.get(contract.team_id)?.internal_name,
            }),
            victories: summary?.victories ?? null,
            points: summary?.points ?? null,
            uciRank: summary?.uci_rank ?? null,
            nationalTitles: nationalTitleRows
              .filter((title) => title.season_id === season.id)
              .map((title) => ({
                type: title.championship_type,
                countryName: countryResult.data!.name,
                countryCode: countryResult.data!.iso_alpha2,
              })),
          };
        });
    })
    .filter(
      (entry, index, entries) =>
        entries.findIndex(
          (candidate) =>
            candidate.seasonId === entry.seasonId &&
            candidate.teamId === entry.teamId
        ) === index
    )
    .sort((left, right) => right.gameYear - left.gameYear);

  const equipmentItems = new Map(
    (equipmentItemsResult.data ?? []).map((item) => [item.id, item])
  );
  const equipment: PublicRiderProfile["equipment"] = {};

  for (const assignment of equipmentAssignments) {
    const item = equipmentItems.get(assignment.equipment_item_id);

    if (item && item.slot_type === assignment.slot_type) {
      equipment[assignment.slot_type] = {
        id: item.id,
        name: item.name,
        catalogKey: item.catalog_key,
        imagePath: item.image_path,
        effectSummary: item.effect_summary,
        effects: normalizeEquipmentEffects(item.effect_payload),
      };
    }
  }

  const startSeason = currentContract
    ? seasonById.get(currentContract.start_season_id)
    : null;
  const endSeason = currentContract
    ? seasonById.get(currentContract.end_season_id)
    : null;

  return {
    id: rider.id,
    firstName: rider.first_name,
    lastName: rider.last_name,
    status: rider.status,
    country: {
      id: countryResult.data.id,
      name: countryResult.data.name,
      code: countryResult.data.iso_alpha2,
    },
    avatarProfileKey: rider.avatar_profile_key,
    avatarSeed: rider.avatar_seed,
    activeSeason: activeSeason
      ? {
          id: activeSeason.id,
          name: activeSeason.name,
          gameYear: activeSeason.game_year,
        }
      : null,
    age: currentRating?.age ?? null,
    potentialSteps: mustUseScoutingReport ? null : rider.potential_steps,
    ratings: mustUseScoutingReport ? null : exactRatings,
    scoutingReport,
    condition,
    medical: injuryResult.data
      ? {
          diagnosisCode: injuryResult.data.diagnosis_code,
          label: getInjuryLabel(injuryResult.data.diagnosis_code),
          startedAt: injuryResult.data.started_at,
          expectedRecoveryAt: injuryResult.data.expected_recovery_at,
          remainingHours: Math.max(
            0,
            Math.ceil(
              (new Date(injuryResult.data.expected_recovery_at).getTime() -
                Date.now()) /
                3_600_000
            )
          ),
        }
      : null,
    trainingReport,
    currentTeam,
    nationalTitles: nationalTitleRows.map((title) => ({
      type: title.championship_type,
      seasonId: title.season_id,
      seasonName: seasonById.get(title.season_id)?.name ?? "Saison inconnue",
      countryName: countryResult.data!.name,
      countryCode: countryResult.data!.iso_alpha2,
      isActive: title.relinquished_at === null,
    })),
    history,
    specialAbilities,
    equipment,
    privateContract:
      currentContract && canManage
        ? {
            salaryPerSeason: Number(currentContract.salary_per_season),
            currencyCode: currentContract.currency_code,
            startSeasonName: startSeason?.name ?? "Saison inconnue",
            endSeasonName: endSeason?.name ?? "Saison inconnue",
            status: currentContract.status,
            signedAt: currentContract.signed_at,
          }
        : null,
    canManage,
  };
}

async function getLatestPrivateTrainingReport({
  supabase,
  riderId,
  seasonId,
}: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  riderId: string;
  seasonId: string;
}): Promise<PublicRiderProfile["trainingReport"]> {
  const [sessionsResult, daysResult] = await Promise.all([
    supabase
      .from("rider_training_sessions")
      .select(
        "rider_id, season_day_id, status, intensity, domain, form_delta, progress_milli, decline_milli, rating_changes, processed_at",
      )
      .eq("rider_id", riderId)
      .eq("season_id", seasonId)
      .returns<TrainingSessionRow[]>(),
    supabase
      .from("season_days")
      .select("id, day_number")
      .eq("season_id", seasonId)
      .returns<SeasonDayRow[]>(),
  ]);
  const { data: sessions, error: sessionError } = sessionsResult;
  assertQuery(sessionError, "le dernier rapport d’entraînement");
  const { data: days, error: dayError } = daysResult;
  assertQuery(dayError, "la journée du rapport d’entraînement");

  const dayNumberById = new Map(
    (days ?? []).map((day) => [day.id, day.day_number]),
  );
  const session = indexLatestTrainingSessionsByRider(
    sessions ?? [],
    dayNumberById,
  ).get(riderId);
  if (!session) return null;

  return {
    dayNumber: dayNumberById.get(session.season_day_id) ?? 1,
    status: session.status,
    intensity: session.intensity,
    domain: session.domain,
    formDelta: session.form_delta,
    progressMilli: session.progress_milli ?? {},
    declineMilli: session.decline_milli ?? {},
    ratingChanges: session.rating_changes ?? {},
  };
}

export async function getPublicTeamRiders(
  teamIdentifier: string
): Promise<PublicTeamRider[]> {
  const teamId = teamIdentifier.trim().toLowerCase();

  if (!isUuid(teamId)) {
    return [];
  }

  const supabase = createSupabaseAdminClient();
  const [activeSeasonResult, contractsResult] = await Promise.all([
    supabase
      .from("seasons")
      .select("id")
      .eq("status", "active")
      .maybeSingle<{ id: string }>(),
    supabase
      .from("rider_contracts")
      .select("rider_id")
      .eq("team_id", teamId)
      .eq("status", "active")
      .returns<Array<{ rider_id: string }>>(),
  ]);

  assertQuery(activeSeasonResult.error, "la saison active");
  assertQuery(contractsResult.error, "l’effectif public de l’équipe");

  const riderIds = [
    ...new Set((contractsResult.data ?? []).map((contract) => contract.rider_id)),
  ];

  if (riderIds.length === 0) {
    return [];
  }

  const [ridersResult, ratingsResult] = await Promise.all([
    supabase
      .from("riders")
      .select(
        "id, country_id, first_name, last_name, status, avatar_profile_key, avatar_seed"
      )
      .in("id", riderIds)
      .returns<PublicTeamRiderRow[]>(),
    activeSeasonResult.data
      ? supabase
          .from("rider_season_ratings")
          .select("rider_id, age")
          .eq("season_id", activeSeasonResult.data.id)
          .in("rider_id", riderIds)
          .returns<Array<{ rider_id: string; age: number }>>()
      : Promise.resolve({
          data: [] as Array<{ rider_id: string; age: number }>,
          error: null,
        }),
  ]);

  assertQuery(ridersResult.error, "les coureurs de l’équipe");
  assertQuery(ratingsResult.error, "l’âge des coureurs de l’équipe");

  const countryIds = [
    ...new Set((ridersResult.data ?? []).map((rider) => rider.country_id)),
  ];
  const { data: countries, error: countriesError } = await supabase
    .from("countries")
    .select("id, name, iso_alpha2")
    .in("id", countryIds)
    .returns<CountryRow[]>();

  assertQuery(countriesError, "les pays des coureurs de l’équipe");

  const countryById = new Map((countries ?? []).map((country) => [country.id, country]));
  const ageByRiderId = new Map(
    (ratingsResult.data ?? []).map((rating) => [rating.rider_id, rating.age])
  );

  return (ridersResult.data ?? [])
    .map((rider) => {
      const country = countryById.get(rider.country_id);

      if (!country) {
        return null;
      }

      return {
        id: rider.id,
        firstName: rider.first_name,
        lastName: rider.last_name,
        countryName: country.name,
        countryCode: country.iso_alpha2,
        avatarProfileKey: rider.avatar_profile_key,
        avatarSeed: rider.avatar_seed,
        age: ageByRiderId.get(rider.id) ?? null,
      } satisfies PublicTeamRider;
    })
    .filter((rider): rider is PublicTeamRider => rider !== null)
    .sort(
      (left, right) =>
        left.lastName.localeCompare(right.lastName, "fr") ||
        left.firstName.localeCompare(right.firstName, "fr")
    );
}

function toRatings(row: RatingRow): RiderRatings {
  return {
    mountain: row.mountain,
    hills: row.hills,
    recovery: row.recovery,
    endurance: row.endurance,
    resistance: row.resistance,
    breakaway: row.breakaway,
    downhill: row.downhill,
    acceleration: row.acceleration,
    sprint: row.sprint,
    flat: row.flat,
    cobbles: row.cobbles,
    prologue: row.prologue,
    timeTrial: row.time_trial,
  };
}

function getInjuryLabel(diagnosisCode: string) {
  if (diagnosisCode in RIDER_INJURY_DIAGNOSES) {
    return RIDER_INJURY_DIAGNOSES[
      diagnosisCode as RiderInjuryDiagnosisCode
    ].label;
  }

  return "Blessure en cours";
}

async function getCurrentCondition({
  supabase,
  riderId,
  activeSeason,
}: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  riderId: string;
  activeSeason: SeasonRow | null;
}): Promise<PublicRiderProfile["condition"]> {
  if (!activeSeason) {
    return { form: 75, dayNumber: null };
  }

  const dayNumber = activeSeason.current_day_number ?? 1;
  const { data: seasonDays, error: seasonDayError } = await supabase
    .from("season_days")
    .select("id, day_number")
    .eq("season_id", activeSeason.id)
    .lte("day_number", dayNumber)
    .order("day_number", { ascending: false })
    .returns<SeasonDayRow[]>();

  assertQuery(seasonDayError, "la journée courante");

  if (!seasonDays || seasonDays.length === 0) {
    return { form: 75, dayNumber };
  }

  const { data: conditions, error: conditionError } = await supabase
    .from("rider_condition_states")
    .select("season_day_id, form")
    .eq("rider_id", riderId)
    .in("season_day_id", seasonDays.map((day) => day.id))
    .returns<ConditionRow[]>();

  assertQuery(conditionError, "la forme du coureur");
  const conditionByDayId = new Map(
    (conditions ?? []).map((condition) => [condition.season_day_id, condition])
  );
  const condition = seasonDays
    .map((day) => conditionByDayId.get(day.id))
    .find((candidate) => candidate !== undefined);

  return {
    form: condition?.form ?? 75,
    dayNumber,
  };
}

async function viewerManagesTeam({
  supabase,
  viewerAuthUserId,
  teamId,
}: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  viewerAuthUserId: string;
  teamId: string;
}): Promise<boolean> {
  const normalizedViewerId = viewerAuthUserId.trim();

  if (!normalizedViewerId) {
    return false;
  }

  const { data: director, error: directorError } = await supabase
    .from("sporting_directors")
    .select("id")
    .eq("auth_user_id", normalizedViewerId)
    .eq("status", "active")
    .maybeSingle<SportingDirectorRow>();

  assertQuery(directorError, "le Directeur Sportif connecté");

  if (!director) {
    return false;
  }

  const { data: assignment, error: assignmentError } = await supabase
    .from("team_manager_assignments")
    .select("id")
    .eq("sporting_director_id", director.id)
    .eq("team_id", teamId)
    .eq("role", "general_manager")
    .eq("status", "active")
    .maybeSingle<ManagerAssignmentRow>();

  assertQuery(assignmentError, "l’affectation du Directeur Sportif");

  return Boolean(assignment);
}

function findTeamSeason({
  teamSeasons,
  teamId,
  seasonId,
}: {
  teamSeasons: TeamSeasonRow[];
  teamId: string;
  seasonId: string;
}): TeamSeasonRow | null {
  return (
    teamSeasons.find(
      (teamSeason) =>
        teamSeason.team_id === teamId && teamSeason.season_id === seasonId
    ) ?? null
  );
}

function getSeasonYear(seasons: SeasonRow[], seasonId: string): number {
  return seasons.find((season) => season.id === seasonId)?.game_year ?? 0;
}

function assertQuery(
  error: { message: string } | null,
  resourceName: string
): asserts error is null {
  if (error) {
    throw new Error(`Impossible de charger ${resourceName} : ${error.message}`);
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}
