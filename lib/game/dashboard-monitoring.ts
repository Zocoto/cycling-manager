import type { DashboardEvent } from "@/lib/game/dashboard-events";
import type { PublicGameNewsItem } from "@/lib/game/public-game-news";
import type { UciRankings } from "@/services/uci-rankings";

export type DashboardMonitoringPayload = {
  teamId: string;
  seasonName: string;
  dashboardEvents: DashboardEvent[];
  rankings: UciRankings | null;
  pelotonNews: PublicGameNewsItem[];
};

export type DashboardMonitoringActionResult =
  | { ok: true; payload: DashboardMonitoringPayload }
  | { ok: false; message: string };
