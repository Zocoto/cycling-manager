import "server-only";

import type {
  DashboardAssistantSnapshot,
  DashboardJournalItem,
} from "@/lib/game/dashboard-assistant";
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

export async function getCurrentDashboardAssistantSummary(
  supabase: SupabaseServerClient,
): Promise<DashboardAssistantSnapshot | null> {
  const result = await supabase
    .rpc("get_current_dashboard_assistant_summary")
    .maybeSingle<DashboardAssistantSummaryRow>();

  if (result.error) {
    throw new Error(
      `Impossible de charger l’assistant du DS : ${result.error.message}`,
    );
  }

  const row = result.data;
  if (!row) return null;

  const assistantPayload = normalizeAssistantPayload(row.journal_items);

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
    journalItems: assistantPayload.journalItems,
  };
}

function normalizeAssistantPayload(value: unknown): {
  riderRecruitmentMatchCount: number;
  staffRecruitmentMatchCount: number;
  availableScoutCount: number;
  juniorManualTrainingDueCount: number;
  juniorManualTrainingSlot: "manual_am" | "manual_pm" | null;
  nextSeasonRosterProjectedCount: number;
  nextSeasonRosterOverflowCount: number;
  journalItems: DashboardJournalItem[];
} {
  if (Array.isArray(value)) {
    return {
      riderRecruitmentMatchCount: 0,
      staffRecruitmentMatchCount: 0,
      availableScoutCount: 0,
      juniorManualTrainingDueCount: 0,
      juniorManualTrainingSlot: null,
      nextSeasonRosterProjectedCount: 0,
      nextSeasonRosterOverflowCount: 0,
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
      nextSeasonRosterProjectedCount: 0,
      nextSeasonRosterOverflowCount: 0,
      journalItems: [],
    };
  }

  const payload = value as Record<string, unknown>;
  const rosterProjection =
    payload.nextSeasonRosterProjection &&
    typeof payload.nextSeasonRosterProjection === "object"
      ? (payload.nextSeasonRosterProjection as Record<string, unknown>)
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
    nextSeasonRosterProjectedCount: normalizeCount(
      rosterProjection.projectedCount,
    ),
    nextSeasonRosterOverflowCount: normalizeCount(
      rosterProjection.overflowCount,
    ),
    journalItems: normalizeJournalItems(payload.items),
  };
}

function normalizeCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : 0;
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
