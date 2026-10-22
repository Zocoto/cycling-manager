import type { EquipmentSlot } from "./equipment";
import type { RiderRatingKey } from "./rider-profile";

export const SEASON_FOUR_GALA = {
  route: "/jeu/gala-saison-4",
  date: "2026-11-06",
  dateLabel: "Vendredi 6 novembre 2026",
  twitchUrl: "https://www.twitch.tv/gouille_tw",
  hostAvatar: "/images/gala/gouille-twitch.png",
  primaryCap: 75,
  liveBoosters: 2,
  albumLaunchSeason: 5,
} as const;

export type GalaProgram = "world-tour" | "continental";
export type GalaProfile = "mountain" | "hills" | "cobbles" | "sprint";
export type GalaCourse = {
  id: GalaProfile; title: string; profile: string; name: string; distance: string;
  description: string; highlights: string[]; filename: string; raceId: number;
  nativeCapacity: number; primary: RiderRatingKey; primaryLabel: string;
  elevation: number[]; sourceUrl?: string;
};

// Course variants exist as both CDS and ZCES files in the local PCM26 pack.
// Capacities come from official-release.sqlite: per-race override, then class.
// These are source capacities, not a tested custom six-race export limit.
export const GALA_COURSES: Record<GalaProfile, GalaCourse> = {
  mountain: {
    id: "mountain", title: "Le vertige des sommets", profile: "Montagne", name: "Lourdes → Hautacam",
    distance: "143,2 km", primary: "mountain", primaryLabel: "MON", nativeCapacity: 23, raceId: 25,
    description: "Aubisque, Spandelles, Hautacam : trois géants pyrénéens, des pentes sévères et une arrivée au sommet pour faire parler les grands grimpeurs.",
    highlights: ["Col d’Aubisque", "Col de Spandelles", "Hautacam · arrivée au sommet"],
    filename: "top_tdf_18_2022", sourceUrl: "https://www.letour.fr/fr/galerie-image/best-of-2022",
    elevation: [14,13,16,22,18,14,18,23,29,57,91,100,73,37,20,56,83,62,21,14,45,74,96],
  },
  hills: {
    id: "hills", title: "Les mille relances", profile: "Vallons", name: "Amstel Gold Race · 2023",
    distance: "253,6 km", primary: "hills", primaryLabel: "VAL", nativeCapacity: 25, raceId: 173,
    description: "33 côtes et un parcours tortueux dans le Limbourg. Les difficultés s’enchaînent tout au long de la course : il faudra encaisser les relances bien avant le final.",
    highlights: ["33 côtes", "Eyserbosweg & Keutenberg", "Cauberg, Geulhemmerberg & Bemelerberg"],
    filename: "topclas_maastricht_2023", sourceUrl: "https://movistarteam.com/en/races/race/2023-mens-amstel-gold-race",
    elevation: [10,29,13,42,20,54,17,39,19,64,30,79,28,51,16,71,31,60,20,87,33,74,17,57,23,72,25,53,14,43,21,30,18],
  },
  cobbles: {
    id: "cobbles", title: "L’enfer en habit d’or", profile: "Pavés", name: "Paris–Roubaix · 2026",
    distance: "Classique pavée", primary: "cobbles", primaryLabel: "PAV", nativeCapacity: 25, raceId: 4,
    description: "Des secteurs qui secouent le peloton, le placement sous pression et le vélodrome en ligne de mire. Un rendez-vous pour les spécialistes des pavés.",
    highlights: ["Trouée d’Arenberg", "Mons-en-Pévèle", "Carrefour de l’Arbre"],
    filename: "topclas_roubaix_2026", elevation: [26,28,23,29,24,26,20,24,18,20,13,16,11,15,9,14,8,12,8,10],
  },
  sprint: {
    id: "sprint", title: "Le dernier éclair", profile: "Sprint", name: "Grand Prix de l’Escaut · 2026",
    distance: "Terneuzen → Schoten", primary: "sprint", primaryLabel: "SPR", nativeCapacity: 20, raceId: 145,
    description: "Une classique plate pour les hommes rapides. Économiser ses forces, organiser son train et surgir au bon moment : le sprint aura son grand soir.",
    highlights: ["Parcours plat", "Placement & train de sprint", "Arrivée à Schoten"],
    filename: "c0_schelde_2026", elevation: [8,9,7,8,10,7,9,8,7,9,10,8,9,7,8,9,7,8,9,7],
  },
};
export const GALA_PROGRAM_PROFILES: Record<GalaProgram, readonly GalaProfile[]> = {
  "world-tour": ["mountain", "hills", "cobbles"],
  continental: ["mountain", "hills", "sprint"],
};

export const GALA_PODIUM_PROPOSAL = [
  { rank: 1, name: "Roue avant · Éclat de Gala", slot: "front_wheel", primaryBonus: 3, image: "/images/equipment/products/novaspoke-vent-28.webp" },
  { rank: 2, name: "Casque · Couronne de Gala", slot: "helmet", primaryBonus: 2, image: "/images/equipment/products/aerion-stratos-pro.webp" },
  { rank: 3, name: "Chaussures · Dernier Éclair", slot: "shoes", primaryBonus: 1, image: "/images/equipment/products/montclair-alpine-lace.webp" },
] as const satisfies readonly { rank: number; name: string; slot: EquipmentSlot; primaryBonus: number; image: string }[];

export const GALA_CONSUMABLE_PROPOSAL = [
  { places: "4e–5e", name: "Pack grande récupération", detail: "3 doses de forme + 2 soins de blessure" },
  { places: "6e–7e", name: "Pack relance", detail: "2 doses de forme + 1 soin de blessure" },
  { places: "8e–10e", name: "Pack dernier effort", detail: "1 dose de forme + 1 soin de blessure" },
] as const;

export function galaClubCapacity(course: GalaCourse): number {
  return course.nativeCapacity - 1; // Indicative, if one observer team is needed.
}
