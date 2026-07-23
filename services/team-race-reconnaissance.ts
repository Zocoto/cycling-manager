import "server-only";

import {
  getRacePreparerBonusPercentage,
  getRaceReconnaissanceBonus,
  getRaceReconnaissanceCost,
} from "@/lib/game/race-reconnaissance";
import {
  isRaceCategoryCode,
  type RaceCategoryCode,
  type RaceFormat,
  type RaceProfileType,
} from "@/lib/game/race-calendar";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type DirectorRow = { id: string };
type AssignmentRow = { team_id: string };
type SeasonRow = {
  id: string;
  name: string;
  game_year: number;
  current_day_number: number | null;
};
type TeamSeasonRow = {
  id: string;
  team_id: string;
  display_name: string;
  cash_balance: number | string;
  currency: string;
};
type DayRow = {
  id: string;
  day_number: number;
  calendar_date: string;
};
type ContractRow = { rider_id: string };
type RiderRow = {
  id: string;
  country_id: string;
  first_name: string;
  last_name: string;
  avatar_profile_key: string | null;
  avatar_seed: number | string | null;
};
type CountryRow = { id: string; name: string; iso_alpha2: string };
type ConditionRow = {
  rider_id: string;
  season_day_id: string;
  form: number;
  updated_at: string;
};
type InjuryRow = {
  rider_id: string;
  diagnosis_code: string;
  started_at: string;
  expected_recovery_at: string;
};
type CampRow = {
  rider_id: string;
  camp_type: "classic" | "premium" | "reconnaissance";
  start_day_number: number;
  end_day_number: number;
};
type StaffContractRow = { id: string; staff_member_id: string };
type StaffMemberRow = {
  id: string;
  first_name: string;
  last_name: string;
  level: number;
};
type EditionRow = {
  id: string;
  race_id: string;
  race_category_id: string;
  display_name: string;
  status: string;
};
type RaceRow = {
  id: string;
  country_id: string;
  name: string;
  slug: string;
  race_format: RaceFormat;
};
type CategoryRow = {
  id: string;
  code: string;
  name: string;
};
type StageRow = {
  id: string;
  race_edition_id: string;
  season_day_id: string;
  stage_number: number;
  name: string;
  profile_type: RaceProfileType;
  distance_km: number | string;
  status: string;
};
type RosterRow = {
  rider_id: string;
  race_registration_id: string;
};
type RegistrationRow = {
  id: string;
  race_edition_id: string;
  status: string;
};
type ReconnaissanceRow = {
  id: string;
  target_stage_id: string;
  preparer_contract_id: string | null;
  preparer_level: number;
  bonus_points: number | string;
  start_day_number: number;
  end_day_number: number;
  total_price: number | string;
  status: "planned" | "active" | "completed" | "cancelled";
  created_at: string;
};
type ParticipantRow = {
  reconnaissance_id: string;
  rider_id: string;
};

export type RaceReconnaissanceRider = {
  id: string;
  firstName: string;
  lastName: string;
  countryName: string;
  countryCode: string;
  avatarProfileKey: string | null;
  avatarSeed: number | string | null;
  form: number;
  isAvailable: boolean;
  unavailableReason: string | null;
};

export type RacePreparerOption = {
  contractId: string;
  firstName: string;
  lastName: string;
  level: number;
  efficiencyPercentage: number;
  resultingBonus: number;
};

export type RaceReconnaissanceStage = {
  id: string;
  dayNumber: number;
  stageNumber: number;
  stageName: string;
  raceName: string;
  raceSlug: string;
  countryName: string;
  countryCode: string;
  categoryCode: RaceCategoryCode;
  categoryName: string;
  raceFormat: RaceFormat;
  profileType: RaceProfileType;
  distanceKm: number;
  cost: number;
};

export type RaceReconnaissanceMission = {
  id: string;
  stageId: string;
  raceName: string;
  stageName: string;
  targetDayNumber: number;
  startDayNumber: number;
  endDayNumber: number;
  status: ReconnaissanceRow["status"];
  bonusPoints: number;
  price: number;
  preparerName: string | null;
  riderNames: string[];
};

export type TeamRaceReconnaissanceOverview = {
  teamName: string;
  seasonName: string;
  currentDayNumber: number;
  startDayNumber: number;
  endDayNumber: number;
  balance: number;
  currency: string;
  riders: RaceReconnaissanceRider[];
  preparers: RacePreparerOption[];
  stages: RaceReconnaissanceStage[];
  missions: RaceReconnaissanceMission[];
};

export async function getCurrentTeamRaceReconnaissanceOverview(
  authUserId: string,
): Promise<TeamRaceReconnaissanceOverview | null> {
  const admin = createSupabaseAdminClient();
  const [healthSettlement, reconnaissanceSettlement] = await Promise.all([
    admin.rpc("settle_current_health_and_form"),
    admin.rpc("settle_current_race_reconnaissances"),
  ]);
  assertQuery(healthSettlement.error, "l’état physique des coureurs");
  assertQuery(
    reconnaissanceSettlement.error,
    "les reconnaissances déjà programmées",
  );

  const context = await loadContext(admin, authUserId);
  if (!context) return null;

  const { season, teamSeason } = context;
  const currentDayNumber = season.current_day_number ?? 1;
  const startDayNumber = currentDayNumber + 1;
  const endDayNumber = startDayNumber + 1;

  const [
    daysResult,
    contractsResult,
    staffContractsResult,
    editionsResult,
    categoriesResult,
    missionsResult,
  ] = await Promise.all([
    admin
      .from("season_days")
      .select("id, day_number, calendar_date")
      .eq("season_id", season.id)
      .order("day_number")
      .returns<DayRow[]>(),
    admin
      .from("rider_contracts")
      .select("rider_id")
      .eq("team_id", teamSeason.team_id)
      .eq("status", "active")
      .returns<ContractRow[]>(),
    admin
      .from("staff_contracts")
      .select("id, staff_member_id")
      .eq("team_id", teamSeason.team_id)
      .eq("status", "active")
      .returns<StaffContractRow[]>(),
    admin
      .from("race_editions")
      .select("id, race_id, race_category_id, display_name, status")
      .eq("season_id", season.id)
      .neq("status", "cancelled")
      .returns<EditionRow[]>(),
    admin
      .from("race_categories")
      .select("id, code, name")
      .returns<CategoryRow[]>(),
    admin
      .from("stage_reconnaissances")
      .select(
        "id, target_stage_id, preparer_contract_id, preparer_level, bonus_points, start_day_number, end_day_number, total_price, status, created_at",
      )
      .eq("team_season_id", teamSeason.id)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .returns<ReconnaissanceRow[]>(),
  ]);

  assertQuery(daysResult.error, "les journées de saison");
  assertQuery(contractsResult.error, "les contrats des coureurs");
  assertQuery(staffContractsResult.error, "les contrats du staff");
  assertQuery(editionsResult.error, "les éditions de course");
  assertQuery(categoriesResult.error, "les catégories de course");
  assertQuery(missionsResult.error, "les missions de reconnaissance");

  const days = daysResult.data ?? [];
  const riderIds = (contractsResult.data ?? []).map(
    (contract) => contract.rider_id,
  );
  const staffContracts = staffContractsResult.data ?? [];
  const staffMemberIds = staffContracts.map(
    (contract) => contract.staff_member_id,
  );
  const editions = editionsResult.data ?? [];
  const editionIds = editions.map((edition) => edition.id);
  const raceIds = [...new Set(editions.map((edition) => edition.race_id))];
  const missionRows = missionsResult.data ?? [];
  const missionIds = missionRows.map((mission) => mission.id);

  const [
    ridersResult,
    conditionsResult,
    injuriesResult,
    campsResult,
    staffMembersResult,
    racesResult,
    stagesResult,
    participantsResult,
    rostersResult,
  ] = await Promise.all([
    riderIds.length
      ? admin
          .from("riders")
          .select(
            "id, country_id, first_name, last_name, avatar_profile_key, avatar_seed",
          )
          .in("id", riderIds)
          .returns<RiderRow[]>()
      : emptyResult<RiderRow>(),
    riderIds.length
      ? admin
          .from("rider_condition_states")
          .select("rider_id, season_day_id, form, updated_at")
          .in("rider_id", riderIds)
          .returns<ConditionRow[]>()
      : emptyResult<ConditionRow>(),
    riderIds.length && endDayNumber <= 28
      ? admin
          .from("rider_injuries")
          .select(
            "rider_id, diagnosis_code, started_at, expected_recovery_at",
          )
          .in("rider_id", riderIds)
          .neq("status", "recovered")
          .returns<InjuryRow[]>()
      : emptyResult<InjuryRow>(),
    riderIds.length && endDayNumber <= 28
      ? admin
          .from("rider_form_camps")
          .select(
            "rider_id, camp_type, start_day_number, end_day_number",
          )
          .eq("season_id", season.id)
          .in("rider_id", riderIds)
          .neq("status", "cancelled")
          .lte("start_day_number", endDayNumber)
          .gte("end_day_number", startDayNumber)
          .returns<CampRow[]>()
      : emptyResult<CampRow>(),
    staffMemberIds.length
      ? admin
          .from("staff_members")
          .select("id, first_name, last_name, level")
          .eq("role", "race_preparer")
          .in("id", staffMemberIds)
          .returns<StaffMemberRow[]>()
      : emptyResult<StaffMemberRow>(),
    raceIds.length
      ? admin
          .from("races")
          .select("id, country_id, name, slug, race_format")
          .in("id", raceIds)
          .returns<RaceRow[]>()
      : emptyResult<RaceRow>(),
    editionIds.length
      ? admin
          .from("stages")
          .select(
            "id, race_edition_id, season_day_id, stage_number, name, profile_type, distance_km, status",
          )
          .in("race_edition_id", editionIds)
          .returns<StageRow[]>()
      : emptyResult<StageRow>(),
    missionIds.length
      ? admin
          .from("stage_reconnaissance_riders")
          .select("reconnaissance_id, rider_id")
          .in("reconnaissance_id", missionIds)
          .returns<ParticipantRow[]>()
      : emptyResult<ParticipantRow>(),
    riderIds.length
      ? admin
          .from("race_rosters")
          .select("rider_id, race_registration_id")
          .in("rider_id", riderIds)
          .in("status", ["selected", "confirmed"])
          .returns<RosterRow[]>()
      : emptyResult<RosterRow>(),
  ]);

  assertQuery(ridersResult.error, "les coureurs");
  assertQuery(conditionsResult.error, "la forme des coureurs");
  assertQuery(injuriesResult.error, "les blessures");
  assertQuery(campsResult.error, "les indisponibilités");
  assertQuery(staffMembersResult.error, "les préparateurs");
  assertQuery(racesResult.error, "les courses");
  assertQuery(stagesResult.error, "les étapes");
  assertQuery(participantsResult.error, "les participants aux reconnaissances");
  assertQuery(rostersResult.error, "les engagements en course");

  const races = racesResult.data ?? [];
  const riderRows = ridersResult.data ?? [];
  const countryIds = [
    ...new Set([
      ...riderRows.map((rider) => rider.country_id),
      ...races.map((race) => race.country_id),
    ]),
  ];
  const countriesResult = countryIds.length
    ? await admin
        .from("countries")
        .select("id, name, iso_alpha2")
        .in("id", countryIds)
        .returns<CountryRow[]>()
    : emptyResult<CountryRow>();
  assertQuery(countriesResult.error, "les pays");

  const rosters = rostersResult.data ?? [];
  const registrationIds = [
    ...new Set(rosters.map((roster) => roster.race_registration_id)),
  ];
  const registrationsResult = registrationIds.length
    ? await admin
        .from("race_registrations")
        .select("id, race_edition_id, status")
        .in("id", registrationIds)
        .eq("status", "accepted")
        .returns<RegistrationRow[]>()
    : emptyResult<RegistrationRow>();
  assertQuery(registrationsResult.error, "les inscriptions en course");

  const dayById = new Map(days.map((day) => [day.id, day]));
  const countryById = new Map(
    (countriesResult.data ?? []).map((country) => [country.id, country]),
  );
  const categoryById = new Map(
    (categoriesResult.data ?? []).map((category) => [category.id, category]),
  );
  const raceById = new Map(races.map((race) => [race.id, race]));
  const editionById = new Map(
    editions.map((edition) => [edition.id, edition]),
  );
  const stageRows = stagesResult.data ?? [];
  const stageById = new Map(stageRows.map((stage) => [stage.id, stage]));
  const latestConditionByRiderId = latestConditions(
    conditionsResult.data ?? [],
    dayById,
  );
  const injuryByRiderId = activeInjuriesByRider(
    injuriesResult.data ?? [],
    days,
    startDayNumber,
    endDayNumber,
  );
  const campByRiderId = new Map(
    (campsResult.data ?? []).map((camp) => [camp.rider_id, camp]),
  );
  const raceConflictByRiderId = getRaceConflictsByRider(
    rosters,
    registrationsResult.data ?? [],
    stageRows,
    dayById,
    startDayNumber,
    endDayNumber,
  );
  const riderById = new Map(riderRows.map((rider) => [rider.id, rider]));
  const staffMemberById = new Map(
    (staffMembersResult.data ?? []).map((member) => [member.id, member]),
  );
  const staffContractById = new Map(
    staffContracts.map((contract) => [contract.id, contract]),
  );
  const participantsByMissionId = groupParticipants(
    participantsResult.data ?? [],
  );

  const riders = riderRows
    .map((rider): RaceReconnaissanceRider => {
      const country = countryById.get(rider.country_id);
      const injury = injuryByRiderId.get(rider.id);
      const camp = campByRiderId.get(rider.id);
      const raceConflict = raceConflictByRiderId.get(rider.id);
      const unavailableReason = injury
        ? injuryLabel(injury.diagnosis_code)
        : camp
          ? camp.camp_type === "reconnaissance"
            ? `Reconnaissance J${camp.start_day_number}–J${camp.end_day_number}`
            : `Stage de forme J${camp.start_day_number}–J${camp.end_day_number}`
          : raceConflict
            ? `Course engagée J${raceConflict.startDay}–J${raceConflict.endDay}`
            : endDayNumber > 28
              ? "Saison trop proche de son terme"
              : null;

      return {
        id: rider.id,
        firstName: rider.first_name,
        lastName: rider.last_name,
        countryName: country?.name ?? "Pays inconnu",
        countryCode: country?.iso_alpha2 ?? "UN",
        avatarProfileKey: rider.avatar_profile_key,
        avatarSeed: rider.avatar_seed,
        form: latestConditionByRiderId.get(rider.id)?.form ?? 75,
        isAvailable: unavailableReason === null,
        unavailableReason,
      };
    })
    .sort((left, right) =>
      `${left.lastName} ${left.firstName}`.localeCompare(
        `${right.lastName} ${right.firstName}`,
        "fr",
      ),
    );

  const preparers = staffContracts
    .flatMap((contract): RacePreparerOption[] => {
      const member = staffMemberById.get(contract.staff_member_id);
      if (!member) return [];
      return [
        {
          contractId: contract.id,
          firstName: member.first_name,
          lastName: member.last_name,
          level: member.level,
          efficiencyPercentage: getRacePreparerBonusPercentage(member.level),
          resultingBonus: getRaceReconnaissanceBonus(member.level),
        },
      ];
    })
    .sort((left, right) => right.level - left.level);

  const stages = stageRows
    .flatMap((stage): RaceReconnaissanceStage[] => {
      const day = dayById.get(stage.season_day_id);
      const edition = editionById.get(stage.race_edition_id);
      const race = edition ? raceById.get(edition.race_id) : null;
      const category = edition
        ? categoryById.get(edition.race_category_id)
        : null;
      const country = race ? countryById.get(race.country_id) : null;
      if (
        !day ||
        !edition ||
        !race ||
        !category ||
        !country ||
        !isRaceCategoryCode(category.code) ||
        stage.status !== "planned" ||
        day.day_number <= endDayNumber
      ) {
        return [];
      }

      return [
        {
          id: stage.id,
          dayNumber: day.day_number,
          stageNumber: stage.stage_number,
          stageName: stage.name,
          raceName: edition.display_name,
          raceSlug: race.slug,
          countryName: country.name,
          countryCode: country.iso_alpha2,
          categoryCode: category.code,
          categoryName: category.name,
          raceFormat: race.race_format,
          profileType: stage.profile_type,
          distanceKm: Number(stage.distance_km),
          cost: getRaceReconnaissanceCost({
            categoryCode: category.code,
            raceFormat: race.race_format,
          }),
        },
      ];
    })
    .sort(
      (left, right) =>
        left.dayNumber - right.dayNumber ||
        left.stageNumber - right.stageNumber ||
        left.raceName.localeCompare(right.raceName, "fr"),
    );

  const missions = missionRows.map((mission): RaceReconnaissanceMission => {
    const stage = stageById.get(mission.target_stage_id);
    const edition = stage ? editionById.get(stage.race_edition_id) : null;
    const preparerContract = mission.preparer_contract_id
      ? staffContractById.get(mission.preparer_contract_id)
      : null;
    const preparer = preparerContract
      ? staffMemberById.get(preparerContract.staff_member_id)
      : null;
    const participantIds = participantsByMissionId.get(mission.id) ?? [];

    return {
      id: mission.id,
      stageId: mission.target_stage_id,
      raceName: edition?.display_name ?? "Course",
      stageName: stage?.name ?? "Étape",
      targetDayNumber: stage
        ? dayById.get(stage.season_day_id)?.day_number ?? 0
        : 0,
      startDayNumber: mission.start_day_number,
      endDayNumber: mission.end_day_number,
      status: mission.status,
      bonusPoints: Number(mission.bonus_points),
      price: Number(mission.total_price),
      preparerName: preparer
        ? `${preparer.first_name} ${preparer.last_name}`
        : null,
      riderNames: participantIds
        .map((riderId) => riderById.get(riderId))
        .filter((rider): rider is RiderRow => Boolean(rider))
        .map((rider) => `${rider.first_name} ${rider.last_name}`),
    };
  });

  return {
    teamName: teamSeason.display_name,
    seasonName: season.name,
    currentDayNumber,
    startDayNumber,
    endDayNumber,
    balance: Number(teamSeason.cash_balance),
    currency: teamSeason.currency,
    riders,
    preparers,
    stages,
    missions,
  };
}

async function loadContext(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  authUserId: string,
) {
  const { data: director, error: directorError } = await admin
    .from("sporting_directors")
    .select("id")
    .eq("auth_user_id", authUserId)
    .eq("status", "active")
    .maybeSingle<DirectorRow>();
  assertQuery(directorError, "le Directeur Sportif");
  if (!director) return null;

  const [assignmentResult, seasonResult] = await Promise.all([
    admin
      .from("team_manager_assignments")
      .select("team_id")
      .eq("sporting_director_id", director.id)
      .eq("role", "general_manager")
      .eq("status", "active")
      .maybeSingle<AssignmentRow>(),
    admin
      .from("seasons")
      .select("id, name, game_year, current_day_number")
      .eq("status", "active")
      .maybeSingle<SeasonRow>(),
  ]);
  assertQuery(assignmentResult.error, "l’affectation à l’équipe");
  assertQuery(seasonResult.error, "la saison active");
  if (!assignmentResult.data || !seasonResult.data) return null;

  const { data: teamSeason, error } = await admin
    .from("team_seasons")
    .select("id, team_id, display_name, cash_balance, currency")
    .eq("team_id", assignmentResult.data.team_id)
    .eq("season_id", seasonResult.data.id)
    .maybeSingle<TeamSeasonRow>();
  assertQuery(error, "l’équipe de la saison");
  if (!teamSeason) return null;

  return { season: seasonResult.data, teamSeason };
}

function latestConditions(
  rows: ConditionRow[],
  dayById: Map<string, DayRow>,
) {
  const result = new Map<string, ConditionRow>();
  for (const row of rows) {
    const rowDay = dayById.get(row.season_day_id)?.day_number ?? 0;
    const current = result.get(row.rider_id);
    const currentDay = current
      ? dayById.get(current.season_day_id)?.day_number ?? 0
      : 0;
    if (
      !current ||
      rowDay > currentDay ||
      (rowDay === currentDay && row.updated_at > current.updated_at)
    ) {
      result.set(row.rider_id, row);
    }
  }
  return result;
}

function activeInjuriesByRider(
  injuries: InjuryRow[],
  days: DayRow[],
  startDayNumber: number,
  endDayNumber: number,
) {
  const result = new Map<string, InjuryRow>();
  const startDay = days.find((day) => day.day_number === startDayNumber);
  const endDay = days.find((day) => day.day_number === endDayNumber);
  if (!startDay || !endDay) return result;
  const startAt = new Date(`${startDay.calendar_date}T00:00:00+02:00`).getTime();
  const endAt = new Date(`${endDay.calendar_date}T23:59:59+02:00`).getTime();

  for (const injury of injuries) {
    if (
      new Date(injury.started_at).getTime() <= endAt &&
      new Date(injury.expected_recovery_at).getTime() > startAt
    ) {
      result.set(injury.rider_id, injury);
    }
  }
  return result;
}

function getRaceConflictsByRider(
  rosters: RosterRow[],
  registrations: RegistrationRow[],
  stages: StageRow[],
  dayById: Map<string, DayRow>,
  startDayNumber: number,
  endDayNumber: number,
) {
  const result = new Map<string, { startDay: number; endDay: number }>();
  const registrationById = new Map(
    registrations.map((registration) => [registration.id, registration]),
  );
  const stageDaysByEdition = new Map<string, number[]>();
  for (const stage of stages) {
    const dayNumber = dayById.get(stage.season_day_id)?.day_number;
    if (!dayNumber) continue;
    const days = stageDaysByEdition.get(stage.race_edition_id) ?? [];
    days.push(dayNumber);
    stageDaysByEdition.set(stage.race_edition_id, days);
  }

  for (const roster of rosters) {
    const registration = registrationById.get(roster.race_registration_id);
    if (!registration) continue;
    const days = stageDaysByEdition.get(registration.race_edition_id) ?? [];
    if (
      !days.some(
        (dayNumber) =>
          dayNumber >= startDayNumber && dayNumber <= endDayNumber,
      )
    ) {
      continue;
    }
    result.set(roster.rider_id, {
      startDay: Math.min(...days),
      endDay: Math.max(...days),
    });
  }
  return result;
}

function groupParticipants(rows: ParticipantRow[]) {
  const result = new Map<string, string[]>();
  for (const row of rows) {
    const riderIds = result.get(row.reconnaissance_id) ?? [];
    riderIds.push(row.rider_id);
    result.set(row.reconnaissance_id, riderIds);
  }
  return result;
}

function injuryLabel(code: string) {
  switch (code) {
    case "clavicle_fracture":
      return "Fracture de la clavicule";
    case "wrist_fracture":
      return "Fracture du poignet";
    case "rib_fracture":
      return "Fracture des côtes";
    default:
      return "Blessure en cours";
  }
}

function emptyResult<T>() {
  return { data: [] as T[], error: null };
}

function assertQuery(
  error: { message: string } | null,
  label: string,
): asserts error is null {
  if (error) {
    throw new Error(`Impossible de charger ${label} : ${error.message}`);
  }
}
