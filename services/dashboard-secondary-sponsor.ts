import "server-only";

import {
  SECONDARY_SPONSOR_REPUTATION_THRESHOLD,
  SECONDARY_SPONSOR_START_GAME_YEAR,
} from "@/lib/game/secondary-sponsor";
import { isFutureSponsoringWindowOpen } from "@/lib/gameplay-rules";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { DashboardFastSummary } from "@/services/dashboard-fast-summary";

type SeasonRow = {
  id: string;
  name: string;
  game_year: number;
  status: string;
  current_day_number: number | null;
};

export async function getDashboardSecondarySponsorOpportunity(
  summary: Pick<DashboardFastSummary, "sportingDirectorId" | "teamId" | "seasonId" | "seasonDayNumber">,
  signal = AbortSignal.timeout(1_500),
): Promise<{ targetSeasonName: string } | null> {
  if (!isFutureSponsoringWindowOpen(summary.seasonDayNumber) || signal.aborted) return null;
  const readSignal = AbortSignal.any([signal, AbortSignal.timeout(1_500)]);
  try {
    // The authenticated fast summary already identifies the active team and its DS.
    const admin = createSupabaseAdminClient();
    const director = await admin.from("sporting_directors")
      .select("reputation_points").eq("id", summary.sportingDirectorId).eq("status", "active")
      .gte("reputation_points", SECONDARY_SPONSOR_REPUTATION_THRESHOLD).limit(1)
      .abortSignal(readSignal).maybeSingle<{ reputation_points: number | string }>();
    if (director.error) throw director.error;
    const reputation = Number(director.data?.reputation_points);
    if (!director.data || !Number.isFinite(reputation) || reputation < SECONDARY_SPONSOR_REPUTATION_THRESHOLD) return null;

    const seasons = await admin.from("seasons")
      .select("id, name, game_year, status, current_day_number")
      .in("status", ["active", "planned"]).order("game_year", { ascending: true }).limit(2)
      .abortSignal(readSignal).returns<SeasonRow[]>();
    if (seasons.error) throw seasons.error;
    const active = seasons.data?.find(season => season.id === summary.seasonId && season.status === "active");
    if (!active || !isFutureSponsoringWindowOpen(active.current_day_number ?? 0)) return null;
    const target = seasons.data?.find(season => season.status === "planned" && season.game_year === active.game_year + 1
      && season.game_year >= SECONDARY_SPONSOR_START_GAME_YEAR);
    if (!target) return null;

    const contract = await admin.from("secondary_sponsor_contracts").select("id")
      .eq("team_id", summary.teamId).eq("season_id", target.id)
      .limit(1)
      .abortSignal(readSignal).maybeSingle<{ id: string }>();
    if (contract.error) throw contract.error;
    return contract.data ? null : { targetSeasonName: target.name };
  } catch (error) {
    console.warn("dashboard_secondary_sponsor_unavailable", {
      code: error && typeof error === "object" && "code" in error ? error.code : undefined,
    });
    return null;
  }
}
