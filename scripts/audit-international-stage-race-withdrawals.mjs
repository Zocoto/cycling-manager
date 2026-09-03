import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error("Les variables Supabase sont manquantes.");
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const seasons = await fetchAll((from, to) =>
  supabase
    .from("seasons")
    .select("id,name,game_year,status")
    .order("game_year")
    .range(from, to),
);
const editions = await fetchAll((from, to) =>
  supabase
    .from("race_editions")
    .select(
      "id,season_id,display_name,withdrawal_closes_at,races(race_format,competition_type),stages(id,season_day_id,departure_at,status)",
    )
    .range(from, to),
);
const internationalEditionIds = new Set(
  editions
    .filter((edition) =>
      ["continental_championship", "world_championship"].includes(
        edition.races?.competition_type,
      ),
    )
    .map((edition) => edition.id),
);
const stageRaceEditionIds = new Set(
  editions
    .filter((edition) => edition.races?.race_format === "stage_race")
    .map((edition) => edition.id),
);
const nationSelections = await fetchAll((from, to) =>
  supabase
    .from("international_championship_nation_selections")
    .select("id,race_edition_id")
    .in("race_edition_id", [...internationalEditionIds])
    .range(from, to),
);
const selectionById = new Map(
  nationSelections.map((selection) => [selection.id, selection]),
);
const candidates = await fetchAll((from, to) =>
  supabase
    .from("international_championship_rider_selections")
    .select(
      "id,nation_selection_id,rider_id,team_id,sporting_director_id,response_status,is_selected,selected_at,created_at",
    )
    .not("selected_at", "is", null)
    .range(from, to),
);
const registrations = await fetchAll((from, to) =>
  supabase
    .from("race_registrations")
    .select(
      "id,race_edition_id,team_season_id,status,entry_method,registered_at,decided_at",
    )
    .in("race_edition_id", [...stageRaceEditionIds])
    .in("status", ["accepted", "withdrawn"])
    .range(from, to),
);
const registrationById = new Map(
  registrations.map((registration) => [registration.id, registration]),
);
const withdrawnRosters = await fetchAll((from, to) =>
  supabase
    .from("race_rosters")
    .select("id,race_registration_id,rider_id,status,selected_at")
    .in(
      "race_registration_id",
      registrations.map((row) => row.id),
    )
    .eq("status", "withdrawn")
    .range(from, to),
);
const teamSeasonIds = [
  ...new Set(registrations.map((row) => row.team_season_id).filter(Boolean)),
];
const teamSeasons = await fetchAll((from, to) =>
  supabase
    .from("team_seasons")
    .select("id,team_id,season_id,display_name,status")
    .in("id", teamSeasonIds)
    .range(from, to),
);
const riderIds = [...new Set(withdrawnRosters.map((row) => row.rider_id))];
const riders = await fetchAll((from, to) =>
  supabase
    .from("riders")
    .select("id,first_name,last_name")
    .in("id", riderIds)
    .range(from, to),
);

const editionById = new Map(editions.map((edition) => [edition.id, edition]));
const teamSeasonById = new Map(teamSeasons.map((row) => [row.id, row]));
const riderById = new Map(riders.map((rider) => [rider.id, rider]));
const candidatesByRiderId = groupBy(
  candidates,
  (candidate) => candidate.rider_id,
);
const incidents = [];

for (const roster of withdrawnRosters) {
  const registration = registrationById.get(roster.race_registration_id);
  const tour = registration
    ? editionById.get(registration.race_edition_id)
    : null;
  if (!registration || !tour) continue;

  for (const candidate of candidatesByRiderId.get(roster.rider_id) ?? []) {
    const nationSelection = selectionById.get(candidate.nation_selection_id);
    const championship = nationSelection
      ? editionById.get(nationSelection.race_edition_id)
      : null;
    if (!championship || championship.season_id !== tour.season_id) continue;
    if (!hasSharedRaceDay(championship, tour)) continue;

    const selectedAt = Date.parse(candidate.selected_at);
    const tourDepartures = tour.stages
      .map((stage) => Date.parse(stage.departure_at))
      .filter(Number.isFinite);
    const startedAtSelection = tourDepartures.some(
      (departureAt) => departureAt <= selectedAt,
    );
    const hadFutureStage = tourDepartures.some(
      (departureAt) => departureAt >= selectedAt,
    );
    const withdrawalClosesAt = Date.parse(tour.withdrawal_closes_at);
    const wasLockedAtSelection =
      !Number.isFinite(withdrawalClosesAt) || withdrawalClosesAt <= selectedAt;

    if (!(hadFutureStage && (startedAtSelection || wasLockedAtSelection))) {
      continue;
    }

    const teamSeason = teamSeasonById.get(registration.team_season_id);
    const rider = riderById.get(roster.rider_id);
    incidents.push({
      candidateId: candidate.id,
      sportingDirectorId: candidate.sporting_director_id,
      teamSeasonId: registration.team_season_id,
      teamId: teamSeason?.team_id ?? candidate.team_id,
      teamName: teamSeason?.display_name ?? null,
      seasonId: tour.season_id,
      seasonName: seasons.find((season) => season.id === tour.season_id)?.name,
      riderId: roster.rider_id,
      riderName: rider
        ? `${rider.first_name} ${rider.last_name}`
        : roster.rider_id,
      tourEditionId: tour.id,
      tourName: tour.display_name,
      championshipEditionId: championship.id,
      championshipName: championship.display_name,
      selectedAt: candidate.selected_at,
      startedAtSelection,
      wasLockedAtSelection,
      registrationStatus: registration.status,
      candidateStatus: candidate.response_status,
    });
  }
}

const affectedDirectors = [
  ...groupBy(
    incidents.filter((incident) => incident.sportingDirectorId),
    (incident) => incident.sportingDirectorId,
  ),
].map(([sportingDirectorId, directorIncidents]) => ({
  sportingDirectorId,
  teamSeasonId: directorIncidents[0].teamSeasonId,
  teamId: directorIncidents[0].teamId,
  teamName: directorIncidents[0].teamName,
  seasonId: directorIncidents[0].seasonId,
  tours: [...new Set(directorIncidents.map((incident) => incident.tourName))],
  riders: [...new Set(directorIncidents.map((incident) => incident.riderName))],
  incidentCount: directorIncidents.length,
}));

const affectedDirectorIds = affectedDirectors.map(
  (director) => director.sportingDirectorId,
);
const affectedTeamIds = affectedDirectors.map((director) => director.teamId);
const [directors, assignments, botManagers] = await Promise.all([
  fetchAll((from, to) =>
    supabase
      .from("sporting_directors")
      .select("id,status,auth_user_id")
      .in("id", affectedDirectorIds)
      .range(from, to),
  ),
  fetchAll((from, to) =>
    supabase
      .from("team_manager_assignments")
      .select("sporting_director_id,team_id,role,status")
      .in("sporting_director_id", affectedDirectorIds)
      .in("team_id", affectedTeamIds)
      .range(from, to),
  ),
  fetchAll((from, to) =>
    supabase
      .from("alpha_bot_managers")
      .select("sporting_director_id")
      .in("sporting_director_id", affectedDirectorIds)
      .range(from, to),
  ),
]);
const directorById = new Map(
  directors.map((director) => [director.id, director]),
);
const activeAssignmentKeys = new Set(
  assignments
    .filter(
      (assignment) =>
        assignment.role === "general_manager" && assignment.status === "active",
    )
    .map(
      (assignment) =>
        `${assignment.sporting_director_id}:${assignment.team_id}`,
    ),
);
const botDirectorIds = new Set(
  botManagers.map((manager) => manager.sporting_director_id),
);

for (const affectedDirector of affectedDirectors) {
  const director = directorById.get(affectedDirector.sportingDirectorId);
  affectedDirector.directorStatus = director?.status ?? null;
  affectedDirector.hasAuthUser = Boolean(director?.auth_user_id);
  affectedDirector.hasActiveAssignment = activeAssignmentKeys.has(
    `${affectedDirector.sportingDirectorId}:${affectedDirector.teamId}`,
  );
  affectedDirector.isAlphaBot = botDirectorIds.has(
    affectedDirector.sportingDirectorId,
  );
  affectedDirector.compensationEligible = Boolean(
    director?.status === "active" &&
    director.auth_user_id &&
    affectedDirector.hasActiveAssignment &&
    !affectedDirector.isAlphaBot,
  );
}

const summaryOnly = process.argv.includes("--summary");
const incidentsByTour = [...groupBy(incidents, (incident) => incident.tourName)]
  .map(([tourName, tourIncidents]) => ({
    tourName,
    withdrawnRiderCount: new Set(
      tourIncidents.map((incident) => incident.riderId),
    ).size,
    affectedDirectorCount: new Set(
      tourIncidents.map((incident) => incident.sportingDirectorId),
    ).size,
  }))
  .sort((left, right) => left.tourName.localeCompare(right.tourName, "fr"));

console.log(
  JSON.stringify(
    summaryOnly
      ? {
          incidentCount: incidents.length,
          affectedRiderCount: new Set(
            incidents.map((incident) => incident.riderId),
          ).size,
          affectedDirectorCount: affectedDirectors.length,
          incidentsByTour,
          affectedDirectors,
        }
      : { incidents, affectedDirectors },
    null,
    2,
  ),
);

async function fetchAll(queryPage, pageSize = 500) {
  const rows = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await queryPage(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
  }
}

function groupBy(values, getKey) {
  const grouped = new Map();
  for (const value of values) {
    const key = getKey(value);
    const group = grouped.get(key) ?? [];
    group.push(value);
    grouped.set(key, group);
  }
  return grouped;
}

function hasSharedRaceDay(firstEdition, secondEdition) {
  const firstDayIds = new Set(
    firstEdition.stages.map((stage) => stage.season_day_id),
  );
  return secondEdition.stages.some((stage) =>
    firstDayIds.has(stage.season_day_id),
  );
}
