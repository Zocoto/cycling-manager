/** JSON contract of the authenticated, transactional album RPCs. */
export type CycloStickersInventorySource = "login" | "referral" | "edition";
export type CycloStickersTradeStatus = "pending" | "accepted" | "cancelled" | "declined" | "expired";
export type CycloStickersTrade = {
  id: string; fromDirectorId: string; fromName: string; toDirectorId: string; toName: string;
  give: number[]; receive: number; status: CycloStickersTradeStatus; createdAt: string; expiresAt: string;
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
    id: string; inventorySource: CycloStickersInventorySource; acquiredAt: string; openedAt: string | null;
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
