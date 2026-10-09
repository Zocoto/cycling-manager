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
import {
  collectChunkedPaginatedRows,
  collectPaginatedRows,
} from "@/lib/supabase/pagination";

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
type FederationSelectionRaceLinkRow = {
  race_registration_id: string;
  race_edition_id: string;
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
  camp_type:
    | "classic"
    | "premium"
    | "reconnaissance"
    | "indoor_preparation"
    | "wind_tunnel_preparation";
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

const PLANNING_QUERY_BATCH_SIZE = 75;
const PLANNING_QUERY_PAGE_SIZE = 500;

export async function getCurrentTeamRiderSeasonPlanning({
  authUserId,
  riderId,
}: {
  authUserId: string;
  riderId?: string;
}): Promise<TeamRiderSeasonPlanning | null> {
  const admin = createSupabaseAdminClient();
  // This is a read view: event statuses are derived from the current season day.
  // Opening a planning must not trigger a global gameplay settlement.
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
      loadSeasonEditions(admin, context.season.id),
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
    teamRegistrationsResult,
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
      .eq("status", "active")
      .gt("expected_recovery_at", new Date().toISOString())
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
    [teamRegistrationsResult, "les inscriptions en course"],
    [campsResult, "les stages de forme"],
    [injuriesResult, "les blessures"],
    [reconnaissancesResult, "les stages de reconnaissance"],
  ] as const) {
    assertQuery(result.error, label);
  }

  const riders = ridersResult.data ?? [];
  const teamRegistrations = teamRegistrationsResult.data ?? [];
  const federationRegistrations = await loadFederationRegistrations(
    admin,
    editionIds,
  );
  const registrations = uniqueById([
    ...teamRegistrations,
    ...federationRegistrations,
  ]);
  const teamRegistrationIds = teamRegistrations.map(
    (registration) => registration.id,
  );
  const teamRegistrationIdSet = new Set(teamRegistrationIds);
  const federationRegistrationIds = federationRegistrations
    .map((registration) => registration.id)
    .filter((registrationId) => !teamRegistrationIdSet.has(registrationId));
  const reconnaissances = reconnaissancesResult.data ?? [];
  const reconnaissanceIds = reconnaissances.map(
    (reconnaissance) => reconnaissance.id,
  );
  const countryIds = [...new Set(riders.map((rider) => rider.country_id))];
  const [
    countriesResult,
    teamRosters,
    federationRosters,
    participantsResult,
  ] =
    await Promise.all([
      admin
        .from("countries")
        .select("id, name, iso_alpha2")
        .in("id", countryIds)
        .returns<CountryRow[]>(),
      loadRaceRosters(
        admin,
        teamRegistrationIds,
        riderIds,
        "les sélections de course",
      ),
      loadOptionalFederationRaceRosters(
        admin,
        federationRegistrationIds,
        riderIds,
      ),
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
  assertQuery(participantsResult.error, "les participants aux reconnaissances");
  const rosters = uniqueRosters([...teamRosters, ...federationRosters]);
  const registrationById = new Map(
    registrations.map((registration) => [registration.id, registration]),
  );
  const editionById = new Map(editions.map((edition) => [edition.id, edition]));
  const registeredEditionIds = [
    ...new Set(
      rosters.flatMap((roster) => {
        const registration = registrationById.get(roster.race_registration_id);
        return registration && editionById.has(registration.race_edition_id)
          ? [registration.race_edition_id]
          : [];
      }),
    ),
  ];
  const referencedStageIds = [
    ...new Set([
      ...reconnaissances.map((row) => row.target_stage_id),
      ...(injuriesResult.data ?? []).flatMap((row) =>
        row.source_stage_id ? [row.source_stage_id] : [],
      ),
    ]),
  ];
  const stages = uniqueById([
    ...(await loadPlanningStages(admin, "race_edition_id", registeredEditionIds)),
    ...(await loadPlanningStages(admin, "id", referencedStageIds)),
  ]);
  const requiredRaceIds = [
    ...new Set(
      [...registeredEditionIds, ...stages.map((stage) => stage.race_edition_id)]
        .flatMap((id) => {
          const edition = editionById.get(id);
          return edition ? [edition.race_id] : [];
        }),
    ),
  ];
  const races = await loadPlanningRaces(admin, requiredRaceIds);

  const days = daysResult.data ?? [];
  const currentDayNumber = context.season.current_day_number ?? 1;
  const dayById = new Map(days.map((day) => [day.id, day]));
  const countryById = new Map(
    (countriesResult.data ?? []).map((country) => [country.id, country]),
  );
  const ageByRiderId = new Map(
    (ratingsResult.data ?? []).map((rating) => [rating.rider_id, rating.age]),
  );
  const raceById = new Map(
    races.map((race) => [race.id, race]),
  );
  const categoryById = new Map(
    (categoriesResult.data ?? []).map((category) => [category.id, category]),
  );
  const stageById = new Map(
    stages.map((stage) => [stage.id, stage]),
  );
  const stagesByEditionId = groupBy(
    stages,
    (stage) => stage.race_edition_id,
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

  for (const roster of rosters) {
    const registration = registrationById.get(roster.race_registration_id);
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
    const isPerformancePreparation =
      camp.camp_type === "indoor_preparation" ||
      camp.camp_type === "wind_tunnel_preparation";
    const definition =
      camp.camp_type === "classic" || camp.camp_type === "premium"
        ? FORM_CAMP_TYPES[camp.camp_type]
        : null;
    addEvent(eventsByRiderId, camp.rider_id, {
      id: `form-camp:${camp.id}`,
      riderId: camp.rider_id,
      type: "form_camp",
      title: isPerformancePreparation
        ? camp.camp_type === "indoor_preparation"
          ? "Préparation · Piste indoor"
          : "Préparation · Soufflerie"
        : definition!.label,
      detail: isPerformancePreparation
        ? "Préparation de performance · entraînement suspendu"
        : `Remise en forme · +${camp.form_gain_per_day} points par jour`,
      startDay: camp.start_day_number,
      endDay: camp.end_day_number,
      status: getRiderPlanningEventStatus({
        startDay: camp.start_day_number,
        endDay: camp.end_day_number,
        currentDayNumber,
      }),
      href: isPerformancePreparation
        ? "/jeu/entrainement?onglet=preparation"
        : "/jeu/centre-de-soin?onglet=forme",
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
    (day) => day.calendar_date >= startedOn && day.calendar_date <= recoversOn,
  );
  if (overlappingDays.length === 0) return null;
  return {
    startDay: overlappingDays[0]?.day_number ?? 1,
    endDay: overlappingDays[overlappingDays.length - 1]?.day_number ?? 28,
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
    return RIDER_INJURY_DIAGNOSES[code as keyof typeof RIDER_INJURY_DIAGNOSES]
      .label;
  }
  const legacyLabels: Record<string, string> = {
    legacy_fracture: "Fracture",
    legacy_concussion: "Commotion",
    legacy_contusion: "Contusion",
    legacy_abrasions: "Abrasions",
  };
  return legacyLabels[code] ?? "Indisponibilité médicale";
}

function toRaceCategoryCode(code: string | undefined): RaceCategoryCode | null {
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

function uniqueById<T extends { id: string }>(rows: T[]) {
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

async function loadSeasonEditions(admin: AdminClient, seasonId: string) {
  return collectPaginatedRows<EditionRow, { message: string }>({
    pageSize: PLANNING_QUERY_PAGE_SIZE,
    fetchPage: async (from, to) => {
      const result = await admin
        .from("race_editions")
        .select("id, race_id, race_category_id, display_name, status")
        .eq("season_id", seasonId)
        .neq("status", "cancelled")
        .order("id")
        .range(from, to)
        .returns<EditionRow[]>();
      return { data: result.data, error: result.error };
    },
  });
}

async function loadPlanningRaces(admin: AdminClient, raceIds: string[]) {
  const result = await collectChunkedPaginatedRows<RaceRow, { message: string }, string>({
    values: raceIds,
    chunkSize: PLANNING_QUERY_BATCH_SIZE,
    pageSize: PLANNING_QUERY_PAGE_SIZE,
    maxConcurrency: 2,
    fetchPage: async (raceIdBatch, from, to) => {
      const page = await admin
        .from("races")
        .select("id, name, slug, race_format")
        .in("id", raceIdBatch)
        .order("id")
        .range(from, to)
        .returns<RaceRow[]>();
      return { data: page.data, error: page.error };
    },
  });
  assertQuery(result.error, "les identités des courses");
  return uniqueById(result.data);
}

async function loadPlanningStages(
  admin: AdminClient,
  column: "id" | "race_edition_id",
  ids: string[],
) {
  const result = await collectChunkedPaginatedRows<StageRow, { message: string }, string>({
    values: ids,
    chunkSize: PLANNING_QUERY_BATCH_SIZE,
    pageSize: PLANNING_QUERY_PAGE_SIZE,
    maxConcurrency: 2,
    fetchPage: async (idBatch, from, to) => {
      const page = await admin
        .from("stages")
        .select("id, race_edition_id, season_day_id, stage_number, name, status")
        .in(column, idBatch)
        .neq("status", "cancelled")
        .order("id")
        .range(from, to)
        .returns<StageRow[]>();
      return { data: page.data, error: page.error };
    },
  });
  assertQuery(result.error, "les étapes");
  return uniqueById(result.data);
}

async function loadFederationRegistrations(
  admin: AdminClient,
  editionIds: string[],
): Promise<RegistrationRow[]> {
  try {
    const links: FederationSelectionRaceLinkRow[] = [];
    for (const editionIdBatch of chunkValues(
      editionIds,
      PLANNING_QUERY_BATCH_SIZE,
    )) {
      for (let offset = 0; ; offset += PLANNING_QUERY_PAGE_SIZE) {
        const result = await admin
          .from("national_federation_selection_race_links")
          .select("race_registration_id, race_edition_id")
          .in("race_edition_id", editionIdBatch)
          .order("race_registration_id")
          .order("race_edition_id")
          .range(offset, offset + PLANNING_QUERY_PAGE_SIZE - 1)
          .returns<FederationSelectionRaceLinkRow[]>();
        assertQuery(result.error, "les inscriptions des sélections fédérales");
        const page = result.data ?? [];
        links.push(...page);
        if (page.length < PLANNING_QUERY_PAGE_SIZE) break;
      }
    }

    const registrationIds = [
      ...new Set(links.map((link) => link.race_registration_id)),
    ];
    const registrations: RegistrationRow[] = [];
    for (const registrationIdBatch of chunkValues(
      registrationIds,
      PLANNING_QUERY_BATCH_SIZE,
    )) {
      const result = await admin
        .from("race_registrations")
        .select("id, race_edition_id, status")
        .in("id", registrationIdBatch)
        .in("status", ["pending", "accepted"])
        .returns<RegistrationRow[]>();
      assertQuery(result.error, "les engagements des sélections fédérales");
      registrations.push(...(result.data ?? []));
    }
    return uniqueById(registrations);
  } catch (error) {
    console.error(
      "[rider-season-planning] Les sélections fédérales sont temporairement omises du planning.",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

async function loadRaceRosters(
  admin: AdminClient,
  registrationIds: string[],
  riderIds: string[],
  errorLabel: string,
): Promise<RosterRow[]> {
  const rosters: RosterRow[] = [];
  for (const registrationIdBatch of chunkValues(
    registrationIds,
    PLANNING_QUERY_BATCH_SIZE,
  )) {
    for (let offset = 0; ; offset += PLANNING_QUERY_PAGE_SIZE) {
      const result = await admin
        .from("race_rosters")
        .select("rider_id, race_registration_id")
        .in("race_registration_id", registrationIdBatch)
        .in("rider_id", riderIds)
        .in("status", ["selected", "confirmed"])
        .order("race_registration_id")
        .order("rider_id")
        .range(offset, offset + PLANNING_QUERY_PAGE_SIZE - 1)
        .returns<RosterRow[]>();
      assertQuery(result.error, errorLabel);
      const page = result.data ?? [];
      rosters.push(...page);
      if (page.length < PLANNING_QUERY_PAGE_SIZE) break;
    }
  }
  return uniqueRosters(rosters);
}

async function loadOptionalFederationRaceRosters(
  admin: AdminClient,
  registrationIds: string[],
  riderIds: string[],
) {
  try {
    return await loadRaceRosters(
      admin,
      registrationIds,
      riderIds,
      "les sélections fédérales de course",
    );
  } catch (error) {
    console.error(
      "[rider-season-planning] Les coureurs des sélections fédérales sont temporairement omis du planning.",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

function chunkValues<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function uniqueRosters(rows: RosterRow[]) {
  return [
    ...new Map(
      rows.map((row) => [
        `${row.race_registration_id}:${row.rider_id}`,
        row,
      ]),
    ).values(),
  ];
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
