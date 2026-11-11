import "server-only";

import type {
  DashboardAssistantSnapshot,
  DashboardFederationVoteReminder,
  DashboardNationalChampionshipRouteReminder,
  DashboardFormCampReportSummary,
  DashboardNaturalizationAlert,
  DashboardJournalItem,
  NewcomerJourney,
  NewcomerJourneyStep,
  NewcomerJourneyStepKey,
} from "@/lib/game/dashboard-assistant";
import { getPendingInfrastructureOrientations } from "@/lib/game/dashboard-assistant";
import { INFRASTRUCTURE_SPECIALIZATION_UNLOCK_LEVEL } from "@/lib/game/infrastructure-specializations";
import { parseDashboardConstructionContext } from "@/lib/game/dashboard-construction-alert";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { DashboardFastSummary } from "@/services/dashboard-fast-summary";
import { getDashboardFederationConstructionOpportunity } from "@/services/dashboard-federation-construction";
import { getDashboardHalloweenEdition } from "@/services/dashboard-halloween";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

type DashboardAssistantSummaryRow = {
  game_date: string;
  minimum_form: number;
  untreated_injury_count: number;
  low_form_count: number;
  completed_scouting_count: number;
  zero_training_count: number;
  senior_session_count: number;
  senior_completed_count: number;
  senior_skipped_count: number;
  senior_progress_count: number;
  junior_rider_count: number;
  junior_session_count: number; // Legacy RPC name for the count of juniors with a session.
  junior_progress_count: number;
  auction_count: number;
  daily_auction_count: number;
  director_auction_count: number;
  next_auction_close_at: string | null;
  pending_selection_count: number;
  pending_direct_offer_count: number;
  contract_renewal_count: number;
  youth_alert_count: number;
  watched_auction_closing_count: number;
  staff_market_count: number;
  preparation_reminder_count: number;
  journal_items: unknown;
};

type SponsoringAlertRow = {
  signature_available: boolean;
  renewal_available: boolean;
  jersey_change_available: boolean;
  target_season_name: string | null;
};

type FanClubAssistantSummaryRow = {
  shop_level: number;
  total_stock: number;
  sales_processed_today: boolean;
  today_units_sold: number;
  today_revenue: number | string;
};

type FederationEquipmentAlertRow = {
  selection_required: boolean;
  country_code: string | null;
};

type DashboardInfrastructureLevelRow = {
  infrastructure_code: string;
  level: number;
};

type DashboardInfrastructureSpecializationRow = {
  infrastructure_code: string;
};

async function readAssistantCore(supabase: SupabaseServerClient, signal: AbortSignal) {
  return supabase.rpc("get_current_dashboard_assistant_summary")
    .abortSignal(signal).maybeSingle<DashboardAssistantSummaryRow>();
}

async function hasManagedInCompletedSeason(authUserId: string, signal: AbortSignal) {
  try {
    const result = await createSupabaseAdminClient()
      .from("team_manager_assignments")
      .select("id, director:sporting_directors!inner(auth_user_id), start_season:seasons!team_manager_assignments_start_season_id_fkey!inner(status)")
      .eq("director.auth_user_id", authUserId)
      .eq("start_season.status", "completed")
      .eq("role", "general_manager")
      .in("status", ["active", "completed", "terminated"])
      .limit(1)
      .abortSignal(signal)
      .maybeSingle<{ id: string }>();
    if (!result.error) return result.data !== null;
    console.warn("dashboard_manager_experience_unavailable", { code: result.error.code });
  } catch {
    console.warn("dashboard_manager_experience_unavailable");
  }
  return false;
}

export function getCurrentDashboardAssistantSummaries(
  supabase: SupabaseServerClient,
  authUserId: string,
  fastSummary?: Promise<DashboardFastSummary | null>,
) {
  const signal = AbortSignal.timeout(3000);
  const core = readAssistantCore(supabase, signal);
  const federationConstruction = fastSummary?.then((summary) => summary
    ? getDashboardFederationConstructionOpportunity(summary, signal)
    : null);
  let previousSeason: Promise<boolean> | undefined;

  async function loadSummary(enrich: boolean) {
    const snapshot = await getCurrentDashboardAssistantSummary(supabase, { core, signal, enrich });
    if (!snapshot || !(
      snapshot.developmentTeamSetupRequired ||
      snapshot.developmentRaceRegistrationReminderCount > 0 ||
      snapshot.federationEquipmentSelectionRequired
    )) {
      return snapshot;
    }

    previousSeason ??= hasManagedInCompletedSeason(authUserId, signal);
    if (await previousSeason) return snapshot;

    return {
      ...snapshot,
      developmentTeamSetupRequired: false,
      developmentRaceRegistrationReminderCount: 0,
      federationEquipmentSelectionRequired: false,
    };
  }

  return {
    initial: loadSummary(false),
    complete: Promise.all([loadSummary(true), federationConstruction])
      .then(([snapshot, opportunity]) => snapshot && opportunity
        ? { ...snapshot, federationConstructionOpportunity: opportunity }
        : snapshot),
  };
}

export async function getCurrentDashboardAssistantSummary(
  supabase: SupabaseServerClient,
  { core, signal = AbortSignal.timeout(3000), enrich = true }: {
    core?: ReturnType<typeof readAssistantCore>;
    signal?: AbortSignal;
    enrich?: boolean;
  } = {},
): Promise<DashboardAssistantSnapshot | null> {
  const empty = { data: null, error: null };
  const [
    result,
    sponsoringAlertResult,
    fanClubResult,
    constructionResult,
    welcomeJourneyResult,
    federationEquipmentAlertResult,
    infrastructureLevelsResult,
    infrastructureSpecializationsResult,
    rndOpportunityResult,
    halloweenEdition,
  ] = await Promise.all([
    core ?? readAssistantCore(supabase, signal),
    enrich ? supabase
      .rpc("get_current_sponsoring_alerts")
      .abortSignal(signal)
      .maybeSingle<SponsoringAlertRow>() : empty,
    enrich ? supabase
      .rpc("get_current_fan_club_assistant_summary")
      .abortSignal(signal)
      .maybeSingle<FanClubAssistantSummaryRow>() : empty,
    enrich ? supabase.rpc("get_current_dashboard_construction_context").abortSignal(signal) : empty,
    enrich ? supabase.rpc("get_current_newcomer_journey").abortSignal(signal) : empty,
    enrich ? supabase
      .rpc("get_current_federation_equipment_alert")
      .abortSignal(signal)
      .maybeSingle<FederationEquipmentAlertRow>() : empty,
    enrich ? supabase
      .from("team_infrastructures")
      .select("infrastructure_code, level")
      .gte("level", INFRASTRUCTURE_SPECIALIZATION_UNLOCK_LEVEL)
      .abortSignal(signal)
      .returns<DashboardInfrastructureLevelRow[]>() : empty,
    enrich ? supabase
      .from("team_infrastructure_specializations")
      .select("infrastructure_code")
      .abortSignal(signal)
      .returns<DashboardInfrastructureSpecializationRow[]>() : empty,
    enrich ? supabase.rpc("get_current_equipment_rnd_opportunity").abortSignal(signal) : empty,
    enrich ? getDashboardHalloweenEdition() : null,
  ]);

  if (result.error) {
    throw new Error(
      `Impossible de charger l’assistant du DS : ${result.error.message}`,
    );
  }

  if (sponsoringAlertResult.error) {
    console.error("Impossible de charger les alertes sponsoring :", sponsoringAlertResult.error.message);
  }

  if (fanClubResult.error) {
    console.error(
      "Impossible de charger l’état de la boutique du Fan Club :",
      fanClubResult.error.message,
    );
  }

  if (constructionResult.error) {
    console.error(
      "Impossible de charger les opportunités de construction :",
      constructionResult.error.message,
    );
  }

  if (welcomeJourneyResult.error) {
    console.error(
      "Impossible de charger le parcours de bienvenue :",
      welcomeJourneyResult.error.message,
    );
  }

  if (federationEquipmentAlertResult.error) {
    console.error(
      "Impossible de charger l’alerte équipementier fédérale :",
      federationEquipmentAlertResult.error.message,
    );
  }

  if (infrastructureLevelsResult.error) {
    console.error(
      "Impossible de charger les niveaux d’infrastructure pour l’assistant du DS :",
      infrastructureLevelsResult.error.message,
    );
  }

  if (infrastructureSpecializationsResult.error) {
    console.error(
      "Impossible de charger les orientations d’infrastructure pour l’assistant du DS :",
      infrastructureSpecializationsResult.error.message,
    );
  }

  const row = result.data;
  if (!row) return null;

  const assistantPayload = normalizeAssistantPayload(row.journal_items);
  const sponsoringAlert = sponsoringAlertResult.data;
  const fanClubSummary = fanClubResult.error ? null : fanClubResult.data;
  if (rndOpportunityResult.error) {
    console.error("Impossible de charger les disponibilités R&D :", rndOpportunityResult.error.message);
  }

  return {
    formCampReport: assistantPayload.formCampReport,
    halloweenShopEndsAt: halloweenEdition?.shopEndsAt ?? null,
    naturalizationAlerts: assistantPayload.naturalizationAlerts,
    federationVoteReminder: assistantPayload.federationVoteReminder,
    nationalChampionshipRouteReminder: assistantPayload.nationalChampionshipRouteReminder,
    emptyRosterRecoveryAvailable: assistantPayload.emptyRosterRecoveryAvailable,
    gameDate: row.game_date,
    minimumForm: row.minimum_form,
    untreatedInjuryCount: row.untreated_injury_count,
    lowFormCount: row.low_form_count,
    overweightRiders: [],
    completedScoutingCount: row.completed_scouting_count,
    availableScoutCount: assistantPayload.availableScoutCount,
    availablePhysiotherapistSlotCount: assistantPayload.availablePhysiotherapistSlotCount,
    ridersWithoutPhysiotherapistCount: assistantPayload.ridersWithoutPhysiotherapistCount,
    staffAcademyOpportunity: assistantPayload.staffAcademyOpportunity,
    availableRndEngineerCount: rndOpportunityResult.error
      ? 0
      : normalizeCount(rndOpportunityResult.data),
    zeroTrainingCount: row.zero_training_count,
    seniorSessionCount: row.senior_session_count,
    seniorCompletedCount: row.senior_completed_count,
    seniorSkippedCount: row.senior_skipped_count,
    seniorProgressCount: row.senior_progress_count,
    juniorRiderCount: row.junior_rider_count,
    juniorTrainedRiderCount: row.junior_session_count,
    juniorProgressCount: row.junior_progress_count,
    juniorManualTrainingDueCount:
      assistantPayload.juniorManualTrainingDueCount,
    juniorManualTrainingSlot: assistantPayload.juniorManualTrainingSlot,
    auctionCount: row.auction_count,
    dailyAuctionCount: row.daily_auction_count,
    directorAuctionCount: row.director_auction_count,
    nextAuctionCloseAt: row.next_auction_close_at,
    pendingSelectionCount: row.pending_selection_count,
    federationSelectionReminderCount:
      assistantPayload.federationSelectionReminderCount,
    federationSelectionReminderNextLabel:
      assistantPayload.federationSelectionReminderNextLabel,
    federationSelectionReminderNextClosesAt:
      assistantPayload.federationSelectionReminderNextClosesAt,
    federationSelectionReminderCountryCode:
      assistantPayload.federationSelectionReminderCountryCode,
    pendingDirectOfferCount: row.pending_direct_offer_count,
    contractRenewalCount: row.contract_renewal_count,
    youthAlertCount: row.youth_alert_count,
    nextSeasonRosterProjectedCount:
      assistantPayload.nextSeasonRosterProjectedCount,
    nextSeasonRosterOverflowCount:
      assistantPayload.nextSeasonRosterOverflowCount,
    watchedAuctionClosingCount: row.watched_auction_closing_count,
    staffMarketCount: row.staff_market_count,
    preparationReminderCount: row.preparation_reminder_count,
    riderRecruitmentMatchCount: assistantPayload.riderRecruitmentMatchCount,
    staffRecruitmentMatchCount: assistantPayload.staffRecruitmentMatchCount,
    sponsorSignatureAvailable: sponsoringAlert?.signature_available === true,
    sponsorRenewalAvailable: sponsoringAlert?.renewal_available === true,
    sponsorJerseyChangeAvailable:
      sponsoringAlert?.jersey_change_available === true,
    sponsorTargetSeasonName: sponsoringAlert?.target_season_name ?? null,
    equipmentPartnerSignatureAvailable:
      assistantPayload.equipmentPartnerSignatureAvailable,
    federationEquipmentSelectionRequired:
      !federationEquipmentAlertResult.error &&
      federationEquipmentAlertResult.data?.selection_required === true,
    federationEquipmentCountryCode:
      federationEquipmentAlertResult.error
        ? null
        : normalizeCountryCode(
            federationEquipmentAlertResult.data?.country_code,
          ),
    developmentTeamSetupRequired:
      assistantPayload.developmentTeamSetupRequired,
    developmentTeamSetupCurrentDayNumber:
      assistantPayload.developmentTeamSetupCurrentDayNumber,
    developmentRaceRegistrationReminderCount:
      assistantPayload.developmentRaceRegistrationReminderCount,
    developmentRaceRegistrationReminderNextName:
      assistantPayload.developmentRaceRegistrationReminderNextName,
    developmentRaceRegistrationReminderNextEditionId:
      assistantPayload.developmentRaceRegistrationReminderNextEditionId,
    constructionContext: constructionResult.error
      ? null
      : parseDashboardConstructionContext(constructionResult.data),
    pendingInfrastructureOrientations:
      infrastructureLevelsResult.error ||
      infrastructureSpecializationsResult.error
        ? []
        : getPendingInfrastructureOrientations({
            infrastructureLevels: (infrastructureLevelsResult.data ?? []).map(
              (infrastructure) => ({
                infrastructureCode: infrastructure.infrastructure_code,
                level: infrastructure.level,
              }),
            ),
            selectedInfrastructureCodes: (
              infrastructureSpecializationsResult.data ?? []
            ).map((specialization) => specialization.infrastructure_code),
          }),
    fanClubShopLevel: normalizeCount(fanClubSummary?.shop_level),
    fanClubStockCount: normalizeCount(fanClubSummary?.total_stock),
    fanClubSalesProcessedToday:
      fanClubSummary?.sales_processed_today === true,
    fanClubTodayUnitsSold: normalizeCount(fanClubSummary?.today_units_sold),
    fanClubTodayRevenue: normalizeAmount(fanClubSummary?.today_revenue),
    welcomeJourney: welcomeJourneyResult.error
      ? null
      : normalizeNewcomerJourney(welcomeJourneyResult.data),
    journalItems: assistantPayload.journalItems,
  };
}

const NEWCOMER_JOURNEY_STEP_KEYS = new Set<NewcomerJourneyStepKey>([
  "claim_daily_reward",
  "post_global_chat_message",
  "configure_training",
  "recruit_staff_member",
  "place_auction_bid",
  "register_for_race",
  "prepare_race",
  "follow_race_live",
]);

function normalizeNewcomerJourney(value: unknown): NewcomerJourney | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const journey = value as Record<string, unknown>;
  const enrolledAt = normalizeOptionalString(journey.enrolledAt);
  const chapter = normalizeOptionalString(journey.chapter);
  const rawSteps = Array.isArray(journey.steps) ? journey.steps : [];
  const steps = rawSteps.flatMap(normalizeNewcomerJourneyStep);

  if (!enrolledAt || !chapter || steps.length !== 2) return null;

  return {
    enrolledAt,
    chapter,
    wave: clampInteger(journey.wave, 1, 4),
    totalWaves: clampInteger(journey.totalWaves, 4, 4),
    completedCount: clampInteger(journey.completedCount, 0, 8),
    claimedCount: clampInteger(journey.claimedCount, 0, 8),
    totalCount: clampInteger(journey.totalCount, 8, 8),
    steps,
  };
}

function normalizeNewcomerJourneyStep(
  value: unknown,
): NewcomerJourneyStep[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];

  const step = value as Record<string, unknown>;
  const key = normalizeOptionalString(step.key);
  const title = normalizeOptionalString(step.title);
  const description = normalizeOptionalString(step.description);
  const href = normalizeOptionalString(step.href);

  if (
    !key ||
    !NEWCOMER_JOURNEY_STEP_KEYS.has(key as NewcomerJourneyStepKey) ||
    !title ||
    !description ||
    !href?.startsWith("/jeu")
  ) {
    return [];
  }

  return [{
    key: key as NewcomerJourneyStepKey,
    position: clampInteger(step.position, 1, 8),
    title,
    description,
    href,
    rewardCash: normalizeAmount(step.rewardCash),
    rewardExperience: normalizeCount(step.rewardExperience),
    completed: step.completed === true,
    claimed: step.claimed === true,
  }];
}

function clampInteger(value: unknown, minimum: number, maximum: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return minimum;
  return Math.max(minimum, Math.min(maximum, Math.trunc(numeric)));
}

function normalizeAssistantPayload(value: unknown): {
  formCampReport: DashboardFormCampReportSummary | null;
  federationVoteReminder: DashboardFederationVoteReminder | null;
  nationalChampionshipRouteReminder: DashboardNationalChampionshipRouteReminder | null;
  naturalizationAlerts: DashboardNaturalizationAlert[];
  emptyRosterRecoveryAvailable: boolean;
  riderRecruitmentMatchCount: number;
  staffRecruitmentMatchCount: number;
  availableScoutCount: number;
  availablePhysiotherapistSlotCount: number;
  ridersWithoutPhysiotherapistCount: number;
  staffAcademyOpportunity: DashboardAssistantSnapshot["staffAcademyOpportunity"];
  juniorManualTrainingDueCount: number;
  juniorManualTrainingSlot: "manual_am" | "manual_pm" | null;
  federationSelectionReminderCount: number;
  federationSelectionReminderNextLabel: string | null;
  federationSelectionReminderNextClosesAt: string | null;
  federationSelectionReminderCountryCode: string | null;
  nextSeasonRosterProjectedCount: number;
  nextSeasonRosterOverflowCount: number;
  equipmentPartnerSignatureAvailable: boolean;
  developmentTeamSetupRequired: boolean;
  developmentTeamSetupCurrentDayNumber: number;
  developmentRaceRegistrationReminderCount: number;
  developmentRaceRegistrationReminderNextName: string | null;
  developmentRaceRegistrationReminderNextEditionId: string | null;
  journalItems: DashboardJournalItem[];
} {
  if (Array.isArray(value)) {
    return {
      formCampReport: null,
      federationVoteReminder: null,
      nationalChampionshipRouteReminder: null,
      naturalizationAlerts: [],
      emptyRosterRecoveryAvailable: false,
      riderRecruitmentMatchCount: 0,
      staffRecruitmentMatchCount: 0,
      availableScoutCount: 0,
      availablePhysiotherapistSlotCount: 0,
      ridersWithoutPhysiotherapistCount: 0,
      staffAcademyOpportunity: null,
      juniorManualTrainingDueCount: 0,
      juniorManualTrainingSlot: null,
      federationSelectionReminderCount: 0,
      federationSelectionReminderNextLabel: null,
      federationSelectionReminderNextClosesAt: null,
      federationSelectionReminderCountryCode: null,
      nextSeasonRosterProjectedCount: 0,
      nextSeasonRosterOverflowCount: 0,
      equipmentPartnerSignatureAvailable: false,
      developmentTeamSetupRequired: false,
      developmentTeamSetupCurrentDayNumber: 0,
      developmentRaceRegistrationReminderCount: 0,
      developmentRaceRegistrationReminderNextName: null,
      developmentRaceRegistrationReminderNextEditionId: null,
      journalItems: normalizeJournalItems(value),
    };
  }

  if (!value || typeof value !== "object") {
    return {
      formCampReport: null,
      federationVoteReminder: null,
      nationalChampionshipRouteReminder: null,
      naturalizationAlerts: [],
      emptyRosterRecoveryAvailable: false,
      riderRecruitmentMatchCount: 0,
      staffRecruitmentMatchCount: 0,
      availableScoutCount: 0,
      availablePhysiotherapistSlotCount: 0,
      ridersWithoutPhysiotherapistCount: 0,
      staffAcademyOpportunity: null,
      juniorManualTrainingDueCount: 0,
      juniorManualTrainingSlot: null,
      federationSelectionReminderCount: 0,
      federationSelectionReminderNextLabel: null,
      federationSelectionReminderNextClosesAt: null,
      federationSelectionReminderCountryCode: null,
      nextSeasonRosterProjectedCount: 0,
      nextSeasonRosterOverflowCount: 0,
      equipmentPartnerSignatureAvailable: false,
      developmentTeamSetupRequired: false,
      developmentTeamSetupCurrentDayNumber: 0,
      developmentRaceRegistrationReminderCount: 0,
      developmentRaceRegistrationReminderNextName: null,
      developmentRaceRegistrationReminderNextEditionId: null,
      journalItems: [],
    };
  }

  const payload = value as Record<string, unknown>;
  const physiotherapistOpportunity =
    payload.physiotherapistOpportunity &&
    typeof payload.physiotherapistOpportunity === "object"
      ? (payload.physiotherapistOpportunity as Record<string, unknown>)
      : {};
  const rosterProjection =
    payload.nextSeasonRosterProjection &&
    typeof payload.nextSeasonRosterProjection === "object"
      ? (payload.nextSeasonRosterProjection as Record<string, unknown>)
      : {};
  const developmentTeamSetup =
    payload.developmentTeamSetup &&
    typeof payload.developmentTeamSetup === "object"
      ? (payload.developmentTeamSetup as Record<string, unknown>)
      : {};
  const developmentRaceRegistrationReminder =
    payload.developmentRaceRegistrationReminder &&
    typeof payload.developmentRaceRegistrationReminder === "object"
      ? (payload.developmentRaceRegistrationReminder as Record<string, unknown>)
      : {};
  const federationSelectionReminder =
    payload.federationSelectionReminder &&
    typeof payload.federationSelectionReminder === "object"
      ? (payload.federationSelectionReminder as Record<string, unknown>)
      : {};
  return {
    formCampReport: normalizeFormCampReportSummary(payload.formCampReport),
    federationVoteReminder: normalizeFederationVoteReminder(payload.federationVoteReminder),
    nationalChampionshipRouteReminder: normalizeNationalChampionshipRouteReminder(payload.nationalChampionshipRouteReminder),
    naturalizationAlerts: normalizeNaturalizationAlerts(payload.naturalizationAlerts),
    emptyRosterRecoveryAvailable: payload.emptyRosterRecoveryAvailable === true,
    riderRecruitmentMatchCount: normalizeCount(
      payload.riderRecruitmentMatchCount,
    ),
    staffRecruitmentMatchCount: normalizeCount(
      payload.staffRecruitmentMatchCount,
    ),
    availableScoutCount: normalizeCount(payload.availableScoutCount),
    availablePhysiotherapistSlotCount: normalizeCount(physiotherapistOpportunity.freeSlotCount),
    ridersWithoutPhysiotherapistCount: normalizeCount(physiotherapistOpportunity.unassignedRiderCount),
    staffAcademyOpportunity: normalizeStaffAcademyOpportunity(payload.staffAcademyOpportunity),
    juniorManualTrainingDueCount: normalizeCount(
      payload.juniorManualTrainingDueCount,
    ),
    juniorManualTrainingSlot:
      payload.juniorManualTrainingSlot === "manual_am" ||
      payload.juniorManualTrainingSlot === "manual_pm"
        ? payload.juniorManualTrainingSlot
        : null,
    federationSelectionReminderCount: normalizeCount(
      federationSelectionReminder.count,
    ),
    federationSelectionReminderNextLabel: normalizeOptionalString(
      federationSelectionReminder.nextLabel,
    ),
    federationSelectionReminderNextClosesAt: normalizeOptionalString(
      federationSelectionReminder.nextClosesAt,
    ),
    federationSelectionReminderCountryCode: normalizeCountryCode(
      federationSelectionReminder.countryCode,
    ),
    nextSeasonRosterProjectedCount: normalizeCount(
      rosterProjection.projectedCount,
    ),
    nextSeasonRosterOverflowCount: normalizeCount(
      rosterProjection.overflowCount,
    ),
    equipmentPartnerSignatureAvailable:
      payload.equipmentPartnerSignatureAvailable === true,
    developmentTeamSetupRequired: developmentTeamSetup.required === true,
    developmentTeamSetupCurrentDayNumber: normalizeCount(
      developmentTeamSetup.currentDayNumber,
    ),
    developmentRaceRegistrationReminderCount: normalizeCount(
      developmentRaceRegistrationReminder.count,
    ),
    developmentRaceRegistrationReminderNextName: normalizeOptionalString(
      developmentRaceRegistrationReminder.nextName,
    ),
    developmentRaceRegistrationReminderNextEditionId: normalizeUuid(
      developmentRaceRegistrationReminder.nextEditionId,
    ),
    journalItems: normalizeJournalItems(payload.items),
  };
}

function normalizeStaffAcademyOpportunity(value: unknown): NonNullable<DashboardAssistantSnapshot["staffAcademyOpportunity"]> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const opportunity = value as Record<string, unknown>;
  return {
    freeSlotCount: normalizeCount(opportunity.freeSlotCount),
    eligibleMemberCount: normalizeCount(opportunity.eligibleMemberCount),
  };
}

function normalizeFormCampReportSummary(value: unknown): DashboardFormCampReportSummary | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const { dayNumber, riderCount, totalFormGain } = row;
  if (typeof dayNumber !== "number" || !Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 28 ||
    typeof riderCount !== "number" || !Number.isSafeInteger(riderCount) || riderCount < 1 ||
    typeof totalFormGain !== "number" || !Number.isFinite(totalFormGain) || totalFormGain < 0 || totalFormGain > riderCount * 100) return null;
  return { dayNumber, riderCount, totalFormGain };
}

function normalizeCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : 0;
}

function normalizeAmount(value: unknown): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
}

function normalizeOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeCountryCode(value: unknown): string | null {
  const countryCode = normalizeOptionalString(value)?.toUpperCase() ?? null;
  return countryCode && /^[A-Z]{2}$/.test(countryCode) ? countryCode : null;
}

function normalizeFederationVoteReminder(value: unknown): DashboardFederationVoteReminder | null {
  if (!value || typeof value !== "object") return null;
  const reminder = value as Record<string, unknown>;
  const countryCode = normalizeCountryCode(reminder.countryCode);
  const closesAt = normalizeOptionalString(reminder.closesAt);
  return countryCode && closesAt && Number.isFinite(Date.parse(closesAt))
    ? { countryCode, closesAt }
    : null;
}

function normalizeNationalChampionshipRouteReminder(value: unknown): DashboardNationalChampionshipRouteReminder | null {
  const timing = normalizeFederationVoteReminder(value);
  if (!timing) return null;
  const { targetGameYear } = value as Record<string, unknown>;
  return typeof targetGameYear === "number" && Number.isSafeInteger(targetGameYear) && targetGameYear > 1
    ? { ...timing, targetGameYear }
    : null;
}

function normalizeUuid(value: unknown): string | null {
  const id = normalizeOptionalString(value);
  return id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ? id
    : null;
}

function normalizeNaturalizationAlerts(value: unknown): DashboardNaturalizationAlert[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((entry): DashboardNaturalizationAlert[] => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const subjectId = normalizeUuid(row.subjectId);
    const targetCountryId = normalizeUuid(row.targetCountryId);
    const name = normalizeOptionalString(row.name);
    const currentCountryName = normalizeOptionalString(row.currentCountryName);
    const targetCountryName = normalizeOptionalString(row.targetCountryName);
    if (!subjectId || !targetCountryId || !name || !currentCountryName || !targetCountryName ||
      (row.subjectType !== "professional" && row.subjectType !== "youth") ||
      typeof row.elapsedDays !== "number" || !Number.isFinite(row.elapsedDays) || row.elapsedDays < 0 ||
      typeof row.requiredDays !== "number" || !Number.isFinite(row.requiredDays) || row.requiredDays < 0 ||
      row.elapsedDays < row.requiredDays) return [];
    const key = `${row.subjectType}:${subjectId}:${targetCountryId}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ subjectId, targetCountryId, subjectType: row.subjectType, name, currentCountryName, targetCountryName,
      elapsedDays: Math.trunc(row.elapsedDays), requiredDays: Math.trunc(row.requiredDays) }];
  });
}

function normalizeJournalItems(value: unknown): DashboardJournalItem[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry): DashboardJournalItem[] => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    if (
      typeof item.id !== "string" ||
      typeof item.type !== "string" ||
      typeof item.title !== "string" ||
      typeof item.detail !== "string" ||
      typeof item.href !== "string" ||
      !item.href.startsWith("/jeu") ||
      typeof item.sentAt !== "string"
    ) {
      return [];
    }

    return [{
      id: item.id,
      type: item.type,
      title: item.title,
      detail: item.detail,
      href: item.href,
      important: item.important === true,
      sentAt: item.sentAt,
      read: item.read === true,
    }];
  });
}
