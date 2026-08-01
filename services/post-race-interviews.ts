import "server-only";

import type {
  PostRaceInterviewAnswer,
  PostRaceInterviewContext,
  PostRaceInterviewQuestion,
  PostRaceInterviewSnapshot,
} from "@/lib/game/post-race-interview";
import { selectPostRaceInterviewQuestions } from "@/lib/game/post-race-interview";
import type { OfficialRaceEditionResults } from "@/lib/game/race-results";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getUciRankings } from "@/services/uci-rankings";

type DirectorRow = {
  id: string;
  display_name: string;
  avatar_key: string | null;
};

type SeasonRow = { id: string };

type AssignmentRow = { team_id: string };

type PostRaceInterviewRow = {
  id: string;
  question_set: unknown;
  answers: unknown;
  closing_note: string | null;
  context: unknown;
  status: "pending" | "submitted";
  submitted_at: string | null;
};

export async function getOrCreatePostRaceInterview({
  authUserId,
  teamId,
  editionId,
  raceName,
  stageId,
  stageNumber,
  stageName,
  officialResults,
}: {
  authUserId: string;
  teamId: string | null;
  editionId: string;
  raceName: string;
  stageId: string;
  stageNumber: number;
  stageName: string;
  officialResults: OfficialRaceEditionResults;
}): Promise<PostRaceInterviewSnapshot | null> {
  if (!teamId) return null;

  const stageResults = officialResults.stages.find(
    (classification) => classification.stageId === stageId,
  )?.results;
  const teamResults = stageResults?.filter((result) => result.teamId === teamId) ?? [];
  if (teamResults.length === 0) return null;

  const admin = createSupabaseAdminClient();
  const [directorResult, seasonResult, rankings] = await Promise.all([
    admin
      .from("sporting_directors")
      .select("id, display_name, avatar_key")
      .eq("auth_user_id", authUserId)
      .eq("status", "active")
      .maybeSingle<DirectorRow>(),
    admin
      .from("seasons")
      .select("id")
      .eq("status", "active")
      .maybeSingle<SeasonRow>(),
    getUciRankings().catch(() => null),
  ]);

  if (directorResult.error || !directorResult.data || seasonResult.error || !seasonResult.data) {
    return null;
  }

  const assignmentResult = await admin
    .from("team_manager_assignments")
    .select("team_id")
    .eq("sporting_director_id", directorResult.data.id)
    .eq("team_id", teamId)
    .eq("role", "general_manager")
    .eq("status", "active")
    .maybeSingle<AssignmentRow>();

  if (assignmentResult.error || !assignmentResult.data) return null;

  const existing = await admin
    .from("post_race_interviews")
    .select("id, question_set, answers, closing_note, context, status, submitted_at")
    .eq("stage_id", stageId)
    .eq("team_id", teamId)
    .maybeSingle<PostRaceInterviewRow>();

  if (existing.error) {
    throw new Error(`Impossible de charger l’interview après-course : ${existing.error.message}`);
  }
  if (existing.data) return mapInterview(existing.data);

  const bestResult = [...teamResults]
    .filter((result) => result.status === "finished" && result.rank !== null)
    .sort((first, second) => (first.rank ?? 999) - (second.rank ?? 999))[0] ?? teamResults[0];
  const teamRanking = rankings?.teams.find((team) => team.teamId === teamId) ?? null;
  const teamAttacks = officialResults.attackParticipants.filter(
    (participant) =>
      participant.teamId === teamId && participant.stageNumbers.includes(stageNumber),
  );
  const context: PostRaceInterviewContext = {
    raceName,
    stageName,
    teamId,
    teamName: bestResult.teamName,
    directorName: directorResult.data.display_name,
    directorAvatarKey: directorResult.data.avatar_key,
    riderName: bestResult.riderName,
    bestRank: bestResult.rank,
    gapLabel: formatGap(bestResult.gapToWinnerMs),
    uciRank: teamRanking?.rank ?? null,
    divisionLabel: teamRanking?.division ?? null,
    tookBreakaway: teamAttacks.some(({ participationType }) => participationType === "breakaway"),
    tookChase: teamAttacks.some(({ participationType }) => participationType === "chase"),
  };
  const questions = selectPostRaceInterviewQuestions(
    context,
    `${editionId}:${stageId}:${teamId}`,
  );

  const inserted = await admin
    .from("post_race_interviews")
    .insert({
      race_edition_id: editionId,
      stage_id: stageId,
      team_id: teamId,
      sporting_director_id: directorResult.data.id,
      season_id: seasonResult.data.id,
      question_set: questions,
      context,
    })
    .select("id, question_set, answers, closing_note, context, status, submitted_at")
    .single<PostRaceInterviewRow>();

  if (!inserted.error && inserted.data) return mapInterview(inserted.data);

  // Deux chargements simultanés peuvent tenter la même création. La contrainte
  // unique garde une seule interview et ce second accès relit simplement la ligne.
  const concurrent = await admin
    .from("post_race_interviews")
    .select("id, question_set, answers, closing_note, context, status, submitted_at")
    .eq("stage_id", stageId)
    .eq("team_id", teamId)
    .maybeSingle<PostRaceInterviewRow>();

  if (concurrent.error || !concurrent.data) {
    throw new Error(
      `Impossible de préparer l’interview après-course : ${inserted.error?.message ?? "erreur inconnue"}`,
    );
  }
  return mapInterview(concurrent.data);
}

export async function submitPostRaceInterview({
  authUserId,
  interviewId,
  answers,
  closingNote,
}: {
  authUserId: string;
  interviewId: string;
  answers: string[];
  closingNote: string;
}): Promise<PostRaceInterviewSnapshot> {
  const admin = createSupabaseAdminClient();
  const directorResult = await admin
    .from("sporting_directors")
    .select("id")
    .eq("auth_user_id", authUserId)
    .eq("status", "active")
    .maybeSingle<{ id: string }>();

  if (directorResult.error || !directorResult.data) {
    throw new Error("Votre profil de Directeur Sportif est introuvable.");
  }

  const current = await admin
    .from("post_race_interviews")
    .select("id, question_set, answers, closing_note, context, status, submitted_at")
    .eq("id", interviewId)
    .eq("sporting_director_id", directorResult.data.id)
    .maybeSingle<PostRaceInterviewRow>();

  if (current.error || !current.data) {
    throw new Error("Cette interview ne vous appartient pas ou n’existe plus.");
  }
  if (current.data.status === "submitted") return mapInterview(current.data);

  const questions = current.data.question_set as PostRaceInterviewQuestion[];
  if (questions.length !== 3 || answers.length !== questions.length) {
    throw new Error("Les trois réponses de l’interview sont attendues.");
  }
  const normalizedAnswers: PostRaceInterviewAnswer[] = questions.map((question, index) => ({
    questionId: question.id,
    question: question.text,
    answer: answers[index].trim(),
  }));
  if (normalizedAnswers.some(({ answer }) => answer.length < 2 || answer.length > 600)) {
    throw new Error("Chaque réponse doit contenir entre 2 et 600 caractères.");
  }

  const nowIso = new Date().toISOString();
  const updated = await admin
    .from("post_race_interviews")
    .update({
      answers: normalizedAnswers,
      closing_note: closingNote.trim() || null,
      status: "submitted",
      submitted_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", interviewId)
    .eq("status", "pending")
    .select("id, question_set, answers, closing_note, context, status, submitted_at")
    .single<PostRaceInterviewRow>();

  if (updated.error || !updated.data) {
    throw new Error(`Impossible d’enregistrer l’interview : ${updated.error?.message ?? "erreur inconnue"}`);
  }
  return mapInterview(updated.data);
}

function mapInterview(row: PostRaceInterviewRow): PostRaceInterviewSnapshot {
  return {
    id: row.id,
    status: row.status,
    questions: row.question_set as PostRaceInterviewQuestion[],
    answers: row.answers as PostRaceInterviewAnswer[],
    closingNote: row.closing_note ?? "",
    context: row.context as PostRaceInterviewContext,
    submittedAt: row.submitted_at,
  };
}

function formatGap(gapMs: number | null) {
  if (gapMs === null || gapMs <= 0) return null;
  const totalSeconds = Math.max(1, Math.round(gapMs / 1_000));
  if (totalSeconds < 60) return `à ${totalSeconds} s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `à ${minutes} min ${String(seconds).padStart(2, "0")} s`;
}
