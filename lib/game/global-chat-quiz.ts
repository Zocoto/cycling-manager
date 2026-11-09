import type { SupabaseClient } from "@supabase/supabase-js";

import { isUuid } from "@/lib/game/direct-messages";

export const GLOBAL_CHAT_QUIZ_RESULT_VISIBILITY_MS = 15 * 60_000;
export const GLOBAL_CHAT_QUIZ_PORTRAIT_BUCKET = "global-chat-quiz-portraits";

export type GlobalChatQuizRound = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: "open" | "won" | "expired";
  portraitPath: string;
  answerName: string | null;
  answerRiderId: string | null;
  winnerUsername: string | null;
  winnerSportingDirectorId: string | null;
};

/** RPC projections use camelCase and the safe Realtime events use snake_case. */
export function readGlobalChatQuizRound(value: unknown): GlobalChatQuizRound | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const { id, status } = row;
  const startsAt = row.startsAt ?? row.starts_at;
  const endsAt = row.endsAt ?? row.ends_at;
  const portraitPath = row.portraitPath ?? row.portrait_path;
  if (typeof id !== "string" || !isUuid(id) ||
    (status !== "open" && status !== "won" && status !== "expired") ||
    typeof startsAt !== "string" || !Number.isFinite(Date.parse(startsAt)) ||
    typeof endsAt !== "string" || !(Date.parse(endsAt) > Date.parse(startsAt)) ||
    portraitPath !== `${id}.webp`
  ) return null;

  const answerName = row.answerName ?? row.answer_name;
  const riderId = row.answerRiderId ?? row.answer_rider_id;
  const username = row.winnerUsername ?? row.winner_username;
  const directorId = row.winnerSportingDirectorId ?? row.winner_sporting_director_id;
  const winnerUsername = status === "won" && typeof username === "string" ? username.trim() : null;
  const winnerSportingDirectorId = status === "won" && typeof directorId === "string" && isUuid(directorId)
    ? directorId : null;
  if (status === "won" && (!winnerUsername || !winnerSportingDirectorId)) return null;

  return {
    id, startsAt, endsAt, status, portraitPath,
    answerName: status !== "open" && typeof answerName === "string" ? answerName : null,
    answerRiderId: status !== "open" && typeof riderId === "string" && isUuid(riderId) ? riderId : null,
    winnerUsername,
    winnerSportingDirectorId,
  };
}

export function mergeGlobalChatQuizRound(
  current: GlobalChatQuizRound | null,
  next: GlobalChatQuizRound,
) {
  if (!current) return next;
  if (current.id !== next.id) {
    return Date.parse(next.startsAt) >= Date.parse(current.startsAt) ? next : current;
  }
  // A reconnect or an overlapping guess must not reopen a settled round.
  const progress = { open: 0, expired: 1, won: 2 };
  return progress[next.status] >= progress[current.status] ? next : current;
}

/** Read the published questions alongside a page of chat messages. */
export async function loadGlobalChatQuizHistory(
  supabase: Pick<SupabaseClient, "rpc">,
  { from = null, before = null }: { from?: string | null; before?: string | null } = {},
): Promise<GlobalChatQuizRound[]> {
  const { data, error } = await supabase.rpc("get_global_chat_quiz_history", {
    p_from: from,
    p_before: before,
  }).abortSignal(AbortSignal.timeout(5_000));
  if (error) throw error;
  if (!Array.isArray(data)) return [];
  return data.map(readGlobalChatQuizRound).filter(round => round !== null).reverse();
}
