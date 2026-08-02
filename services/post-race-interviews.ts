import "server-only";

import type {
  PostRaceInterviewAnswer,
  PostRaceInterviewContext,
  PostRaceInterviewQuestion,
  PostRaceInterviewRivalryContext,
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
  team_id?: string;
  sporting_director_id?: string;
  question_set: unknown;
  answers: unknown;
  closing_note: string | null;
  context: unknown;
  status: "pending" | "submitted";
  submitted_at: string | null;
};

type RivalAssignmentRow = {
  team_id: string;
  sporting_director_id: string;
};

type SubmittedInterviewRow = PostRaceInterviewRow & {
  team_id: string;
  sporting_director_id: string;
};

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

const INTERVIEW_SELECT =
  "id, team_id, sporting_director_id, question_set, answers, closing_note, context, status, submitted_at";

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
    .select(INTERVIEW_SELECT)
    .eq("stage_id", stageId)
    .eq("team_id", teamId)
    .maybeSingle<PostRaceInterviewRow>();

  if (existing.error) {
    throw new Error(`Impossible de charger l’interview après-course : ${existing.error.message}`);
  }
  if (existing.data?.status === "submitted") return mapInterview(existing.data);
  if (existing.data) {
    const currentContext = existing.data.context as PostRaceInterviewContext;
    const rivalry = await loadRivalryContext(admin, {
      stageId,
      currentTeamId: teamId,
      stageResults: stageResults ?? [],
    });
    if (!rivalry || sameRivalry(currentContext.rivalry, rivalry)) {
      return mapInterview(existing.data);
    }
    const refreshedContext = { ...currentContext, rivalry };
    const refreshedQuestions = selectPostRaceInterviewQuestions(
      refreshedContext,
      `${editionId}:${stageId}:${teamId}`,
    );
    const refreshed = await admin
      .from("post_race_interviews")
      .update({
        context: refreshedContext,
        question_set: refreshedQuestions,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.data.id)
      .eq("status", "pending")
      .select(INTERVIEW_SELECT)
      .single<PostRaceInterviewRow>();
    if (!refreshed.error && refreshed.data) return mapInterview(refreshed.data);
    return mapInterview(existing.data);
  }

  const bestResult = [...teamResults]
    .filter((result) => result.status === "finished" && result.rank !== null)
    .sort((first, second) => (first.rank ?? 999) - (second.rank ?? 999))[0] ?? teamResults[0];
  const teamRanking = rankings?.teams.find((team) => team.teamId === teamId) ?? null;
  const teamAttacks = officialResults.attackParticipants.filter(
    (participant) =>
      participant.teamId === teamId && participant.stageNumbers.includes(stageNumber),
  );
  const rivalry = await loadRivalryContext(admin, {
    stageId,
    currentTeamId: teamId,
    stageResults: stageResults ?? [],
  });
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
    rivalry,
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
    .select(INTERVIEW_SELECT)
    .single<PostRaceInterviewRow>();

  if (!inserted.error && inserted.data) return mapInterview(inserted.data);

  // Deux chargements simultanés peuvent tenter la même création. La contrainte
  // unique garde une seule interview et ce second accès relit simplement la ligne.
  const concurrent = await admin
    .from("post_race_interviews")
    .select(INTERVIEW_SELECT)
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
    .select(INTERVIEW_SELECT)
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
    .select(INTERVIEW_SELECT)
    .single<PostRaceInterviewRow>();

  if (updated.error || !updated.data) {
    throw new Error(`Impossible d’enregistrer l’interview : ${updated.error?.message ?? "erreur inconnue"}`);
  }
  return mapInterview(updated.data);
}

async function loadRivalryContext(
  admin: SupabaseAdminClient,
  {
    stageId,
    currentTeamId,
    stageResults,
  }: {
    stageId: string;
    currentTeamId: string;
    stageResults: NonNullable<OfficialRaceEditionResults["stages"][number]["results"]>;
  },
): Promise<PostRaceInterviewRivalryContext | null> {
  const submitted = await admin
    .from("post_race_interviews")
    .select(INTERVIEW_SELECT)
    .eq("stage_id", stageId)
    .eq("status", "submitted")
    .neq("team_id", currentTeamId)
    .order("submitted_at", { ascending: false })
    .limit(20)
    .returns<SubmittedInterviewRow[]>();

  if (!submitted.error) {
    for (const interview of submitted.data ?? []) {
      const questions = asQuestions(interview.question_set);
      const answers = asAnswers(interview.answers);
      const targeted = questions.find(
        (question) => question.subjectTeamId === currentTeamId,
      );
      const answer = targeted
        ? answers.find((candidate) => candidate.questionId === targeted.id)
        : null;
      if (!targeted || !answer?.answer.trim()) continue;
      const sourceContext = interview.context as PostRaceInterviewContext;
      return {
        kind: "rebound",
        teamId: interview.team_id,
        teamName: sourceContext.teamName,
        directorName: sourceContext.directorName,
        quote: truncateQuote(answer.answer.trim()),
        sourceInterviewId: interview.id,
      };
    }
  }

  const candidates = stageResults
    .filter(
      (result) =>
        result.teamId !== currentTeamId &&
        result.status === "finished" &&
        result.rank !== null,
    )
    .sort((first, second) => (first.rank ?? 999) - (second.rank ?? 999));
  const distinctCandidates = candidates.filter(
    (candidate, index) =>
      candidates.findIndex((other) => other.teamId === candidate.teamId) === index,
  );
  if (distinctCandidates.length === 0) return null;

  const assignments = await admin
    .from("team_manager_assignments")
    .select("team_id, sporting_director_id")
    .in(
      "team_id",
      distinctCandidates.slice(0, 12).map((candidate) => candidate.teamId),
    )
    .eq("role", "general_manager")
    .eq("status", "active")
    .returns<RivalAssignmentRow[]>();
  if (assignments.error || !assignments.data?.length) return null;

  const assignmentByTeam = new Map(
    assignments.data.map((assignment) => [assignment.team_id, assignment]),
  );
  const rival = distinctCandidates.find((candidate) =>
    assignmentByTeam.has(candidate.teamId),
  );
  if (!rival) return null;
  const rivalAssignment = assignmentByTeam.get(rival.teamId)!;
  const director = await admin
    .from("sporting_directors")
    .select("display_name")
    .eq("id", rivalAssignment.sporting_director_id)
    .maybeSingle<{ display_name: string }>();
  if (director.error || !director.data) return null;

  return {
    kind: "opinion",
    teamId: rival.teamId,
    teamName: rival.teamName,
    directorName: director.data.display_name,
    riderName: rival.riderName,
    achievement: rival.rank === 1 ? "winner" : "runner_up",
  };
}

function asQuestions(value: unknown): PostRaceInterviewQuestion[] {
  return Array.isArray(value)
    ? value.filter(
        (question): question is PostRaceInterviewQuestion =>
          typeof question === "object" &&
          question !== null &&
          typeof (question as PostRaceInterviewQuestion).id === "string",
      )
    : [];
}

function asAnswers(value: unknown): PostRaceInterviewAnswer[] {
  return Array.isArray(value)
    ? value.filter(
        (answer): answer is PostRaceInterviewAnswer =>
          typeof answer === "object" &&
          answer !== null &&
          typeof (answer as PostRaceInterviewAnswer).questionId === "string" &&
          typeof (answer as PostRaceInterviewAnswer).answer === "string",
      )
    : [];
}

function truncateQuote(quote: string) {
  if (quote.length <= 260) return quote;
  return `${quote.slice(0, 257).trimEnd()}…`;
}

function sameRivalry(
  current: PostRaceInterviewRivalryContext | null | undefined,
  next: PostRaceInterviewRivalryContext,
) {
  if (!current || current.kind !== next.kind || current.teamId !== next.teamId) {
    return false;
  }
  if (current.kind === "rebound" && next.kind === "rebound") {
    return current.sourceInterviewId === next.sourceInterviewId;
  }
  return current.kind === "opinion" && next.kind === "opinion";
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
