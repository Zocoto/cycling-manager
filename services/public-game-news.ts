import "server-only";

import { SPONSORS } from "@/data/sponsors";
import {
  DEFAULT_AMATEUR_JERSEY,
  isAmateurJerseyPattern,
  normalizeHexColor,
  type AmateurJerseyConfig,
} from "@/lib/amateur-team";
import {
  createEmptyPublicGameNewsSnapshot,
  createPublicGameNewsSnapshot,
  resolvePublicGameNewsTeamJersey,
  resolvePublicGameNewsTeamJerseyArtwork,
  type PublicGameNewsItem,
  type PublicGameNewsSnapshot,
  type PublicGameNewsTeamVisual,
} from "@/lib/game/public-game-news";
import type { RaceStageSegment } from "@/lib/game/race-profiles";
import {
  STAFF_ROLE_DEFINITIONS,
  isStaffRole,
} from "@/lib/game/staff";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

type RaceResultRow = {
  id: string;
  race_edition_id: string;
  race_roster_id: string;
  created_at: string;
};

type RaceEditionRow = {
  id: string;
  display_name: string;
};

type RaceRosterRow = {
  id: string;
  race_registration_id: string;
  rider_id: string;
};

type RaceRegistrationRow = {
  id: string;
  team_season_id: string;
};

type RaceStageRow = {
  id: string;
  race_edition_id: string;
  stage_number: number;
};

type StageSegmentPrimeRow = {
  prime_type: "mountain" | "intermediate_sprint";
  mountain_category: "HC" | "1" | "2" | "3" | "4" | null;
  points_scale: number[];
};

type StageSegmentRow = {
  stage_id: string;
  segment_number: number;
  distance_km: number | string;
  terrain_type: "flat" | "climb" | "descent";
  surface_type: "asphalt" | "cobbles";
  average_gradient_pct: number | string;
  stage_segment_primes: StageSegmentPrimeRow[];
};

type RiderRow = {
  id: string;
  first_name: string;
  last_name: string;
  avatar_profile_key: string;
  avatar_seed: number | string;
};

type TeamSeasonRow = {
  id: string;
  team_id: string;
  display_name: string;
  created_at: string;
};

type TeamRow = {
  id: string;
  amateur_jersey_pattern: string;
  amateur_jersey_primary_color: string;
  amateur_jersey_secondary_color: string;
  amateur_jersey_accent_color: string;
};

type SportingDirectorRow = {
  id: string;
  display_name: string;
  avatar_key: string | null;
  created_at: string;
};

type TeamManagerAssignmentRow = {
  sporting_director_id: string;
  team_id: string;
};

type RiderContractRow = {
  id: string;
  rider_id: string;
  team_id: string;
  acquisition_type:
    | "daily_auction"
    | "director_auction"
    | "free_agent";
  signed_at: string | null;
  created_at: string;
};

type StaffContractRow = {
  id: string;
  staff_member_id: string;
  team_id: string;
  signed_at: string;
};

type StaffMemberRow = {
  id: string;
  country_id: string;
  first_name: string;
  last_name: string;
  role: string;
  level: number;
};

type CountryAvatarProfileRow = {
  country_id: string;
  avatar_profile_key: string;
};

type TeamSponsorContractRow = {
  team_id: string;
  sponsor_id: string;
  selected_jersey_id: string | null;
  created_at: string;
};

type SponsorRegistryRow = {
  id: string;
  catalog_key: string;
};

type PostRaceNewsRow = {
  id: string;
  race_edition_id: string;
  stage_id: string;
  event_kind: "breakaway" | "incident" | "classification";
  title: string;
  detail: string;
  featured_rider_id: string | null;
  featured_team_id: string | null;
  happened_at: string;
};

type LoadedNews = {
  items: PublicGameNewsItem[];
  total: number | null;
};

const movementTypes = [
  "daily_auction",
  "director_auction",
  "free_agent",
] as const;

export async function getPublicGameNews(): Promise<PublicGameNewsSnapshot> {
  let admin: AdminClient;

  try {
    admin = createSupabaseAdminClient();
  } catch {
    return createEmptyPublicGameNewsSnapshot();
  }

  const results = await Promise.allSettled([
    loadRecentPostRaceNews(admin),
    loadRecentVictories(admin),
    loadRecentArrivals(admin),
    loadRecentRiderMovements(admin),
    loadRecentStaffMovements(admin),
  ]);
  const successfulLoads = results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : []
  );

  if (successfulLoads.length === 0) {
    return createEmptyPublicGameNewsSnapshot();
  }

  const [postRaceNews, victories, arrivals, riderMovements, staffMovements] =
    results.map((result) =>
      result.status === "fulfilled"
        ? result.value
        : ({ items: [], total: null } satisfies LoadedNews)
    );

  return createPublicGameNewsSnapshot({
    items: [
      ...postRaceNews.items,
      ...victories.items,
      ...arrivals.items,
      ...riderMovements.items,
      ...staffMovements.items,
    ],
    totals: {
      directors: arrivals.total,
      victories: victories.total,
      movements: sumKnownTotals(riderMovements.total, staffMovements.total),
    },
    isLive: true,
  });
}

async function loadRecentPostRaceNews(admin: AdminClient): Promise<LoadedNews> {
  const [recentQuery, totalQuery] = await Promise.all([
    admin
      .from("post_race_news_events")
      .select(
        "id, race_edition_id, stage_id, event_kind, title, detail, featured_rider_id, featured_team_id, happened_at"
      )
      .order("happened_at", { ascending: false })
      .limit(10)
      .returns<PostRaceNewsRow[]>(),
    admin
      .from("post_race_news_events")
      .select("id", { count: "exact", head: true }),
  ]);
  assertQuery(recentQuery.error, "les résumés de course");
  assertQuery(totalQuery.error, "le total des résumés de course");

  const rows = recentQuery.data ?? [];
  if (rows.length === 0) {
    return { items: [], total: totalQuery.count ?? 0 };
  }

  const riderIds = unique(
    rows.flatMap((row) =>
      row.featured_rider_id ? [row.featured_rider_id] : []
    )
  );
  const teamIds = unique(
    rows.flatMap((row) => (row.featured_team_id ? [row.featured_team_id] : []))
  );
  const editionIds = unique(rows.map((row) => row.race_edition_id));
  const [ridersQuery, teamSeasonsQuery, profilesByEditionId] =
    await Promise.all([
      riderIds.length > 0
        ? admin
            .from("riders")
            .select(
              "id, first_name, last_name, avatar_profile_key, avatar_seed"
            )
            .in("id", riderIds)
            .returns<RiderRow[]>()
        : Promise.resolve({ data: [] as RiderRow[], error: null }),
      teamIds.length > 0
        ? admin
            .from("team_seasons")
            .select("id, team_id, display_name, created_at")
            .in("team_id", teamIds)
            .order("created_at", { ascending: false })
            .returns<TeamSeasonRow[]>()
        : Promise.resolve({ data: [] as TeamSeasonRow[], error: null }),
      loadRaceProfiles(admin, editionIds),
    ]);
  assertQuery(ridersQuery.error, "les coureurs des résumés de course");
  assertQuery(teamSeasonsQuery.error, "les équipes des résumés de course");

  const riderById = toMap(ridersQuery.data ?? []);
  const teamSeasons = teamSeasonsQuery.data ?? [];
  const teamVisualByTeamId = await loadTeamVisuals(admin, teamSeasons);

  const items = rows.map((row) => {
    const rider = row.featured_rider_id
      ? riderById.get(row.featured_rider_id)
      : null;
    const teamVisual = row.featured_team_id
      ? teamVisualByTeamId.get(row.featured_team_id)
      : null;
    const riderName = rider
      ? `${rider.first_name} ${rider.last_name}`
      : null;
    const raceProfile = profilesByEditionId.get(row.race_edition_id);

    return {
      id: `race-recap:${row.id}`,
      kind: "race_recap" as const,
      title: row.title,
      detail: row.detail,
      happenedAt: row.happened_at,
      ...(rider && riderName
        ? {
            visual: {
              person: {
                kind: "rider" as const,
                profileKey: rider.avatar_profile_key,
                seed: String(rider.avatar_seed),
                label: `Portrait de ${riderName}`,
              },
              team: teamVisual ?? null,
              ...(raceProfile && raceProfile.length > 0
                ? { raceProfile }
                : {}),
            },
          }
        : {}),
    };
  });

  return { items, total: totalQuery.count ?? items.length };
}

async function loadRecentVictories(admin: AdminClient): Promise<LoadedNews> {
  const [recentQuery, totalQuery] = await Promise.all([
    admin
      .from("race_results")
      .select("id, race_edition_id, race_roster_id, created_at")
      .eq("final_rank", 1)
      .order("created_at", { ascending: false })
      .limit(6)
      .returns<RaceResultRow[]>(),
    admin
      .from("race_results")
      .select("id", { count: "exact", head: true })
      .eq("final_rank", 1),
  ]);
  assertQuery(recentQuery.error, "les dernières victoires");
  assertQuery(totalQuery.error, "le total des victoires");

  const results = recentQuery.data ?? [];
  if (results.length === 0) {
    return { items: [], total: totalQuery.count ?? 0 };
  }

  const editionIds = unique(results.map((row) => row.race_edition_id));
  const [editionsQuery, rostersQuery, profilesByEditionId] = await Promise.all([
    admin
      .from("race_editions")
      .select("id, display_name")
      .in("id", editionIds)
      .returns<RaceEditionRow[]>(),
    admin
      .from("race_rosters")
      .select("id, race_registration_id, rider_id")
      .in("id", unique(results.map((row) => row.race_roster_id)))
      .returns<RaceRosterRow[]>(),
    loadRaceProfiles(admin, editionIds),
  ]);
  assertQuery(editionsQuery.error, "les courses victorieuses");
  assertQuery(rostersQuery.error, "les vainqueurs");

  const rosters = rostersQuery.data ?? [];
  const [ridersQuery, registrationsQuery] = await Promise.all([
    admin
      .from("riders")
      .select(
        "id, first_name, last_name, avatar_profile_key, avatar_seed"
      )
      .in("id", unique(rosters.map((row) => row.rider_id)))
      .returns<RiderRow[]>(),
    admin
      .from("race_registrations")
      .select("id, team_season_id")
      .in("id", unique(rosters.map((row) => row.race_registration_id)))
      .returns<RaceRegistrationRow[]>(),
  ]);
  assertQuery(ridersQuery.error, "les identités des vainqueurs");
  assertQuery(registrationsQuery.error, "les équipes victorieuses");

  const registrations = registrationsQuery.data ?? [];
  const teamSeasonsQuery = await admin
    .from("team_seasons")
    .select("id, team_id, display_name, created_at")
    .in("id", unique(registrations.map((row) => row.team_season_id)))
    .returns<TeamSeasonRow[]>();
  assertQuery(teamSeasonsQuery.error, "les noms des équipes victorieuses");

  const teamSeasons = teamSeasonsQuery.data ?? [];
  const teamVisualByTeamId = await loadTeamVisuals(admin, teamSeasons);
  const editionById = toMap(editionsQuery.data ?? []);
  const rosterById = toMap(rosters);
  const riderById = toMap(ridersQuery.data ?? []);
  const registrationById = toMap(registrations);
  const teamSeasonById = toMap(teamSeasons);

  const items = results.flatMap((result) => {
    const edition = editionById.get(result.race_edition_id);
    const roster = rosterById.get(result.race_roster_id);
    const rider = roster ? riderById.get(roster.rider_id) : null;
    const registration = roster
      ? registrationById.get(roster.race_registration_id)
      : null;
    const teamSeason = registration
      ? teamSeasonById.get(registration.team_season_id)
      : null;

    if (!edition || !rider || !teamSeason) return [];

    const riderName = `${rider.first_name} ${rider.last_name}`;
    const raceProfile = profilesByEditionId.get(result.race_edition_id);

    return [
      {
        id: `victory:${result.id}`,
        kind: "victory" as const,
        title: `${riderName} s’impose`,
        detail: `${teamSeason.display_name} remporte ${edition.display_name}.`,
        happenedAt: result.created_at,
        visual: {
          person: {
            kind: "rider" as const,
            profileKey: rider.avatar_profile_key,
            seed: String(rider.avatar_seed),
            label: `Portrait de ${riderName}`,
          },
          team:
            teamVisualByTeamId.get(teamSeason.team_id) ??
            createFallbackTeamVisual(teamSeason.display_name),
          ...(raceProfile && raceProfile.length > 0 ? { raceProfile } : {}),
        },
      },
    ];
  });

  return { items, total: totalQuery.count ?? items.length };
}

async function loadRecentArrivals(admin: AdminClient): Promise<LoadedNews> {
  const [recentQuery, totalQuery] = await Promise.all([
    admin
      .from("sporting_directors")
      .select("id, display_name, avatar_key, created_at")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(6)
      .returns<SportingDirectorRow[]>(),
    admin
      .from("sporting_directors")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
  ]);
  assertQuery(recentQuery.error, "les nouveaux directeurs sportifs");
  assertQuery(totalQuery.error, "le total des directeurs sportifs");

  const directors = recentQuery.data ?? [];
  if (directors.length === 0) {
    return { items: [], total: totalQuery.count ?? 0 };
  }

  const assignmentsQuery = await admin
    .from("team_manager_assignments")
    .select("sporting_director_id, team_id")
    .in("sporting_director_id", directors.map((director) => director.id))
    .eq("role", "general_manager")
    .eq("status", "active")
    .returns<TeamManagerAssignmentRow[]>();
  assertQuery(
    assignmentsQuery.error,
    "les équipes des nouveaux directeurs sportifs"
  );

  const assignments = assignmentsQuery.data ?? [];
  const assignmentByDirectorId = new Map(
    assignments.map((assignment) => [
      assignment.sporting_director_id,
      assignment,
    ])
  );
  let teamSeasonByTeamId = new Map<string, TeamSeasonRow>();
  let teamVisualByTeamId = new Map<string, PublicGameNewsTeamVisual>();

  if (assignments.length > 0) {
    const teamSeasonsQuery = await admin
      .from("team_seasons")
      .select("id, team_id, display_name, created_at")
      .in(
        "team_id",
        unique(assignments.map((assignment) => assignment.team_id))
      )
      .order("created_at", { ascending: false })
      .returns<TeamSeasonRow[]>();
    assertQuery(
      teamSeasonsQuery.error,
      "les identités des équipes nouvellement dirigées"
    );

    const teamSeasons = teamSeasonsQuery.data ?? [];
    teamSeasonByTeamId = latestTeamSeasonByTeamId(teamSeasons);
    teamVisualByTeamId = await loadTeamVisuals(admin, teamSeasons);
  }

  const items = directors.map((director) => {
    const assignment = assignmentByDirectorId.get(director.id);
    const teamSeason = assignment
      ? teamSeasonByTeamId.get(assignment.team_id)
      : null;
    const team = teamSeason
      ? (teamVisualByTeamId.get(teamSeason.team_id) ??
        createFallbackTeamVisual(teamSeason.display_name))
      : null;

    return {
      id: `arrival:${director.id}`,
      kind: "arrival" as const,
      title: `${director.display_name} a rejoint le peloton`,
      detail: "Un nouveau directeur sportif prend place sur la ligne de départ.",
      happenedAt: director.created_at,
      visual: {
        person: {
          kind: "director" as const,
          avatarKey: director.avatar_key,
          label: `Portrait de ${director.display_name}`,
        },
        ...(team ? { team } : {}),
      },
    };
  });

  return { items, total: totalQuery.count ?? items.length };
}

async function loadRecentRiderMovements(
  admin: AdminClient
): Promise<LoadedNews> {
  const [recentQuery, totalQuery] = await Promise.all([
    admin
      .from("rider_contracts")
      .select(
        "id, rider_id, team_id, acquisition_type, signed_at, created_at"
      )
      .in("acquisition_type", movementTypes)
      .not("signed_at", "is", null)
      .order("signed_at", { ascending: false })
      .limit(6)
      .returns<RiderContractRow[]>(),
    admin
      .from("rider_contracts")
      .select("id", { count: "exact", head: true })
      .in("acquisition_type", movementTypes)
      .not("signed_at", "is", null),
  ]);
  assertQuery(recentQuery.error, "les derniers mouvements de coureurs");
  assertQuery(totalQuery.error, "le total des mouvements de coureurs");

  const contracts = recentQuery.data ?? [];
  if (contracts.length === 0) {
    return { items: [], total: totalQuery.count ?? 0 };
  }

  const [ridersQuery, teamSeasonsQuery] = await Promise.all([
    admin
      .from("riders")
      .select(
        "id, first_name, last_name, avatar_profile_key, avatar_seed"
      )
      .in("id", unique(contracts.map((row) => row.rider_id)))
      .returns<RiderRow[]>(),
    admin
      .from("team_seasons")
      .select("id, team_id, display_name, created_at")
      .in("team_id", unique(contracts.map((row) => row.team_id)))
      .order("created_at", { ascending: false })
      .returns<TeamSeasonRow[]>(),
  ]);
  assertQuery(ridersQuery.error, "les recrues");
  assertQuery(teamSeasonsQuery.error, "les équipes recruteuses");

  const teamSeasons = teamSeasonsQuery.data ?? [];
  const teamVisualByTeamId = await loadTeamVisuals(admin, teamSeasons);
  const riderById = toMap(ridersQuery.data ?? []);
  const teamSeasonByTeamId = latestTeamSeasonByTeamId(teamSeasons);

  const items = contracts.flatMap((contract) => {
    const rider = riderById.get(contract.rider_id);
    const teamSeason = teamSeasonByTeamId.get(contract.team_id);
    if (!rider || !teamSeason) return [];

    const riderName = `${rider.first_name} ${rider.last_name}`;

    return [
      {
        id: `movement:${contract.id}`,
        kind: "movement" as const,
        title: `${riderName} rejoint ${teamSeason.display_name}`,
        detail: getMovementDetail(contract.acquisition_type),
        happenedAt: contract.signed_at ?? contract.created_at,
        visual: {
          person: {
            kind: "rider" as const,
            profileKey: rider.avatar_profile_key,
            seed: String(rider.avatar_seed),
            label: `Portrait de ${riderName}`,
          },
          team:
            teamVisualByTeamId.get(teamSeason.team_id) ??
            createFallbackTeamVisual(teamSeason.display_name),
        },
      },
    ];
  });

  return { items, total: totalQuery.count ?? items.length };
}

async function loadRecentStaffMovements(
  admin: AdminClient
): Promise<LoadedNews> {
  const [recentQuery, totalQuery] = await Promise.all([
    admin
      .from("staff_contracts")
      .select("id, staff_member_id, team_id, signed_at")
      .neq("status", "cancelled")
      .order("signed_at", { ascending: false })
      .limit(6)
      .returns<StaffContractRow[]>(),
    admin
      .from("staff_contracts")
      .select("id", { count: "exact", head: true })
      .neq("status", "cancelled"),
  ]);
  assertQuery(recentQuery.error, "les derniers recrutements de staff");
  assertQuery(totalQuery.error, "le total des recrutements de staff");

  const contracts = recentQuery.data ?? [];
  if (contracts.length === 0) {
    return { items: [], total: totalQuery.count ?? 0 };
  }

  const [membersQuery, teamSeasonsQuery] = await Promise.all([
    admin
      .from("staff_members")
      .select("id, country_id, first_name, last_name, role, level")
      .in("id", unique(contracts.map((row) => row.staff_member_id)))
      .returns<StaffMemberRow[]>(),
    admin
      .from("team_seasons")
      .select("id, team_id, display_name, created_at")
      .in("team_id", unique(contracts.map((row) => row.team_id)))
      .order("created_at", { ascending: false })
      .returns<TeamSeasonRow[]>(),
  ]);
  assertQuery(membersQuery.error, "les membres du staff recrutés");
  assertQuery(teamSeasonsQuery.error, "les équipes du staff recruté");

  const members = membersQuery.data ?? [];
  const teamSeasons = teamSeasonsQuery.data ?? [];
  const [profilesQuery, teamVisualByTeamId] = await Promise.all([
    admin
      .from("country_rider_generation_profiles")
      .select("country_id, avatar_profile_key")
      .in("country_id", unique(members.map((member) => member.country_id)))
      .returns<CountryAvatarProfileRow[]>(),
    loadTeamVisuals(admin, teamSeasons),
  ]);

  const profileByCountryId = new Map(
    (profilesQuery.data ?? []).map((profile) => [
      profile.country_id,
      profile.avatar_profile_key,
    ])
  );
  const memberById = toMap(members);
  const teamSeasonByTeamId = latestTeamSeasonByTeamId(teamSeasons);

  const items = contracts.flatMap((contract) => {
    const member = memberById.get(contract.staff_member_id);
    const teamSeason = teamSeasonByTeamId.get(contract.team_id);
    if (!member || !teamSeason || !isStaffRole(member.role)) return [];

    const memberName = `${member.first_name} ${member.last_name}`;
    const role = STAFF_ROLE_DEFINITIONS[member.role];

    return [
      {
        id: `staff:${contract.id}`,
        kind: "staff" as const,
        title: `${memberName} signe chez ${teamSeason.display_name}`,
        detail: `${role.label} niveau ${member.level}, une nouvelle expertise rejoint l’équipe.`,
        happenedAt: contract.signed_at,
        visual: {
          person: {
            kind: "staff" as const,
            profileKey: profileByCountryId.get(member.country_id) ?? null,
            seed: member.id,
            role: member.role,
            label: `Portrait de ${memberName}, ${role.label.toLocaleLowerCase("fr")}`,
          },
          team:
            teamVisualByTeamId.get(teamSeason.team_id) ??
            createFallbackTeamVisual(teamSeason.display_name),
        },
      },
    ];
  });

  return { items, total: totalQuery.count ?? items.length };
}

async function loadRaceProfiles(
  admin: AdminClient,
  editionIds: string[]
): Promise<Map<string, RaceStageSegment[]>> {
  if (editionIds.length === 0) return new Map();

  const stagesQuery = await admin
    .from("stages")
    .select("id, race_edition_id, stage_number")
    .in("race_edition_id", editionIds)
    .order("stage_number", { ascending: false })
    .returns<RaceStageRow[]>();

  if (stagesQuery.error) return new Map();

  const stageByEditionId = new Map<string, RaceStageRow>();
  for (const stage of stagesQuery.data ?? []) {
    if (!stageByEditionId.has(stage.race_edition_id)) {
      stageByEditionId.set(stage.race_edition_id, stage);
    }
  }

  const stageIds = [...stageByEditionId.values()].map((stage) => stage.id);
  if (stageIds.length === 0) return new Map();

  const segmentsQuery = await admin
    .from("stage_segments")
    .select(
      `
        stage_id,
        segment_number,
        distance_km,
        terrain_type,
        surface_type,
        average_gradient_pct,
        stage_segment_primes (
          prime_type,
          mountain_category,
          points_scale
        )
      `
    )
    .in("stage_id", stageIds)
    .order("segment_number", { ascending: true })
    .returns<StageSegmentRow[]>();

  if (segmentsQuery.error) return new Map();

  const segmentsByStageId = new Map<string, RaceStageSegment[]>();
  for (const segment of segmentsQuery.data ?? []) {
    const prime = segment.stage_segment_primes[0];
    const stageSegments = segmentsByStageId.get(segment.stage_id) ?? [];
    stageSegments.push({
      segmentNumber: segment.segment_number,
      distanceKm: Number(segment.distance_km),
      terrain: segment.terrain_type,
      averageGradientPct: Number(segment.average_gradient_pct),
      surface: segment.surface_type,
      prime: prime
        ? {
            type: prime.prime_type,
            category: prime.mountain_category,
            pointsScale: prime.points_scale,
          }
        : null,
    });
    segmentsByStageId.set(segment.stage_id, stageSegments);
  }

  return new Map(
    [...stageByEditionId.entries()].map(([editionId, stage]) => [
      editionId,
      segmentsByStageId.get(stage.id) ?? [],
    ])
  );
}

async function loadTeamVisuals(
  admin: AdminClient,
  teamSeasons: TeamSeasonRow[]
): Promise<Map<string, PublicGameNewsTeamVisual>> {
  const latestTeamSeasons = latestTeamSeasonByTeamId(teamSeasons);
  const teamIds = [...latestTeamSeasons.keys()];
  if (teamIds.length === 0) return new Map();

  const [teamsQuery, contractsQuery] = await Promise.all([
    admin
      .from("teams")
      .select(
        `
          id,
          amateur_jersey_pattern,
          amateur_jersey_primary_color,
          amateur_jersey_secondary_color,
          amateur_jersey_accent_color
        `
      )
      .in("id", teamIds)
      .returns<TeamRow[]>(),
    admin
      .from("team_sponsor_contracts")
      .select("team_id, sponsor_id, selected_jersey_id, created_at")
      .in("team_id", teamIds)
      .eq("role", "principal")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .returns<TeamSponsorContractRow[]>(),
  ]);

  const teamById = teamsQuery.error
    ? new Map<string, TeamRow>()
    : toMap(teamsQuery.data ?? []);
  const amateurJerseyByTeamId = new Map(
    teamIds.map((teamId) => [
      teamId,
      getTeamAmateurJersey(teamById.get(teamId)),
    ])
  );
  const visuals = new Map(
    [...latestTeamSeasons.entries()].map(([teamId, teamSeason]) => [
      teamId,
      createFallbackTeamVisual(
        teamSeason.display_name,
        amateurJerseyByTeamId.get(teamId)
      ),
    ])
  );

  if (contractsQuery.error) return visuals;

  const contractByTeamId = new Map<string, TeamSponsorContractRow>();
  for (const contract of contractsQuery.data ?? []) {
    if (!contractByTeamId.has(contract.team_id)) {
      contractByTeamId.set(contract.team_id, contract);
    }
  }

  const sponsorIds = unique(
    [...contractByTeamId.values()].map((contract) => contract.sponsor_id)
  );
  if (sponsorIds.length === 0) return visuals;

  const sponsorsQuery = await admin
    .from("sponsors")
    .select("id, catalog_key")
    .in("id", sponsorIds)
    .returns<SponsorRegistryRow[]>();

  if (sponsorsQuery.error) return visuals;

  const sponsorRegistryById = toMap(sponsorsQuery.data ?? []);
  for (const [teamId, contract] of contractByTeamId) {
    const registrySponsor = sponsorRegistryById.get(contract.sponsor_id);
    const catalogSponsor = registrySponsor
      ? SPONSORS.find((sponsor) => sponsor.id === registrySponsor.catalog_key)
      : null;
    const teamSeason = latestTeamSeasons.get(teamId);
    const selectedJersey = catalogSponsor?.jerseys.find(
      (jersey) => jersey.id === contract.selected_jersey_id
    );
    if (!catalogSponsor || !selectedJersey || !teamSeason) continue;

    visuals.set(teamId, {
      name: teamSeason.display_name,
      logoPath: catalogSponsor.logoPath,
      sponsorName: catalogSponsor.name,
      colors: catalogSponsor.colors,
      jerseyArtwork: resolvePublicGameNewsTeamJerseyArtwork({
        amateurJersey:
          amateurJerseyByTeamId.get(teamId) ?? DEFAULT_AMATEUR_JERSEY,
        sponsorJerseyImagePath: selectedJersey.imagePath,
      }),
      jersey: resolvePublicGameNewsTeamJersey({
        amateurJersey:
          amateurJerseyByTeamId.get(teamId) ?? DEFAULT_AMATEUR_JERSEY,
        sponsor: {
          colors: catalogSponsor.colors,
          jerseyStyle: selectedJersey.style,
        },
      }),
    });
  }

  return visuals;
}

function createFallbackTeamVisual(
  name: string,
  amateurJersey: AmateurJerseyConfig = DEFAULT_AMATEUR_JERSEY
): PublicGameNewsTeamVisual {
  return {
    name,
    logoPath: null,
    sponsorName: null,
    colors: {
      primary: amateurJersey.primaryColor,
      secondary: amateurJersey.secondaryColor,
      accent: amateurJersey.accentColor,
      background: amateurJersey.secondaryColor,
      text: amateurJersey.primaryColor,
    },
    jerseyArtwork: resolvePublicGameNewsTeamJerseyArtwork({ amateurJersey }),
    jersey: resolvePublicGameNewsTeamJersey({ amateurJersey }),
  };
}

function getTeamAmateurJersey(team: TeamRow | undefined): AmateurJerseyConfig {
  if (!team) return DEFAULT_AMATEUR_JERSEY;

  return {
    pattern: isAmateurJerseyPattern(team.amateur_jersey_pattern)
      ? team.amateur_jersey_pattern
      : DEFAULT_AMATEUR_JERSEY.pattern,
    primaryColor:
      normalizeHexColor(team.amateur_jersey_primary_color) ??
      DEFAULT_AMATEUR_JERSEY.primaryColor,
    secondaryColor:
      normalizeHexColor(team.amateur_jersey_secondary_color) ??
      DEFAULT_AMATEUR_JERSEY.secondaryColor,
    accentColor:
      normalizeHexColor(team.amateur_jersey_accent_color) ??
      DEFAULT_AMATEUR_JERSEY.accentColor,
  };
}

function latestTeamSeasonByTeamId(rows: TeamSeasonRow[]) {
  const teamSeasonByTeamId = new Map<string, TeamSeasonRow>();
  for (const teamSeason of rows) {
    if (!teamSeasonByTeamId.has(teamSeason.team_id)) {
      teamSeasonByTeamId.set(teamSeason.team_id, teamSeason);
    }
  }
  return teamSeasonByTeamId;
}

function getMovementDetail(
  acquisitionType: RiderContractRow["acquisition_type"]
): string {
  if (acquisitionType === "free_agent") {
    return "Recrutement conclu parmi les agents libres.";
  }
  if (acquisitionType === "director_auction") {
    return "Transfert conclu entre deux directeurs sportifs.";
  }
  return "Recrutement conclu sur le marché quotidien.";
}

function sumKnownTotals(...values: Array<number | null>): number | null {
  const knownValues = values.filter((value): value is number => value !== null);
  return knownValues.length > 0
    ? knownValues.reduce((total, value) => total + value, 0)
    : null;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function toMap<T extends { id: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((row) => [row.id, row]));
}

function assertQuery(
  error: { message: string } | null,
  context: string
): asserts error is null {
  if (error) {
    throw new Error(`Impossible de charger ${context} : ${error.message}`);
  }
}
