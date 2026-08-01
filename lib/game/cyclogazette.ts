import type { PublicGameNewsItem } from "@/lib/game/public-game-news";

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
};

export type CyclogazetteContent = {
  lead: PublicGameNewsItem | null;
  raceStories: PublicGameNewsItem[];
  mercatoStories: PublicGameNewsItem[];
  reactions: CyclogazetteReaction[];
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
