import type { HalloweenPreviewItem } from "./halloween-catalog";

export function getHalloweenPurchaseLimit(item: HalloweenPreviewItem): number {
  if (item.kind === "cosmetic") return 1;
  if (item.kind === "transformation") return 10;
  return item.relic ? 5 : 30;
}

export function getHalloweenObtainedLimit(item: HalloweenPreviewItem): number {
  if (item.id === "witches-star") return 5;
  // Other relics retain one extra slot for a podium gift.
  return item.relic ? 6 : getHalloweenPurchaseLimit(item);
}

export function isHalloweenPurchaseLimitReached(
  item: HalloweenPreviewItem,
  purchases: number,
  obtained: number,
): boolean {
  return purchases >= getHalloweenPurchaseLimit(item) || obtained >= getHalloweenObtainedLimit(item);
}
