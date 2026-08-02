import "server-only";

import {
  getParisDateKey,
  getParisHour,
  type CyclogazetteArchiveSeason,
  type CyclogazetteContent,
  type CyclogazetteEdition,
  type CyclogazetteReaction,
} from "@/lib/game/cyclogazette";
import type {
  PostRaceInterviewAnswer,
  PostRaceInterviewContext,
} from "@/lib/game/post-race-interview";
import type { PublicGameNewsItem } from "@/lib/game/public-game-news";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCyclogazetteNewsItems } from "@/services/public-game-news";

type SeasonRow = {
  id: string;
  name: string;
  game_year: number;
  current_day_number: number | null;
};

type SeasonDayRow = {
  id: string;
  day_number: number;
  calendar_date: string;
};

type InterviewRow = {
  id: string;
  sporting_director_id: string;
  context: unknown;
  answers: unknown;
  closing_note: string | null;
  submitted_at: string | null;
};

type GazetteRow = {
  id: string;
  season_id: string;
  issue_number: number;
  title: string;
  subtitle: string;
  issue_date: string;
  content: unknown;
  published_at: string;
  season_days: { day_number: number } | null;
};

type GazetteArchiveRow = {
  id: string;
  season_id: string;
  issue_number: number;
  subtitle: string;
  issue_date: string;
  published_at: string;
  season_days: { day_number: number } | null;
};

type ArchiveSeasonRow = Pick<SeasonRow, "id" | "name" | "game_year">;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CyclogazettePublicationResult = {
  status: "published" | "already-published" | "skipped";
  reason?: string;
  edition: CyclogazetteEdition | null;
};

export async function publishCyclogazetteEdition(
  now = new Date(),
  options: { force?: boolean } = {},
): Promise<CyclogazettePublicationResult> {
  if (!options.force && getParisHour(now) !== 20) {
    return {
      status: "skipped",
      reason: "La rédaction publie uniquement à 20 h, heure de Paris.",
      edition: null,
    };
  }

  const admin = createSupabaseAdminClient();
  const seasonResult = await admin
    .from("seasons")
    .select("id, name, game_year, current_day_number")
    .eq("status", "active")
    .maybeSingle<SeasonRow>();

  if (seasonResult.error || !seasonResult.data) {
    return { status: "skipped", reason: "Aucune saison active.", edition: null };
  }

  const season = seasonResult.data;
  const dayNumber = season.current_day_number ?? 1;
  const dayResult = await admin
    .from("season_days")
    .select("id, day_number, calendar_date")
    .eq("season_id", season.id)
    .eq("day_number", dayNumber)
    .maybeSingle<SeasonDayRow>();

  if (dayResult.error || !dayResult.data) {
    return { status: "skipped", reason: "Journée de saison introuvable.", edition: null };
  }
  const seasonDay = dayResult.data;

  const existing = await admin
    .from("cyclogazette_editions")
    .select("id, season_id, issue_number, title, subtitle, issue_date, content, published_at, season_days(day_number)")
    .eq("season_day_id", seasonDay.id)
    .maybeSingle<GazetteRow>();

  if (existing.error) {
    throw new Error(`Impossible de consulter La Cyclogazette : ${existing.error.message}`);
  }
  if (existing.data) {
    return {
      status: "already-published",
      edition: mapGazetteEdition(existing.data, season.name),
    };
  }

  const [allNews, reactions] = await Promise.all([
    getCyclogazetteNewsItems(),
    loadDailyReactions(seasonDay.calendar_date),
  ]);
  const dailyNews = allNews.filter(
    (item) => getParisDateKey(item.happenedAt) === seasonDay.calendar_date,
  );
  const victories = deduplicateStories(
    dailyNews.filter((item) => item.kind === "victory"),
  ).slice(0, 6);
  const raceNews = deduplicateStories(
    dailyNews.filter((item) => item.kind === "race_recap"),
  ).slice(0, 12);
  const raceHighlights = raceNews
    .filter(
      (item) =>
        item.raceEventKind === "breakaway" ||
        item.raceEventKind === "incident",
    )
    .slice(0, 8);
  const raceClassifications = raceNews.filter(
    (item) => !raceHighlights.some((highlight) => highlight.id === item.id),
  );
  const mercatoStories = dailyNews
    .filter((item) => item.kind !== "race_recap" && item.kind !== "victory")
    .slice(0, 8);
  const lead =
    victories[0] ??
    raceClassifications[0] ??
    raceHighlights[0] ??
    mercatoStories[0] ??
    null;
  const content: CyclogazetteContent = {
    lead,
    raceStories: [...victories.slice(1), ...raceClassifications].filter(
      (item) => item.id !== lead?.id,
    ),
    raceHighlights: raceHighlights.filter((item) => item.id !== lead?.id),
    mercatoStories: mercatoStories.filter((item) => item.id !== lead?.id),
    reactions,
  };
  const publishedAt = now.toISOString();
  const issueNumber = Math.max(1, (season.game_year - 1) * 28 + dayNumber);
  const subtitle = createSubtitle(content, dayNumber);

  const inserted = await admin
    .from("cyclogazette_editions")
    .insert({
      season_id: season.id,
      season_day_id: seasonDay.id,
      issue_number: issueNumber,
      title: "La Cyclogazette",
      subtitle,
      issue_date: seasonDay.calendar_date,
      content,
      published_at: publishedAt,
      updated_at: publishedAt,
    })
    .select("id, season_id, issue_number, title, subtitle, issue_date, content, published_at, season_days(day_number)")
    .single<GazetteRow>();

  if (inserted.error || !inserted.data) {
    throw new Error(`Impossible de publier La Cyclogazette : ${inserted.error?.message ?? "erreur inconnue"}`);
  }

  return {
    status: "published",
    edition: mapGazetteEdition(inserted.data, season.name),
  };
}

export async function getLatestCyclogazetteEdition(
  now = new Date(),
): Promise<CyclogazetteEdition | null> {
  if (getParisHour(now) >= 20) {
    await publishCyclogazetteEdition(now, { force: true }).catch((error: unknown) => {
      console.error("Publication de rattrapage de La Cyclogazette impossible :", error);
    });
  }

  const admin = createSupabaseAdminClient();
  const result = await admin
    .from("cyclogazette_editions")
    .select("id, season_id, issue_number, title, subtitle, issue_date, content, published_at, season_days(day_number)")
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle<GazetteRow>();

  if (result.error || !result.data) return null;
  const seasonResult = await admin
    .from("seasons")
    .select("name")
    .eq("id", result.data.season_id)
    .maybeSingle<{ name: string }>();
  return mapGazetteEdition(result.data, seasonResult.data?.name ?? "Saison en cours");
}

export async function getCyclogazetteEditionById(
  editionId: string,
): Promise<CyclogazetteEdition | null> {
  if (!UUID_PATTERN.test(editionId)) return null;

  const admin = createSupabaseAdminClient();
  const result = await admin
    .from("cyclogazette_editions")
    .select("id, season_id, issue_number, title, subtitle, issue_date, content, published_at, season_days(day_number)")
    .eq("id", editionId)
    .maybeSingle<GazetteRow>();

  if (result.error || !result.data) return null;
  const seasonResult = await admin
    .from("seasons")
    .select("name")
    .eq("id", result.data.season_id)
    .maybeSingle<{ name: string }>();

  return mapGazetteEdition(
    result.data,
    seasonResult.data?.name ?? "Saison archivée",
  );
}

export async function getCyclogazetteArchive(): Promise<
  CyclogazetteArchiveSeason[]
> {
  const admin = createSupabaseAdminClient();
  const editionsResult = await admin
    .from("cyclogazette_editions")
    .select("id, season_id, issue_number, subtitle, issue_date, published_at, season_days(day_number)")
    .order("published_at", { ascending: false })
    .returns<GazetteArchiveRow[]>();

  if (editionsResult.error || !editionsResult.data?.length) return [];

  const seasonIds = [
    ...new Set(editionsResult.data.map((edition) => edition.season_id)),
  ];
  const seasonsResult = await admin
    .from("seasons")
    .select("id, name, game_year")
    .in("id", seasonIds)
    .returns<ArchiveSeasonRow[]>();
  const seasonById = new Map(
    (seasonsResult.data ?? []).map((season) => [season.id, season]),
  );
  const archiveBySeasonId = new Map<string, CyclogazetteArchiveSeason>();

  for (const edition of editionsResult.data) {
    const season = seasonById.get(edition.season_id);
    const archiveSeason = archiveBySeasonId.get(edition.season_id) ?? {
      seasonId: edition.season_id,
      seasonName: season?.name ?? "Saison archivée",
      gameYear: season?.game_year ?? 0,
      editions: [],
    };
    archiveSeason.editions.push({
      id: edition.id,
      issueNumber: edition.issue_number,
      seasonName: archiveSeason.seasonName,
      dayNumber: edition.season_days?.day_number ?? 1,
      issueDate: edition.issue_date,
      subtitle: edition.subtitle,
      publishedAt: edition.published_at,
    });
    archiveBySeasonId.set(edition.season_id, archiveSeason);
  }

  return [...archiveBySeasonId.values()].sort(
    (first, second) =>
      second.gameYear - first.gameYear ||
      second.seasonName.localeCompare(first.seasonName, "fr"),
  );
}

async function loadDailyReactions(issueDate: string): Promise<CyclogazetteReaction[]> {
  const admin = createSupabaseAdminClient();
  const result = await admin
    .from("post_race_interviews")
    .select("id, sporting_director_id, context, answers, closing_note, submitted_at")
    .eq("status", "submitted")
    .order("submitted_at", { ascending: false })
    .limit(120)
    .returns<InterviewRow[]>();

  if (result.error) return [];
  const reactions: CyclogazetteReaction[] = [];
  const representedDirectors = new Set<string>();

  for (const row of result.data ?? []) {
    if (
      !row.submitted_at ||
      getParisDateKey(row.submitted_at) !== issueDate ||
      representedDirectors.has(row.sporting_director_id)
    ) {
      continue;
    }

    const context = row.context as PostRaceInterviewContext;
    const answers = (row.answers as PostRaceInterviewAnswer[]).filter(
      (answer) => Boolean(answer?.answer?.trim()),
    );
    const excerpt = selectReactionExcerpt(answers);
    if (!context || !excerpt) continue;

    representedDirectors.add(row.sporting_director_id);
    reactions.push({
      interviewId: row.id,
      directorName: context.directorName,
      directorAvatarKey: context.directorAvatarKey,
      teamId: context.teamId,
      teamName: context.teamName,
      raceName: context.raceName,
      stageName: context.stageName,
      question: excerpt.question,
      answer: excerpt.answer,
      closingNote: row.closing_note,
      answers,
    });
  }

  return reactions;
}

function deduplicateStories(items: PublicGameNewsItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key =
      item.kind === "race_recap"
        ? item.id
        : `${item.href ?? item.title}:${item.kind}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function createSubtitle(content: CyclogazetteContent, dayNumber: number) {
  if (content.lead?.kind === "victory" || content.lead?.kind === "race_recap") {
    return content.lead.title;
  }
  if (content.mercatoStories.length > 0) return "Le mercato anime le peloton";
  if (content.reactions.length > 0) return "Les directeurs sportifs prennent la parole";
  return `L’essentiel du peloton au jour ${dayNumber}`;
}

function selectReactionExcerpt(answers: PostRaceInterviewAnswer[]) {
  return (
    answers.find(
      (answer) =>
        answer.questionId.startsWith("rebound-") ||
        answer.questionId.startsWith("rivalry-"),
    ) ?? answers[0]
  );
}

function mapGazetteEdition(row: GazetteRow, seasonName: string): CyclogazetteEdition {
  return {
    id: row.id,
    issueNumber: row.issue_number,
    seasonName,
    dayNumber: row.season_days?.day_number ?? 1,
    issueDate: row.issue_date,
    title: row.title,
    subtitle: row.subtitle,
    publishedAt: row.published_at,
    content: normalizeGazetteContent(row.content),
  };
}

function normalizeGazetteContent(value: unknown): CyclogazetteContent {
  const content = (value ?? {}) as Partial<CyclogazetteContent>;
  const raceStories = Array.isArray(content.raceStories)
    ? content.raceStories
    : [];
  const raceHighlights = Array.isArray(content.raceHighlights)
    ? content.raceHighlights
    : [];
  const reactions = Array.isArray(content.reactions)
    ? content.reactions.map((reaction) => ({
        ...reaction,
        answers:
          Array.isArray(reaction.answers) && reaction.answers.length > 0
            ? reaction.answers
            : [
                {
                  questionId: `archive:${reaction.interviewId}`,
                  question: reaction.question,
                  answer: reaction.answer,
                },
              ],
      }))
    : [];

  return {
    lead: content.lead ?? null,
    raceStories,
    raceHighlights,
    mercatoStories: Array.isArray(content.mercatoStories)
      ? content.mercatoStories
      : [],
    reactions,
  };
}
