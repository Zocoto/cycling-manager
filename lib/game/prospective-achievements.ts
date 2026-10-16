import { SOCIAL_ACHIEVEMENTS } from "./social-achievements";

export const PROSPECTIVE_ACHIEVEMENTS_START_LABEL = "15 octobre 2026";

export const PROSPECTIVE_ACHIEVEMENTS = {
  ...SOCIAL_ACHIEVEMENTS,
  natural_progress: { title: "Ça progresse !", group: "training", targets: [1, 3, 5],
    descriptions: [1, 3, 5].map(n => `Gagner ${n} point${n > 1 ? "s nets" : " net"} dans une même note principale d’un même coureur grâce aux entraînements réalisés dans votre équipe, hors objets bonus.`) },
  tailored_setup: { title: "Le sens du détail", group: "equipment", targets: [1, 5, 20],
    descriptions: [1, 5, 20].map(n => `Achever ${n} course${n > 1 ? "s" : ""} avec au moins un coureur ayant terminé une étape avec un montage spécifique, différent de son équipement habituel.`) },
  panache: { title: "Le panache avant tout", group: "racing", targets: [1, 5, 20],
    descriptions: [1, 5, 20].map(n => `Remporter ${n} prix de la combativité sur des courses officielles seniors.`) },
  world_traveler: { title: "Voyage, voyage", group: "participations", targets: [3, 10, 20],
    descriptions: [3, 10, 20].map(n => `Achever des courses officielles seniors dans ${n} pays différents.`) },
  shopkeeper: { title: "Boutique bien tenue", group: "fan_club", targets: [3, 7, 14], cosmetic: "career-shopkeeper",
    descriptions: [3, 7, 14].map(n => `Réaliser des ventes à marge positive pendant ${n} journées de jeu consécutives, en gardant tous les articles standards débloqués en stock après les ventes et avant le réapprovisionnement automatique.`) },
  mentor: { title: "Le maître d’apprentissage", group: "staff", targets: [3, 4, 5], cosmetic: "career-mentor",
    descriptions: [3, 4, 5].map(n => `Former le même membre du staff du niveau 1 au niveau ${n}, uniquement par des formations de niveau achevées après l’activation de ces succès.`) },
  research_podium: { title: "Du labo au podium", group: "research", targets: [1, 2, 3],
    descriptions: ["Obtenir un podium", "Remporter une course", "Remporter un Monument ou le général d’un Grand Tour"].map(goal => `${goal} avec un coureur ayant bénéficié sur cette course d’un bonus positif d’un prototype produit par votre propre laboratoire.`) },
  homegrown: { title: "Pur produit maison", group: "youth", targets: [1, 2, 3], cosmetic: "career-homegrown",
    descriptions: ["Obtenir un podium professionnel", "Remporter une course professionnelle", "Remporter un Monument ou le général d’un Grand Tour"].map(goal => `${goal} avec un junior détecté, entraîné puis promu dans votre propre centre de formation.`) },
  three_tours: { title: "Le seigneur des trois Tours", group: "grand_tours", targets: [1, 2, 3],
    descriptions: [1, 2, 3].map(n => `Remporter le général de ${n} Grand${n > 1 ? "s" : ""} Tour${n > 1 ? "s" : ""} différent${n > 1 ? "s" : ""} avec le même coureur. Les victoires peuvent s’étaler sur plusieurs saisons.`) },
  family_photo: { title: "Photo de famille", group: "racing", targets: [1], secret: true,
    descriptions: ["Placer trois coureurs de l’équipe aux trois premières places d’une course officielle senior, hors initiation et gala."] },
  upset: { title: "Personne ne l’avait vu venir", group: "racing", targets: [1], secret: true,
    descriptions: ["Remporter une course officielle senior d’un jour avec un coureur absent des dix premiers favoris figés avant le départ, dans un peloton de plus de dix partants."] },
} as const;

export type ProspectiveAchievementKey = keyof typeof PROSPECTIVE_ACHIEVEMENTS;
export const PROSPECTIVE_ACHIEVEMENT_KEYS = Object.keys(PROSPECTIVE_ACHIEVEMENTS) as ProspectiveAchievementKey[];
export const CAREER_AVATAR_OUTFITS = ["career-shopkeeper", "career-mentor", "career-homegrown"] as const;

export function getProspectiveAchievement(key: string) {
  const match = /^journey_(.+)_(bronze|silver|gold)$/.exec(key);
  if (!match || !Object.hasOwn(PROSPECTIVE_ACHIEVEMENTS, match[1])) return null;
  const familyKey = match[1] as ProspectiveAchievementKey;
  return { familyKey, definition: PROSPECTIVE_ACHIEVEMENTS[familyKey],
    tier: match[2] as "bronze" | "silver" | "gold" };
}

export function getCareerOutfitObjective(outfit: string) {
  const family = PROSPECTIVE_ACHIEVEMENT_KEYS.find(key => {
    const definition = PROSPECTIVE_ACHIEVEMENTS[key];
    return "cosmetic" in definition && definition.cosmetic === outfit;
  });
  return family ? `journey_${family}_gold` : null;
}
