import type { EquipmentSlot } from "@/lib/game/equipment";
import type { RiderRatingKey } from "@/lib/game/rider-profile";
import { getPcmGalaRace } from "@/lib/game/pcm-gala-races";

export const SEASON_FINALE_GALA_ROUTE = "/jeu/gala-fin-de-saison";
export const SEASON_FINALE_GALA_EVENT_KEY = "gala-des-puncheurs" as const;
export const SEASON_FINALE_GALA_NAME = "Grand Gala de fin de saison";
export const SEASON_FINALE_GALA_RACE = getPcmGalaRace(SEASON_FINALE_GALA_EVENT_KEY)!;
export const SEASON_FINALE_GALA_MIN_RIDERS = 6;
export const SEASON_FINALE_GALA_MAX_RIDERS = 8;
export const SEASON_FINALE_GALA_TEAMS_PER_GROUP = 20;
// Paramètre de la classe officielle PCM26 de la Flèche Wallonne, spectateur inclus.
export const SEASON_FINALE_GALA_PCM_MAX_TEAMS = 25;

// Dotation validée par l'organisateur, répétée pour le top 5 de chaque groupe.
export const SEASON_FINALE_GALA_PRIZES_CONFIRMED = true;
export const SEASON_FINALE_GALA_PRIZES = [
  { rank: 1, key: "gala-roue-avant-or", name: "Roue avant · Éclat de Gala", slot: "front_wheel", rarity: "Exceptionnel", summary: "+3 VAL · +2 DES · +1 RES", bonuses: { hills: 3, downhill: 2, resistance: 1 }, image: "/images/equipment/products/novaspoke-vent-28.webp" },
  { rank: 2, key: "gala-gants-or", name: "Gants de Gala", slot: "gloves", rarity: "Exceptionnel", summary: "+2 VAL · +2 ACC · +1 RES", bonuses: { hills: 2, acceleration: 2, resistance: 1 }, image: "/images/equipment/products/montclair-podium-atelier.webp" },
  { rank: 3, key: "gala-casque-bronze", name: "Casque · Sérénité de Gala", slot: "helmet", rarity: "Édition Gala", summary: "+2 RES · +1 END", bonuses: { resistance: 2, endurance: 1 }, image: "/images/equipment/products/aerion-stratos-pro.webp" },
  { rank: 4, key: "gala-chaussures", name: "Chaussures · Dernière Relance", slot: "shoes", rarity: "Édition Gala", summary: "+2 ACC · +1 SPR", bonuses: { acceleration: 2, sprint: 1 }, image: "/images/equipment/products/montclair-alpine-lace.webp" },
  { rank: 5, key: "gala-lunettes", name: "Lunettes · Ligne d’Horizon", slot: "glasses", rarity: "Édition Gala", summary: "+1 VAL · +1 DES", bonuses: { hills: 1, downhill: 1 }, image: "/images/equipment/products/aerion-prism-horizon.webp" },
] as const satisfies ReadonlyArray<{
  rank: number; key: string; name: string; slot: EquipmentSlot; rarity: string;
  summary: string; bonuses: Partial<Record<RiderRatingKey, number>>; image: string;
}>;

export function readGalaYoutubeVideoId(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    const id = host === "youtu.be" ? url.pathname.slice(1)
      : ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)
        ? url.pathname === "/watch" ? url.searchParams.get("v") : url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)$/)?.[1]
        : null;
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}
