export const HALLOWEEN_AVATAR_SEPARATOR = "~halloween~";
export const HALLOWEEN_AVATAR_ARTS = ["vlad", "moon", "trident", "cap", "bat", "wheel", "web", "scarf", "vampire", "mummy", "headless"] as const;
export type HalloweenAvatarArt = typeof HALLOWEEN_AVATAR_ARTS[number];
export function originalHalloweenAvatarKey(value?: string | null) {
  return value?.split(HALLOWEEN_AVATAR_SEPARATOR)[0] ?? value;
}
export function halloweenAvatarArts(value?: string | null): HalloweenAvatarArt[] {
  const parts = value?.split(HALLOWEEN_AVATAR_SEPARATOR);
  if (parts?.length !== 2) return [];
  return [...new Set(parts[1].split(",").filter((art): art is HalloweenAvatarArt => (HALLOWEEN_AVATAR_ARTS as readonly string[]).includes(art)))];
}

// Same slots and art IDs as the server's avatar trigger. This only composes an
// ephemeral preview key: it never equips an item or writes to the wallet.
const PREVIEW_ITEMS: Record<string, { art: HalloweenAvatarArt; slot: string }> = {
  "lord-vlad": { art: "vlad", slot: "outfit" },
  "halloween-background": { art: "moon", slot: "background" },
  "devil-trident": { art: "trident", slot: "accessory" },
  "pumpkin-cap": { art: "cap", slot: "hat" },
  "pocket-bat": { art: "bat", slot: "pin" },
  "spectral-wheel": { art: "wheel", slot: "frame" },
  "cobweb-frame": { art: "web", slot: "frame" },
  "ghost-scarf": { art: "scarf", slot: "neck" },
  "headless-skin": { art: "headless", slot: "outfit" },
  "vampire-kiss": { art: "vampire", slot: "curse" },
  "mummy-curse": { art: "mummy", slot: "curse" },
};

export function previewHalloweenAvatarKey(value: string | null | undefined, itemId: string) {
  const selected = PREVIEW_ITEMS[itemId];
  if (!selected) return value;
  const occupied = Object.values(PREVIEW_ITEMS).filter(item => item.slot === selected.slot).map(item => item.art);
  const arts = halloweenAvatarArts(value).filter(art =>
    art !== "vampire" && art !== "mummy" && !occupied.includes(art) &&
    (selected.slot !== "curse" || (art !== "vlad" && art !== "headless")));
  return `${originalHalloweenAvatarKey(value) || "director_m_01"}${HALLOWEEN_AVATAR_SEPARATOR}${[...arts, selected.art].join(",")}`;
}
