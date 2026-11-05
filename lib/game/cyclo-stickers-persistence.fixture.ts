import { ALBUM_ACHIEVEMENTS } from "./collector-album";
import type { CycloStickersPersistentState } from "./cyclo-stickers-persistence";

export function createCycloStickersPersistentStateFixture(): CycloStickersPersistentState {
  return {
    edition: {
      id: "cyclo-stickers-s5-s4-final-v1", sourceSeason: 4, collectionSeason: 5,
      sourceSeasonId: "10000000-0000-4000-8000-000000000001", collectionSeasonId: "10000000-0000-4000-8000-000000000002", enabled: true,
      odds: { bronze: 80, silver: 16.9, gold: 3, holographic: 0.1 }, achievements: ALBUM_ACHIEVEMENTS.map(row => ({ ...row })),
    },
    directorId: "10000000-0000-4000-8000-000000000003",
    owner: { directorId: "10000000-0000-4000-8000-000000000003", displayName: "Collectionneur réel de recette" },
    owned: [], boosters: [], boosterCount: 0, totalOpenedCount: 0, openedPacks: [], claimedAchievements: [], acceptedTradeCount: 0,
    outgoingOffers: [], incomingOffers: [], history: [],
  };
}
