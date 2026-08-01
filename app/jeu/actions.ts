"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { buildDashboardEventFeed } from "@/lib/game/dashboard-events";
import type { DashboardMonitoringActionResult } from "@/lib/game/dashboard-monitoring";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { getStageLiveState } from "@/lib/game/race-live";
import type { SeasonRaceCalendar } from "@/lib/game/race-calendar";
import { getActiveSeasonRaceCalendar } from "@/services/race-calendar";
import { settleFinishedRaceResults } from "@/services/race-results";
import { getCurrentDashboardFastSummary } from "@/services/dashboard-fast-summary";
import { getCurrentDashboardOperationalEvents } from "@/services/dashboard-events";
import { getCurrentDailyRewardOverview } from "@/services/daily-rewards";
import { getCurrentGameObjectives } from "@/services/game-objectives";
import { getDashboardPelotonNews } from "@/services/public-game-news";
import type { FinanceCategory, TeamFinanceTransaction } from "@/services/team-finances";
import { getSportingDirectorTrophyRewardStatus } from "@/services/trophy-gallery";
import { getUciRankings } from "@/services/uci-rankings";

export async function settleDueOfficialRaceRewardsAction(raceSlug?: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await getAuthenticatedUser(supabase);

  if (error || !user) {
    return {
      processedStages: 0,
      completedEditions: 0,
      nextSettlementAt: null,
    };
  }

  const now = new Date();
  const calendar = await getActiveSeasonRaceCalendar(supabase, now, {
    raceSlug,
  });
  if (!calendar) {
    return {
      processedStages: 0,
      completedEditions: 0,
      nextSettlementAt: null,
    };
  }

  const settlement = await settleFinishedRaceResults(calendar, now);
  if (settlement.completedEditions > 0) {
    revalidatePath("/jeu", "layout");
  }

  return {
    ...settlement,
    nextSettlementAt: getNextSettlementAt(calendar, now),
  };
}

type DashboardTransactionRow = {
  id: string;
  day_number: number;
  amount: number | string;
  category: FinanceCategory;
  status: TeamFinanceTransaction["status"];
  description: string;
  source_reference: string;
  posted_at: string | null;
};

type DashboardRosterRow = { rider_id: string };

export async function loadDashboardMonitoringAction(): Promise<DashboardMonitoringActionResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await getAuthenticatedUser(supabase);

    if (error || !user) {
      return { ok: false, message: "Votre session a expiré. Reconnectez-vous." };
    }

    const [summary, objectives, trophyRewardStatus, dailyRewards, rankings, pelotonNews] =
      await Promise.all([
        getCurrentDashboardFastSummary(supabase),
        getCurrentGameObjectives(supabase),
        getSportingDirectorTrophyRewardStatus(user.id),
        getCurrentDailyRewardOverview(supabase),
        getUciRankings(),
        getDashboardPelotonNews(),
      ]);

    if (!summary) {
      return { ok: false, message: "Le bureau de votre équipe est indisponible." };
    }

    const rosterResult = await supabase.rpc("get_current_team_roster");
    if (rosterResult.error) throw rosterResult.error;
    const riderIds = ((rosterResult.data ?? []) as DashboardRosterRow[]).map(
      (rider) => rider.rider_id,
    );

    const admin = createSupabaseAdminClient();
    const [operationalEvents, transactionsResult] = await Promise.all([
      getCurrentDashboardOperationalEvents({
        authUserId: user.id,
        teamId: summary.teamId,
        seasonId: summary.seasonId,
        currentDayNumber: summary.seasonDayNumber,
        riderIds,
      }),
      admin
        .from("team_finance_transactions")
        .select(
          "id, day_number, amount, category, status, description, source_reference, posted_at",
        )
        .eq("team_season_id", summary.teamSeasonId)
        .eq("category", "sponsor")
        .eq("status", "posted")
        .gte("day_number", Math.max(1, summary.seasonDayNumber - 2))
        .returns<DashboardTransactionRow[]>(),
    ]);

    if (transactionsResult.error) throw transactionsResult.error;

    const transactions: TeamFinanceTransaction[] = (transactionsResult.data ?? []).map(
      (transaction) => ({
        id: transaction.id,
        dayNumber: transaction.day_number,
        amount: Number(transaction.amount),
        category: transaction.category,
        status: transaction.status,
        description: transaction.description,
        sourceReference: transaction.source_reference,
        postedAt: transaction.posted_at,
      }),
    );

    const dailyRewardEvents = dailyRewards?.availableToday
      ? [{
          id: `daily-reward:${dailyRewards.seasonId}:${dailyRewards.currentDayNumber}`,
          category: "objective" as const,
          priority: "action" as const,
          title: "Votre cadeau quotidien vous attend",
          description: `Série de ${dailyRewards.consecutiveDays} jour${dailyRewards.consecutiveDays > 1 ? "s" : ""} · cadeau du jour à ouvrir.`,
          href: "/jeu/objectifs?onglet=quotidiennes",
          actionLabel: "Ouvrir le cadeau",
          badgeLabel: "Quotidien",
          dayNumber: dailyRewards.currentDayNumber,
          happenedAt: null,
          },
        ]
      : [];

    return {
      ok: true,
      payload: {
        teamId: summary.teamId,
        seasonName: summary.seasonName,
        dashboardEvents: buildDashboardEventFeed({
          currentDayNumber: summary.seasonDayNumber,
          currency: summary.currency,
          operationalEvents: [...dailyRewardEvents, ...operationalEvents.events],
          transactions,
          objectives,
          trophyRewardStatus,
        }),
        rankings,
        pelotonNews,
      },
    };
  } catch (error) {
    console.error("Impossible de charger le monitoring détaillé :", error);
    return {
      ok: false,
      message: "Le monitoring détaillé n’a pas pu être chargé. Réessayez dans un instant.",
    };
  }
}

function getNextSettlementAt(calendar: SeasonRaceCalendar, now: Date) {
  const nowTimestamp = now.getTime();
  const timestamps = calendar.editions.flatMap((edition) => {
    if (edition.status === "completed" || edition.status === "cancelled") {
      return [];
    }

    const finalStage = [...edition.stages].sort(
      (left, right) => right.stageNumber - left.stageNumber
    )[0];
    if (!finalStage) return [];
    const state = getStageLiveState(finalStage, now);
    if (!state.endsAt) return [];
    const timestamp = new Date(state.endsAt).getTime();
    return Number.isFinite(timestamp) && timestamp > nowTimestamp
      ? [timestamp]
      : [];
  });

  const nextTimestamp = timestamps.sort((left, right) => left - right)[0];
  return nextTimestamp ? new Date(nextTimestamp).toISOString() : null;
}

export async function logoutAccount(): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signOut({
    scope: "local",
  });

  if (error) {
    console.error("Échec de la déconnexion Supabase :", {
      code: error.code,
      status: error.status,
      message: error.message,
    });
  }

  redirect("/connexion");
}
