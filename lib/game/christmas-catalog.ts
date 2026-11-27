import catalog from "@/data/christmas-2026-catalog.json";

export type ChristmasDelivery = { kind: "cosmetic" | "daily_reward" | "inventory_item" | "collector_booster" | "equipment" | "wallet_item"; key?: string; editionId?: string };
export type ChristmasCatalogItem = {
  id: string; name: string; category: "portrait" | "gestion" | "collection" | "equipment";
  slot?: string; price?: number; source?: string; limit?: number; description: string; effect: string;
  useKind?: string; art: string; equipmentSlot?: string; bonuses?: Record<string, number>;
  effects?: Record<string, unknown>; delivery: ChristmasDelivery;
};
export const CHRISTMAS_ALBUM_EDITION = catalog.albumEditionId;
export const CHRISTMAS_ITEMS = catalog.items as unknown as readonly ChristmasCatalogItem[];
export const CHRISTMAS_ADVENT = catalog.advent;
export const CHRISTMAS_MILESTONES = catalog.milestones;
export const CHRISTMAS_CONTRIBUTION_REWARDS = catalog.contributionRewards;
const byId = new Map(CHRISTMAS_ITEMS.map(item => [item.id, item]));
export function getChristmasItem(id: string): ChristmasCatalogItem | null { return byId.get(id) ?? null; }
export function christmasInventoryItemHref(id: string) {
  return getChristmasItem(id)?.delivery.kind === "inventory_item" || getChristmasItem(id)?.delivery.kind === "daily_reward"
    ? "/jeu/inventaire" : `/jeu/noel#inventaire`;
}
