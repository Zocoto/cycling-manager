import "server-only";

import {
  FORM_CAMP_TYPES,
  RIDER_INJURY_DIAGNOSES,
} from "@/lib/game/health-center";
import {
  getRiderPlanningEventStatus,
  type RiderPlanningEntry,
  type RiderPlanningEvent,
  type TeamRiderSeasonPlanning,
} from "@/lib/game/rider-season-planning";
import {
  isRaceCategoryCode,
  type RaceCategoryCode,
} from "@/lib/game/race-calendar";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

type DirectorRow = { id: string };
type AssignmentRow = { team_id: string };
type SeasonRow = {
  id: string;
  name: string;
  current_day_number: number | null;
};
type TeamSeasonRow = {
  id: string;
  team_id: string;
  display_name: string;
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
type RatingRow = {
  rider_id: string;
  age: number;
};
type CountryRow = {
  id: string;
  name: string;
  iso_alpha2: string;
};
type RegistrationRow = {
  id: string;
  race_edition_id: string;
  status: "pending" | "accepted";
};
type RosterRow = {
  rider_id: string;
  race_registration_id: string;
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
  name: string;
  slug: string;
  race_format: "one_day" | "stage_race";
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
  status: string;
};
type CampRow = {
  id: string;
  rider_id: string;
  camp_type: "classic" | "premium" | "reconnaissance";
  start_day_number: number;
  end_day_number: number;
  form_gain_per_day: number;
  status: "planned" | "active" | "completed";
};
type InjuryRow = {
  id: string;
  rider_id: string;
  source_stage_id: string | null;
  diagnosis_code: string;
  status: "active" | "recovered";
  started_at: string;
  expected_recovery_at: string;
};
type ReconnaissanceRow = {
  id: string;
  target_stage_id: string;
  bonus_points: number | string;
  start_day_number: number;
  end_day_number: number;
  status: "planned" | "active" | "completed";
};
type ReconnaissanceParticipantRow = {
  reconnaissance_id: string;
  rider_id: string;
  form_camp_id: string;
};

export async function getCurrentTeamRiderSeasonPlanning({
  authUserId,
  riderId,
}: {
  authUserId: string;
  riderId?: string;
}): Promise<TeamRiderSeasonPlanning | null> {
  const admin = createSupabaseAdminClient();
  const [healthSettlement, reconnaissanceSettlement] = await Promise.all([
    admin.rpc("settle_current_health_and_form"),
    admin.rpc("settle_current_race_reconnaissances"),
  ]);
  assertQuery(healthSettlement.error, "l’état de santé des coureurs");
  assertQuery(
    reconnaissanceSettlement.error,
    "les reconnaissances de course",
  );

  const context = await loadContext(admin, authUserId);
  if (!context) return null;

  const [daysResult, contractsResult, editionsResult, categoriesResult] =
    await Promise.all([
      admin
        .from("season_days")
        .select("id, day_number, calendar_date")
        .eq("season_id", context.season.id)
        .order("day_number")
        .returns<DayRow[]>(),
      admin
        .from("rider_contracts")
        .select("rider_id")
        .eq("team_id", context.teamSeason.team_id)
        .eq("status", "active")
        .returns<ContractRow[]>(),
      admin
        .from("race_editions")
        .select("id, race_id, race_category_id, display_name, status")
        .eq("season_id", context.season.id)
        .neq("status", "cancelled")
        .returns<EditionRow[]>(),
      admin
        .from("race_categories")
        .select("id, code, name")
        .returns<CategoryRow[]>(),
    ]);
  assertQuery(daysResult.error, "les journées de la saison");
  assertQuery(contractsResult.error, "l’effectif actif");
  assertQuery(editionsResult.error, "les courses de la saison");
  assertQuery(categoriesResult.error, "les catégories de course");

  const contractedRiderIds = (contractsResult.data ?? []).map(
    (contract) => contract.rider_id,
  );
  if (riderId && !contractedRiderIds.includes(riderId)) return null;
  const riderIds = riderId ? [riderId] : contractedRiderIds;
  const editions = editionsResult.data ?? [];
  const editionIds = editions.map((edition) => edition.id);
  const raceIds = [...new Set(editions.map((edition) => edition.race_id))];

  if (riderIds.length === 0) {
    return {
      teamId: context.teamSeason.team_id,
      teamName: context.teamSeason.display_name,
      seasonId: context.season.id,
      seasonName: context.season.name,
      currentDayNumber: context.season.current_day_number ?? 1,
      days: mapPlanningDays(daysResult.data ?? []),
      riders: [],
    };
  }

  const [
    ridersResult,
    ratingsResult,
    registrationsResult,
    racesResult,
    stagesResult,
    campsResult,
    injuriesResult,
    reconnaissancesResult,
  ] = await Promise.all([
    admin
      .from("riders")
      .select(
        "id, country_id, first_name, last_name, avatar_profile_key, avatar_seed",
      )
      .in("id", riderIds)
      .returns<RiderRow[]>(),
    admin
      .from("rider_season_ratings")
      .select("rider_id, age")
      .eq("season_id", context.season.id)
      .in("rider_id", riderIds)
      .returns<RatingRow[]>(),
    admin
      .from("race_registrations")
      .select("id, race_edition_id, status")
      .eq("team_season_id", context.teamSeason.id)
      .in("status", ["pending", "accepted"])
      .returns<RegistrationRow[]>(),
    raceIds.length
      ? admin
          .from("races")
          .select("id, name, slug, race_format")
          .in("id", raceIds)
          .returns<RaceRow[]>()
      : emptyResult<RaceRow>(),
    editionIds.length
      ? admin
          .from("stages")
          .select(
            "id, race_edition_id, season_day_id, stage_number, name, status",
          )
          .in("race_edition_id", editionIds)
          .neq("status", "cancelled")
          .returns<StageRow[]>()
      : emptyResult<StageRow>(),
    admin
      .from("rider_form_camps")
      .select(
        "id, rider_id, camp_type, start_day_number, end_day_number, form_gain_per_day, status",
      )
      .eq("season_id", context.season.id)
      .in("rider_id", riderIds)
      .in("status", ["planned", "active", "completed"])
      .returns<CampRow[]>(),
    admin
      .from("rider_injuries")
      .select(
        "id, rider_id, source_stage_id, diagnosis_code, status, started_at, expected_recovery_at",
      )
      .in("rider_id", riderIds)
      .returns<InjuryRow[]>(),
    admin
      .from("stage_reconnaissances")
      .select(
        "id, target_stage_id, bonus_points, start_day_number, end_day_number, status",
      )
      .eq("team_season_id", context.teamSeason.id)
      .in("status", ["planned", "active", "completed"])
      .returns<ReconnaissanceRow[]>(),
  ]);
  for (const [result, label] of [
    [ridersResult, "les coureurs"],
    [ratingsResult, "l’âge des coureurs"],
    [registrationsResult, "les inscriptions en course"],
    [racesResult, "les identités des courses"],
    [stagesResult, "les étapes"],
    [campsResult, "les stages de forme"],
    [injuriesResult, "les blessures"],
    [reconnaissancesResult, "les stages de reconnaissance"],
  ] as const) {
    assertQuery(result.error, label);
  }

  const riders = ridersResult.data ?? [];
  const registrations = registrationsResult.data ?? [];
  const registrationIds = registrations.map((registration) => registration.id);
  const reconnaissances = reconnaissancesResult.data ?? [];
  const reconnaissanceIds = reconnaissances.map(
    (reconnaissance) => reconnaissance.id,
  );
  const countryIds = [...new Set(riders.map((rider) => rider.country_id))];
  const [countriesResult, rostersResult, participantsResult] =
    await Promise.all([
      admin
        .from("countries")
        .select("id, name, iso_alpha2")
        .in("id", countryIds)
        .returns<CountryRow[]>(),
      registrationIds.length
        ? admin
            .from("race_rosters")
            .select("rider_id, race_registration_id")
            .in("race_registration_id", registrationIds)
            .in("rider_id", riderIds)
            .in("status", ["selected", "confirmed"])
            .returns<RosterRow[]>()
        : emptyResult<RosterRow>(),
      reconnaissanceIds.length
        ? admin
            .from("stage_reconnaissance_riders")
            .select("reconnaissance_id, rider_id, form_camp_id")
            .in("reconnaissance_id", reconnaissanceIds)
            .in("rider_id", riderIds)
            .returns<ReconnaissanceParticipantRow[]>()
        : emptyResult<ReconnaissanceParticipantRow>(),
    ]);
  assertQuery(countriesResult.error, "les nationalités");
  assertQuery(rostersResult.error, "les sélections de course");
  assertQuery(
    participantsResult.error,
    "les participants aux reconnaissances",
  );

  const days = daysResult.data ?? [];
  const currentDayNumber = context.season.current_day_number ?? 1;
  const dayById = new Map(days.map((day) => [day.id, day]));
  const countryById = new Map(
    (countriesResult.data ?? []).map((country) => [country.id, country]),
  );
  const ageByRiderId = new Map(
    (ratingsResult.data ?? []).map((rating) => [
      rating.rider_id,
      rating.age,
    ]),
  );
  const editionById = new Map(
    editions.map((edition) => [edition.id, edition]),
  );
  const raceById = new Map(
    (racesResult.data ?? []).map((race) => [race.id, race]),
  );
  const categoryById = new Map(
    (categoriesResult.data ?? []).map((category) => [
      category.id,
      category,
    ]),
  );
  const stageById = new Map(
    (stagesResult.data ?? []).map((stage) => [stage.id, stage]),
  );
  const stagesByEditionId = groupBy(
    stagesResult.data ?? [],
    (stage) => stage.race_edition_id,
  );
  const registrationById = new Map(
    registrations.map((registration) => [registration.id, registration]),
  );
  const reconnaissanceById = new Map(
    reconnaissances.map((reconnaissance) => [
      reconnaissance.id,
      reconnaissance,
    ]),
  );
  const eventsByRiderId = new Map<string, RiderPlanningEvent[]>(
    riderIds.map((id) => [id, []]),
  );

  for (const roster of rostersResult.data ?? []) {
    const registration = registrationById.get(
      roster.race_registration_id,
    );
    const edition = registration
      ? editionById.get(registration.race_edition_id)
      : null;
    const race = edition ? raceById.get(edition.race_id) : null;
    const category = edition
      ? categoryById.get(edition.race_category_id)
      : null;
    const stageDays = edition
      ? (stagesByEditionId.get(edition.id) ?? []).flatMap((stage) => {
          const day = dayById.get(stage.season_day_id);
          return day ? [day.day_number] : [];
        })
      : [];
    if (!registration || !edition || !race || stageDays.length === 0) {
      continue;
    }
    const startDay = Math.min(...stageDays);
    const endDay = Math.max(...stageDays);
    const categoryCode = toRaceCategoryCode(category?.code);
    addEvent(eventsByRiderId, roster.rider_id, {
      id: `race:${registration.id}:${roster.rider_id}`,
      riderId: roster.rider_id,
      type: "race",
      title: edition.display_name,
      detail: [
        category?.name ?? "Course",
        race.race_format === "stage_race"
          ? `${stageDays.length} étape${stageDays.length > 1 ? "s" : ""}`
          : "Course d’un jour",
        registration.status === "pending"
          ? "Inscription en attente"
          : "Inscription confirmée",
      ].join(" · "),
      startDay,
      endDay,
      status: getRiderPlanningEventStatus({
        startDay,
        endDay,
        currentDayNumber,
      }),
      href: `/jeu/courses/${race.slug}`,
      raceCategoryCode: categoryCode,
    });
  }

  for (const camp of campsResult.data ?? []) {
    if (camp.camp_type === "reconnaissance") continue;
    const definition = FORM_CAMP_TYPES[camp.camp_type];
    addEvent(eventsByRiderId, camp.rider_id, {
      id: `form-camp:${camp.id}`,
      riderId: camp.rider_id,
      type: "form_camp",
      title: definition.label,
      detail: `Remise en forme · +${camp.form_gain_per_day} points par jour`,
      startDay: camp.start_day_number,
      endDay: camp.end_day_number,
      status: getRiderPlanningEventStatus({
        startDay: camp.start_day_number,
        endDay: camp.end_day_number,
        currentDayNumber,
      }),
      href: "/jeu/centre-de-soin?onglet=forme",
      raceCategoryCode: null,
    });
  }

  for (const participant of participantsResult.data ?? []) {
    const reconnaissance = reconnaissanceById.get(
      participant.reconnaissance_id,
    );
    const targetStage = reconnaissance
      ? stageById.get(reconnaissance.target_stage_id)
      : null;
    const edition = targetStage
      ? editionById.get(targetStage.race_edition_id)
      : null;
    if (!reconnaissance) continue;
    addEvent(eventsByRiderId, participant.rider_id, {
      id: `reconnaissance:${reconnaissance.id}:${participant.rider_id}`,
      riderId: participant.rider_id,
      type: "reconnaissance",
      title: `Reconnaissance · ${edition?.display_name ?? "course"}`,
      detail: targetStage
        ? `${targetStage.name} · objectif J${
            dayById.get(targetStage.season_day_id)?.day_number ?? "?"
          } · bonus +${formatBonus(reconnaissance.bonus_points)}`
        : `Bonus +${formatBonus(reconnaissance.bonus_points)}`,
      startDay: reconnaissance.start_day_number,
      endDay: reconnaissance.end_day_number,
      status: getRiderPlanningEventStatus({
        startDay: reconnaissance.start_day_number,
        endDay: reconnaissance.end_day_number,
        currentDayNumber,
      }),
      href: "/jeu/entrainement",
      raceCategoryCode: null,
    });
  }

  for (const injury of injuriesResult.data ?? []) {
    const dayRange = getInjuryDayRange(injury, days);
    if (!dayRange) continue;
    const sourceStage = injury.source_stage_id
      ? stageById.get(injury.source_stage_id)
      : null;
    const sourceEdition = sourceStage
      ? editionById.get(sourceStage.race_edition_id)
      : null;
    addEvent(eventsByRiderId, injury.rider_id, {
      id: `injury:${injury.id}`,
      riderId: injury.rider_id,
      type: "injury",
      title: getInjuryLabel(injury.diagnosis_code),
      detail:
        injury.diagnosis_code === "fatigue_exhaustion"
          ? `Fatigue accumulée · reprise prévue J${dayRange.endDay}`
          : sourceEdition
            ? `Chute sur ${sourceEdition.display_name}${
                sourceStage ? ` · ${sourceStage.name}` : ""
              } · reprise prévue J${dayRange.endDay}`
            : `Indisponibilité médicale · reprise prévue J${dayRange.endDay}`,
      startDay: dayRange.startDay,
      endDay: dayRange.endDay,
      status: getRiderPlanningEventStatus({
        ...dayRange,
        currentDayNumber,
      }),
      href: "/jeu/centre-de-soin?onglet=blessures",
      raceCategoryCode: null,
    });
  }

  const planningRiders = riders
    .map((rider): RiderPlanningEntry => {
      const country = countryById.get(rider.country_id);
      return {
        id: rider.id,
        firstName: rider.first_name,
        lastName: rider.last_name,
        countryName: country?.name ?? "Pays inconnu",
        countryCode: country?.iso_alpha2 ?? "UN",
        avatarProfileKey: rider.avatar_profile_key,
        avatarSeed: rider.avatar_seed,
        age: ageByRiderId.get(rider.id) ?? 25,
        events: [...(eventsByRiderId.get(rider.id) ?? [])].sort(
          (left, right) =>
            left.startDay - right.startDay ||
            left.endDay - right.endDay ||
            left.title.localeCompare(right.title, "fr"),
        ),
      };
    })
    .sort((left, right) =>
      `${left.lastName} ${left.firstName}`.localeCompare(
        `${right.lastName} ${right.firstName}`,
        "fr",
      ),
    );

  return {
    teamId: context.teamSeason.team_id,
    teamName: context.teamSeason.display_name,
    seasonId: context.season.id,
    seasonName: context.season.name,
    currentDayNumber,
    days: mapPlanningDays(days),
    riders: planningRiders,
  };
}

async function loadContext(admin: AdminClient, authUserId: string) {
  const directorResult = await admin
    .from("sporting_directors")
    .select("id")
    .eq("auth_user_id", authUserId)
    .eq("status", "active")
    .maybeSingle<DirectorRow>();
  assertQuery(directorResult.error, "le Directeur Sportif");
  if (!directorResult.data) return null;

  const [assignmentResult, seasonResult] = await Promise.all([
    admin
      .from("team_manager_assignments")
      .select("team_id")
      .eq("sporting_director_id", directorResult.data.id)
      .eq("role", "general_manager")
      .eq("status", "active")
      .maybeSingle<AssignmentRow>(),
    admin
      .from("seasons")
      .select("id, name, current_day_number")
      .eq("status", "active")
      .maybeSingle<SeasonRow>(),
  ]);
  assertQuery(assignmentResult.error, "l’équipe du Directeur Sportif");
  assertQuery(seasonResult.error, "la saison active");
  if (!assignmentResult.data || !seasonResult.data) return null;

  const teamSeasonResult = await admin
    .from("team_seasons")
    .select("id, team_id, display_name")
    .eq("team_id", assignmentResult.data.team_id)
    .eq("season_id", seasonResult.data.id)
    .maybeSingle<TeamSeasonRow>();
  assertQuery(teamSeasonResult.error, "la saison de l’équipe");
  if (!teamSeasonResult.data) return null;

  return {
    season: seasonResult.data,
    teamSeason: teamSeasonResult.data,
  };
}

function getInjuryDayRange(injury: InjuryRow, days: DayRow[]) {
  const startedOn = toParisDate(injury.started_at);
  const recoversOn = toParisDate(injury.expected_recovery_at);
  const overlappingDays = days.filter(
    (day) =>
      day.calendar_date >= startedOn && day.calendar_date <= recoversOn,
  );
  if (overlappingDays.length === 0) return null;
  return {
    startDay: overlappingDays[0]?.day_number ?? 1,
    endDay:
      overlappingDays[overlappingDays.length - 1]?.day_number ?? 28,
  };
}

function mapPlanningDays(days: DayRow[]) {
  return days.map((day) => ({
    id: day.id,
    dayNumber: day.day_number,
    calendarDate: day.calendar_date,
  }));
}

function toParisDate(timestamp: string) {
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
}

function getInjuryLabel(code: string) {
  if (code in RIDER_INJURY_DIAGNOSES) {
    return RIDER_INJURY_DIAGNOSES[
      code as keyof typeof RIDER_INJURY_DIAGNOSES
    ].label;
  }
  const legacyLabels: Record<string, string> = {
    legacy_fracture: "Fracture",
    legacy_concussion: "Commotion",
    legacy_contusion: "Contusion",
    legacy_abrasions: "Abrasions",
  };
  return legacyLabels[code] ?? "Indisponibilité médicale";
}

function toRaceCategoryCode(
  code: string | undefined,
): RaceCategoryCode | null {
  return code && isRaceCategoryCode(code) ? code : null;
}

function formatBonus(value: number | string) {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function addEvent(
  eventsByRiderId: Map<string, RiderPlanningEvent[]>,
  riderId: string,
  event: RiderPlanningEvent,
) {
  const events = eventsByRiderId.get(riderId);
  if (events) events.push(event);
}

function groupBy<T>(rows: T[], key: (row: T) => string) {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const rowKey = key(row);
    groups.set(rowKey, [...(groups.get(rowKey) ?? []), row]);
  }
  return groups;
}

function emptyResult<T>() {
  return Promise.resolve({
    data: [] as T[],
    error: null,
  });
}

function assertQuery(
  error: { message: string } | null,
  label: string,
): asserts error is null {
  if (error) {
    throw new Error(`Impossible de charger ${label} : ${error.message}`);
  }
}
