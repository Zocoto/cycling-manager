/** JSON contract of the authenticated, transactional album RPCs. */
export type CycloStickersInventorySource = "login" | "referral" | "edition";
export type CycloStickersTradeStatus = "pending" | "accepted" | "cancelled" | "declined" | "expired";
export type CycloStickersTrade = {
  id: string; fromDirectorId: string; fromName: string; toDirectorId: string; toName: string;
  give: number[]; receive: number; receiveCards?: number[]; status: CycloStickersTradeStatus; createdAt: string; expiresAt: string;
};
export type CycloStickersPersistentState = {
  edition: {
    id: string; sourceSeason: number; collectionSeason: number; sourceSeasonId: string;
    collectionSeasonId: string; enabled: boolean; odds: Record<string, number>;
    achievements: {id: string; name: string; kind: string; target?: number; cash: number; xp: number; reputation: number; trophy?: boolean; profile?: string; rarity?: string}[];
  };
  directorId: string;
  owner: {directorId: string; displayName: string};
  owned: {cardNumber: number; quantity: number; pasted: boolean; reserved: number}[];
  boosters: {
    id: string; inventorySource: CycloStickersInventorySource; acquisitionSource?: string; acquiredAt: string; openedAt: string | null;
    collectionSeasonId: string; sourceSeasonId: string;
  }[];
  boosterCount: number;
  totalOpenedCount: number;
  openedPacks: {id: string; inventorySource: CycloStickersInventorySource; cards: [number, number]}[];
  claimedAchievements: string[];
  acceptedTradeCount: number;
  outgoingOffers: CycloStickersTrade[];
  incomingOffers: CycloStickersTrade[];
  history: CycloStickersTrade[];
};
export type CycloStickersMutationResult = {state: CycloStickersPersistentState};
export type CycloStickersOpenResult = CycloStickersMutationResult & {cards: [number, number]; alreadyOpened: boolean};
export type CycloStickersClaimResult = CycloStickersMutationResult & {
  alreadyClaimed: boolean; reward: {cash: number; xp: number; reputation: number};
};
export type CycloStickersCollector = {
  directorId: string; displayName: string; availableCards: {cardNumber: number; quantity: number}[];
};
export type CycloStickersCollectorMatch = CycloStickersCollector & {
  wantedOfferCards: number[];
};

/** A number belongs to one sealed edition; S4 #1 and S5 #1 are different cards. */
export type CycloStickersCardReference = { editionId: string; cardNumber: number };
export type CycloStickersSeasonCard = CycloStickersCardReference & { sourceSeason: number };
export type CycloStickersEditionSummary = {
  editionId: string; sourceSeasonId: string; collectionSeasonId: string;
  sourceSeason: number; collectionSeason: number; totalCards: number;
  pastedCount: number; ownedCount: number; completionPercent: number;
  unopenedBoosterCount?: number;
};
export type CycloStickersCrossTrade = {
  id: string; legacy: boolean; editionId?: string;
  fromDirectorId: string; fromName: string; toDirectorId: string; toName: string;
  giveItems: CycloStickersSeasonCard[]; receiveItems: CycloStickersSeasonCard[];
  status: CycloStickersTradeStatus; createdAt: string; expiresAt: string;
};
export type CycloStickersTradeWorkspace = {
  directorId: string; editions: CycloStickersEditionSummary[];
  owned: (CycloStickersSeasonCard & { quantity: number; pasted: boolean; reserved: number })[];
  incomingOffers: CycloStickersCrossTrade[]; outgoingOffers: CycloStickersCrossTrade[];
  history: CycloStickersCrossTrade[];
};
export type CycloStickersCrossCollector = {
  directorId: string; displayName: string;
  availableCards: (CycloStickersSeasonCard & { quantity: number })[];
  wantedOfferCards: CycloStickersSeasonCard[];
};
export type CycloStickersMutation = (
  name: string, args: Record<string, unknown>,
  message: string | ((next: CycloStickersPersistentState) => string),
  onError?: (message: string) => void,
  onTradeState?: (workspace: CycloStickersTradeWorkspace, receipt?: { status?: CycloStickersTradeStatus }) => void,
) => Promise<CycloStickersPersistentState | null>;
