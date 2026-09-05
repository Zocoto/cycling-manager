import "server-only";

import {
  calculateFederationHostingAttendance,
  calculateFederationRaceReturn,
  FEDERATION_HOSTING_APPLICATION_CLOSE_DAY,
  FEDERATION_HOSTING_DECISION_DAY,
  FEDERATION_HOSTING_EVENTS,
  getFederationHostingEvent,
  getFederationRenownLabel,
  type FederationHostingEventType,
  type FederationHostingRiderCategory,
} from "@/lib/game/federation-hosting";
import type { RaceProfileType } from "@/lib/game/race-calendar";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

export type FederationRacePastWinner = {
  gameYear: number;
  riderName: string;
  teamName: string | null;
};

export type FederationCountryRace = {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  format: "one_day" | "stage_race";
  competitionType: string;
  editionId: string | null;
  editionStatus: string | null;
  categoryCode: string | null;
  categoryName: string | null;
  prestigeRank: number | null;
  acceptedTeamCount: number;
  pendingTeamCount: number;
  rejectedTeamCount: number;
  withdrawnTeamCount: number;
  activeRiderCount: number;
  fieldLimit: number | null;
  teamParticipationPercentage: number;
  riderFillPercentage: number;
  completedStageCount: number;
  totalStageCount: number;
  returnStatus: "earned" | "projected";
  moneyGain: number;
  prestigeGain: number;
  gainKind: "money" | "mixed";
  profiles: Array<{ type: RaceProfileType; count: number }>;
  pastWinners: FederationRacePastWinner[];
};

export type FederationRenownState = {
  score: number;
  label: string;
  sourceThroughGameYear: number;
  breakdown: {
    uciHistory: number;
    teamLegacy: number;
    riderLegacy: number;
    hostingLegacy: number;
  };
};

export type FederationHostingCandidacy = {
  id: string;
  countryId: string;
  countryCode: string;
  countryName: string;
  eventType: FederationHostingEventType;
  riderCategory: FederationHostingRiderCategory;
  eventKey: string;
  targetGameYear: number;
  status: "pending" | "selected" | "not_selected" | "withdrawn";
  hostingCost: number;
  lastHostedGameYear: number | null;
  uciRank: number;
  renownScore: number;
  recencyPoints: number;
  rankingPoints: number;
  renownPoints: number;
  selectionScore: number;
  submittedAt: string;
};

export type FederationHostingOpportunity = {
  eventType: FederationHostingEventType;
  riderCategory: FederationHostingRiderCategory;
  eventKey: string;
  label: string;
  shortLabel: string;
  hostingCost: number;
  prestigeGain: number;
  projectedAttendance: number;
  projectedGrossRevenue: number;
  projectedNetReturn: number;
  candidacy: FederationHostingCandidacy | null;
  selectedHostName: string | null;
  canApply: boolean;
  unavailableReason: string | null;
};

export type FederationCoursesState = {
  portfolio: FederationCountryRace[];
  renown: FederationRenownState;
  officeLevel: number;
  hosting: {
    targetGameYear: number;
    applicationCloseDay: number;
    decisionDay: number;
    viewerIsPresident: boolean;
    balance: number | null;
    reservedAmount: number;
    opportunities: FederationHostingOpportunity[];
    candidacies: FederationHostingCandidacy[];
  };
};

type RaceRow = {
  id: string;
  slug: string;
  name: string;
  short_name: string | null;
  race_format: "one_day" | "stage_race";
  competition_type: string;
};
type EditionRow = {
  id: string;
  race_id: string;
  season_id: string;
  race_category_id: string;
  status: string;
  field_limit: number | null;
};
type CategoryRow = {
  id: string;
  code: string;
  name: string;
  prestige_rank: number;
  maximum_roster_size: number | null;
};
type RegistrationRow = {
  id: string;
  race_edition_id: string;
  status: "pending" | "accepted" | "rejected" | "withdrawn";
};
type RosterRow = { race_registration_id: string; status: string };
type StageRow = {
  race_edition_id: string;
  status: string;
  profile_type: RaceProfileType;
};
type RenownRow = {
  score: number;
  uci_history_points: number;
  team_legacy_points: number;
  rider_legacy_points: number;
  hosting_legacy_points: number;
  source_through_game_year: number;
};
type CandidacyRow = {
  id: string;
  country_id: string;
  target_game_year: number;
  event_type: FederationHostingEventType;
  event_key: string;
  hosting_cost: number | string;
  last_hosted_game_year: number | null;
  uci_rank: number;
  renown_score: number;
  recency_points: number;
  ranking_points: number;
  renown_points: number;
  selection_score: number;
  status: FederationHostingCandidacy["status"];
  created_at: string;
};
type CountryRow = { id: string; iso_alpha2: string; name: string };
type FederationCountryMetaRow = { continent_code: string | null };
type AwardRow = { event_key: string; country_id: string; status: string };
type AccountRow = { balance: number | string };
type InfrastructureRow = { level: number };
type AssignmentRow = { sporting_director_id: string };
type TermRow = { president_director_id: string | null };
type HistoricEditionRow = {
  id: string;
  race_id: string;
  season_id: string;
};
type HistoricWinnerRow = {
  race_edition_id: string;
  race_roster_id: string;
};
type HistoricRosterRow = {
  id: string;
  rider_id: string;
  race_registration_id: string;
};
type HistoricRegistrationRow = {
  id: string;
  team_season_id: string | null;
  historical_team_name: string | null;
};
type HistoricRiderRow = { id: string; first_name: string; last_name: string };
type HistoricSeasonRow = { id: string; game_year: number };
type HistoricTeamSeasonRow = { id: string; display_name: string };

const emptyRenown = (gameYear: number): FederationRenownState => ({
  score: 0,
  label: getFederationRenownLabel(0),
  sourceThroughGameYear: gameYear,
  breakdown: { uciHistory: 0, teamLegacy: 0, riderLegacy: 0, hostingLegacy: 0 },
});

export async function getFederationCoursesState({
  countryId,
  seasonId,
  gameYear,
  currentDayNumber,
  viewerTeamId,
}: {
  countryId: string;
  seasonId: string;
  gameYear: number;
  currentDayNumber: number;
  viewerTeamId: string | null;
}): Promise<FederationCoursesState> {
  const targetGameYear = gameYear + 1;
  const fallback: FederationCoursesState = {
    portfolio: [],
    renown: emptyRenown(gameYear),
    officeLevel: 0,
    hosting: {
      targetGameYear,
      applicationCloseDay: FEDERATION_HOSTING_APPLICATION_CLOSE_DAY,
      decisionDay: FEDERATION_HOSTING_DECISION_DAY,
      viewerIsPresident: false,
      balance: null,
      reservedAmount: 0,
      opportunities: [],
      candidacies: [],
    },
  };

  try {
    const admin = createSupabaseAdminClient();
    const [countryResult, racesResult, renownResult, accountResult, officeResult, assignmentResult, termResult] =
      await Promise.all([
        admin
          .from("countries")
          .select("continent_code")
          .eq("id", countryId)
          .maybeSingle<FederationCountryMetaRow>(),
        admin
          .from("races")
          .select("id, slug, name, short_name, race_format, competition_type")
          .eq("country_id", countryId)
          .eq("status", "active")
          .order("name")
          .returns<RaceRow[]>(),
        admin.rpc("refresh_national_federation_renown", {
          p_country_id: countryId,
        }),
        admin
          .from("national_federation_accounts")
          .select("balance")
          .eq("country_id", countryId)
          .eq("season_id", seasonId)
          .maybeSingle<AccountRow>(),
        admin
          .from("national_federation_infrastructures")
          .select("level")
          .eq("country_id", countryId)
          .eq("infrastructure_code", "race_organization_office")
          .maybeSingle<InfrastructureRow>(),
        viewerTeamId
          ? admin
              .from("team_manager_assignments")
              .select("sporting_director_id")
              .eq("team_id", viewerTeamId)
              .eq("role", "general_manager")
              .eq("status", "active")
              .maybeSingle<AssignmentRow>()
          : Promise.resolve({ data: null, error: null }),
        admin
          .from("national_federation_terms")
          .select("president_director_id")
          .eq("country_id", countryId)
          .lte("start_game_year", gameYear)
          .gte("end_game_year", gameYear)
          .maybeSingle<TermRow>(),
      ]);

    for (const result of [
      countryResult,
      racesResult,
      renownResult,
      accountResult,
      officeResult,
      assignmentResult,
      termResult,
    ]) {
      if (result.error) throw result.error;
    }
    const continentCode = countryResult.data?.continent_code ?? null;

    const races = racesResult.data ?? [];
    const raceIds = races.map((race) => race.id);
    const editionsResult = raceIds.length
      ? await admin
          .from("race_editions")
          .select("id, race_id, season_id, race_category_id, status, field_limit")
          .eq("season_id", seasonId)
          .in("race_id", raceIds)
          .returns<EditionRow[]>()
      : { data: [] as EditionRow[], error: null };
    if (editionsResult.error) throw editionsResult.error;

    const editions = editionsResult.data ?? [];
    const editionIds = editions.map((edition) => edition.id);
    const categoryIds = [...new Set(editions.map((edition) => edition.race_category_id))];
    const [categoriesResult, registrationsResult, stagesResult, candidaciesResult, awardsResult, pastWinnersByRaceId] =
      await Promise.all([
        categoryIds.length
          ? admin
              .from("race_categories")
              .select("id, code, name, prestige_rank, maximum_roster_size")
              .in("id", categoryIds)
              .returns<CategoryRow[]>()
          : Promise.resolve({ data: [] as CategoryRow[], error: null }),
        editionIds.length
          ? admin
              .from("race_registrations")
              .select("id, race_edition_id, status")
              .in("race_edition_id", editionIds)
              .returns<RegistrationRow[]>()
          : Promise.resolve({ data: [] as RegistrationRow[], error: null }),
        editionIds.length
          ? admin
              .from("stages")
              .select("race_edition_id, status, profile_type")
              .in("race_edition_id", editionIds)
              .returns<StageRow[]>()
          : Promise.resolve({ data: [] as StageRow[], error: null }),
        admin
          .from("national_federation_hosting_candidacies")
          .select(
            "id, country_id, target_game_year, event_type, event_key, hosting_cost, last_hosted_game_year, uci_rank, renown_score, recency_points, ranking_points, renown_points, selection_score, status, created_at",
          )
          .eq("target_game_year", targetGameYear)
          .order("selection_score", { ascending: false })
          .order("created_at", { ascending: true })
          .returns<CandidacyRow[]>(),
        admin
          .from("national_federation_hosting_awards")
          .select("event_key, country_id, status")
          .eq("target_game_year", targetGameYear)
          .in("status", ["scheduled", "settled"])
          .returns<AwardRow[]>(),
        loadRacePastWinners(admin, raceIds),
      ]);
    for (const result of [
      categoriesResult,
      registrationsResult,
      stagesResult,
      candidaciesResult,
      awardsResult,
    ]) {
      if (result.error) throw result.error;
    }

    const registrations = registrationsResult.data ?? [];
    const registrationIds = registrations.map((registration) => registration.id);
    const rostersResult = registrationIds.length
      ? await admin
          .from("race_rosters")
          .select("race_registration_id, status")
          .in("race_registration_id", registrationIds)
          .returns<RosterRow[]>()
      : { data: [] as RosterRow[], error: null };
    if (rostersResult.error) throw rostersResult.error;

    const candidacyRows = candidaciesResult.data ?? [];
    const candidateCountryIds = [...
      new Set([
        ...candidacyRows.map((candidate) => candidate.country_id),
        ...(awardsResult.data ?? []).map((award) => award.country_id),
      ]),
    ];
    const countriesResult = candidateCountryIds.length
      ? await admin
          .from("countries")
          .select("id, iso_alpha2, name")
          .in("id", candidateCountryIds)
          .returns<CountryRow[]>()
      : { data: [] as CountryRow[], error: null };
    if (countriesResult.error) throw countriesResult.error;

    const renown = parseRenown(renownResult.data, gameYear);
    const categoryById = new Map(
      (categoriesResult.data ?? []).map((category) => [category.id, category]),
    );
    const editionByRaceId = new Map(editions.map((edition) => [edition.race_id, edition]));
    const registrationsByEdition = groupBy(registrations, (row) => row.race_edition_id);
    const stagesByEdition = groupBy(stagesResult.data ?? [], (row) => row.race_edition_id);
    const rosterByRegistration = groupBy(
      rostersResult.data ?? [],
      (row) => row.race_registration_id,
    );
    const officeLevel = officeResult.data?.level ?? 0;

    const portfolio = races.map((race): FederationCountryRace => {
      const edition = editionByRaceId.get(race.id) ?? null;
      const category = edition ? categoryById.get(edition.race_category_id) ?? null : null;
      const raceRegistrations = edition
        ? registrationsByEdition.get(edition.id) ?? []
        : [];
      const accepted = raceRegistrations.filter((row) => row.status === "accepted");
      const activeRiders = accepted.reduce(
        (count, registration) =>
          count +
          (rosterByRegistration.get(registration.id) ?? []).filter((roster) =>
            ["selected", "confirmed"].includes(roster.status),
          ).length,
        0,
      );
      const raceStages = edition ? stagesByEdition.get(edition.id) ?? [] : [];
      const completedStageCount = raceStages.filter(
        (stage) => stage.status === "completed",
      ).length;
      const returnStatus = edition?.status === "completed" ? "earned" : "projected";
      const countedStages =
        returnStatus === "earned" ? completedStageCount : raceStages.length;
      const raceReturn = calculateFederationRaceReturn({
        categoryCode: category?.code ?? "regional",
        completedStageCount: countedStages,
        starterCount: activeRiders,
        officeLevel,
      });
      const fieldLimit = edition?.field_limit ?? null;
      const maximumRosterSize = category?.maximum_roster_size ?? 0;
      const profileCounts = new Map<RaceProfileType, number>();
      for (const stage of raceStages) {
        profileCounts.set(
          stage.profile_type,
          (profileCounts.get(stage.profile_type) ?? 0) + 1,
        );
      }
      return {
        id: race.id,
        slug: race.slug,
        name: race.name,
        shortName: race.short_name,
        format: race.race_format,
        competitionType: race.competition_type,
        editionId: edition?.id ?? null,
        editionStatus: edition?.status ?? null,
        categoryCode: category?.code ?? null,
        categoryName: category?.name ?? null,
        prestigeRank: category?.prestige_rank ?? null,
        acceptedTeamCount: accepted.length,
        pendingTeamCount: raceRegistrations.filter((row) => row.status === "pending").length,
        rejectedTeamCount: raceRegistrations.filter((row) => row.status === "rejected").length,
        withdrawnTeamCount: raceRegistrations.filter((row) => row.status === "withdrawn").length,
        activeRiderCount: activeRiders,
        fieldLimit,
        teamParticipationPercentage: percentage(accepted.length, fieldLimit ?? 0),
        riderFillPercentage: percentage(activeRiders, accepted.length * maximumRosterSize),
        completedStageCount,
        totalStageCount: raceStages.length,
        returnStatus,
        moneyGain: raceReturn.money,
        prestigeGain: raceReturn.prestige,
        gainKind: raceReturn.kind,
        profiles: [...profileCounts.entries()].map(([type, count]) => ({
          type,
          count,
        })),
        pastWinners: pastWinnersByRaceId.get(race.id) ?? [],
      };
    });

    const countryById = new Map(
      (countriesResult.data ?? []).map((country) => [country.id, country]),
    );
    const candidacies = candidacyRows.map((row): FederationHostingCandidacy => {
      const country = countryById.get(row.country_id);
      return {
        id: row.id,
        countryId: row.country_id,
        countryCode: country?.iso_alpha2 ?? "XX",
        countryName: country?.name ?? "Pays inconnu",
        eventType: row.event_type,
        riderCategory: getFederationHostingEvent(row.event_type).riderCategory,
        eventKey: row.event_key,
        targetGameYear: row.target_game_year,
        status: row.status,
        hostingCost: Number(row.hosting_cost),
        lastHostedGameYear: row.last_hosted_game_year,
        uciRank: row.uci_rank,
        renownScore: row.renown_score,
        recencyPoints: row.recency_points,
        rankingPoints: row.ranking_points,
        renownPoints: row.renown_points,
        selectionScore: row.selection_score,
        submittedAt: row.created_at,
      };
    });
    const viewerDirectorId = assignmentResult.data?.sporting_director_id ?? null;
    const viewerIsPresident = Boolean(
      viewerDirectorId && viewerDirectorId === termResult.data?.president_director_id,
    );
    const balance = accountResult.data ? Number(accountResult.data.balance) : null;
    const reservedAmount = candidacies
      .filter((candidate) => candidate.countryId === countryId && candidate.status === "pending")
      .reduce((total, candidate) => total + candidate.hostingCost, 0);
    const relevantEventKeys = new Set(
      FEDERATION_HOSTING_EVENTS.map((event) =>
        getHostingEventKey(event.type, continentCode),
      ),
    );
    const relevantCandidacies = candidacies.filter((candidate) =>
      relevantEventKeys.has(candidate.eventKey),
    );
    const awardByEventKey = new Map(
      (awardsResult.data ?? []).map((award) => [award.event_key, award]),
    );
    const opportunities = FEDERATION_HOSTING_EVENTS.map(
      (event): FederationHostingOpportunity => {
        const eventKey = getHostingEventKey(event.type, continentCode);
        const candidacy =
          relevantCandidacies.find(
            (candidate) => candidate.countryId === countryId && candidate.eventKey === eventKey,
          ) ?? null;
        const award = awardByEventKey.get(eventKey);
        const selectedCountry = award ? countryById.get(award.country_id) : null;
        const projection = calculateFederationHostingAttendance({
          eventType: event.type,
          participationRate: 0.85,
          renown: renown.score,
        });
        const unavailableReason = getUnavailableReason({
          gameYear,
          currentDayNumber,
          viewerIsPresident,
          balance,
          reservedAmount,
          eventCost: event.hostingCost,
          candidacy,
          hasContinent: Boolean(continentCode),
          eventType: event.type,
        });
        return {
          eventType: event.type,
          riderCategory: event.riderCategory,
          eventKey,
          label: event.label,
          shortLabel: event.shortLabel,
          hostingCost: event.hostingCost,
          prestigeGain: event.prestigeGain,
          projectedAttendance: projection.attendance,
          projectedGrossRevenue: projection.grossRevenue,
          projectedNetReturn: projection.netReturn,
          candidacy,
          selectedHostName: selectedCountry?.name ?? null,
          canApply: unavailableReason == null,
          unavailableReason,
        };
      },
    );

    return {
      portfolio,
      renown,
      officeLevel,
      hosting: {
        targetGameYear,
        applicationCloseDay: FEDERATION_HOSTING_APPLICATION_CLOSE_DAY,
        decisionDay: FEDERATION_HOSTING_DECISION_DAY,
        viewerIsPresident,
        balance,
        reservedAmount,
        opportunities,
        candidacies: relevantCandidacies,
      },
    };
  } catch (error) {
    console.error("Impossible de charger le portefeuille de courses fédérales :", error);
    return fallback;
  }
}

async function loadRacePastWinners(
  admin: AdminClient,
  raceIds: string[],
): Promise<Map<string, FederationRacePastWinner[]>> {
  if (raceIds.length === 0) return new Map();

  const editionsResult = await admin
    .from("race_editions")
    .select("id, race_id, season_id")
    .in("race_id", raceIds)
    .eq("status", "completed")
    .returns<HistoricEditionRow[]>();
  if (editionsResult.error) throw editionsResult.error;
  const editions = editionsResult.data ?? [];
  if (editions.length === 0) return new Map();

  const winnersResult = await admin
    .from("race_results")
    .select("race_edition_id, race_roster_id")
    .in(
      "race_edition_id",
      editions.map((edition) => edition.id),
    )
    .eq("status", "classified")
    .eq("final_rank", 1)
    .returns<HistoricWinnerRow[]>();
  if (winnersResult.error) throw winnersResult.error;
  const winners = winnersResult.data ?? [];
  if (winners.length === 0) return new Map();

  const rostersResult = await admin
    .from("race_rosters")
    .select("id, rider_id, race_registration_id")
    .in(
      "id",
      winners.map((winner) => winner.race_roster_id),
    )
    .returns<HistoricRosterRow[]>();
  if (rostersResult.error) throw rostersResult.error;
  const rosters = rostersResult.data ?? [];
  const registrationIds = [
    ...new Set(rosters.map((roster) => roster.race_registration_id)),
  ];
  const teamSeasonIds: string[] = [];
  const [ridersResult, registrationsResult, seasonsResult] = await Promise.all([
    admin
      .from("riders")
      .select("id, first_name, last_name")
      .in(
        "id",
        rosters.map((roster) => roster.rider_id),
      )
      .returns<HistoricRiderRow[]>(),
    registrationIds.length
      ? admin
          .from("race_registrations")
          .select("id, team_season_id, historical_team_name")
          .in("id", registrationIds)
          .returns<HistoricRegistrationRow[]>()
      : Promise.resolve({ data: [] as HistoricRegistrationRow[], error: null }),
    admin
      .from("seasons")
      .select("id, game_year")
      .in(
        "id",
        [...new Set(editions.map((edition) => edition.season_id))],
      )
      .returns<HistoricSeasonRow[]>(),
  ]);
  if (ridersResult.error) throw ridersResult.error;
  if (registrationsResult.error) throw registrationsResult.error;
  if (seasonsResult.error) throw seasonsResult.error;

  for (const registration of registrationsResult.data ?? []) {
    if (registration.team_season_id) teamSeasonIds.push(registration.team_season_id);
  }
  const teamSeasonsResult = teamSeasonIds.length
    ? await admin
        .from("team_seasons")
        .select("id, display_name")
        .in("id", [...new Set(teamSeasonIds)])
        .returns<HistoricTeamSeasonRow[]>()
    : { data: [] as HistoricTeamSeasonRow[], error: null };
  if (teamSeasonsResult.error) throw teamSeasonsResult.error;

  const editionById = new Map(editions.map((edition) => [edition.id, edition]));
  const rosterById = new Map(rosters.map((roster) => [roster.id, roster]));
  const riderById = new Map(
    (ridersResult.data ?? []).map((rider) => [rider.id, rider]),
  );
  const registrationById = new Map(
    (registrationsResult.data ?? []).map((registration) => [
      registration.id,
      registration,
    ]),
  );
  const gameYearBySeasonId = new Map(
    (seasonsResult.data ?? []).map((season) => [season.id, season.game_year]),
  );
  const teamNameBySeasonId = new Map(
    (teamSeasonsResult.data ?? []).map((teamSeason) => [
      teamSeason.id,
      teamSeason.display_name,
    ]),
  );
  const result = new Map<string, FederationRacePastWinner[]>();

  for (const winner of winners) {
    const edition = editionById.get(winner.race_edition_id);
    const roster = rosterById.get(winner.race_roster_id);
    const rider = roster ? riderById.get(roster.rider_id) : null;
    const registration = roster
      ? registrationById.get(roster.race_registration_id)
      : null;
    const gameYear = edition
      ? gameYearBySeasonId.get(edition.season_id)
      : null;
    if (!edition || !rider || !gameYear) continue;

    const raceWinners = result.get(edition.race_id) ?? [];
    raceWinners.push({
      gameYear,
      riderName: `${rider.first_name} ${rider.last_name}`,
      teamName:
        registration?.historical_team_name ??
        (registration?.team_season_id
          ? teamNameBySeasonId.get(registration.team_season_id) ?? null
          : null),
    });
    result.set(edition.race_id, raceWinners);
  }

  for (const [raceId, raceWinners] of result) {
    result.set(
      raceId,
      raceWinners
        .sort((first, second) => second.gameYear - first.gameYear)
        .slice(0, 3),
    );
  }
  return result;
}

function parseRenown(value: unknown, gameYear: number): FederationRenownState {
  const row = (Array.isArray(value) ? value[0] : value) as RenownRow | null;
  if (!row || typeof row.score !== "number") return emptyRenown(gameYear);
  return {
    score: row.score,
    label: getFederationRenownLabel(row.score),
    sourceThroughGameYear: row.source_through_game_year,
    breakdown: {
      uciHistory: row.uci_history_points,
      teamLegacy: row.team_legacy_points,
      riderLegacy: row.rider_legacy_points,
      hostingLegacy: row.hosting_legacy_points,
    },
  };
}

function getUnavailableReason({
  gameYear,
  currentDayNumber,
  viewerIsPresident,
  balance,
  reservedAmount,
  eventCost,
  candidacy,
  hasContinent,
  eventType,
}: {
  gameYear: number;
  currentDayNumber: number;
  viewerIsPresident: boolean;
  balance: number | null;
  reservedAmount: number;
  eventCost: number;
  candidacy: FederationHostingCandidacy | null;
  hasContinent: boolean;
  eventType: FederationHostingEventType;
}): string | null {
  if (gameYear < 3) return "Ouverture des candidatures en Saison 3.";
  if (currentDayNumber > FEDERATION_HOSTING_APPLICATION_CLOSE_DAY)
    return `Dépôts clos depuis la J${FEDERATION_HOSTING_APPLICATION_CLOSE_DAY}.`;
  if (!viewerIsPresident) return "Action réservée au président élu.";
  if (eventType.startsWith("continental_championship") && !hasContinent)
    return "Le continent de la fédération doit être renseigné.";
  if (candidacy) return "Candidature déjà déposée pour cette édition.";
  if (balance == null) return "La trésorerie fédérale n’est pas encore active.";
  if (balance - reservedAmount < eventCost)
    return "Trésorerie disponible insuffisante après les garanties en cours.";
  return null;
}

function getHostingEventKey(
  eventType: FederationHostingEventType,
  continentCode: string | null,
): string {
  return eventType.startsWith("continental_championship")
    ? `${eventType}:${continentCode ?? "unknown"}`
    : eventType;
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const row of rows) {
    const value = key(row);
    result.set(value, [...(result.get(value) ?? []), row]);
  }
  return result;
}

function percentage(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((value / total) * 100));
}
