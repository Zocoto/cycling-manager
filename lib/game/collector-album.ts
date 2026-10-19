import type { RiderRatings } from "@/lib/game/rider-profile";
import type { RiderJerseyAppearance } from "@/lib/rider-jersey";

export const ALBUM_PROFILES = [
  { id: "tours", label: "Coureurs de tour", subtitle: "L’art de durer", symbol: "◎" },
  { id: "mountain", label: "Grimpeurs", subtitle: "Au-dessus des nuages", symbol: "△" },
  { id: "hills", label: "Puncheurs", subtitle: "L’étincelle décisive", symbol: "ϟ" },
  { id: "sprint", label: "Sprinteurs", subtitle: "La dernière seconde", symbol: "»" },
  { id: "cobbles", label: "Classiques & pavés", subtitle: "Le caractère des pierres", symbol: "▰" },
  { id: "timeTrial", label: "Rouleurs", subtitle: "Seuls face au temps", symbol: "◷" },
  { id: "breakaway", label: "Baroudeurs", subtitle: "L’instinct de l’échappée", symbol: "↗" },
] as const;

export type AlbumProfile = typeof ALBUM_PROFILES[number]["id"];
export type CollectorCard = {
  id: string; number: number; rank: number; name: string;
  country: string; countryCode: string; age: number;
  avatarProfileKey: string | null; avatarSeed: string | number | null;
  teamName: string; jersey: RiderJerseyAppearance;
  profile: string; profileKey: AlbumProfile; ratings: RiderRatings;
  points: number; victories: number;
};
export type CollectorAlbumSnapshot = {
  edition: string; collectionSeason: number; sourceSeason: number;
  capturedAt: string; cards: CollectorCard[];
};

export function getCardRarity(rank: number): "gold" | "silver" | "bronze" {
  return rank <= 5 ? "gold" : rank <= 20 ? "silver" : "bronze";
}
export const CARD_RARITY_LABELS = { gold: "Or", silver: "Argent", bronze: "Bronze" } as const;

// Presentation-only inventory: never written to gameplay tables or exposed as rewards.
const INITIAL_OWNED = [1, 8];
const INITIAL_PARTNER = [9];
type Offer = { give: number; receive: number };
type TradeRecord = Offer & { outcome: "accepted" | "cancelled" | "declined" };
export type AlbumPilotState = {
  version: 1;
  owned: number[];
  partner: number[];
  pasted: number[];
  pending: Offer | null;
  history: TradeRecord[];
};
export function createAlbumPilotState(): AlbumPilotState {
  return { version: 1, owned: [...INITIAL_OWNED], partner: [...INITIAL_PARTNER], pasted: [], pending: null, history: [] };
}
export type AlbumPilotAction =
  | { type: "paste" | "unpaste"; card: number }
  | { type: "propose"; give: number; receive: number }
  | { type: "accept" | "cancel" | "decline" }
  | { type: "reset" };

export function updateAlbumPilot(state: AlbumPilotState, action: AlbumPilotAction): AlbumPilotState {
  if (action.type === "reset") return createAlbumPilotState();
  if (action.type === "paste") {
    if (!state.owned.includes(action.card) || state.pasted.includes(action.card) || state.pending?.give === action.card) return state;
    return { ...state, pasted: [...state.pasted, action.card] };
  }
  if (action.type === "unpaste") return { ...state, pasted: state.pasted.filter(id => id !== action.card) };
  if (action.type === "propose") {
    if (state.pending || state.pasted.includes(action.give) || !state.owned.includes(action.give) || !state.partner.includes(action.receive)) return state;
    return { ...state, pending: { give: action.give, receive: action.receive } };
  }
  if (!state.pending) return state;
  const offer = state.pending;
  // Both sides move in one transition. Repeated acceptance cannot duplicate cards.
  if (!state.owned.includes(offer.give) || !state.partner.includes(offer.receive) || state.pasted.includes(offer.give)) return state;
  const outcome: TradeRecord["outcome"] = action.type === "accept" ? "accepted" : action.type === "cancel" ? "cancelled" : "declined";
  return {
    ...state,
    owned: action.type === "accept" ? state.owned.map(id => id === offer.give ? offer.receive : id) : state.owned,
    partner: action.type === "accept" ? state.partner.map(id => id === offer.receive ? offer.give : id) : state.partner,
    pending: null,
    history: [{ ...offer, outcome }, ...state.history].slice(0, 10),
  };
}

export function readAlbumPilotState(raw: string | null): AlbumPilotState {
  const initial = createAlbumPilotState();
  if (!raw || raw.length > 8000) return initial;
  try {
    const value = JSON.parse(raw) as AlbumPilotState;
    if (value.version !== 1 || !Array.isArray(value.owned) || !Array.isArray(value.partner) || !Array.isArray(value.pasted) || !Array.isArray(value.history)) return initial;
    if ([...value.owned, ...value.partner].some(id => !Number.isInteger(id))) return initial;
    if (value.owned.length !== 2 || value.partner.length !== 1 || [...value.owned, ...value.partner].sort((a,b)=>a-b).join(",") !== "1,8,9") return initial;
    if (new Set(value.pasted).size !== value.pasted.length || value.pasted.some(id => !value.owned.includes(id))) return initial;
    if (value.pending && (!value.owned.includes(value.pending.give) || value.pasted.includes(value.pending.give) || !value.partner.includes(value.pending.receive))) return initial;
    if (value.history.length > 10 || value.history.some(h => !h || ![1,8,9].includes(h.give) || ![1,8,9].includes(h.receive) || !["accepted","cancelled","declined"].includes(h.outcome))) return initial;
    return { version: 1, owned: value.owned, partner: value.partner, pasted: value.pasted, pending: value.pending ? {give: value.pending.give, receive: value.pending.receive} : null, history: value.history };
  } catch { return initial; }
}

export function albumPilotStorageKey(userId: string, edition: string): string {
  return `cs:private-collector:${edition}:${userId}`;
}
