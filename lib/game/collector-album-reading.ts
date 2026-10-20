import { ALBUM_PROFILES, albumPilotStorageKey, type AlbumProfile, type CollectorCard } from "./collector-album";

/** Reading preferences/history live beside, never inside, the demo card inventory. */
export type AlbumReadingState = {
  version: 1;
  lastProfile: AlbumProfile | null;
  wanted: number[];
  completedChapters: Partial<Record<AlbumProfile, string>>;
  completedAt: string | null;
};

export type AlbumReadingAction =
  | { type: "profile"; profile: AlbumProfile | null }
  | { type: "wanted"; card: number }
  | { type: "observe-completion"; cards: readonly CollectorCard[]; pasted: readonly number[]; at: string };

export type NextAlbumChapter = {
  profile: AlbumProfile;
  missing: number;
  total: number;
  pasted: number;
};

const MAX_READING_BYTES = 16000;
const READING_KEYS = ["version", "lastProfile", "wanted", "completedChapters", "completedAt"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isProfile(value: unknown): value is AlbumProfile {
  return ALBUM_PROFILES.some(profile => profile.id === value);
}

/** Strict UTC instants: Date.parse alone silently normalises invalid dates. */
function isIsoInstant(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

export function createAlbumReadingState(): AlbumReadingState {
  return { version: 1, lastProfile: null, wanted: [], completedChapters: {}, completedAt: null };
}

export function albumReadingStorageKey(userId: string, edition: string): string {
  return `${albumPilotStorageKey(userId, edition)}:reading-v1`;
}

/** Invalid or oversized storage cannot alter inventory or invent completion dates. */
export function readAlbumReadingState(raw: string | null, cards: readonly CollectorCard[]): AlbumReadingState {
  const initial = createAlbumReadingState();
  if (!raw || raw.length > MAX_READING_BYTES) return initial;
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || Object.keys(value).length !== READING_KEYS.length || READING_KEYS.some(key => !Object.hasOwn(value, key))) return initial;
    if (value.version !== 1 || (value.lastProfile !== null && !isProfile(value.lastProfile))) return initial;
    const knownCards = new Set(cards.map(card => card.number));
    if (!Array.isArray(value.wanted) || value.wanted.length > knownCards.size || new Set(value.wanted).size !== value.wanted.length || value.wanted.some(number => !Number.isSafeInteger(number) || !knownCards.has(number))) return initial;
    if (!isRecord(value.completedChapters) || Object.keys(value.completedChapters).length > ALBUM_PROFILES.length) return initial;
    const completedChapters: AlbumReadingState["completedChapters"] = {};
    for (const [profile, at] of Object.entries(value.completedChapters)) {
      if (!isProfile(profile) || !cards.some(card => card.profileKey === profile) || !isIsoInstant(at)) return initial;
      completedChapters[profile] = at;
    }
    const completedAt = value.completedAt;
    if (completedAt !== null) {
      if (!isIsoInstant(completedAt) || cards.length === 0) return initial;
      const profiles = new Set(cards.map(card => card.profileKey));
      if ([...profiles].some(profile => !completedChapters[profile]) || Object.values(completedChapters).some(at => at > completedAt)) return initial;
    }
    return { version: 1, lastProfile: value.lastProfile, wanted: [...value.wanted], completedChapters, completedAt };
  } catch {
    return initial;
  }
}

/** Closest nonempty unfinished chapter; stable ties retain the printed order. */
export function getNextAlbumChapter(cards: readonly CollectorCard[], pasted: readonly number[]): NextAlbumChapter | null {
  const pastedNumbers = new Set(pasted);
  let next: NextAlbumChapter | null = null;
  for (const profile of ALBUM_PROFILES) {
    const numbers = new Set(cards.filter(card => card.profileKey === profile.id).map(card => card.number));
    const total = numbers.size;
    const count = [...numbers].filter(number => pastedNumbers.has(number)).length;
    const chapter: NextAlbumChapter = { profile: profile.id, missing: total - count, total, pasted: count };
    if (chapter.missing === 0) continue;
    if (!next || chapter.missing < next.missing || (chapter.missing === next.missing && chapter.pasted * next.total > next.pasted * chapter.total)) next = chapter;
  }
  return next;
}

export function updateAlbumReading(state: AlbumReadingState, action: AlbumReadingAction, cards: readonly CollectorCard[] = []): AlbumReadingState {
  if (action.type === "profile") {
    if ((action.profile !== null && !isProfile(action.profile)) || state.lastProfile === action.profile) return state;
    return { ...state, lastProfile: action.profile };
  }
  if (action.type === "wanted") {
    if (!Number.isSafeInteger(action.card) || !cards.some(card => card.number === action.card)) return state;
    return { ...state, wanted: state.wanted.includes(action.card) ? state.wanted.filter(number => number !== action.card) : [...state.wanted, action.card] };
  }
  if (action.type !== "observe-completion" || !isIsoInstant(action.at) || action.cards.length === 0) return state;
  // The caller supplies the actual observation time. Never backdate a new stamp
  // before history, or manufacture one while loading a previous local save.
  const previousDates = [...Object.values(state.completedChapters), ...(state.completedAt ? [state.completedAt] : [])];
  if (previousDates.some(at => at > action.at)) return state;
  const pasted = new Set(action.pasted);
  const completedChapters = { ...state.completedChapters };
  let changed = false;
  for (const profile of ALBUM_PROFILES) {
    const chapter = action.cards.filter(card => card.profileKey === profile.id);
    if (chapter.length > 0 && !completedChapters[profile.id] && chapter.every(card => pasted.has(card.number))) {
      completedChapters[profile.id] = action.at;
      changed = true;
    }
  }
  const completedAt = state.completedAt ?? (action.cards.every(card => pasted.has(card.number)) ? action.at : null);
  if (!changed && completedAt === state.completedAt) return state;
  return { ...state, completedChapters, completedAt };
}
