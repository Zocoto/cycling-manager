import nativeProfiles from "./season-five-gala-profiles.json";

export type SeasonFiveGalaProgram = "pro-tour" | "continental";
export type SeasonFiveGalaCourse = {
  id: string;
  program: SeasonFiveGalaProgram;
  name: string;
  title: string;
  profile: "Montagne" | "Vallons" | "Pavés" | "Sprint";
  description: string;
  highlights: readonly string[];
  pcmRaceId: number | null;
  pcmName: string | null;
  startlistFilename: string | null;
  stageFile: string | null;
  nativeCapacity: number | null;
  pcmEditionYear?: number;
  pcmStageNumber?: number;
  distanceKm: number | null;
  elevation: readonly (readonly [number, number])[];
  verified: boolean;
};

function nativeCourse(id: keyof typeof nativeProfiles.courses) {
  const profile = nativeProfiles.courses[id];
  return {
    ...profile,
    // Distance is normalized; elevations retain native PCM units, not metres.
    elevation: profile.elevation.map(([x, y]) => [x, y] as const),
    verified: true,
  };
}

export const SEASON_FIVE_GALA = {
  route: "/apercus/gala-saison-5",
  name: "Le Gala des Lumières",
  sourceSeason: 5,
  nextSeason: 6,
  dateLabel: "Début décembre · date à confirmer",
  minRiders: 7,
  maxRiders: 8,
  continentalCap: 75,
  isRegistrationOpen: true,
  registrationClosesAt: "2026-12-04T11:00:00.000Z",
  registrationDeadlineLabel: "Vendredi 4 décembre à 12 h (heure de Paris)",
  twitchUrl: "https://www.twitch.tv/gouille_tw",
  hostAvatar: "/images/gala/gouille-twitch.png",
} as const;

// The six native PCM race identities, rather than the terrain alone, determine
// startlist filenames. Proposals remain separate from S4's published archives.
export const GALA_S5_COURSES: readonly SeasonFiveGalaCourse[] = [
  { id: "pt-zoncolan", program: "pro-tour", name: "Le Monte Zoncolan", title: "La montagne à l’état brut", profile: "Montagne", description: "Une arrivée mythique du Giro, des rampes redoutables et un dernier face-à-face avec la pente.", highlights: ["Giro d’Italia", "Arrivée au sommet", "Grimpeurs"], ...nativeCourse("pt-zoncolan") },
  { id: "pt-liege", program: "pro-tour", name: "Liège–Bastogne–Liège", title: "Le dernier rendez-vous des Ardennes", profile: "Vallons", description: "La Doyenne : des côtes qui s’accumulent, la Redoute et une sélection qui se joue à l’usure.", highlights: ["La Doyenne", "Ardennes", "Puncheurs"], ...nativeCourse("pt-liege") },
  { id: "pt-flanders", program: "pro-tour", name: "Le Tour des Flandres", title: "Des murs et des pavés", profile: "Pavés", description: "Les monts flamands, les pavés et les changements de rythme : une autre manière de conquérir un Monument.", highlights: ["Monts flamands", "Pavés", "Placement"], ...nativeCourse("pt-flanders") },
  { id: "ct-alpe", program: "continental", name: "L’Alpe-d’Huez", title: "Les vingt et un virages", profile: "Montagne", description: "Une des arrivées les plus célèbres du Tour : trouver son rythme, tenir dans les lacets et finir devant la foule.", highlights: ["Tour de France", "21 virages", "Arrivée au sommet"], ...nativeCourse("ct-alpe") },
  { id: "ct-fleche", program: "continental", name: "La Flèche Wallonne", title: "Tout se joue dans le Mur", profile: "Vallons", description: "Un final tendu et le Mur de Huy pour trancher : le bon placement, puis une dernière accélération.", highlights: ["Mur de Huy", "Final explosif", "Puncheurs"], ...nativeCourse("ct-fleche") },
  { id: "ct-hamburg", program: "continental", name: "La Classique de Hambourg", title: "Le grand soir des sprinteurs", profile: "Sprint", description: "Une grande classique pour les hommes rapides : franchir les difficultés, préserver son train et réussir le dernier lancement.", highlights: ["Classique World Tour", "Train de sprint", "Hommes rapides"], ...nativeCourse("ct-hamburg") },
];

export const GALA_S5_LIVE_REWARD = {
  name: "Cuissard des Lumières",
  slot: "bib_shorts",
  ratingBonuses: { cobbles: 1, flat: 1, resistance: 1 },
  bonus: "+1 PAV · +1 PLA · +1 RES",
  detail: "Un cuissard exclusif à équiper sur un coureur, pour garder un souvenir du direct.",
  boosters: 2,
} as const;

export const GALA_S5_REWARD_PROPOSAL = [
  { places: "1er", name: "Le grand éclat", detail: "Trophée Or · cadre d’avatar exclusif Maître des Lumières · 4 boosters Cyclo-Stickers · 1 Perfectionnement technique (+1 à une note secondaire au choix)." },
  { places: "2e", name: "Le relais d’argent", detail: "Trophée Argent · 3 boosters · 2 Blocs haute intensité (deux séances collectives à progression doublée)." },
  { places: "3e", name: "Le dernier rayon", detail: "Trophée Bronze · 2 boosters · 1 bonus de qualité de scouting +20 % pendant 7 jours." },
  { places: "4e–5e", name: "La belle échappée", detail: "2 boosters · 1 Bloc haute intensité (une séance collective à progression doublée)." },
  { places: "6e–10e", name: "Le coup d’éclat", detail: "1 booster · 1 Ration énergétique (+5 de forme, dans la limite de 100)." },
] as const;
