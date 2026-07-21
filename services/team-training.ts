import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  TRAINER_SPECIALTY_LABELS,
  isTrainerSpecialty,
  type TrainerSpecialty,
} from "@/lib/game/staff";
import {
  isTrainingDomain,
  type TrainingDomain,
} from "@/lib/game/training";

type DirectorRow = { id: string };
type AssignmentRow = { team_id: string };
type SeasonRow = {
  id: string;
  name: string;
  current_day_number: number | null;
};
type TeamSeasonRow = { team_id: string; display_name: string };
type DayRow = { id: string; day_number: number; calendar_date: string };
type ContractRow = { rider_id: string };
type RiderRow = {
  id: string;
  country_id: string;
  first_name: string;
  last_name: string;
  avatar_profile_key: string | null;
  avatar_seed: number | string | null;
  potential_steps: number;
};
type CountryRow = { id: string; name: string; iso_alpha2: string };
type RatingRow = {
  rider_id: string;
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
type ConditionRow = {
  rider_id: string;
  season_day_id: string;
  form: number;
  updated_at: string;
};
type PlanRow = {
  rider_id: string;
  intensity: number;
  domain: string;
  trainer_contract_id: string | null;
  effective_from_day_number: number;
  created_at: string;
};
type SettingRow = {
  minimum_form: number;
  effective_from_day_number: number;
  created_at: string;
};
type StaffContractRow = { id: string; staff_member_id: string };
type StaffMemberRow = {
  id: string;
  country_id: string;
  first_name: string;
  last_name: string;
  level: number;
  trainer_specialty: string | null;
};
type SessionRow = {
  rider_id: string;
  season_day_id: string;
  status: TrainingSessionStatus;
  intensity: number;
  domain: string;
  minimum_form: number;
  trainer_level: number;
  trainer_specialty: string | null;
  trainer_country_match: boolean;
  physiotherapist_level: number;
  form_before: number;
  form_delta: number;
  form_after: number;
  progress_milli: Record<string, number>;
  decline_milli: Record<string, number>;
  rating_changes: Record<string, number>;
  processed_at: string;
};

export type TrainingSessionStatus =
  | "completed"
  | "skipped_low_form"
  | "skipped_injury"
  | "skipped_form_camp";

export type TeamTrainer = {
  contractId: string;
  countryId: string;
  countryName: string;
  countryCode: string;
  firstName: string;
  lastName: string;
  level: number;
  specialty: TrainerSpecialty;
  specialtyLabel: string;
  efficiencyBonus: number;
};

export type RiderTrainingReport = {
  dayNumber: number;
  status: TrainingSessionStatus;
  intensity: number;
  domain: TrainingDomain;
  minimumForm: number;
  trainerLevel: number;
  trainerSpecialty: TrainerSpecialty | null;
  trainerCountryMatch: boolean;
  physiotherapistLevel: number;
  formBefore: number;
  formDelta: number;
  formAfter: number;
  progressMilli: Record<string, number>;
  declineMilli: Record<string, number>;
  ratingChanges: Record<string, number>;
  processedAt: string;
};

export type TeamTrainingRider = {
  id: string;
  firstName: string;
  lastName: string;
  countryName: string;
  countryCode: string;
  avatarProfileKey: string | null;
  avatarSeed: number | string | null;
  age: number;
  potentialSteps: number;
  form: number;
  ratings: Omit<RatingRow, "rider_id" | "age">;
  plan: {
    intensity: number;
    domain: TrainingDomain;
    trainerContractId: string | null;
    effectiveFromDayNumber: number;
    isPending: boolean;
  };
  latestReport: RiderTrainingReport | null;
};

export type TeamTrainingOverview = {
  teamId: string;
  teamName: string;
  seasonName: string;
  currentDayNumber: number;
  minimumForm: number;
  minimumFormEffectiveFromDayNumber: number;
  minimumFormIsPending: boolean;
  sessionCutoffPassed: boolean;
  trainers: TeamTrainer[];
  riders: TeamTrainingRider[];
};

export async function getCurrentTeamTrainingOverview(
  authUserId: string,
): Promise<TeamTrainingOverview | null> {
  const admin = createSupabaseAdminClient();
  const settlement = await admin.rpc("settle_due_training_sessions");
  assertQuery(settlement.error, "le règlement des entraînements");

  const context = await loadContext(admin, authUserId);
  if (!context) return null;

  const { teamSeason, season } = context;
  const [daysResult, contractsResult, settingsResult, plansResult, staffContractsResult] =
    await Promise.all([
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
        .from("team_training_setting_versions")
        .select("minimum_form, effective_from_day_number, created_at")
        .eq("team_id", teamSeason.team_id)
        .eq("season_id", season.id)
        .order("effective_from_day_number", { ascending: false })
        .order("created_at", { ascending: false })
        .returns<SettingRow[]>(),
      admin
        .from("rider_training_plan_versions")
        .select(
          "rider_id, intensity, domain, trainer_contract_id, effective_from_day_number, created_at",
        )
        .eq("team_id", teamSeason.team_id)
        .eq("season_id", season.id)
        .order("effective_from_day_number", { ascending: false })
        .order("created_at", { ascending: false })
        .returns<PlanRow[]>(),
      admin
        .from("staff_contracts")
        .select("id, staff_member_id")
        .eq("team_id", teamSeason.team_id)
        .eq("status", "active")
        .returns<StaffContractRow[]>(),
    ]);

  assertQuery(daysResult.error, "les journées de saison");
  assertQuery(contractsResult.error, "les contrats des coureurs");
  assertQuery(settingsResult.error, "le seuil de forme");
  assertQuery(plansResult.error, "les programmes d’entraînement");
  assertQuery(staffContractsResult.error, "les contrats des entraîneurs");

  const days = daysResult.data ?? [];
  const riderIds = (contractsResult.data ?? []).map((contract) => contract.rider_id);
  const staffContracts = staffContractsResult.data ?? [];
  const staffMemberIds = staffContracts.map((contract) => contract.staff_member_id);

  const [ridersResult, ratingsResult, conditionsResult, sessionsResult, staffMembersResult] =
    await Promise.all([
      riderIds.length
        ? admin
            .from("riders")
            .select(
              "id, country_id, first_name, last_name, avatar_profile_key, avatar_seed, potential_steps",
            )
            .in("id", riderIds)
            .returns<RiderRow[]>()
        : Promise.resolve({ data: [] as RiderRow[], error: null }),
      riderIds.length
        ? admin
            .from("rider_season_ratings")
            .select(
              "rider_id, age, mountain, hills, flat, time_trial, cobbles, sprint, acceleration, downhill, endurance, resistance, recovery, breakaway, prologue",
            )
            .eq("season_id", season.id)
            .in("rider_id", riderIds)
            .returns<RatingRow[]>()
        : Promise.resolve({ data: [] as RatingRow[], error: null }),
      riderIds.length
        ? admin
            .from("rider_condition_states")
            .select("rider_id, season_day_id, form, updated_at")
            .in("rider_id", riderIds)
            .returns<ConditionRow[]>()
        : Promise.resolve({ data: [] as ConditionRow[], error: null }),
      riderIds.length
        ? admin
            .from("rider_training_sessions")
            .select(
              "rider_id, season_day_id, status, intensity, domain, minimum_form, trainer_level, trainer_specialty, trainer_country_match, physiotherapist_level, form_before, form_delta, form_after, progress_milli, decline_milli, rating_changes, processed_at",
            )
            .eq("season_id", season.id)
            .in("rider_id", riderIds)
            .order("processed_at", { ascending: false })
            .returns<SessionRow[]>()
        : Promise.resolve({ data: [] as SessionRow[], error: null }),
      staffMemberIds.length
        ? admin
            .from("staff_members")
            .select("id, country_id, first_name, last_name, level, trainer_specialty")
            .eq("role", "trainer")
            .in("id", staffMemberIds)
            .returns<StaffMemberRow[]>()
        : Promise.resolve({ data: [] as StaffMemberRow[], error: null }),
    ]);

  assertQuery(ridersResult.error, "les coureurs");
  assertQuery(ratingsResult.error, "les caractéristiques des coureurs");
  assertQuery(conditionsResult.error, "la forme des coureurs");
  assertQuery(sessionsResult.error, "les rapports d’entraînement");
  assertQuery(staffMembersResult.error, "les entraîneurs");

  const countryIds = [
    ...new Set([
      ...(ridersResult.data ?? []).map((rider) => rider.country_id),
      ...(staffMembersResult.data ?? []).map((member) => member.country_id),
    ]),
  ];
  const countriesResult = countryIds.length
    ? await admin
        .from("countries")
        .select("id, name, iso_alpha2")
        .in("id", countryIds)
        .returns<CountryRow[]>()
    : { data: [] as CountryRow[], error: null };
  assertQuery(countriesResult.error, "les pays des coureurs");

  const currentDayNumber = season.current_day_number ?? 1;
  const dayById = new Map(days.map((day) => [day.id, day]));
  const countryById = new Map((countriesResult.data ?? []).map((country) => [country.id, country]));
  const ratingByRiderId = new Map((ratingsResult.data ?? []).map((rating) => [rating.rider_id, rating]));
  const plansByRiderId = firstByKey(plansResult.data ?? [], (plan) => plan.rider_id);
  const latestSessionByRiderId = firstByKey(
    sessionsResult.data ?? [],
    (session) => session.rider_id,
  );
  const conditionByRiderId = latestConditions(
    conditionsResult.data ?? [],
    dayById,
    season.id,
  );
  const staffMemberById = new Map(
    (staffMembersResult.data ?? []).map((member) => [member.id, member]),
  );
  const trainers = staffContracts.flatMap((contract) => {
    const member = staffMemberById.get(contract.staff_member_id);
    if (!member?.trainer_specialty || !isTrainerSpecialty(member.trainer_specialty)) {
      return [];
    }
    return [
      {
        contractId: contract.id,
        countryId: member.country_id,
        countryName: countryById.get(member.country_id)?.name ?? "Pays inconnu",
        countryCode: countryById.get(member.country_id)?.iso_alpha2 ?? "UN",
        firstName: member.first_name,
        lastName: member.last_name,
        level: member.level,
        specialty: member.trainer_specialty,
        specialtyLabel: TRAINER_SPECIALTY_LABELS[member.trainer_specialty],
        efficiencyBonus: member.level * 4,
      } satisfies TeamTrainer,
    ];
  });

  const latestSetting = settingsResult.data?.[0];
  const currentDay = days.find((day) => day.day_number === currentDayNumber);

  return {
    teamId: teamSeason.team_id,
    teamName: teamSeason.display_name,
    seasonName: season.name,
    currentDayNumber,
    minimumForm: latestSetting?.minimum_form ?? 50,
    minimumFormEffectiveFromDayNumber:
      latestSetting?.effective_from_day_number ?? currentDayNumber,
    minimumFormIsPending:
      (latestSetting?.effective_from_day_number ?? currentDayNumber) > currentDayNumber,
    sessionCutoffPassed: currentDay ? isAfterParisTrainingTime(currentDay.calendar_date) : false,
    trainers,
    riders: (ridersResult.data ?? [])
      .flatMap((rider) => {
        const country = countryById.get(rider.country_id);
        const rating = ratingByRiderId.get(rider.id);
        if (!country || !rating) return [];
        const planRow = plansByRiderId.get(rider.id);
        const domain =
          planRow && isTrainingDomain(planRow.domain) ? planRow.domain : "stage_racer";
        const reportRow = latestSessionByRiderId.get(rider.id);
        const reportDomain =
          reportRow && isTrainingDomain(reportRow.domain)
            ? reportRow.domain
            : "stage_racer";
        const reportSpecialty =
          reportRow?.trainer_specialty && isTrainerSpecialty(reportRow.trainer_specialty)
            ? reportRow.trainer_specialty
            : null;
        const condition = conditionByRiderId.get(rider.id);

        return [
          {
            id: rider.id,
            firstName: rider.first_name,
            lastName: rider.last_name,
            countryName: country.name,
            countryCode: country.iso_alpha2,
            avatarProfileKey: rider.avatar_profile_key,
            avatarSeed: rider.avatar_seed,
            age: rating.age,
            potentialSteps: rider.potential_steps,
            form: condition?.form ?? 75,
            ratings: {
              mountain: rating.mountain,
              hills: rating.hills,
              flat: rating.flat,
              time_trial: rating.time_trial,
              cobbles: rating.cobbles,
              sprint: rating.sprint,
              acceleration: rating.acceleration,
              downhill: rating.downhill,
              endurance: rating.endurance,
              resistance: rating.resistance,
              recovery: rating.recovery,
              breakaway: rating.breakaway,
              prologue: rating.prologue,
            },
            plan: {
              intensity: planRow?.intensity ?? 0,
              domain,
              trainerContractId: planRow?.trainer_contract_id ?? null,
              effectiveFromDayNumber:
                planRow?.effective_from_day_number ?? currentDayNumber,
              isPending:
                (planRow?.effective_from_day_number ?? currentDayNumber) >
                currentDayNumber,
            },
            latestReport: reportRow
              ? {
                  dayNumber: dayById.get(reportRow.season_day_id)?.day_number ?? currentDayNumber,
                  status: reportRow.status,
                  intensity: reportRow.intensity,
                  domain: reportDomain,
                  minimumForm: reportRow.minimum_form,
                  trainerLevel: reportRow.trainer_level,
                  trainerSpecialty: reportSpecialty,
                  trainerCountryMatch: reportRow.trainer_country_match,
                  physiotherapistLevel: reportRow.physiotherapist_level,
                  formBefore: reportRow.form_before,
                  formDelta: reportRow.form_delta,
                  formAfter: reportRow.form_after,
                  progressMilli: reportRow.progress_milli ?? {},
                  declineMilli: reportRow.decline_milli ?? {},
                  ratingChanges: reportRow.rating_changes ?? {},
                  processedAt: reportRow.processed_at,
                }
              : null,
          } satisfies TeamTrainingRider,
        ];
      })
      .sort((left, right) =>
        `${left.lastName} ${left.firstName}`.localeCompare(
          `${right.lastName} ${right.firstName}`,
          "fr",
        ),
      ),
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
      .select("id, name, current_day_number")
      .eq("status", "active")
      .maybeSingle<SeasonRow>(),
  ]);
  assertQuery(assignmentResult.error, "l’affectation à l’équipe");
  assertQuery(seasonResult.error, "la saison active");
  if (!assignmentResult.data || !seasonResult.data) return null;

  const { data: teamSeason, error: teamSeasonError } = await admin
    .from("team_seasons")
    .select("team_id, display_name")
    .eq("team_id", assignmentResult.data.team_id)
    .eq("season_id", seasonResult.data.id)
    .maybeSingle<TeamSeasonRow>();
  assertQuery(teamSeasonError, "l’équipe de la saison");
  if (!teamSeason) return null;

  return { season: seasonResult.data, teamSeason };
}

function firstByKey<T>(rows: T[], key: (row: T) => string): Map<string, T> {
  const result = new Map<string, T>();
  for (const row of rows) {
    const value = key(row);
    if (!result.has(value)) result.set(value, row);
  }
  return result;
}

function latestConditions(
  rows: ConditionRow[],
  dayById: Map<string, DayRow>,
  seasonId: string,
) {
  const result = new Map<string, ConditionRow>();
  for (const row of rows) {
    const day = dayById.get(row.season_day_id);
    if (!day || seasonId.length === 0) continue;
    const current = result.get(row.rider_id);
    const currentDay = current ? dayById.get(current.season_day_id)?.day_number ?? 0 : 0;
    if (
      !current ||
      day.day_number > currentDay ||
      (day.day_number === currentDay && row.updated_at > current.updated_at)
    ) {
      result.set(row.rider_id, row);
    }
  }
  return result;
}

function isAfterParisTrainingTime(calendarDate: string): boolean {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  const today = `${read("year")}-${read("month")}-${read("day")}`;
  const hour = Number(read("hour"));
  const minute = Number(read("minute"));
  return today > calendarDate || (today === calendarDate && hour * 60 + minute >= 8 * 60);
}

function assertQuery(error: { message: string } | null, label: string): asserts error is null {
  if (error) throw new Error(`Impossible de charger ${label} : ${error.message}`);
}
