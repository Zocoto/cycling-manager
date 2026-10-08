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
