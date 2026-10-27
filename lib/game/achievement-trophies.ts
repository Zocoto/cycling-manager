import type { TrophyPalette } from "@/lib/game/trophy-gallery";
import { PROSPECTIVE_ACHIEVEMENTS, PROSPECTIVE_ACHIEVEMENT_KEYS, type ProspectiveAchievementKey } from "./prospective-achievements";

export type JourneyTrophyVisualVariant = `journey-${ProspectiveAchievementKey}`;

function journeyPalette(primary: string, secondary: string, accent: string): TrophyPalette {
  return { primary, secondary, accent, glow: `${primary}59` };
}

// Explicit catalogue: a new career family must choose its own colours and emblem.
const journeyPalettes: Record<ProspectiveAchievementKey, TrophyPalette> = {
  community_days: journeyPalette("#59D7B3", "#E8FFF5", "#163F3B"),
  private_contacts: journeyPalette("#59BFE6", "#E8F8FF", "#173D58"),
  transfer_sent: journeyPalette("#F2AE65", "#FFF1DA", "#68442D"),
  transfer_received: journeyPalette("#BD9AF5", "#F3ECFF", "#3D285C"),
  interview_support_given: journeyPalette("#F3A5C7", "#FFF0F7", "#5B2B49"),
  interview_support_received: journeyPalette("#FFD268", "#FFF6D6", "#6C4524"),
  gazette_days: journeyPalette("#D6C6A0", "#FFFBEA", "#49413A"),
  game_variety: journeyPalette("#92BFEF", "#EDF5FF", "#293F68"),
  first_deal: journeyPalette("#D9986D", "#FFF0DF", "#4D3227"),
  interview_regular: journeyPalette("#AC9FF4", "#F4EFFF", "#342B60"),
  natural_progress: journeyPalette("#9DDB75", "#F1FFE0", "#2F522C"),
  tailored_setup: journeyPalette("#A8CBDC", "#EEFAFF", "#284B61"),
  panache: journeyPalette("#F08262", "#FFF0D8", "#662B2B"),
  world_traveler: journeyPalette("#71C5DF", "#ECFAFF", "#17465D"),
  shopkeeper: journeyPalette("#E6B563", "#FFF1CD", "#584128"),
  mentor: journeyPalette("#C4A2ED", "#F7EFFF", "#4A3263"),
  research_podium: journeyPalette("#75DCD5", "#E6FFFA", "#214D54"),
  homegrown: journeyPalette("#6CCB91", "#F1FFE9", "#204D37"),
  three_tours: journeyPalette("#F6CC65", "#FFF7D9", "#60442A"),
  family_photo: journeyPalette("#91ADEA", "#EFF4FF", "#2D3C64"),
  upset: journeyPalette("#DDA3ED", "#FCEDFF", "#512961"),
};

const prospectiveTrophies = Object.fromEntries(PROSPECTIVE_ACHIEVEMENT_KEYS.map(key => {
  const definition = PROSPECTIVE_ACHIEVEMENTS[key];
  return [`journey_${key}`, {
    objectiveKey: `journey_${key}_gold`, title: definition.title,
    competitionName: "Objectif de carrière accompli", seasonName: "Carrière",
    inscription: "Un parcours · Une histoire", description: definition.descriptions.at(-1)!,
    href: `/jeu/objectifs?onglet=objectifs&groupe=${definition.group}`,
    visualVariant: `journey-${key}` as const,
    palette: journeyPalettes[key],
  }];
})) as { [K in ProspectiveAchievementKey as `journey_${K}`]: {
  objectiveKey: string; title: string; competitionName: string; seasonName: string;
  inscription: string; description: string; href: string; visualVariant: `journey-${K}`; palette: TrophyPalette;
} };

export type AchievementTrophyVisualVariant =
  | JourneyTrophyVisualVariant
  | "first-pedals"
  | "astrolabe"
  | "panorama"
  | "apparatus"
  | "regalia"
  | "presidential-seal"
  | "switchback"
  | "poker-chips"
  | "midnight-auction";

export const INVETERATE_PLAYER_TROPHY_KEY = "joueur_inveter";
export const NIGHT_AUCTION_TROPHY_KEY = "jusqu_au_bout_de_la_nuit";
export const EL_PRESIDENTE_TROPHY_KEY = "el_presidente";
export const NEWCOMER_JOURNEY_TROPHY_KEY = "premiers_tours_de_roue";

export const ACHIEVEMENT_TROPHY_DEFINITIONS = {
  ...prospectiveTrophies,
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
  [NIGHT_AUCTION_TROPHY_KEY]: {
    objectiveKey: null,
    title: "Jusqu’au bout de la nuit",
    competitionName: "Enchères nocturnes",
    seasonName: "Carrière",
    inscription: "Participer à une enchère prolongée jusqu’à 22 h",
    description:
      "Décerné à tous les DS ayant enchéri sur une vente quotidienne dont les prolongations repoussent la clôture à 22 h ou au-delà. Offre 50 000 €, 250 XP, 15 points de réputation et le skin Cernes dans l’éditeur d’avatar.",
    href: "/jeu/directeur-sportif#night-auction-avatar-skin",
    targetHref: "/jeu/transferts",
    visualVariant: "midnight-auction" satisfies AchievementTrophyVisualVariant,
    palette: {
      primary: "#7B8FD1",
      secondary: "#E9ECFF",
      accent: "#E0A84B",
      glow: "rgba(123, 143, 209, 0.42)",
    } satisfies TrophyPalette,
  },
  [EL_PRESIDENTE_TROPHY_KEY]: {
    objectiveKey: null,
    title: "El Presidente",
    competitionName: "Présidence fédérale",
    seasonName: "Carrière",
    inscription: "Élu pour servir le cyclisme national",
    description:
      "Décerné dès la prise de fonction à la présidence d’une fédération. Débloque la tenue officielle El Presidente dans l’éditeur d’avatar et reste acquis pour toute la carrière.",
    href: "/jeu/directeur-sportif#el-presidente-avatar-outfit",
    visualVariant: "presidential-seal" satisfies AchievementTrophyVisualVariant,
    palette: {
      primary: "#D7A928",
      secondary: "#FFF4C9",
      accent: "#176951",
      glow: "rgba(215, 169, 40, 0.42)",
    } satisfies TrophyPalette,
  },
  [NEWCOMER_JOURNEY_TROPHY_KEY]: {
    objectiveKey: null,
    title: "Premiers tours de roue",
    competitionName: "Parcours de bienvenue",
    seasonName: "Carrière",
    inscription: "Huit repères · Une carrière lancée",
    description:
      "Décerné aux nouveaux DS qui accomplissent les huit étapes de prise en main, de leur premier cadeau jusqu’au premier direct suivi.",
    href: "/jeu/objectifs?onglet=trophees",
    visualVariant: "first-pedals" satisfies AchievementTrophyVisualVariant,
    palette: {
      primary: "#42B99A",
      secondary: "#E9FFF6",
      accent: "#D9AC12",
      glow: "rgba(66, 185, 154, 0.4)",
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
