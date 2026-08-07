import type { PublicGameNewsItem } from "@/lib/game/public-game-news";
import type { PostRaceInterviewAnswer } from "@/lib/game/post-race-interview";

export type CyclogazetteReaction = {
  interviewId: string;
  directorName: string;
  directorAvatarKey: string | null;
  teamId: string;
  teamName: string;
  raceName: string;
  stageName: string;
  question: string;
  answer: string;
  closingNote: string | null;
  answers: PostRaceInterviewAnswer[];
  isEditorial?: boolean;
};

export type CyclogazetteTourSummary = {
  raceName: string;
  stageLabel: string;
  href: string;
  generalLeader: string | null;
  jerseys: Array<{ label: string; holder: string }>;
};

export type CyclogazetteCommunity = {
  likeCount: number;
  likedByViewer: boolean;
  comments: Array<{ id: string; directorName: string; message: string; createdAt: string }>;
};

export type CyclogazetteContent = {
  lead: PublicGameNewsItem | null;
  raceStories: PublicGameNewsItem[];
  raceHighlights: PublicGameNewsItem[];
  mercatoStories: PublicGameNewsItem[];
  reactions: CyclogazetteReaction[];
  tourSummaries?: CyclogazetteTourSummary[];
};

export type CyclogazetteEdition = {
  id: string;
  issueNumber: number;
  seasonName: string;
  dayNumber: number;
  issueDate: string;
  title: string;
  subtitle: string;
  publishedAt: string;
  content: CyclogazetteContent;
};

export type CyclogazetteArchiveEntry = {
  id: string;
  issueNumber: number;
  seasonName: string;
  dayNumber: number;
  issueDate: string;
  subtitle: string;
  publishedAt: string;
};

export type CyclogazetteArchiveSeason = {
  seasonId: string;
  seasonName: string;
  gameYear: number;
  editions: CyclogazetteArchiveEntry[];
};

const PARIS_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const PARIS_HOUR_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  hour: "2-digit",
  hourCycle: "h23",
});

export function getParisDateKey(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = PARIS_DATE_FORMATTER.formatToParts(date);
  const year = parts.find(({ type }) => type === "year")?.value;
  const month = parts.find(({ type }) => type === "month")?.value;
  const day = parts.find(({ type }) => type === "day")?.value;
  return `${year}-${month}-${day}`;
}

export function getParisHour(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const hour = PARIS_HOUR_FORMATTER.formatToParts(date).find(({ type }) => type === "hour")?.value;
  return Number(hour);
}

export function formatCyclogazetteStageLabel(raceName: string, stageName: string) {
  const normalizedRace = raceName.trim();
  const normalizedStage = stageName.trim();
  if (!normalizedStage || normalizedStage === normalizedRace) return normalizedRace;
  return `${normalizedRace} ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ${normalizedStage}`;
}
