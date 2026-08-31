import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getCyclogazetteDailyGames,
  getCyclogazetteGameSolutions,
  type CyclogazetteDailyGames,
  type CyclogazetteGameSolutions,
  type CyclogazetteGameType,
} from "@/lib/game/cyclogazette-games";
import type { CyclogazetteEdition } from "@/lib/game/cyclogazette";

export const CYCLOGAZETTE_GAME_REWARD_CASH = 1_000;

export type CyclogazetteGameCompleter = {
  directorName: string;
  completedGames: CyclogazetteGameType[];
};

export type CyclogazetteGamesOverview = {
  editionId: string;
  issueNumber: number;
  games: CyclogazetteDailyGames;
  previousSolutions: CyclogazetteGameSolutions | null;
  isPlayable: boolean;
  viewerCompletedGames: CyclogazetteGameType[];
  completers: CyclogazetteGameCompleter[];
  totalCompleters: number;
  rewardCash: number;
};

type GamesSummaryPayload = {
  viewerCompleted?: unknown;
  completers?: unknown;
  totalCompleters?: unknown;
};

export async function getCyclogazetteGamesOverview({
  supabase,
  edition,
  latestEditionId,
  previousIssueNumber,
}: {
  supabase: SupabaseClient;
  edition: CyclogazetteEdition;
  latestEditionId: string;
  previousIssueNumber: number | null;
}): Promise<CyclogazetteGamesOverview> {
  const summaryResult = await supabase.rpc("get_cyclogazette_game_summary", {
    p_edition_id: edition.id,
  });

  if (summaryResult.error) {
    console.error(
      "Impossible de charger le palmarès des jeux de La Cyclogazette :",
      summaryResult.error,
    );
  }

  const summary = normalizeGamesSummary(summaryResult.data);

  return {
    editionId: edition.id,
    issueNumber: edition.issueNumber,
    games: getCyclogazetteDailyGames(edition.issueNumber),
    previousSolutions:
      previousIssueNumber && previousIssueNumber > 0
        ? getCyclogazetteGameSolutions(previousIssueNumber)
        : null,
    isPlayable: edition.id === latestEditionId,
    viewerCompletedGames: summary.viewerCompletedGames,
    completers: summary.completers,
    totalCompleters: summary.totalCompleters,
    rewardCash: CYCLOGAZETTE_GAME_REWARD_CASH,
  };
}

function normalizeGamesSummary(value: unknown) {
  const raw =
    value && typeof value === "object" ? (value as GamesSummaryPayload) : {};
  const viewerCompletedGames = Array.isArray(raw.viewerCompleted)
    ? raw.viewerCompleted.filter(isGameType)
    : [];
  const completers = Array.isArray(raw.completers)
    ? raw.completers.flatMap<CyclogazetteGameCompleter>((item) => {
        if (!item || typeof item !== "object") return [];
        const row = item as {
          directorName?: unknown;
          completedGames?: unknown;
        };
        const directorName =
          typeof row.directorName === "string" ? row.directorName.trim() : "";
        if (!directorName) return [];
        const completedGames = Array.isArray(row.completedGames)
          ? row.completedGames.filter(isGameType)
          : [];
        if (completedGames.length === 0) return [];
        return [{ directorName, completedGames }];
      })
    : [];
  const parsedTotal = Number(raw.totalCompleters);

  return {
    viewerCompletedGames,
    completers,
    totalCompleters: Number.isFinite(parsedTotal)
      ? Math.max(completers.length, Math.trunc(parsedTotal))
      : completers.length,
  };
}

function isGameType(value: unknown): value is CyclogazetteGameType {
  return value === "sudoku" || value === "crossword";
}
