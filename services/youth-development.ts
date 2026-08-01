import "server-only";

import { COUNTRY_MAP_COORDINATES } from "@/data/country-map-coordinates";
import {
  calculateInGameTenureDays,
  evaluateNaturalizationEligibility,
  type NaturalizationEligibility,
} from "@/lib/game/naturalization";
import { applyInternationalCenterPotentialBonus } from "@/lib/game/infrastructure";
import { MAX_TEAM_ROSTER_SIZE } from "@/lib/game/team-roster-capacity";
import {
  calculateCountryWorldReputation,
  calculateYouthSigningCosts,
  chooseYouthArchetype,
  createSeededRandom,
  generateYouthRatings,
  getCountryBaseReputation,
  getCountryYouthSpecialties,
  getScoutNationalityEfficiencyBonus,
  getScoutingCandidateCount,
  getYouthScoutingReportDetailLevel,
  YOUTH_ARCHETYPE_LABELS,
  YOUTH_RATING_KEYS,
  type YouthArchetype,
  type YouthRatings,
} from "@/lib/game/youth-development";
import { getRiderSportingProfile } from "@/lib/game/rider-profile";
import {
  createStandardTransferScoutingReport,
  type TransferScoutingReport,
} from "@/lib/game/transfer-scouting";
import { getScoutYouthBonuses } from "@/lib/game/staff";
import {
  getScoutTalentBonuses,
  isStaffTalentForRole,
} from "@/lib/game/staff-talents";
import {
  YOUTH_RAW_RATING_MAX,
  calculateYouthAutomaticTrainingGain,
  getYouthAutomaticFirstDay,
  getYouthManualTrainingSlot,
  getYouthTrainingGameType,
  isYouthAutomaticTrainingDue,
  projectYouthRating,
  projectedGainToRawGain,
  summarizeYouthSeasonTraining,
  type YouthManualTrainingSlot,
  type YouthSeasonTrainingSummary,
  type YouthTrainingDomain,
  type YouthTrainingGameType,
  type YouthTrainingMode,
} from "@/lib/game/youth-training";
import {
  generateRiderIdentities,
  hasRiderNameLibrary,
} from "@/lib/rider-names/generate-rider-identities";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

type Context = {
  teamId: string;
  teamSeasonId: string;
  teamName: string;
  currency: string;
  balance: number;
  seasonId: string;
  seasonName: string;
  gameYear: number;
  currentDayNumber: number;
  registrationCountryId: string;
};

type CountryRow = {
  id: string;
  name: string;
  iso_alpha2: string;
  is_active: boolean;
};

type MissionRow = {
  id: string;
  team_id: string;
  season_id: string;
  scout_contract_id: string;
  country_id: string;
  start_day_number: number;
  duration_days: number;
  completes_day_number: number;
  status: "active" | "completed" | "cancelled";
  report_ready_at: string | null;
  report_viewed_at: string | null;
  created_at: string;
};

type CandidateRow = {
  id: string;
  mission_id: string;
  report_slot: number;
  country_id: string;
  first_name: string;
  last_name: string;
  age: number;
  archetype: YouthArchetype;
  potential_steps: number;
  avatar_profile_key: string;
  avatar_seed: string | number;
  mountain: number | string;
  hills: number | string;
  flat: number | string;
  time_trial: number | string;
  cobbles: number | string;
  sprint: number | string;
  acceleration: number | string;
  downhill: number | string;
  endurance: number | string;
  resistance: number | string;
  recovery: number | string;
  breakaway: number | string;
  prologue: number | string;
  signing_fee: number | string;
  tuition_per_season: number | string;
  status: "spotted" | "signed" | "expired";
  international_center_bonus_applied: boolean;
  international_center_bonus_percentage: number;
};

type AcademyRow = Omit<
  CandidateRow,
  | "mission_id"
  | "report_slot"
  | "age"
  | "signing_fee"
  | "status"
  | "international_center_bonus_applied"
  | "international_center_bonus_percentage"
> & {
  team_id: string;
  joined_season_id: string;
  joined_day_number: number;
  birth_game_year: number;
  training_priority: YouthTrainingDomain;
  training_mode: YouthTrainingMode;
  automatic_since_season_id: string | null;
  automatic_since_day_number: number | null;
  pending_training_mode: YouthTrainingMode | null;
  pending_training_mode_after_season_id: string | null;
  pending_training_mode_after_day_number: number | null;
  status: "active" | "recruited" | "promoted" | "free_agent";
  promotion_game_year: number | null;
  promoted_rider_id: string | null;
};

type YouthTrainingSessionRow = {
  academy_rider_id: string;
  day_number: number;
  training_mode: YouthTrainingMode;
  slot: "automatic" | YouthManualTrainingSlot;
  game_type: YouthTrainingGameType | null;
  score: number | null;
  rating_changes: Record<string, number>;
  processed_at: string;
};

export type YouthCountry = {
  id: string;
  name: string;
  code: string;
  latitude: number;
  longitude: number;
  reputation: number;
  reputationHistorySeasons: number;
  specialty: YouthArchetype;
  secondarySpecialty: YouthArchetype;
  specialtyLabel: string;
  secondarySpecialtyLabel: string;
  facilityLevel: number;
};

export type YouthScout = {
  id: string;
  contractId: string;
  firstName: string;
  lastName: string;
  level: number;
  countryId: string;
  countryName: string;
  countryCode: string;
  activeMissionId: string | null;
};

export type YouthCandidate = {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  countryName: string;
  countryCode: string;
  archetype: YouthArchetype;
  archetypeLabel: string;
  sportingProfile: string;
  potentialSteps: number;
  profileKey: string;
  avatarSeed: string;
  scoutingReport: TransferScoutingReport;
  signingFee: number;
  tuitionPerSeason: number;
  status: CandidateRow["status"];
  internationalCenterBonusApplied: boolean;
  internationalCenterBonusPercentage: number;
};

export type YouthMission = {
  id: string;
  scoutName: string;
  countryName: string;
  countryCode: string;
  startDayNumber: number;
  durationDays: number;
  completesDayNumber: number;
  status: MissionRow["status"];
  unread: boolean;
  viewedAt: string | null;
  candidates: YouthCandidate[];
};

export type AcademyYouth = {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  countryName: string;
  countryCode: string;
  profileKey: string;
  avatarSeed: string;
  sportingProfile: string;
  potentialSteps: number;
  ratings: YouthRatings;
  trainingPriority: YouthTrainingDomain;
  trainingMode: YouthTrainingMode;
  trainingModePreference: YouthTrainingMode;
  pendingTrainingMode: YouthTrainingMode | null;
  manualTraining: {
    currentSlot: YouthManualTrainingSlot;
    currentSlotLabel: string;
    currentSlotCompleted: boolean;
    completedSlotCount: number;
    gameType: YouthTrainingGameType;
  };
  tuitionPerSeason: number;
  status: AcademyRow["status"];
  promotionGameYear: number | null;
  canRecruit: boolean;
  naturalization: NaturalizationEligibility;
  latestTrainingReport: {
    dayNumber: number;
    ratingChanges: Record<string, number>;
    trainingMode: YouthTrainingMode;
    slot: "automatic" | YouthManualTrainingSlot;
    score: number | null;
  } | null;
  seasonTrainingReport: YouthSeasonTrainingSummary & {
    fromDayNumber: number;
    toDayNumber: number;
  };
};

export type YouthNotification = {
  id: string;
  type: "promotion_scheduled" | "promoted" | "contract_expired";
  title: string;
  message: string;
  unread: boolean;
  createdAt: string;
};

export type YouthDevelopmentOverview = {
  teamId: string;
  teamName: string;
  seasonName: string;
  gameYear: number;
  currentDayNumber: number;
  balance: number;
  currency: string;
  countries: YouthCountry[];
  scouts: YouthScout[];
  missions: YouthMission[];
  academy: AcademyYouth[];
  notifications: YouthNotification[];
  unreadCount: number;
  nextSeasonRosterCommitments: number;
  rosterLimit: number;
  canScheduleYouthPromotion: boolean;
  totalTuitionPerSeason: number;
};

export async function getYouthDevelopmentOverview(
  supabase: ServerClient,
  authUserId: string,
): Promise<YouthDevelopmentOverview | null> {
  const admin = createSupabaseAdminClient();
  const context = await loadContext(admin, authUserId);
  if (!context) return null;

  const infrastructureSettlement = await admin.rpc(
    "settle_due_infrastructure_projects",
  );
  assertQuery(
    infrastructureSettlement.error,
    "les chantiers de formation internationale",
  );
  await settleDueScoutingMissions(admin, context);
  await settleAcademyDailyOperations(admin, context);
  const financeSettlement = await supabase.rpc("settle_current_team_finances");
  assertQuery(financeSettlement.error, "l’actualisation des finances du centre");

  const refreshedContext = await loadContext(admin, authUserId);
  return refreshedContext ? loadOverview(admin, refreshedContext) : null;
}

export async function getYouthDevelopmentAlertCount(
  authUserId: string,
  options: {
    settleInfrastructure?: boolean;
  } = {},
): Promise<number> {
  const admin = createSupabaseAdminClient();
  const context = await loadContext(admin, authUserId);
  if (!context) return 0;
  if (options.settleInfrastructure !== false) {
    const infrastructureSettlement = await admin.rpc(
      "settle_due_infrastructure_projects",
    );
    assertQuery(
      infrastructureSettlement.error,
      "les chantiers de formation internationale",
    );
  }
  await settleDueScoutingMissions(admin, context);
  await settleAcademyDailyOperations(admin, context);

  const [missions, notifications] = await Promise.all([
    admin
      .from("youth_scouting_missions")
      .select("id", { count: "exact", head: true })
      .eq("team_id", context.teamId)
      .eq("status", "completed")
      .is("report_viewed_at", null),
    admin
      .from("youth_development_notifications")
      .select("id", { count: "exact", head: true })
      .eq("team_id", context.teamId)
      .is("read_at", null),
  ]);
  assertQuery(missions.error, "les nouveaux rapports de scouting");
  assertQuery(notifications.error, "les notifications du centre");
  return (missions.count ?? 0) + (notifications.count ?? 0);
}

async function loadOverview(admin: AdminClient, context: Context) {
  const [countriesResult, facilitiesResult, contractsResult, missionsResult, academyResult, notificationsResult, rosterCapacityResult] =
    await Promise.all([
      admin.from("countries").select("id, name, iso_alpha2, is_active").eq("is_active", true).order("name").returns<CountryRow[]>(),
      admin.from("country_cycling_development").select("country_id, facility_level").returns<Array<{ country_id: string; facility_level: number }>>(),
      admin.from("staff_contracts").select("id, staff_member_id").eq("team_id", context.teamId).eq("status", "active").returns<Array<{ id: string; staff_member_id: string }>>(),
      admin.from("youth_scouting_missions").select("*").eq("team_id", context.teamId).order("created_at", { ascending: false }).returns<MissionRow[]>(),
      admin.from("youth_academy_riders").select("*").eq("team_id", context.teamId).in("status", ["active", "recruited"]).order("signed_at", { ascending: true }).returns<AcademyRow[]>(),
      admin.from("youth_development_notifications").select("id, notification_type, title, message, read_at, created_at").eq("team_id", context.teamId).order("created_at", { ascending: false }).limit(20).returns<Array<{ id: string; notification_type: YouthNotification["type"]; title: string; message: string; read_at: string | null; created_at: string }>>(),
      admin.rpc("get_team_roster_commitment_count", {
        p_team_id: context.teamId,
        p_game_year: context.gameYear + 1,
      }),
    ]);
  for (const [result, label] of [
    [countriesResult, "les pays"], [facilitiesResult, "les installations"],
    [contractsResult, "les contrats du staff"], [missionsResult, "les missions"],
    [academyResult, "l’école de cyclisme"], [notificationsResult, "les notifications"],
    [rosterCapacityResult, "la capacité du prochain effectif"],
  ] as const) assertQuery(result.error, label);

  const countries = countriesResult.data ?? [];
  const countryById = new Map(countries.map((country) => [country.id, country]));
  const contracts = contractsResult.data ?? [];
  const nextSeasonRosterCommitments = Number(rosterCapacityResult.data ?? 0);
  const canScheduleYouthPromotion =
    nextSeasonRosterCommitments < MAX_TEAM_ROSTER_SIZE;
  const staffIds = contracts.map((contract) => contract.staff_member_id);
  const memberResult = staffIds.length
    ? await admin.from("staff_members").select("id, country_id, first_name, last_name, role, level").in("id", staffIds).eq("role", "scout").returns<Array<{ id: string; country_id: string; first_name: string; last_name: string; role: string; level: number }>>()
    : { data: [], error: null };
  assertQuery(memberResult.error, "les scouts");
  const memberById = new Map((memberResult.data ?? []).map((member) => [member.id, member]));
  const activeMissionByContract = new Map((missionsResult.data ?? []).filter((mission) => mission.status === "active").map((mission) => [mission.scout_contract_id, mission.id]));

  const countriesDto = await buildCountryDtos(admin, countries, facilitiesResult.data ?? [], context);
  const countryDtoById = new Map(countriesDto.map((country) => [country.id, country]));
  const scouts = contracts.flatMap((contract): YouthScout[] => {
    const member = memberById.get(contract.staff_member_id);
    const country = member ? countryById.get(member.country_id) : undefined;
    if (!member || !country) return [];
    return [{
      id: member.id, contractId: contract.id, firstName: member.first_name,
      lastName: member.last_name, level: member.level, countryId: country.id,
      countryName: country.name, countryCode: country.iso_alpha2,
      activeMissionId: activeMissionByContract.get(contract.id) ?? null,
    }];
  });

  const missionIds = (missionsResult.data ?? []).map((mission) => mission.id);
  const candidateResult = missionIds.length
    ? await admin.from("youth_scouting_candidates").select("*").in("mission_id", missionIds).order("report_slot").returns<CandidateRow[]>()
    : { data: [], error: null };
  assertQuery(candidateResult.error, "les jeunes repérés");
  const candidatesByMission = groupBy(candidateResult.data ?? [], (candidate) => candidate.mission_id);
  const scoutByContractId = new Map(scouts.map((scout) => [scout.contractId, scout]));
  const missions = (missionsResult.data ?? []).map((mission): YouthMission => {
    const country = countryDtoById.get(mission.country_id);
    const scout = scoutByContractId.get(mission.scout_contract_id);
    return {
      id: mission.id,
      scoutName: scout ? `${scout.firstName} ${scout.lastName}` : "Scout",
      countryName: country?.name ?? "Pays inconnu",
      countryCode: country?.code ?? "--",
      startDayNumber: mission.start_day_number,
      durationDays: mission.duration_days,
      completesDayNumber: mission.completes_day_number,
      status: mission.status,
      unread: mission.status === "completed" && !mission.report_viewed_at,
      viewedAt: mission.report_viewed_at,
      candidates: (candidatesByMission.get(mission.id) ?? []).map((candidate) =>
        toCandidate(
          candidate,
          countryById.get(candidate.country_id),
          scout?.level ?? 1,
          mission.duration_days,
        ),
      ),
    };
  });

  const academyRows = academyResult.data ?? [];
  const joinedSeasonIds = [
    ...new Set(academyRows.map((rider) => rider.joined_season_id)),
  ];
  const joinedSeasonsResult = joinedSeasonIds.length
    ? await admin
        .from("seasons")
        .select("id, game_year")
        .in("id", joinedSeasonIds)
        .returns<Array<{ id: string; game_year: number }>>()
    : {
        data: [] as Array<{ id: string; game_year: number }>,
        error: null,
      };
  assertQuery(joinedSeasonsResult.error, "les saisons d’arrivée des juniors");
  const joinedGameYearBySeasonId = new Map(
    (joinedSeasonsResult.data ?? []).map((season) => [
      season.id,
      season.game_year,
    ]),
  );
  const targetCountry = requireData(
    countryById.get(context.registrationCountryId) ?? null,
    "la nationalité de l’équipe",
  );
  const academyIds = academyRows.map((rider) => rider.id);
  const latestSessionsResult = academyIds.length
    ? await admin
        .from("youth_academy_training_sessions")
        .select(
          "academy_rider_id, day_number, training_mode, slot, game_type, score, rating_changes, processed_at",
        )
        .in("academy_rider_id", academyIds)
        .eq("season_id", context.seasonId)
        .order("day_number", { ascending: false })
        .order("processed_at", { ascending: false })
        .returns<YouthTrainingSessionRow[]>()
    : { data: [], error: null };
  assertQuery(
    latestSessionsResult.error,
    "les rapports d’entraînement des jeunes",
  );
  const sessionRows = latestSessionsResult.data ?? [];
  const latestByRider = new Map<
    string,
    NonNullable<AcademyYouth["latestTrainingReport"]>
  >();
  const currentSessionsByRider = new Map<string, YouthTrainingSessionRow[]>();
  const seasonSessionsByRider = new Map<
    string,
    Array<{
      trainingMode: YouthTrainingMode;
      ratingChanges: Record<string, number>;
    }>
  >();
  for (const session of sessionRows) {
    const projectedRatingChanges = projectYouthRatingChanges(
      session.rating_changes,
    );
    seasonSessionsByRider.set(session.academy_rider_id, [
      ...(seasonSessionsByRider.get(session.academy_rider_id) ?? []),
      {
        trainingMode: session.training_mode,
        ratingChanges: projectedRatingChanges,
      },
    ]);
    if (!latestByRider.has(session.academy_rider_id)) {
      latestByRider.set(session.academy_rider_id, {
        dayNumber: session.day_number,
        ratingChanges: projectedRatingChanges,
        trainingMode: session.training_mode,
        slot: session.slot,
        score: session.score,
      });
    }
    if (session.day_number === context.currentDayNumber) {
      currentSessionsByRider.set(session.academy_rider_id, [
        ...(currentSessionsByRider.get(session.academy_rider_id) ?? []),
        session,
      ]);
    }
  }
  const currentManualSlot = getYouthManualTrainingSlot(getParisHour());
  const academy = academyRows.map((rider): AcademyYouth => {
    const country = countryById.get(rider.country_id);
    const ratings = rowToRatings(rider);
    const age = context.gameYear - rider.birth_game_year;
    const todaySessions = currentSessionsByRider.get(rider.id) ?? [];
    const currentSlotSession = todaySessions.find(
      (session) => session.slot === currentManualSlot,
    );
    const joinedGameYear =
      joinedGameYearBySeasonId.get(rider.joined_season_id) ?? context.gameYear;
    const naturalization = evaluateNaturalizationEligibility({
      level: "youth",
      elapsedDays: calculateInGameTenureDays({
        startGameYear: joinedGameYear,
        startDayNumber: rider.joined_day_number,
        currentGameYear: context.gameYear,
        currentDayNumber: context.currentDayNumber,
      }),
      currentCountry: {
        id: country?.id ?? rider.country_id,
        name: country?.name ?? "Pays inconnu",
        code: country?.iso_alpha2 ?? "--",
      },
      targetCountry: {
        id: targetCountry.id,
        name: targetCountry.name,
        code: targetCountry.iso_alpha2,
      },
    });
    return {
      id: rider.id, firstName: rider.first_name, lastName: rider.last_name, age,
      countryName: country?.name ?? "Pays inconnu", countryCode: country?.iso_alpha2 ?? "--",
      profileKey: rider.avatar_profile_key, avatarSeed: String(rider.avatar_seed),
      sportingProfile: getRiderSportingProfile(scaleYouthRatings(ratings)), potentialSteps: rider.potential_steps,
      ratings: scaleYouthRatings(ratings), trainingPriority: rider.training_priority, trainingMode: rider.training_mode,
      trainingModePreference:
        rider.pending_training_mode ?? rider.training_mode,
      pendingTrainingMode: rider.pending_training_mode,
      manualTraining: {
        currentSlot: currentManualSlot,
        currentSlotLabel: currentManualSlot === "manual_am" ? "Minuit – midi" : "Midi – minuit",
        currentSlotCompleted: Boolean(currentSlotSession),
        completedSlotCount: todaySessions.filter((session) => session.training_mode === "manual").length,
        gameType: getYouthTrainingGameType(rider.training_priority),
      }, tuitionPerSeason: toNumber(rider.tuition_per_season),
      status: rider.status, promotionGameYear: rider.promotion_game_year,
      canRecruit: rider.status === "active" && age >= 17, naturalization,
      latestTrainingReport: latestByRider.get(rider.id) ?? null,
      seasonTrainingReport: {
        fromDayNumber: 1,
        toDayNumber: context.currentDayNumber,
        ...summarizeYouthSeasonTraining(
          seasonSessionsByRider.get(rider.id) ?? [],
        ),
      },
    };
  });
  const notifications = (notificationsResult.data ?? []).map((notification): YouthNotification => ({
    id: notification.id, type: notification.notification_type, title: notification.title,
    message: notification.message, unread: !notification.read_at, createdAt: notification.created_at,
  }));
  const unreadCount = missions.filter((mission) => mission.unread).length + notifications.filter((notification) => notification.unread).length;

  return {
    teamId: context.teamId, teamName: context.teamName, seasonName: context.seasonName,
    gameYear: context.gameYear, currentDayNumber: context.currentDayNumber,
    balance: context.balance, currency: context.currency, countries: countriesDto,
    scouts, missions, academy, notifications, unreadCount,
    nextSeasonRosterCommitments,
    rosterLimit: MAX_TEAM_ROSTER_SIZE,
    canScheduleYouthPromotion,
    totalTuitionPerSeason: academy.reduce((sum, rider) => sum + rider.tuitionPerSeason, 0),
  } satisfies YouthDevelopmentOverview;
}

async function buildCountryDtos(admin: AdminClient, countries: CountryRow[], facilities: Array<{ country_id: string; facility_level: number }>, context: Context) {
  const seasonsResult = await admin.from("seasons").select("id, game_year").lte("game_year", context.gameYear).order("game_year", { ascending: false }).limit(10).returns<Array<{ id: string; game_year: number }>>();
  assertQuery(seasonsResult.error, "l’historique des saisons");
  const seasons = seasonsResult.data ?? [];
  const seasonIds = seasons.map((season) => season.id);
  const teamSeasonsResult = seasonIds.length
    ? await admin.from("team_seasons").select("id, season_id").in("season_id", seasonIds).returns<Array<{ id: string; season_id: string }>>()
    : { data: [], error: null };
  assertQuery(teamSeasonsResult.error, "l’historique UCI des équipes");
  const teamSeasons = teamSeasonsResult.data ?? [];
  const teamSeasonIds = teamSeasons.map((row) => row.id);
  const rewardsResult = teamSeasonIds.length
    ? await admin.from("reward_events").select("country_id, team_season_id, uci_points").in("team_season_id", teamSeasonIds).not("country_id", "is", null).returns<Array<{ country_id: string; team_season_id: string; uci_points: number }>>()
    : { data: [], error: null };
  assertQuery(rewardsResult.error, "les résultats UCI par nation");
  const seasonByTeamSeason = new Map(teamSeasons.map((row) => [row.id, row.season_id]));
  const pointsByCountrySeason = new Map<string, number>();
  for (const reward of rewardsResult.data ?? []) {
    const seasonId = seasonByTeamSeason.get(reward.team_season_id);
    if (!seasonId) continue;
    const key = `${reward.country_id}:${seasonId}`;
    pointsByCountrySeason.set(key, (pointsByCountrySeason.get(key) ?? 0) + reward.uci_points);
  }
  const facilityByCountry = new Map(facilities.map((entry) => [entry.country_id, entry.facility_level]));
  return countries.flatMap((country): YouthCountry[] => {
    const coordinate = COUNTRY_MAP_COORDINATES[country.iso_alpha2.toUpperCase()];
    if (!coordinate) return [];
    const specialties = getCountryYouthSpecialties(country.iso_alpha2);
    const history = seasons.map((season) => pointsByCountrySeason.get(`${country.id}:${season.id}`) ?? 0);
    return [{
      id: country.id, name: country.name, code: country.iso_alpha2,
      latitude: coordinate.latitude, longitude: coordinate.longitude,
      reputation: calculateCountryWorldReputation({ baseReputation: getCountryBaseReputation(country.iso_alpha2), seasonUciPoints: history }),
      reputationHistorySeasons: seasons.length, specialty: specialties.primary,
      secondarySpecialty: specialties.secondary, specialtyLabel: YOUTH_ARCHETYPE_LABELS[specialties.primary],
      secondarySpecialtyLabel: YOUTH_ARCHETYPE_LABELS[specialties.secondary],
      facilityLevel: facilityByCountry.get(country.id) ?? 1,
    }];
  });
}

async function settleDueScoutingMissions(admin: AdminClient, context: Context) {
  const result = await admin.from("youth_scouting_missions").select("*").eq("team_id", context.teamId).eq("status", "active").returns<MissionRow[]>();
  assertQuery(result.error, "les missions de scouting en cours");
  const due = (result.data ?? []).filter((mission) => mission.season_id !== context.seasonId || mission.completes_day_number <= context.currentDayNumber);
  for (const mission of due) await completeMission(admin, mission);
}

async function completeMission(admin: AdminClient, mission: MissionRow) {
  const [contractResult, countryResult, facilityResult, profileResult, centersResult] = await Promise.all([
    admin.from("staff_contracts").select("staff_member_id").eq("id", mission.scout_contract_id).single<{ staff_member_id: string }>(),
    admin.from("countries").select("id, name, iso_alpha2, is_active").eq("id", mission.country_id).single<CountryRow>(),
    admin.from("country_cycling_development").select("facility_level").eq("country_id", mission.country_id).maybeSingle<{ facility_level: number }>(),
    admin.from("country_rider_generation_profiles").select("name_profile_code, avatar_profile_key").eq("country_id", mission.country_id).single<{ name_profile_code: string; avatar_profile_key: string }>(),
    admin.from("international_youth_centers").select("quality_level").eq("country_id", mission.country_id).returns<Array<{ quality_level: number }>>(),
  ]);
  assertQuery(contractResult.error, "le contrat du scout"); assertQuery(countryResult.error, "le pays scouté");
  assertQuery(facilityResult.error, "les installations locales"); assertQuery(profileResult.error, "le profil régional");
  assertQuery(centersResult.error, "les centres internationaux");
  const contract = requireData(contractResult.data, "le contrat du scout");
  const country = requireData(countryResult.data, "le pays scouté");
  const profile = requireData(profileResult.data, "le profil régional");
  const memberResult = await admin.from("staff_members").select("country_id, level").eq("id", contract.staff_member_id).single<{ country_id: string; level: number }>();
  assertQuery(memberResult.error, "le scout missionné");
  const scout = requireData(memberResult.data, "le scout missionné");
  const [talentsResult, teamSeasonResult, dailyRewardBoostResult] = await Promise.all([
    admin
      .from("staff_member_talents")
      .select("talent_code")
      .eq("staff_member_id", contract.staff_member_id)
      .returns<Array<{ talent_code: string }>>(),
    admin
      .from("team_seasons")
      .select("registration_country_id")
      .eq("team_id", mission.team_id)
      .eq("season_id", mission.season_id)
      .maybeSingle<{ registration_country_id: string }>(),
    admin
      .from("daily_reward_active_effects")
      .select("effect_payload")
      .eq("team_id", mission.team_id)
      .eq("season_id", mission.season_id)
      .eq("effect_kind", "scouting_boost")
      .eq("status", "active")
      .lte("starts_day_number", mission.completes_day_number)
      .gte("ends_day_number", mission.completes_day_number)
      .returns<Array<{ effect_payload: Record<string, unknown> }>>(),
  ]);
  assertQuery(talentsResult.error, "les talents du scout");
  assertQuery(teamSeasonResult.error, "la nationalité de l’équipe");
  assertQuery(dailyRewardBoostResult.error, "le bonus quotidien de scouting");
  const talentCodes = (talentsResult.data ?? []).flatMap((talent) =>
    isStaffTalentForRole(talent.talent_code, "scout")
      ? [talent.talent_code]
      : [],
  );
  const nationalityAffinity =
    scout.country_id === teamSeasonResult.data?.registration_country_id
      ? 1.1
      : 1;
  const dailyScoutingQualityMultiplier =
    1 +
    Math.max(
      0,
      ...(dailyRewardBoostResult.data ?? []).map((effect) => {
        const percentage = Number(effect.effect_payload.percentage);
        return Number.isFinite(percentage) ? percentage : 0;
      }),
    ) /
      100;
  if (!hasRiderNameLibrary(profile.name_profile_code)) throw new Error(`Aucune bibliothèque de noms pour ${country.name}.`);
  const random = createSeededRandom(mission.id);
  const facilityLevel = facilityResult.data?.facility_level ?? 1;
  const nationalityBonus = getScoutNationalityEfficiencyBonus(scout.country_id, country.id);
  const baseScoutBonuses = getScoutYouthBonuses(scout.level);
  const talentBonuses = getScoutTalentBonuses(talentCodes, scout.level);
  const scoutBonuses = {
    potentialBonus:
      (baseScoutBonuses.potentialBonus + talentBonuses.potentialBonus) *
      nationalityAffinity * dailyScoutingQualityMultiplier,
    initialRatingBonus:
      (baseScoutBonuses.initialRatingBonus +
        talentBonuses.initialRatingBonus) *
      nationalityAffinity * dailyScoutingQualityMultiplier,
  };
  const count =
    getScoutingCandidateCount({
      scoutLevel: scout.level * nationalityAffinity,
      durationDays: mission.duration_days,
      facilityLevel,
      random,
    }) + talentBonuses.reportSizeBonus;
  const identities = generateRiderIdentities(profile.name_profile_code, count);
  const specialties = getCountryYouthSpecialties(country.iso_alpha2);
  const reputation = getCountryBaseReputation(country.iso_alpha2);
  const totalInternationalCenterStars = (centersResult.data ?? []).reduce(
    (total, center) => total + center.quality_level,
    0,
  );
  const candidates = identities.map((identity, index) => {
    const age = clamp(15 + Math.floor(random() * 4), 15, 18);
    const archetype = chooseYouthArchetype({ ...specialties, random });
    const basePotentialSteps = clamp(Math.round(1 + scoutBonuses.potentialBonus + mission.duration_days * 0.16 + facilityLevel * 0.08 + reputation * 0.08 + nationalityBonus / 30 + random() * 1.5), 1, 8);
    const internationalCenterBonus =
      applyInternationalCenterPotentialBonus({
        potentialSteps: basePotentialSteps,
        totalQualityStars: totalInternationalCenterStars,
        random,
      });
    const potentialSteps = internationalCenterBonus.potentialSteps;
    const ratings = generateYouthRatings({
      archetype,
      age,
      talent: potentialSteps,
      countryReputation: reputation,
      accuracyBonus: nationalityBonus / 100,
      initialRatingBonus: scoutBonuses.initialRatingBonus,
      random,
    });
    const costs = calculateYouthSigningCosts({ potentialSteps, ratings, countryReputation: reputation });
    return {
      mission_id: mission.id, report_slot: index + 1, country_id: country.id,
      first_name: identity.first_name, last_name: identity.last_name,
      age, archetype, potential_steps: potentialSteps,
      international_center_bonus_applied: internationalCenterBonus.bonusApplied,
      international_center_bonus_percentage: internationalCenterBonus.bonusPercentage,
      avatar_profile_key: profile.avatar_profile_key, avatar_seed: identity.avatar_seed,
      ...ratingsToRow(ratings),
      signing_fee: costs.signingFee,
      tuition_per_season: Math.max(
        500,
        Math.round(
          (costs.tuitionPerSeason *
            (1 -
              (talentBonuses.tuitionReductionPercentage *
                nationalityAffinity) /
                100)) /
            500,
        ) * 500,
      ),
    };
  });
  const insertion = await admin.from("youth_scouting_candidates").upsert(candidates, { onConflict: "mission_id,report_slot", ignoreDuplicates: true });
  assertQuery(insertion.error, "la génération du rapport de scouting");
  const completion = await admin.from("youth_scouting_missions").update({ status: "completed", report_ready_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", mission.id).eq("status", "active");
  assertQuery(completion.error, "la finalisation du rapport de scouting");
}

async function settleAcademyDailyOperations(
  admin: AdminClient,
  context: Context,
) {
  await settleAcademyTransitions(admin, context);
  const modeActivation = await admin.rpc(
    "activate_due_youth_training_modes",
    {
      p_team_id: context.teamId,
      p_current_season_id: context.seasonId,
      p_current_day_number: context.currentDayNumber,
    },
  );
  assertQuery(
    modeActivation.error,
    "la programmation des entraînements juniors",
  );
  const ridersResult = await admin
    .from("youth_academy_riders")
    .select("*")
    .eq("team_id", context.teamId)
    .in("status", ["active", "recruited"])
    .returns<AcademyRow[]>();
  assertQuery(ridersResult.error, "les jeunes à entraîner");
  const riders = ridersResult.data ?? [];
  if (!riders.length) return;

  const daysResult = await admin
    .from("season_days")
    .select("id, day_number")
    .eq("season_id", context.seasonId)
    .lte("day_number", context.currentDayNumber)
    .order("day_number")
    .returns<Array<{ id: string; day_number: number }>>();
  assertQuery(daysResult.error, "les journées d’entraînement de l’école");

  const existingResult = await admin
    .from("youth_academy_training_sessions")
    .select("academy_rider_id, season_day_id, slot")
    .eq("season_id", context.seasonId)
    .in(
      "academy_rider_id",
      riders.map((rider) => rider.id),
    )
    .returns<
      Array<{
        academy_rider_id: string;
        season_day_id: string;
        slot: "automatic" | YouthManualTrainingSlot;
      }>
    >();
  assertQuery(existingResult.error, "l’historique d’entraînement de l’école");
  const existingDays = new Set(
    (existingResult.data ?? []).map(
      (row) => `${row.academy_rider_id}:${row.season_day_id}`,
    ),
  );
  const parisHour = getParisHour();

  for (const rider of riders) {
    if (rider.training_mode !== "automatic") continue;

    const ratings = rowToRatings(rider);
    const sessions: Array<Record<string, unknown>> = [];
    const age = context.gameYear - rider.birth_game_year;
    const automaticSinceDay = getYouthAutomaticFirstDay({
      automaticSinceSeasonId: rider.automatic_since_season_id,
      automaticSinceDayNumber:
        rider.automatic_since_day_number ?? rider.joined_day_number,
      currentSeasonId: context.seasonId,
    });

    for (const day of daysResult.data ?? []) {
      if (day.day_number < automaticSinceDay) continue;
      if (
        rider.joined_season_id === context.seasonId &&
        day.day_number < rider.joined_day_number
      ) {
        continue;
      }
      if (
        !isYouthAutomaticTrainingDue({
          dayNumber: day.day_number,
          currentDayNumber: context.currentDayNumber,
          parisHour,
        })
      ) {
        continue;
      }

      const sessionKey = `${rider.id}:${day.id}`;
      if (existingDays.has(sessionKey)) continue;

      const changes: Record<string, number> = {};
      for (const key of YOUTH_RATING_KEYS) {
        const projectedGain = calculateYouthAutomaticTrainingGain({
          age,
          potentialSteps: rider.potential_steps,
          currentProjectedRating: projectYouthRating(ratings[key]),
          domain: rider.training_priority,
          ratingKey: key,
        });
        const next = Math.min(
          YOUTH_RAW_RATING_MAX,
          Math.round(
            (ratings[key] + projectedGainToRawGain(projectedGain)) * 1_000,
          ) / 1_000,
        );
        if (next > ratings[key]) {
          changes[key] = Math.round((next - ratings[key]) * 1_000) / 1_000;
        }
        ratings[key] = next;
      }

      sessions.push({
        academy_rider_id: rider.id,
        season_id: context.seasonId,
        season_day_id: day.id,
        day_number: day.day_number,
        training_priority: rider.training_priority,
        training_mode: "automatic",
        slot: "automatic",
        game_type: null,
        score: null,
        rating_changes: changes,
        ratings_after: ratingsToRow(ratings),
      });
      existingDays.add(sessionKey);
    }

    if (sessions.length) {
      const insertion = await admin
        .from("youth_academy_training_sessions")
        .upsert(sessions, {
          onConflict: "academy_rider_id,season_day_id,slot",
          ignoreDuplicates: true,
        });
      assertQuery(
        insertion.error,
        `les séances de ${rider.first_name} ${rider.last_name}`,
      );
      const update = await admin
        .from("youth_academy_riders")
        .update({
          ...ratingsToRow(ratings),
          updated_at: new Date().toISOString(),
        })
        .eq("id", rider.id);
      assertQuery(
        update.error,
        `la progression de ${rider.first_name} ${rider.last_name}`,
      );
    }
  }

  await scheduleTuition(admin, riders, context, daysResult.data ?? []);
}
async function scheduleTuition(admin: AdminClient, riders: AcademyRow[], context: Context, days: Array<{ id: string; day_number: number }>) {
  const dayId = new Map(days.map((day) => [day.day_number, day.id]));
  const transactions = riders.flatMap((rider) => [7, 14, 21, 28].flatMap((installmentDay, index) => {
    if (rider.joined_season_id === context.seasonId && installmentDay < rider.joined_day_number) return [];
    const seasonDayId = dayId.get(installmentDay);
    if (!seasonDayId) return [];
    return [{ team_season_id: context.teamSeasonId, season_day_id: seasonDayId, day_number: installmentDay, amount: -Math.round(toNumber(rider.tuition_per_season) / 4 * 100) / 100, category: "training", status: "pending", description: `Frais de scolarité — ${rider.first_name} ${rider.last_name}`, source_reference: `youth-tuition:${rider.id}:${context.seasonId}:${index + 1}` }];
  }));
  if (!transactions.length) return;
  const insertion = await admin.from("team_finance_transactions").upsert(transactions, { onConflict: "team_season_id,source_reference", ignoreDuplicates: true });
  assertQuery(insertion.error, "les frais de scolarité de l’école");
}

async function settleAcademyTransitions(admin: AdminClient, context: Context) {
  const result = await admin.from("youth_academy_riders").select("*").eq("team_id", context.teamId).in("status", ["active", "recruited"]).returns<AcademyRow[]>();
  assertQuery(result.error, "les échéances de l’école");
  for (const academy of result.data ?? []) {
    const age = context.gameYear - academy.birth_game_year;
    if (academy.status === "recruited" && academy.promotion_game_year !== null && context.gameYear >= academy.promotion_game_year) {
      const riderId = await createPermanentRider(admin, academy, context, "active");
      const contract = await admin.from("rider_contracts").insert({ rider_id: riderId, team_id: context.teamId, start_season_id: context.seasonId, end_season_id: context.seasonId, salary_per_season: 0, currency: context.currency, currency_code: context.currency, status: "active", signed_at: new Date().toISOString(), acquisition_type: "academy" });
      assertQuery(contract.error, "le contrat professionnel du jeune");
      const update = await admin.from("youth_academy_riders").update({ status: "promoted", promoted_rider_id: riderId, updated_at: new Date().toISOString() }).eq("id", academy.id).eq("status", "recruited");
      assertQuery(update.error, "la promotion du jeune");
      await createNotification(admin, academy.team_id, "promoted", "Promotion en équipe première", `${academy.first_name} ${academy.last_name} rejoint officiellement l’effectif professionnel.`, `youth-promoted:${academy.id}`);
    } else if (academy.status === "active" && age > 18) {
      const riderId = await createPermanentRider(admin, academy, context, "free_agent");
      const update = await admin.from("youth_academy_riders").update({ status: "free_agent", promoted_rider_id: riderId, updated_at: new Date().toISOString() }).eq("id", academy.id).eq("status", "active");
      assertQuery(update.error, "la sortie de l’école");
      await createNotification(admin, academy.team_id, "contract_expired", "Fin de cursus jeune", `${academy.first_name} ${academy.last_name} a atteint 19 ans sans être recruté et rejoint les agents libres.`, `youth-expired:${academy.id}`);
    }
  }
}

async function createPermanentRider(admin: AdminClient, academy: AcademyRow, context: Context, status: "active" | "free_agent") {
  const riderResult = await admin.from("riders").insert({ country_id: academy.country_id, first_name: academy.first_name, last_name: academy.last_name, status, potential_steps: academy.potential_steps }).select("id").single<{ id: string }>();
  assertQuery(riderResult.error, "la création du coureur issu de l’école");
  const rider = requireData(riderResult.data, "la création du coureur issu de l’école");
  const ratings = ratingsToRow(scaleYouthRatings(rowToRatings(academy)));
  const seasonRatings = await admin.from("rider_season_ratings").insert({ rider_id: rider.id, season_id: context.seasonId, age: context.gameYear - academy.birth_game_year, ...ratings });
  assertQuery(seasonRatings.error, "les notes professionnelles du jeune");
  return rider.id;
}

async function createNotification(admin: AdminClient, teamId: string, type: YouthNotification["type"], title: string, message: string, sourceReference: string) {
  const result = await admin.from("youth_development_notifications").upsert({ team_id: teamId, notification_type: type, title, message, source_reference: sourceReference }, { onConflict: "team_id,source_reference", ignoreDuplicates: true });
  assertQuery(result.error, "la notification du centre de formation");
}

async function loadContext(admin: AdminClient, authUserId: string): Promise<Context | null> {
  const directorResult = await admin.from("sporting_directors").select("id").eq("auth_user_id", authUserId).eq("status", "active").maybeSingle<{ id: string }>();
  assertQuery(directorResult.error, "le Directeur Sportif");
  if (!directorResult.data) return null;
  const assignmentResult = await admin.from("team_manager_assignments").select("team_id").eq("sporting_director_id", directorResult.data.id).eq("role", "general_manager").eq("status", "active").maybeSingle<{ team_id: string }>();
  assertQuery(assignmentResult.error, "l’équipe du Directeur Sportif");
  if (!assignmentResult.data) return null;
  const seasonResult = await admin.from("seasons").select("id, name, game_year, current_day_number").eq("status", "active").maybeSingle<{ id: string; name: string; game_year: number; current_day_number: number | null }>();
  assertQuery(seasonResult.error, "la saison active");
  if (!seasonResult.data) return null;
  const teamSeasonResult = await admin.from("team_seasons").select("id, display_name, currency, cash_balance, registration_country_id").eq("team_id", assignmentResult.data.team_id).eq("season_id", seasonResult.data.id).maybeSingle<{ id: string; display_name: string; currency: string; cash_balance: number | string; registration_country_id: string }>();
  assertQuery(teamSeasonResult.error, "l’équipe de la saison");
  if (!teamSeasonResult.data) return null;
  return { teamId: assignmentResult.data.team_id, teamSeasonId: teamSeasonResult.data.id, teamName: teamSeasonResult.data.display_name, currency: teamSeasonResult.data.currency, balance: toNumber(teamSeasonResult.data.cash_balance), seasonId: seasonResult.data.id, seasonName: seasonResult.data.name, gameYear: seasonResult.data.game_year, currentDayNumber: seasonResult.data.current_day_number ?? 1, registrationCountryId: teamSeasonResult.data.registration_country_id };
}

function toCandidate(
  row: CandidateRow,
  country: CountryRow | undefined,
  scoutLevel: number,
  durationDays: number,
): YouthCandidate {
  const ratings = scaleYouthRatings(rowToRatings(row));
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    age: row.age,
    countryName: country?.name ?? "Pays inconnu",
    countryCode: country?.iso_alpha2 ?? "--",
    archetype: row.archetype,
    archetypeLabel: YOUTH_ARCHETYPE_LABELS[row.archetype],
    sportingProfile: getRiderSportingProfile(ratings),
    potentialSteps: row.potential_steps,
    profileKey: row.avatar_profile_key,
    avatarSeed: String(row.avatar_seed),
    scoutingReport: createStandardTransferScoutingReport({
      riderId: row.id,
      seasonId: row.mission_id,
      ratings,
      potentialSteps: row.potential_steps,
      dataRoomLevel: getYouthScoutingReportDetailLevel({
        scoutLevel,
        durationDays,
      }),
    }),
    signingFee: toNumber(row.signing_fee),
    tuitionPerSeason: toNumber(row.tuition_per_season),
    status: row.status,
    internationalCenterBonusApplied:
      row.international_center_bonus_applied,
    internationalCenterBonusPercentage:
      row.international_center_bonus_percentage,
  };
}
function rowToRatings(row: CandidateRow | AcademyRow): YouthRatings {
  return { mountain: toNumber(row.mountain), hills: toNumber(row.hills), flat: toNumber(row.flat), timeTrial: toNumber(row.time_trial), cobbles: toNumber(row.cobbles), sprint: toNumber(row.sprint), acceleration: toNumber(row.acceleration), downhill: toNumber(row.downhill), endurance: toNumber(row.endurance), resistance: toNumber(row.resistance), recovery: toNumber(row.recovery), breakaway: toNumber(row.breakaway), prologue: toNumber(row.prologue) };
}

function ratingsToRow(ratings: YouthRatings) {
  return { mountain: ratings.mountain, hills: ratings.hills, flat: ratings.flat, time_trial: ratings.timeTrial, cobbles: ratings.cobbles, sprint: ratings.sprint, acceleration: ratings.acceleration, downhill: ratings.downhill, endurance: ratings.endurance, resistance: ratings.resistance, recovery: ratings.recovery, breakaway: ratings.breakaway, prologue: ratings.prologue };
}

function scaleYouthRatings(ratings: YouthRatings): YouthRatings {
  return Object.fromEntries(YOUTH_RATING_KEYS.map((key) => [key, clamp(Math.round(34 + ratings[key] * 8), 0, 100)])) as YouthRatings;
}

function projectYouthRatingChanges(changes: Record<string, number>) {
  return Object.fromEntries(
    Object.entries(changes).map(([key, value]) => [
      key,
      Math.round(value * 8 * 1_000) / 1_000,
    ]),
  );
}

function getParisHour(now = new Date()) {
  const hourPart = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(now)
    .find((part) => part.type === "hour");
  return Number(hourPart?.value ?? 0);
}

function groupBy<T>(rows: T[], key: (row: T) => string) {
  const grouped = new Map<string, T[]>();
  for (const row of rows) grouped.set(key(row), [...(grouped.get(key(row)) ?? []), row]);
  return grouped;
}

function toNumber(value: number | string) { return typeof value === "number" ? value : Number(value); }
function clamp(value: number, minimum: number, maximum: number) { return Math.min(maximum, Math.max(minimum, value)); }
function assertQuery(error: { message: string } | null, label: string) { if (error) throw new Error(`Impossible de charger ${label} : ${error.message}`); }
function requireData<T>(data: T | null, label: string): T { if (!data) throw new Error(`Impossible de charger ${label}.`); return data; }
