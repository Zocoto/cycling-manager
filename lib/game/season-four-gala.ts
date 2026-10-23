import type { EquipmentSlot } from "./equipment";
import type { RiderRatingKey } from "./rider-profile";
import baseProfiles from "./season-four-gala-base-profiles.json";

export const SEASON_FOUR_GALA = {
  route: "/jeu/gala-saison-4",
  date: "2026-11-06",
  dateLabel: "Vendredi 6 novembre 2026",
  twitchUrl: "https://www.twitch.tv/gouille_tw",
  hostAvatar: "/images/gala/gouille-twitch.png",
  primaryCap: 75,
  sourceSeason: 4,
  minRiders: 7,
  maxRiders: 8,
  liveBoosters: 2,
  albumLaunchSeason: 5,
} as const;

export type GalaProgram = "world-tour" | "continental";
export type GalaProfile = "mountain" | "hills" | "cobbles" | "sprint";
export type GalaCourse = {
  id: GalaProfile; title: string; profile: string; name: string; distance: string;
  description: string; highlights: string[]; filename: string; startlistFilename: string; raceId: number;
  nativeCapacity: number; primary: RiderRatingKey; primaryLabel: string;
  elevation: number[]; elevationPositions?: number[]; sourceUrl?: string;
};

function baseProfile(profile: GalaProfile) {
  const source = baseProfiles[profile];
  // Vertical magnification remains schematic, but every peak, valley and its
  // distance comes from vanilla PCM's altitude curve, never an invented line.
  const amplitude = { mountain: 94, hills: 80, cobbles: 28, sprint: 10 }[profile];
  return {
    filename: source.file.replace(/\.cds$/, ""),
    elevationPositions: source.points.map(point => point[0]),
    elevation: source.points.map(point => 6 + (point[1] - source.minimum) / (source.maximum - source.minimum) * amplitude),
  };
}

// CDS/ZCES pairs verified in vanilla PCM26's pakchunk1, not the Workshop pack.
// Native capacities verified against Mod/Default/OfficialRelease.cdb.
export const GALA_COURSES: Record<GalaProfile, GalaCourse> = {
  mountain: {
    id: "mountain", title: "Le vertige des sommets", profile: "Montagne", name: "Lourdes → Hautacam",
    distance: "Étape du Tour de France", primary: "mountain", primaryLabel: "MON", nativeCapacity: 23, raceId: 25,
    description: "Aubisque, Spandelles, Hautacam : trois géants pyrénéens, des pentes sévères et une arrivée au sommet pour faire parler les grands grimpeurs.",
    highlights: ["Col d’Aubisque", "Col de Spandelles", "Hautacam · arrivée au sommet"],
    startlistFilename: "top_tdf.xml", ...baseProfile("mountain"),
  },
  hills: {
    id: "hills", title: "Les mille relances", profile: "Vallons", name: "Amstel Gold Race",
    distance: "Maastricht → Berg en Terblijt", primary: "hills", primaryLabel: "VAL", nativeCapacity: 25, raceId: 173,
    description: "Le parcours de la Limburg Green Race du jeu de base PCM26 : une succession de côtes dans le Limbourg, des relances et un final à Berg en Terblijt.",
    highlights: ["Côtes du Limbourg", "Relances et placement", "Arrivée à Berg en Terblijt"],
    startlistFilename: "topclas_maastricht.xml", ...baseProfile("hills"),
  },
  cobbles: {
    id: "cobbles", title: "L’enfer en habit d’or", profile: "Pavés", name: "Paris–Roubaix",
    distance: "Compiègne → Roubaix", primary: "cobbles", primaryLabel: "PAV", nativeCapacity: 25, raceId: 4,
    description: "Des secteurs qui secouent le peloton, le placement sous pression et le vélodrome en ligne de mire. Un rendez-vous pour les spécialistes des pavés.",
    highlights: ["Trouée d’Arenberg", "Mons-en-Pévèle", "Carrefour de l’Arbre"],
    startlistFilename: "topclas_roubaix.xml", ...baseProfile("cobbles"),
  },
  sprint: {
    id: "sprint", title: "Le dernier éclair", profile: "Sprint", name: "Grand Prix de l’Escaut",
    distance: "Anvers → Schoten", primary: "sprint", primaryLabel: "SPR", nativeCapacity: 20, raceId: 145,
    description: "Une classique plate pour les hommes rapides. Économiser ses forces, organiser son train et surgir au bon moment : le sprint aura son grand soir.",
    highlights: ["Parcours plat", "Placement & train de sprint", "Arrivée à Schoten"],
    startlistFilename: "c0_schelde.xml", ...baseProfile("sprint"),
  },
};
export const GALA_PROGRAM_PROFILES: Record<GalaProgram, readonly GalaProfile[]> = {
  "world-tour": ["mountain", "hills", "cobbles"],
  continental: ["mountain", "hills", "sprint"],
};

export const GALA_PODIUM_PROPOSAL = [
  { rank: 1, name: "Cuissard · Éclat de Gala", slot: "bib_shorts", primaryBonus: 3, image: "/images/equipment/products/montclair-victoire-atelier.webp" },
  { rank: 2, name: "Casque · Couronne de Gala", slot: "helmet", primaryBonus: 2, image: "/images/equipment/products/aerion-stratos-pro.webp" },
  { rank: 3, name: "Chaussures · Dernier Éclair", slot: "shoes", primaryBonus: 1, image: "/images/equipment/products/montclair-alpine-lace.webp" },
] as const satisfies readonly { rank: number; name: string; slot: EquipmentSlot; primaryBonus: number; image: string }[];

export const GALA_CONSUMABLE_PROPOSAL = [
  { places: "4e", name: "Pack coup d’éclat", detail: "1 capsule +1 note secondaire au choix + 3 doses de forme + 2 soins de blessure" },
  { places: "5e", name: "Pack belle échappée", detail: "1 stage d’entraînement : 3 séances collectives ×2 + 2 doses de forme + 2 soins de blessure" },
  { places: "6e–7e", name: "Pack relance", detail: "2 doses de forme + 1 soin de blessure" },
  { places: "8e–10e", name: "Pack dernier effort", detail: "1 dose de forme + 1 soin de blessure" },
] as const;

export function galaClubCapacity(course: GalaCourse): number {
  return course.nativeCapacity - 1;
}

export type GalaEventKey = `${GalaProgram}:${GalaProfile}`;
export const GALA_EVENTS = (Object.keys(GALA_PROGRAM_PROFILES) as GalaProgram[]).flatMap(program =>
  GALA_PROGRAM_PROFILES[program].map(profile => ({key: `${program}:${profile}` as GalaEventKey, program, profile, course:GALA_COURSES[profile]})));
export type GalaExportStatus = { counts: Partial<Record<GalaEventKey,number>>; unavailable?: boolean };

export function getGalaEvent(key: string) {
  return GALA_EVENTS.find(event=>event.key===key);
}
