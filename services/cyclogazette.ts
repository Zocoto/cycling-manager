import "server-only";

import {
  getParisDateKey,
  getParisHour,
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
  const raceStories = deduplicateStories(
    dailyNews.filter((item) => item.kind === "race_recap" || item.kind === "victory"),
  ).slice(0, 6);
  const mercatoStories = dailyNews
    .filter((item) => item.kind !== "race_recap" && item.kind !== "victory")
    .slice(0, 8);
  const lead = raceStories[0] ?? mercatoStories[0] ?? null;
  const content: CyclogazetteContent = {
    lead,
    raceStories: raceStories.filter((item) => item.id !== lead?.id),
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

async function loadDailyReactions(issueDate: string): Promise<CyclogazetteReaction[]> {
  const admin = createSupabaseAdminClient();
  const result = await admin
    .from("post_race_interviews")
    .select("id, context, answers, closing_note, submitted_at")
    .eq("status", "submitted")
    .order("submitted_at", { ascending: false })
    .limit(60)
    .returns<InterviewRow[]>();

  if (result.error) return [];
  return (result.data ?? [])
    .filter((row) => row.submitted_at && getParisDateKey(row.submitted_at) === issueDate)
    .flatMap((row) => {
      const context = row.context as PostRaceInterviewContext;
      const answer = (row.answers as PostRaceInterviewAnswer[])[0];
      if (!context || !answer?.answer) return [];
      return [{
        interviewId: row.id,
        directorName: context.directorName,
        directorAvatarKey: context.directorAvatarKey,
        teamId: context.teamId,
        teamName: context.teamName,
        raceName: context.raceName,
        stageName: context.stageName,
        question: answer.question,
        answer: answer.answer,
        closingNote: row.closing_note,
      }];
    })
    .slice(0, 6);
}

function deduplicateStories(items: PublicGameNewsItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.href ?? item.title}:${item.kind}`;
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
    content: row.content as CyclogazetteContent,
  };
}
