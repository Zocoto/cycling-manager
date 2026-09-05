import type { PublicGameNewsItem } from "@/lib/game/public-game-news";
import type { PostRaceInterviewAnswer } from "@/lib/game/post-race-interview";
import type { CyclogazetteInterviewReactionStates } from "@/lib/game/cyclogazette-interview-reactions";

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
  excerptQuestionId?: string;
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

export type CyclogazetteTourStageCandidate = {
  raceEditionId: string;
  stageNumber: number;
  daySlot: "early" | "late";
};

export type CyclogazetteCommunity = {
  likeCount: number;
  likedByViewer: boolean;
  interviewReactions: CyclogazetteInterviewReactionStates;
  comments: Array<{
    id: string;
    directorName: string;
    message: string;
    createdAt: string;
  }>;
};

export type CyclogazetteMediaArticle = {
  id: string;
  title: string;
  body: string;
  teamName: string;
  sponsorName: string | null;
  buildingLevel: number;
};

export type CyclogazetteFeatureKind =
  | "startlist"
  | "development"
  | "transfer_rumor"
  | "injury"
  | "rivalry";

export type CyclogazetteFeatureStory = {
  id: string;
  kind: CyclogazetteFeatureKind;
  kicker: string;
  kickerEn: string;
  title: string;
  titleEn: string;
  body: string;
  bodyEn: string;
  href?: string;
};

export type CyclogazetteContent = {
  lead: PublicGameNewsItem | null;
  raceStories: PublicGameNewsItem[];
  raceHighlights: PublicGameNewsItem[];
  mercatoStories: PublicGameNewsItem[];
  reactions: CyclogazetteReaction[];
  tourSummaries?: CyclogazetteTourSummary[];
  mediaArticles?: CyclogazetteMediaArticle[];
  featureStories?: CyclogazetteFeatureStory[];
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

const ITALIAN_GRAND_TOUR_GAZETTE_START_DAY = 2;
const ITALIAN_GRAND_TOUR_GAZETTE_END_DAY = 7;
const FRENCH_GRAND_TOUR_GAZETTE_START_DAY = 9;
const FRENCH_GRAND_TOUR_GAZETTE_END_DAY = 15;
const SPANISH_GRAND_TOUR_GAZETTE_START_DAY = 17;
const SPANISH_GRAND_TOUR_GAZETTE_END_DAY = 22;

export function isItalianGrandTourGazetteDay(dayNumber: number) {
  return (
    Number.isInteger(dayNumber) &&
    dayNumber >= ITALIAN_GRAND_TOUR_GAZETTE_START_DAY &&
    dayNumber <= ITALIAN_GRAND_TOUR_GAZETTE_END_DAY
  );
}

export function isFrenchGrandTourGazetteDay(dayNumber: number) {
  return (
    Number.isInteger(dayNumber) &&
    dayNumber >= FRENCH_GRAND_TOUR_GAZETTE_START_DAY &&
    dayNumber <= FRENCH_GRAND_TOUR_GAZETTE_END_DAY
  );
}

export function isSpanishGrandTourGazetteDay(dayNumber: number) {
  return (
    Number.isInteger(dayNumber) &&
    dayNumber >= SPANISH_GRAND_TOUR_GAZETTE_START_DAY &&
    dayNumber <= SPANISH_GRAND_TOUR_GAZETTE_END_DAY
  );
}

export function sortCyclogazetteStoriesByPrestige<
  T extends Pick<PublicGameNewsItem, "happenedAt" | "prestigeRank">,
>(stories: readonly T[]) {
  return [...stories].sort(
    (left, right) =>
      (left.prestigeRank ?? Number.MAX_SAFE_INTEGER) -
        (right.prestigeRank ?? Number.MAX_SAFE_INTEGER) ||
      new Date(right.happenedAt).getTime() -
        new Date(left.happenedAt).getTime(),
  );
}

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

const MOJIBAKE_PATTERN = /Ã|Â|â€|�/u;
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });
const WINDOWS_1252_BYTES: Readonly<Record<string, number>> = {
  "€": 0x80,
  "‚": 0x82,
  ƒ: 0x83,
  "„": 0x84,
  "…": 0x85,
  "†": 0x86,
  "‡": 0x87,
  ˆ: 0x88,
  "‰": 0x89,
  Š: 0x8a,
  "‹": 0x8b,
  Œ: 0x8c,
  Ž: 0x8e,
  "‘": 0x91,
  "’": 0x92,
  "“": 0x93,
  "”": 0x94,
  "•": 0x95,
  "–": 0x96,
  "—": 0x97,
  "˜": 0x98,
  "™": 0x99,
  š: 0x9a,
  "›": 0x9b,
  œ: 0x9c,
  ž: 0x9e,
  Ÿ: 0x9f,
};

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
  const hour = PARIS_HOUR_FORMATTER.formatToParts(date).find(
    ({ type }) => type === "hour",
  )?.value;
  return Number(hour);
}

export function formatCyclogazetteStageLabel(
  raceName: string,
  stageName: string,
) {
  const normalizedRace = raceName.trim();
  const normalizedStage = stageName.trim();
  if (!normalizedStage || normalizedStage === normalizedRace)
    return normalizedRace;
  return `${normalizedRace} — ${normalizedStage}`;
}

export function repairCyclogazetteText(value: string) {
  if (!MOJIBAKE_PATTERN.test(value)) return value;

  const repairedValue = repairMojibakeSegment(value);
  if (repairedValue !== value) return repairedValue;

  return value.replace(/[^\x20\t\r\n]+/gu, (segment) =>
    MOJIBAKE_PATTERN.test(segment) ? repairMojibakeSegment(segment) : segment,
  );
}

export function repairCyclogazetteValue<T>(value: T): T {
  if (typeof value === "string") {
    return repairCyclogazetteText(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => repairCyclogazetteValue(item)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        repairCyclogazetteValue(item),
      ]),
    ) as T;
  }
  return value;
}

export function selectLatestCyclogazetteEveningStages<
  T extends CyclogazetteTourStageCandidate,
>(stages: readonly T[]) {
  const latestStageByEdition = new Map<string, T>();

  for (const stage of stages) {
    if (stage.daySlot !== "late") continue;
    const current = latestStageByEdition.get(stage.raceEditionId);
    if (!current || stage.stageNumber > current.stageNumber) {
      latestStageByEdition.set(stage.raceEditionId, stage);
    }
  }

  return [...latestStageByEdition.values()];
}

export function selectLatestCyclogazetteTourSummaries(
  summaries: readonly CyclogazetteTourSummary[],
) {
  const latestSummaryByRace = new Map<string, CyclogazetteTourSummary>();

  for (const summary of summaries) {
    const current = latestSummaryByRace.get(summary.raceName);
    if (
      !current ||
      getTourSummaryStageNumber(summary) > getTourSummaryStageNumber(current)
    ) {
      latestSummaryByRace.set(summary.raceName, summary);
    }
  }

  return [...latestSummaryByRace.values()];
}

function repairMojibakeSegment(value: string) {
  let current = value;

  for (
    let attempt = 0;
    attempt < 6 && MOJIBAKE_PATTERN.test(current);
    attempt += 1
  ) {
    const decoded = decodeWindows1252AsUtf8(current);
    if (!decoded || decoded === current) break;
    current = decoded;
  }

  return current;
}

function decodeWindows1252AsUtf8(value: string) {
  const bytes: number[] = [];

  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined) return null;
    if (codePoint <= 0xff) {
      bytes.push(codePoint);
      continue;
    }
    const windows1252Byte = WINDOWS_1252_BYTES[character];
    if (windows1252Byte === undefined) return null;
    bytes.push(windows1252Byte);
  }

  try {
    return UTF8_DECODER.decode(Uint8Array.from(bytes));
  } catch {
    return null;
  }
}

function getTourSummaryStageNumber(summary: CyclogazetteTourSummary) {
  const hrefStageNumber = summary.href.match(/\/(\d+)(?:[/?#]|$)/u)?.[1];
  const labelStageNumber = summary.stageLabel.match(
    /(?:étape|stage)\s+(\d+)/iu,
  )?.[1];
  return Number(hrefStageNumber ?? labelStageNumber ?? 0);
}
