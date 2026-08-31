import type { TrophyPalette } from "@/lib/game/trophy-gallery";

export type AchievementTrophyVisualVariant =
  | "astrolabe"
  | "panorama"
  | "apparatus"
  | "regalia"
  | "switchback"
  | "poker-chips";

export const INVETERATE_PLAYER_TROPHY_KEY = "joueur_inveter";

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
    visualVariant: "astrolabe" satisfies AchievementTrophyVisualVariant,
    palette: {
      primary: "#70A7E8",
      secondary: "#EAF4FF",
      accent: "#314F8F",
      glow: "rgba(112, 167, 232, 0.38)",
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
    visualVariant: "panorama" satisfies AchievementTrophyVisualVariant,
    palette: {
      primary: "#D8895B",
      secondary: "#FFF1E5",
      accent: "#2E7E78",
      glow: "rgba(216, 137, 91, 0.38)",
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
    visualVariant: "apparatus" satisfies AchievementTrophyVisualVariant,
    palette: {
      primary: "#47D6C7",
      secondary: "#E5FFFB",
      accent: "#B96C42",
      glow: "rgba(71, 214, 199, 0.35)",
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
    visualVariant: "regalia" satisfies AchievementTrophyVisualVariant,
    palette: {
      primary: "#D8C7A7",
      secondary: "#FFF5E5",
      accent: "#7B2A3B",
      glow: "rgba(216, 199, 167, 0.4)",
    } satisfies TrophyPalette,
  },
  virage_cache: {
    objectiveKey: null,
    title: "Le Virage caché",
    competitionName: "Secret de Cyclostratège",
    seasonName: "Carrière",
    inscription: "La curiosité ouvre des routes",
    description:
      "Décerné aux DS qui regardent le parcours jusque dans ses plus petits détails. Offre 100 000 €, deux objets de talent +1 étoile et les lunettes d’espion.",
    href: null,
    visualVariant: "switchback" satisfies AchievementTrophyVisualVariant,
    palette: {
      primary: "#A58AF4",
      secondary: "#EEE8FF",
      accent: "#246C73",
      glow: "rgba(165, 138, 244, 0.38)",
    } satisfies TrophyPalette,
  },
  [INVETERATE_PLAYER_TROPHY_KEY]: {
    objectiveKey: null,
    title: "Joueur invétéré",
    competitionName: "Les jeux de La Cyclogazette",
    seasonName: "Carrière",
    inscription: "Dix éditions · Deux grilles parfaites par jour",
    description:
      "Trophée caché remis après dix éditions consécutives avec le Sudoku et les mots croisés réussis. Offre 50 000 €, 250 XP, 15 points de réputation et les piles de jetons dans l’éditeur d’avatar.",
    href: "/jeu/directeur-sportif#inveterate-player-avatar-outfit",
    visualVariant: "poker-chips" satisfies AchievementTrophyVisualVariant,
    palette: {
      primary: "#D7A928",
      secondary: "#FFF1B8",
      accent: "#684DA0",
      glow: "rgba(215, 169, 40, 0.42)",
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
