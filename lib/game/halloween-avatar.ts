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
export const HALLOWEEN_AVATAR_COSMETICS = {
  "lord-vlad": { art: "vlad", slot: "outfit" },
  "halloween-background": { art: "moon", slot: "background" },
  "devil-trident": { art: "trident", slot: "accessory" },
  "pumpkin-cap": { art: "cap", slot: "hat" },
  "pocket-bat": { art: "bat", slot: "pin" },
  "spectral-wheel": { art: "wheel", slot: "frame" },
  "cobweb-frame": { art: "web", slot: "frame_corner" },
  "ghost-scarf": { art: "scarf", slot: "neck" },
  "headless-skin": { art: "headless", slot: "outfit" },
} as const;
export type HalloweenAvatarItemId = keyof typeof HALLOWEEN_AVATAR_COSMETICS;
const PREVIEW_ITEMS: Record<string, { art: HalloweenAvatarArt; slot: string }> = {
  ...HALLOWEEN_AVATAR_COSMETICS,
  "vampire-kiss": { art: "vampire", slot: "curse" },
  "mummy-curse": { art: "mummy", slot: "curse" },
};

export function isHalloweenAvatarItemId(value: unknown): value is HalloweenAvatarItemId {
  return typeof value === "string" && Object.hasOwn(HALLOWEEN_AVATAR_COSMETICS, value);
}

/** One choice per physical slot, not one accessory per portrait. */
export function toggleHalloweenAvatarItem(current: readonly HalloweenAvatarItemId[], id: HalloweenAvatarItemId) {
  if (current.includes(id)) return current.filter(item => item !== id);
  return [...current.filter(item => HALLOWEEN_AVATAR_COSMETICS[item].slot !== HALLOWEEN_AVATAR_COSMETICS[id].slot), id];
}

export function halloweenAvatarWardrobe(inventory: Record<string, unknown> = {}, cosmetics: Record<string, unknown> = {}) {
  const owned = Object.keys(HALLOWEEN_AVATAR_COSMETICS).filter(isHalloweenAvatarItemId).filter(id =>
    typeof inventory[id] === "number" && Number.isSafeInteger(inventory[id]) && (inventory[id] as number) > 0);
  const selected = Object.values(cosmetics).filter(isHalloweenAvatarItemId).filter(id => owned.includes(id));
  return { owned, selected: [...new Set(selected)] };
}

export function composeHalloweenAvatarKey(base: string, items: readonly HalloweenAvatarItemId[], curse?: "vampire" | "mummy" | null) {
  const arts: HalloweenAvatarArt[] = [...new Set(items)].flatMap(id =>
    curse && HALLOWEEN_AVATAR_COSMETICS[id].slot === "outfit" ? [] : [HALLOWEEN_AVATAR_COSMETICS[id].art]);
  if (curse) arts.push(curse);
  return `${originalHalloweenAvatarKey(base)}${arts.length ? HALLOWEEN_AVATAR_SEPARATOR + arts.join(",") : ""}`;
}

/** Missing means preserve existing choices (older open forms); [] means remove. */
export function parseHalloweenAvatarSelection(value: FormDataEntryValue | null): HalloweenAvatarItemId[] | null {
  if (value === null) return null;
  if (typeof value !== "string" || value.length > 512) throw new Error("Choix d’accessoires invalide.");
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.length > 9 || !parsed.every(isHalloweenAvatarItemId)) throw new Error("Choix d’accessoires invalide.");
  const slots = parsed.map(id => HALLOWEEN_AVATAR_COSMETICS[id].slot);
  if (new Set(slots).size !== slots.length) throw new Error("Choisissez un seul élément par emplacement.");
  return parsed;
}

export function previewHalloweenAvatarKey(value: string | null | undefined, itemId: string) {
  const selected = PREVIEW_ITEMS[itemId];
  if (!selected) return value;
  const occupied = Object.values(PREVIEW_ITEMS).filter(item => item.slot === selected.slot).map(item => item.art);
  const arts = halloweenAvatarArts(value).filter(art =>
    art !== "vampire" && art !== "mummy" && !occupied.includes(art) &&
    (selected.slot !== "curse" || (art !== "vlad" && art !== "headless")));
  return `${originalHalloweenAvatarKey(value) || "director_m_01"}${HALLOWEEN_AVATAR_SEPARATOR}${[...arts, selected.art].join(",")}`;
}
