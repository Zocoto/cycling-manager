import type { PublicGameNewsItem } from "@/lib/game/public-game-news";
import type { PostRaceInterviewAnswer } from "@/lib/game/post-race-interview";
import type { CyclogazetteInterviewReactionStates } from "@/lib/game/cyclogazette-interview-reactions";
import type {
  PreRaceAmbition,
  PreRaceIntent,
} from "@/lib/game/pre-race-press";

export type CyclogazettePreRacePressConference = {
  conferenceId: string;
  directorName: string;
  directorAvatarKey: string | null;
  teamId: string;
  teamName: string;
  raceName: string;
  leaderRiderId: string;
  leaderName: string;
  ambition: PreRaceAmbition;
  raceIntent: PreRaceIntent;
  publicStatement: string;
  status: "published" | "settled";
  targetMet: boolean | null;
  leaderFinalRank: number | null;
  reputationDelta: number | null;
};

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
  generalLeaderRiderId?: string | null;
  jerseys: Array<{ label: string; holder: string; riderId?: string }>;
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
  | "rivalry"
  | "federation_race"
  | "event_teaser";

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

export type CyclogazetteNationsCupMovement = {
  countryCode: string;
  countryName: string;
  currentDivision: number;
  projectedDivision: number;
  groupCode: string | null;
  points: number;
  divisionRank: number;
};

export type CyclogazetteNationsCupSpecial = {
  illustrationPath: string;
  winner: {
    countryCode: string;
    countryName: string;
    points: number;
    wins: number;
    podiums: number;
  };
  promotions: CyclogazetteNationsCupMovement[];
  relegations: CyclogazetteNationsCupMovement[];
};

const CYCLING_HOLLOW_TEASER_DATE = "2026-10-04";
export const CYCLING_HOLLOW_TEASER_STORY_ID =
  `event:cycling-hollow:${CYCLING_HOLLOW_TEASER_DATE}`;

const CYCLING_HOLLOW_TEASER_STORY: CyclogazetteFeatureStory = {
  id: CYCLING_HOLLOW_TEASER_STORY_ID,
  kind: "event_teaser",
  kicker: "Témoignages · La route après minuit",
  kickerEn: "Eyewitnesses · The road after midnight",
  title: "La nuit, un étrange cycliste suit le peloton",
  titleEn: "At night, a strange cyclist follows the peloton",
  body: "Trois témoins affirment avoir aperçu, sur une route forestière noyée de brume, un cycliste silencieux lancé sans lumière et sans jamais ralentir. Aucun n’a pu distinguer son visage. Après son passage, des traces de gomme brûlée et une roue marquée d’une lueur orange auraient été retrouvées sur le bas-côté. Dans les vieux carnets du peloton, une légende porte déjà un nom : l’Équipier sans tête. La rédaction n’y croyait pas. Jusqu’à ce soir.",
  bodyEn: "Three witnesses say they spotted a silent cyclist on a forest road drowned in mist, riding without lights and never seeming to slow down. None of them could make out his face. After he passed, scorched tyre marks and a wheel glowing orange were reportedly found by the roadside. In the peloton’s oldest notebooks, the legend already has a name: the Headless Domestique. The newsroom never believed it. Until tonight.",
};

const CYCLING_HOLLOW_TEASER_STORIES: Readonly<Record<string, CyclogazetteFeatureStory>> = {
  [CYCLING_HOLLOW_TEASER_DATE]: CYCLING_HOLLOW_TEASER_STORY,
  "2026-10-05": {
    id: "event:cycling-hollow:2026-10-05",
    kind: "event_teaser",
    kicker: "Légendes du peloton · Le carnet retrouvé",
    kickerEn: "Peloton legends · The recovered notebook",
    title: "L’équipier qui n’est jamais rentré",
    titleEn: "The domestique who never came home",
    body: "Après les témoignages d’hier, la rédaction a ouvert une boîte de vieux carnets. Entre deux feuilles de route, une page raconte un automne oublié : un équipier serait reparti dans la nuit chercher le dernier coureur de son équipe, égaré après un col. On avait retrouvé son bidon au pied d’un panneau, puis son vélo appuyé contre un arbre. De l’homme, aucune trace. Depuis, les anciens prétendent entendre une chaîne tourner lorsque le brouillard descend. Il ne chercherait ni la victoire ni un maillot, mais une roue à suivre pour rentrer enfin. Au bas de la page, une phrase a été soulignée trois fois : « S’il prend votre roue, ne vous retournez pas. » La légende de l’Équipier sans tête vient de trouver son premier chapitre.",
    bodyEn: "After yesterday’s sightings, the newsroom opened a box of old notebooks. Between two route sheets, a page describes a forgotten autumn: a domestique supposedly rode back into the night to find his team’s last rider, lost after a mountain pass. His bottle was found beneath a sign, then his bicycle leaning against a tree. Of the man, no trace. Ever since, old riders claim to hear a chain turning when the mist settles. He is said to seek neither victory nor a jersey, but a wheel to follow home. At the bottom of the page, one sentence is underlined three times: “If he takes your wheel, do not look back.” The legend of the Headless Domestique has found its first chapter.",
  },
  "2026-10-06": {
    id: "event:cycling-hollow:2026-10-06",
    kind: "event_teaser",
    kicker: "Légendes du peloton · L’atelier de nuit",
    kickerEn: "Peloton legends · The midnight workshop",
    title: "Une roue tournait dans l’atelier fermé",
    titleEn: "A wheel was turning in the locked workshop",
    body: "Le carnet retrouvé hier mentionnait un atelier au bord de la forêt. Un ancien mécanicien nous a raconté qu’on y préparait autrefois le vélo de l’équipier disparu : un cadre noir, sans nom, toujours rendu couvert de boue. Cette nuit, assure-t-il, une roue aurait recommencé à tourner sur le pied d’atelier alors que la porte était verrouillée et qu’aucun souffle n’entrait. Ses rayons portaient de petites marques rouges ; au sol, une traînée orange menait jusqu’au seuil. Une farce de fin de saison ? Le mécanicien le voudrait bien. Il a pourtant remis son vieux tablier, fermé les volets et laissé une lampe allumée. « Quand il revient, dit-il, mieux vaut avoir réparé ses freins. » Dans la marge du carnet, quelqu’un a ajouté un nom : Cycling Hollow.",
    bodyEn: "Yesterday’s notebook mentioned a workshop beside the forest. A retired mechanic told us it once serviced the missing domestique’s bicycle: a nameless black frame, always returned covered in mud. Last night, he claims, a wheel started turning on the repair stand although the door was locked and there was no breeze. Small red marks covered its spokes; an orange trail ran across the floor to the threshold. An end-of-season prank? The mechanic hopes so. Still, he put on his old apron, closed the shutters and left a lamp burning. “When he returns,” he says, “you had better have fixed your brakes.” Someone has added a name in the notebook’s margin: Cycling Hollow.",
  },
  "2026-10-07": {
    id: "event:cycling-hollow:2026-10-07",
    kind: "event_teaser",
    kicker: "Légendes du peloton · Le dernier témoin",
    kickerEn: "Peloton legends · The last witness",
    title: "Il avait une citrouille pour visage",
    titleEn: "He had a pumpkin for a face",
    body: "Un témoin s’est présenté avec un détail que les vieux carnets ne donnaient pas. Sur la route de Cycling Hollow, il aurait d’abord vu deux reflets rouges au ras du sol, puis un cycliste dont le visage brillait comme une citrouille évidée. Le poursuivant ne parlait pas. Il accélérait chaque fois que la route se resserrait. Le témoin raconte avoir franchi une pierre tombée, baissé la tête sous une branche et aperçu de petites roues noires et rouges dans la poussière. Une vieille barrière lui aurait offert assez d’avance pour retrouver la lumière du village. Son récit est impossible à vérifier. Mais il rejoint une annotation découverte ce matin : « La nuit n’appartient pas au plus fort. Elle appartient à celui qui garde son sang-froid. » À deux jours de la saison 4, la légende se rapproche du peloton.",
    bodyEn: "A witness has come forward with a detail missing from the old notebooks. On the road to Cycling Hollow, he first saw two red reflections close to the ground, then a cyclist whose face glowed like a carved pumpkin. The pursuer never spoke. He accelerated whenever the road narrowed. The witness describes jumping a fallen stone, ducking beneath a branch and spotting little black-and-red wheels in the dust. An old barrier supposedly gave him enough of a lead to reach the village lights. His account cannot be verified. But it echoes a note found this morning: “The night does not belong to the strongest. It belongs to whoever keeps a cool head.” With season four two days away, the legend is closing on the peloton.",
  },
  "2026-10-08": {
    id: "event:cycling-hollow:2026-10-08",
    kind: "event_teaser",
    kicker: "Légendes du peloton · La veille du retour",
    kickerEn: "Peloton legends · The eve of his return",
    title: "À minuit, ne prenez pas sa roue",
    titleEn: "At midnight, do not take his wheel",
    body: "La dernière page du carnet n’indique ni un vainqueur ni un temps. Seulement une heure : minuit, lorsque commence la nouvelle saison. À Cycling Hollow, les volets se ferment déjà. Près de l’atelier, un enfant en tenue de cycliste présenterait deux bonbons aux passants ; derrière lui, une boutique prépare des trésors que l’on paie avec d’étranges roues rouges et noires. Quant à l’équipier disparu, personne ne prétend plus savoir s’il cherche encore son compagnon ou s’il entraîne désormais les autres dans sa nuit. Sa chaîne, elle, recommence à tourner. Le rendez-vous d’Halloween est prévu à J1 de la saison 4 : Cycling Hollow, la légende de l’Équipier sans tête. La rédaction a posé son carnet. Cette fois, ce sera à vous de raconter jusqu’où vous avez réussi à lui échapper.",
    bodyEn: "The notebook’s final page names neither a winner nor a time. Just an hour: midnight, as the new season begins. In Cycling Hollow, the shutters are already closing. Beside the workshop, a child dressed as a cyclist is said to offer passers-by two sweets; behind him, a shop prepares treasures bought with strange red-and-black wheels. As for the missing domestique, nobody claims to know whether he still seeks his companion or now draws others into his night. His chain is turning again. Halloween is planned for day one of season four: Cycling Hollow, the legend of the Headless Domestique. The newsroom has put down its notebook. This time, you will tell us how far you managed to escape him.",
  },
};

export function getCyclingHollowTeaserStory(calendarDate: string) {
  return Object.hasOwn(CYCLING_HOLLOW_TEASER_STORIES, calendarDate)
    ? CYCLING_HOLLOW_TEASER_STORIES[calendarDate]
    : null;
}

export function includeCyclingHollowTeaserStory(
  stories: readonly CyclogazetteFeatureStory[],
  calendarDate: string,
  options: { includeScheduled?: boolean } = {},
) {
  // An archived issue keeps its published episode and wording, never today's.
  const existing = stories.find((story) =>
    Object.values(CYCLING_HOLLOW_TEASER_STORIES).some(
      (episode) => episode.id === story.id,
    ),
  );
  if (existing) {
    let kept = false;
    return stories.filter((story) => {
      if (story.id !== existing.id) return true;
      if (kept) return false;
      kept = true;
      return true;
    });
  }
  const episode = options.includeScheduled === false
    ? null
    : getCyclingHollowTeaserStory(calendarDate);
  if (!episode) return [...stories];
  // Reserve one secondary feature, preserving the main sporting dossier.
  return [
    ...stories.slice(0, 1),
    episode,
    ...stories.slice(1),
  ].slice(0, 6);
}

export type CyclogazetteContent = {
  lead: PublicGameNewsItem | null;
  raceStories: PublicGameNewsItem[];
  raceHighlights: PublicGameNewsItem[];
  mercatoStories: PublicGameNewsItem[];
  reactions: CyclogazetteReaction[];
  preRacePressConferences?: CyclogazettePreRacePressConference[];
  tourSummaries?: CyclogazetteTourSummary[];
  mediaArticles?: CyclogazetteMediaArticle[];
  featureStories?: CyclogazetteFeatureStory[];
  nationsCupSpecial?: CyclogazetteNationsCupSpecial;
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
