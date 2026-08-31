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

export type CyclogazettePollOption = {
  id: string;
  label: string;
  votes: number;
};

export type CyclogazettePollOverview = {
  id: string;
  question: string;
  options: CyclogazettePollOption[];
  totalVotes: number;
  viewerOptionId: string | null;
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
  poll: CyclogazettePollOverview | null;
};

type GamesSummaryPayload = {
  viewerCompleted?: unknown;
  completers?: unknown;
  totalCompleters?: unknown;
  poll?: unknown;
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
    poll: summary.poll,
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
  const poll = normalizePoll(raw.poll);

  return {
    viewerCompletedGames,
    completers,
    totalCompleters: Number.isFinite(parsedTotal)
      ? Math.max(completers.length, Math.trunc(parsedTotal))
      : completers.length,
    poll,
  };
}

function normalizePoll(value: unknown): CyclogazettePollOverview | null {
  if (!value || typeof value !== "object") return null;
  const poll = value as {
    id?: unknown;
    question?: unknown;
    options?: unknown;
    totalVotes?: unknown;
    viewerOptionId?: unknown;
  };
  const id = typeof poll.id === "string" ? poll.id.trim() : "";
  const question =
    typeof poll.question === "string" ? poll.question.trim() : "";
  const options = Array.isArray(poll.options)
    ? poll.options.flatMap<CyclogazettePollOption>((value) => {
        if (!value || typeof value !== "object") return [];
        const option = value as {
          id?: unknown;
          label?: unknown;
          votes?: unknown;
        };
        const optionId = typeof option.id === "string" ? option.id.trim() : "";
        const label =
          typeof option.label === "string" ? option.label.trim() : "";
        const votes = Number(option.votes);
        if (!optionId || !label) return [];
        return [
          {
            id: optionId,
            label,
            votes: Number.isFinite(votes) ? Math.max(0, Math.trunc(votes)) : 0,
          },
        ];
      })
    : [];
  const totalVotes = Number(poll.totalVotes);
  const viewerOptionId =
    typeof poll.viewerOptionId === "string" &&
    options.some((option) => option.id === poll.viewerOptionId)
      ? poll.viewerOptionId
      : null;

  if (!id || !question || options.length < 2) return null;
  return {
    id,
    question,
    options,
    totalVotes: Number.isFinite(totalVotes)
      ? Math.max(
          options.reduce((total, option) => total + option.votes, 0),
          Math.trunc(totalVotes),
        )
      : options.reduce((total, option) => total + option.votes, 0),
    viewerOptionId,
  };
}

function isGameType(value: unknown): value is CyclogazetteGameType {
  return value === "sudoku" || value === "crossword";
}
