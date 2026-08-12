import type { TrophyPalette } from "@/lib/game/trophy-gallery";

export type AchievementTrophyVisualVariant =
  "astrolabe" | "panorama" | "apparatus" | "regalia" | "switchback";

export const ACHIEVEMENT_TROPHY_DEFINITIONS = {
  atlas_peloton: {
    objectiveKey: "roster_all_continents",
    title: "Atlas du peloton",
    competitionName: "Objectif maître · Diversité",
    seasonName: "Carrière",
    inscription: "Cinq continents · Un même maillot",
    description:
      "Décerné au DS qui réunit simultanément dans son effectif des coureurs d’Afrique, d’Amérique, d’Asie, d’Europe et d’Océanie.",
    href: "/jeu/objectifs?onglet=objectifs&groupe=diversity",
    imagePath: "/images/objective-trophies/atlas-du-peloton.webp",
    visualVariant: "astrolabe" satisfies AchievementTrophyVisualVariant,
    palette: {
      primary: "#D4A847",
      secondary: "#FFF0B8",
      accent: "#0F5A48",
      glow: "rgba(212, 168, 71, 0.42)",
    } satisfies TrophyPalette,
  },
  campus_de_pointe: {
    objectiveKey: "infrastructure_performance_level_5",
    title: "Campus de pointe",
    competitionName: "Objectif maître · Infrastructures",
    seasonName: "Carrière",
    inscription: "Sept installations · Niveau 5",
    description:
      "Récompense la construction au niveau 5 de tout le campus de performance, du vélodrome au Média Center.",
    href: "/jeu/objectifs?onglet=objectifs&groupe=infrastructures",
    imagePath: "/images/objective-trophies/campus-de-pointe.webp",
    visualVariant: "panorama" satisfies AchievementTrophyVisualVariant,
    palette: {
      primary: "#DDB95D",
      secondary: "#FFF2C7",
      accent: "#155F48",
      glow: "rgba(221, 185, 93, 0.43)",
    } satisfies TrophyPalette,
  },
  alchimiste_carbone: {
    objectiveKey: "rnd_all_slots_success",
    title: "Alchimiste du carbone",
    competitionName: "Objectif maître · Laboratoire R&D",
    seasonName: "Carrière",
    inscription: "Huit familles · Huit réussites",
    description:
      "Réservé aux bureaux d’études ayant obtenu une amélioration positive sur chacune des huit familles de matériel.",
    href: "/jeu/objectifs?onglet=objectifs&groupe=research",
    imagePath: "/images/objective-trophies/alchimiste-du-carbone.webp",
    visualVariant: "apparatus" satisfies AchievementTrophyVisualVariant,
    palette: {
      primary: "#D7AA43",
      secondary: "#DFFFF5",
      accent: "#087A67",
      glow: "rgba(49, 205, 176, 0.37)",
    } satisfies TrophyPalette,
  },
  triple_couronne_integrale: {
    objectiveKey: "championship_triple_crown",
    title: "Triple Couronne intégrale",
    competitionName: "Objectif maître · Championnats",
    seasonName: "Carrière",
    inscription: "Route & CLM · National, continental, mondial",
    description:
      "La pièce la plus exigeante du palmarès : les six couronnes de champion, sur route et en CLM, aux trois niveaux.",
    href: "/jeu/objectifs?onglet=objectifs&groupe=championships",
    imagePath: "/images/objective-trophies/triple-couronne-integrale.webp",
    visualVariant: "regalia" satisfies AchievementTrophyVisualVariant,
    palette: {
      primary: "#E2B84E",
      secondary: "#FFF4C9",
      accent: "#166953",
      glow: "rgba(226, 184, 78, 0.48)",
    } satisfies TrophyPalette,
  },
  virage_cache: {
    objectiveKey: null,
    title: "Le Virage caché",
    competitionName: "Secret de Cyclostratège",
    seasonName: "Carrière",
    inscription: "La curiosité ouvre des routes",
    description:
      "Décerné aux DS qui regardent le parcours jusque dans ses plus petits détails.",
    href: null,
    imagePath: "/images/objective-trophies/virage-cache.webp",
    visualVariant: "switchback" satisfies AchievementTrophyVisualVariant,
    palette: {
      primary: "#E0B34C",
      secondary: "#D9FFF4",
      accent: "#0D7967",
      glow: "rgba(38, 224, 187, 0.43)",
    } satisfies TrophyPalette,
  },
} as const;

export type AchievementTrophyKey = keyof typeof ACHIEVEMENT_TROPHY_DEFINITIONS;

const objectiveTrophyKeyByObjective = Object.fromEntries(
  Object.entries(ACHIEVEMENT_TROPHY_DEFINITIONS).flatMap(
    ([trophyKey, definition]) =>
      definition.objectiveKey
        ? [[definition.objectiveKey, trophyKey as AchievementTrophyKey]]
        : [],
  ),
) as Record<string, AchievementTrophyKey>;

export function isAchievementTrophyKey(
  value: string,
): value is AchievementTrophyKey {
  return value in ACHIEVEMENT_TROPHY_DEFINITIONS;
}

export function getAchievementTrophyForObjective(objectiveKey: string) {
  const trophyKey = objectiveTrophyKeyByObjective[objectiveKey];
  return trophyKey ? ACHIEVEMENT_TROPHY_DEFINITIONS[trophyKey] : null;
}
