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
export type CollectorHonour = {
  raceEditionId: string; raceName: string; categoryCode: string;
  kind: "race" | "stages" | "mountain" | "sprint" | "youth";
  count: number; rank?: number;
};
export type CollectorCard = {
  kind?: "team" | "continental" | "world" | "games";
  rarityOverride?: "silver" | "gold" | "holographic";
  stickerTitle?: string;
  specimen?: boolean;
  id: string; number: number; rank: number; name: string;
  country: string; countryCode: string; age: number;
  avatarProfileKey: string | null; avatarSeed: string | number | null;
  teamName: string; jersey: RiderJerseyAppearance;
  profile: string; profileKey: AlbumProfile; ratings: RiderRatings;
  points: number; victories: number;
  honours: CollectorHonour[];
  worldTitles: ("road" | "time_trial")[];
};
export type CollectorAlbumSnapshot = {
  presentationSeason?: number; gamesEdition?: boolean; launchSeason?: number;
  edition: string; collectionSeason: number; sourceSeason: number;
  capturedAt: string; cards: CollectorCard[];
  sourceSeasonId: string; ratingsFrozenFromSeason: number;
};

export function getCardRarity(rank: number): "gold" | "silver" | "bronze" {
  return rank <= 5 ? "gold" : rank <= 20 ? "silver" : "bronze";
}
export const CARD_RARITY_LABELS = { gold: "Or", silver: "Argent", bronze: "Bronze", holographic: "Jeux" } as const;
export function getCollectorCardRarity(card: Pick<CollectorCard, "rank" | "rarityOverride">) {
  return card.rarityOverride ?? getCardRarity(card.rank);
}
export function getAlbumBoosterOdds(cards: readonly Pick<CollectorCard, "rank" | "rarityOverride">[]) {
  return cards.some(card => getCollectorCardRarity(card) === "holographic")
    ? { bronze: 80, silver: 16.9, gold: 3, holographic: 0.1 }
    : { ...ALBUM_BOOSTER_ODDS, holographic: 0 };
}

// Presentation-only inventory: never written to gameplay tables or exposed as rewards.
const INITIAL_OWNED = [1, 8];
const INITIAL_PARTNER = [9];
export const ALBUM_DEMO_COLLECTORS = [
  {id:"collector-demo",name:"Collectionneur démo",initialCards:INITIAL_PARTNER},
  {id:"collector-cols",name:"Collectionneuse des cols · démo",initialCards:[12,27]},
  {id:"collector-sprints",name:"Collectionneur des sprints · démo",initialCards:[9,42]},
] as const;
export const ALBUM_SOURCE_SEASON = 3;
export const ALBUM_BOOSTER_ODDS = { bronze: 80, silver: 17, gold: 3 } as const;
export const ALBUM_PILOT_SEASON = 4;
export const ALBUM_PILOT_EDITION = "s4-top50-s3-private-v1";
export const ALBUM_PILOT_PACK_COUNT = 2;
export function getAlbumPilotPacks(season = ALBUM_PILOT_SEASON) {
  return Array.from({length: ALBUM_PILOT_PACK_COUNT}, (_, i) => ({id: `s${season}-sample-${i + 1}`, season}));
}

export function drawAlbumBooster(cards: ReadonlyArray<Pick<CollectorCard, "number" | "rank" | "rarityOverride">>, rolls: readonly number[]): [number, number] {
  if (rolls.length !== 4 || rolls.some(r => !Number.isFinite(r) || r < 0 || r >= 1)) throw new Error("Invalid booster entropy");
  const pick = (offset: number) => {
    const odds = getAlbumBoosterOdds(cards);
    const rarity = rolls[offset] < odds.bronze / 100 ? "bronze" : rolls[offset] < (odds.bronze + odds.silver) / 100 ? "silver" : rolls[offset] < 1 - odds.holographic / 100 ? "gold" : "holographic";
    const pool = cards.filter(c => getCollectorCardRarity(c) === rarity);
    if (!pool.length) throw new Error("Incomplete album rarity pool");
    return pool[Math.floor(rolls[offset + 1] * pool.length)].number;
  };
  return [pick(0), pick(2)];
}

export type AlbumAchievement = {
  id: string; name: string; description: string; target: number;
  kind: "count" | "profile" | "rarity" | "mixed" | "trade";
  profile?: AlbumProfile; rarity?: "gold" | "silver" | "bronze";
  cash: number; xp: number; reputation: number; trophy?: boolean;
};
export const ALBUM_ACHIEVEMENTS: readonly AlbumAchievement[] = [
  {id:"count-1",name:"La première vignette",description:"Coller une première carte dans l’album.",kind:"count",target:1,cash:2500,xp:100,reputation:0},
  {id:"count-5",name:"Le début de la passion",description:"Réunir cinq cartes différentes dans l’album.",kind:"count",target:5,cash:10000,xp:150,reputation:0},
  {id:"count-10",name:"Les pages prennent vie",description:"Coller dix cartes différentes.",kind:"count",target:10,cash:20000,xp:200,reputation:5},
  {id:"count-20",name:"Un beau peloton",description:"Coller vingt cartes différentes.",kind:"count",target:20,cash:40000,xp:300,reputation:10},
  {id:"count-30",name:"Collectionneur du dimanche",description:"Coller trente cartes différentes.",kind:"count",target:30,cash:60000,xp:400,reputation:15},
  {id:"count-40",name:"La dernière ligne droite",description:"Coller quarante cartes différentes.",kind:"count",target:40,cash:90000,xp:600,reputation:20},
  {id:"count-50",name:"Mémoire du peloton",description:"Compléter toutes les vignettes de cette saison.",kind:"count",target:50,cash:250000,xp:1000,reputation:100,trophy:true},
  ...ALBUM_PROFILES.map(p => ({id:`profile-${p.id}`,name:`Chapitre complet · ${p.label}`,description:`Compléter la page des ${p.label.toLowerCase()}.`,kind:"profile" as const,target:1,profile:p.id,cash:15000,xp:100,reputation:5})),
  {id:"rarity-bronze",name:"Le charme du bronze",description:"Coller toutes les cartes bronze de la saison.",kind:"rarity",rarity:"bronze",target:30,cash:25000,xp:200,reputation:5},
  {id:"rarity-silver",name:"Les reflets d’argent",description:"Coller toutes les cartes argent de la saison.",kind:"rarity",rarity:"silver",target:15,cash:40000,xp:200,reputation:10},
  {id:"rarity-gold",name:"Le club des légendes",description:"Coller les cinq cartes or de la saison.",kind:"rarity",rarity:"gold",target:5,cash:60000,xp:200,reputation:15},
  {id:"mixed",name:"Toutes les couleurs du vélo",description:"Coller au moins une carte bronze, une argent et une or.",kind:"mixed",target:3,cash:5000,xp:50,reputation:5},
  {id:"trade",name:"À la récré",description:"Terminer un premier échange de cartes.",kind:"trade",target:1,cash:5000,xp:50,reputation:0},
];
export type AlbumOffer = { give: number[]; receive: number; partnerId: string };
type TradeRecord = AlbumOffer & { outcome: "accepted" | "cancelled" | "declined" };
export type AlbumPilotState = {
  version: 3;
  season: number;
  owned: number[];
  partners: Record<string, number[]>;
  pasted: number[];
  pending: AlbumOffer | null;
  history: TradeRecord[];
  openedPacks: {id: string; cards: [number, number]}[];
  claimedAchievements: string[];
  acceptedTradeCount: number;
};
export function createAlbumPilotState(season = ALBUM_PILOT_SEASON, cards: readonly CollectorCard[] = []): AlbumPilotState {
  // Extra copies are private test specimens, not a future public starter grant.
  return { version: 3, season, owned: [...INITIAL_OWNED, ...cards.filter(card => card.kind).map(card => card.number)], partners: Object.fromEntries(ALBUM_DEMO_COLLECTORS.map(p=>[p.id,[...p.initialCards]])), pasted: [], pending: null, history: [], openedPacks: [], claimedAchievements: [], acceptedTradeCount: 0 };
}
export type AlbumPilotAction =
  | { type: "paste" | "unpaste"; card: number }
  | { type: "propose"; give: number | number[]; receive: number; partnerId?: string }
  | { type: "accept" | "cancel" | "decline" }
  | { type: "open-pack"; id: string; season: number; cards: [number, number] }
  | { type: "claim-achievement"; id: string }
  | { type: "reset" };

export function getLooseAlbumCardCount(state: AlbumPilotState, id: number, includeReserved = false): number {
  return state.owned.filter(n => n === id).length - Number(state.pasted.includes(id)) - (includeReserved ? 0 : state.pending?.give.filter(n=>n===id).length ?? 0);
}

function isKnownAlbumNumber(id: number, cards: readonly CollectorCard[]) {
  return Number.isInteger(id) && (cards.length ? cards.some(card => card.number === id) : id >= 1 && id <= 50);
}
export function canOfferAlbumCards(state: AlbumPilotState, offer: AlbumOffer, cards: readonly CollectorCard[] = []): boolean {
  if (!Array.isArray(offer.give) || offer.give.length<1 || offer.give.length>3 || !ALBUM_DEMO_COLLECTORS.some(p=>p.id===offer.partnerId) || !state.partners[offer.partnerId]?.includes(offer.receive)) return false;
  if (!isKnownAlbumNumber(offer.receive,cards) || offer.give.some(id=>!isKnownAlbumNumber(id,cards)||id===offer.receive)) return false;
  return [...new Set(offer.give)].every(id=>getLooseAlbumCardCount(state,id,true)>=offer.give.filter(n=>n===id).length);
}

function removeAlbumCopies(cards: number[], copies: readonly number[]): number[] {
  const result=[...cards];
  for(const id of copies) { const index=result.indexOf(id); if(index>=0) result.splice(index,1); }
  return result;
}

export function getAlbumAchievementProgress(achievement: AlbumAchievement, state: AlbumPilotState, cards: readonly CollectorCard[]) {
  const pasted = cards.filter(c => state.pasted.includes(c.number));
  if (achievement.kind === "profile") {
    const group = cards.filter(c => !c.kind && c.profileKey === achievement.profile);
    return {value: group.filter(c => state.pasted.includes(c.number)).length, target: Math.max(1, group.length)};
  }
  if (achievement.kind === "rarity") return {value: pasted.filter(c => getCollectorCardRarity(c) === achievement.rarity).length, target: cards.length ? Math.max(1,cards.filter(c => getCollectorCardRarity(c) === achievement.rarity).length) : achievement.target};
  if (achievement.kind === "mixed") return {value: new Set(pasted.map(getCollectorCardRarity).filter(rarity=>rarity!=="holographic")).size, target: 3};
  if (achievement.kind === "trade") return {value: Math.min(1,state.acceptedTradeCount), target: 1};
  return {value: pasted.length, target: achievement.trophy && cards.length ? cards.length : achievement.target};
}

export function updateAlbumPilot(state: AlbumPilotState, action: AlbumPilotAction, cards: readonly CollectorCard[] = []): AlbumPilotState {
  if (action.type === "reset") return createAlbumPilotState(state.season,cards);
  if (action.type === "open-pack") {
    if (action.season !== state.season || !getAlbumPilotPacks(state.season).some(p => p.id === action.id) || state.openedPacks.some(p => p.id === action.id) || !Array.isArray(action.cards) || action.cards.length !== 2 || action.cards.some(id => !isKnownAlbumNumber(id,cards))) return state;
    return {...state, owned: [...state.owned, ...action.cards], openedPacks: [...state.openedPacks, {id: action.id, cards: [...action.cards]}]};
  }
  if (action.type === "claim-achievement") {
    const achievement = ALBUM_ACHIEVEMENTS.find(a => a.id === action.id);
    if (!achievement || state.claimedAchievements.includes(action.id)) return state;
    const progress = getAlbumAchievementProgress(achievement, state, cards);
    if (progress.value < progress.target) return state;
    return {...state, claimedAchievements: [...state.claimedAchievements, action.id]};
  }
  if (action.type === "paste") {
    if (state.pasted.includes(action.card) || getLooseAlbumCardCount(state, action.card) < 1) return state;
    return { ...state, pasted: [...state.pasted, action.card] };
  }
  if (action.type === "unpaste") return { ...state, pasted: state.pasted.filter(id => id !== action.card) };
  if (action.type === "propose") {
    const offer: AlbumOffer={give:Array.isArray(action.give)?[...action.give]:[action.give],receive:action.receive,partnerId:action.partnerId??ALBUM_DEMO_COLLECTORS[0].id};
    if (state.pending || !canOfferAlbumCards(state,offer,cards)) return state;
    return { ...state, pending: offer };
  }
  if (!state.pending || !["accept","cancel","decline"].includes(action.type)) return state;
  const offer = state.pending;
  // Both sides move in one transition. Repeated acceptance cannot duplicate cards.
  if (action.type === "accept" && !canOfferAlbumCards(state,offer,cards)) return state;
  const outcome: TradeRecord["outcome"] = action.type === "accept" ? "accepted" : action.type === "cancel" ? "cancelled" : "declined";
  return {
    ...state,
    owned: action.type === "accept" ? [...removeAlbumCopies(state.owned,offer.give),offer.receive] : state.owned,
    partners: action.type === "accept" ? {...state.partners,[offer.partnerId]:[...removeAlbumCopies(state.partners[offer.partnerId],[offer.receive]),...offer.give]} : state.partners,
    pending: null,
    acceptedTradeCount: state.acceptedTradeCount + Number(action.type === "accept"),
    history: [{ ...offer, outcome }, ...state.history].slice(0, 10),
  };
}

export function readAlbumPilotState(raw: string | null, season = ALBUM_PILOT_SEASON, cards: readonly CollectorCard[] = []): AlbumPilotState {
  const initial = createAlbumPilotState(season,cards);
  if (!raw || raw.length > 16000) return initial;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || ![1, 2, 3].includes(parsed.version)) return initial;
    const legacy = parsed.version === 1 ? {...parsed, season, openedPacks: [], claimedAchievements: [], acceptedTradeCount: Array.isArray(parsed.history) ? parsed.history.filter((h: TradeRecord) => h?.outcome === "accepted").length : 0} : parsed;
    const upgradeOffer=(h: {give:number;receive:number})=>({give:[h.give],receive:h.receive,partnerId:ALBUM_DEMO_COLLECTORS[0].id});
    const value: AlbumPilotState = parsed.version===3 ? parsed : {...legacy,version:3,partners:{...initial.partners,[ALBUM_DEMO_COLLECTORS[0].id]:legacy.partner},pending:legacy.pending?upgradeOffer(legacy.pending):null,history:legacy.history.map((h: {give:number;receive:number;outcome:TradeRecord["outcome"]})=>({...upgradeOffer(h),outcome:h.outcome}))};
    if (value.season !== season || !Array.isArray(value.owned) || !value.partners || typeof value.partners!=="object" || Object.keys(value.partners).length!==ALBUM_DEMO_COLLECTORS.length || ALBUM_DEMO_COLLECTORS.some(p=>!Array.isArray(value.partners[p.id])) || !Array.isArray(value.pasted) || !Array.isArray(value.history) || !Array.isArray(value.openedPacks) || !Array.isArray(value.claimedAchievements)) return initial;
    const partnerCards=ALBUM_DEMO_COLLECTORS.flatMap(p=>value.partners[p.id]);
    if ([...value.owned, ...partnerCards].some(id => !isKnownAlbumNumber(id,cards))) return initial;
    if (value.openedPacks.length > ALBUM_PILOT_PACK_COUNT || new Set(value.openedPacks.map(p => p.id)).size !== value.openedPacks.length || value.openedPacks.some(p => !getAlbumPilotPacks(season).some(known => known.id === p.id) || !Array.isArray(p.cards) || p.cards.length !== 2 || p.cards.some(id => !isKnownAlbumNumber(id,cards)))) return initial;
    const expected = [...initial.owned, ...ALBUM_DEMO_COLLECTORS.flatMap(p=>[...p.initialCards]), ...value.openedPacks.flatMap(p => p.cards)].sort((a,b)=>a-b).join(",");
    if ([...value.owned, ...partnerCards].sort((a,b)=>a-b).join(",") !== expected) return initial;
    if (new Set(value.pasted).size !== value.pasted.length || value.pasted.some(id => !value.owned.includes(id))) return initial;
    if (value.pending && !canOfferAlbumCards(value,value.pending,cards)) return initial;
    if (value.history.length > 10 || value.history.some(h => !h || !Array.isArray(h.give) || h.give.length<1 || h.give.length>3 || h.give.some(id=>!isKnownAlbumNumber(id,cards)||id===h.receive) || !ALBUM_DEMO_COLLECTORS.some(p=>p.id===h.partnerId) || !isKnownAlbumNumber(h.receive,cards) || !["accepted","cancelled","declined"].includes(h.outcome))) return initial;
    if (new Set(value.claimedAchievements).size !== value.claimedAchievements.length || value.claimedAchievements.some(id => !ALBUM_ACHIEVEMENTS.some(a => a.id === id))) return initial;
    if (!Number.isSafeInteger(value.acceptedTradeCount) || value.acceptedTradeCount < 0) return initial;
    return { version: 3, season, owned: value.owned, partners: value.partners, pasted: value.pasted, pending: value.pending ? {give: [...value.pending.give], receive: value.pending.receive,partnerId:value.pending.partnerId} : null, history: value.history, openedPacks: value.openedPacks, claimedAchievements: value.claimedAchievements, acceptedTradeCount: value.acceptedTradeCount };
  } catch { return initial; }
}

export function albumPilotStorageKey(userId: string, edition: string): string {
  return `cs:private-collector:${edition}:${userId}`;
}
