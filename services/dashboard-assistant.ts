import "server-only";

import type {
  DashboardAssistantSnapshot,
  DashboardJournalItem,
  NewcomerJourney,
  NewcomerJourneyStep,
  NewcomerJourneyStepKey,
} from "@/lib/game/dashboard-assistant";
import { parseDashboardConstructionContext } from "@/lib/game/dashboard-construction-alert";
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
  junior_session_count: number;
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

export async function getCurrentDashboardAssistantSummary(
  supabase: SupabaseServerClient,
): Promise<DashboardAssistantSnapshot | null> {
  const [
    result,
    sponsoringAlertResult,
    fanClubResult,
    constructionResult,
    welcomeJourneyResult,
  ] = await Promise.all([
    supabase
      .rpc("get_current_dashboard_assistant_summary")
      .maybeSingle<DashboardAssistantSummaryRow>(),
    supabase
      .rpc("get_current_sponsoring_alerts")
      .maybeSingle<SponsoringAlertRow>(),
    supabase
      .rpc("get_current_fan_club_assistant_summary")
      .maybeSingle<FanClubAssistantSummaryRow>(),
    supabase.rpc("get_current_dashboard_construction_context"),
    supabase.rpc("get_current_newcomer_journey"),
  ]);

  if (result.error) {
    throw new Error(
      `Impossible de charger l’assistant du DS : ${result.error.message}`,
    );
  }

  if (sponsoringAlertResult.error) {
    throw new Error(
      `Impossible de charger les alertes sponsoring : ${sponsoringAlertResult.error.message}`,
    );
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

  const row = result.data;
  if (!row) return null;

  const assistantPayload = normalizeAssistantPayload(row.journal_items);
  const sponsoringAlert = sponsoringAlertResult.data;
  const fanClubSummary = fanClubResult.error ? null : fanClubResult.data;

  return {
    gameDate: row.game_date,
    minimumForm: row.minimum_form,
    untreatedInjuryCount: row.untreated_injury_count,
    lowFormCount: row.low_form_count,
    completedScoutingCount: row.completed_scouting_count,
    availableScoutCount: assistantPayload.availableScoutCount,
    zeroTrainingCount: row.zero_training_count,
    seniorSessionCount: row.senior_session_count,
    seniorCompletedCount: row.senior_completed_count,
    seniorSkippedCount: row.senior_skipped_count,
    seniorProgressCount: row.senior_progress_count,
    juniorRiderCount: row.junior_rider_count,
    juniorSessionCount: row.junior_session_count,
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
  riderRecruitmentMatchCount: number;
  staffRecruitmentMatchCount: number;
  availableScoutCount: number;
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
      riderRecruitmentMatchCount: 0,
      staffRecruitmentMatchCount: 0,
      availableScoutCount: 0,
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
      riderRecruitmentMatchCount: 0,
      staffRecruitmentMatchCount: 0,
      availableScoutCount: 0,
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
    riderRecruitmentMatchCount: normalizeCount(
      payload.riderRecruitmentMatchCount,
    ),
    staffRecruitmentMatchCount: normalizeCount(
      payload.staffRecruitmentMatchCount,
    ),
    availableScoutCount: normalizeCount(payload.availableScoutCount),
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

function normalizeUuid(value: unknown): string | null {
  const id = normalizeOptionalString(value);
  return id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ? id
    : null;
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
