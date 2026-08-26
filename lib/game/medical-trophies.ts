import type { TrophyPalette } from "@/lib/game/trophy-gallery";

export const AMBULANCIER_TROPHY_KEY = "ambulancier";
export const EMERGENCY_DOCTOR_TROPHY_KEY = "medecin_urgentiste";

export const AMBULANCIER_AVATAR_OUTFIT_KEY = "nurse-cap";
export const EMERGENCY_DOCTOR_AVATAR_OUTFIT_KEY = "emergency-doctor";

export type MedicalTrophyKey =
  | typeof AMBULANCIER_TROPHY_KEY
  | typeof EMERGENCY_DOCTOR_TROPHY_KEY;

export type MedicalTrophyVisualVariant = "nurse" | "emergency-doctor";

export const MEDICAL_TROPHY_DEFINITIONS = {
  [AMBULANCIER_TROPHY_KEY]: {
    key: AMBULANCIER_TROPHY_KEY,
    title: "Ambulancier",
    competitionName: "Infirmerie · 5 blessés simultanés",
    seasonName: "Carrière",
    inscription: "Garder le cap avec 5 coureurs à l’infirmerie",
    description:
      "Décerné dès que 5 coureurs de l’équipe sont blessés au même moment. Offre 25 000 € et débloque définitivement le chapeau d’infirmière dans l’éditeur d’avatar.",
    href: "/jeu/centre-de-soin",
    threshold: 5,
    cashReward: 25_000,
    outfitKey: AMBULANCIER_AVATAR_OUTFIT_KEY,
    visualVariant: "nurse",
    palette: {
      primary: "#E1535B",
      secondary: "#FFF7EB",
      accent: "#176B62",
      glow: "rgba(225, 83, 91, 0.4)",
    } satisfies TrophyPalette,
  },
  [EMERGENCY_DOCTOR_TROPHY_KEY]: {
    key: EMERGENCY_DOCTOR_TROPHY_KEY,
    title: "Médecin urgentiste",
    competitionName: "Alerte médicale · 10 blessés simultanés",
    seasonName: "Carrière",
    inscription: "Piloter une équipe avec 10 coureurs indisponibles",
    description:
      "Décerné dès que 10 coureurs de l’équipe sont blessés au même moment. Offre 75 000 € et débloque définitivement la blouse de docteur avec stéthoscope.",
    href: "/jeu/centre-de-soin",
    threshold: 10,
    cashReward: 75_000,
    outfitKey: EMERGENCY_DOCTOR_AVATAR_OUTFIT_KEY,
    visualVariant: "emergency-doctor",
    palette: {
      primary: "#43B6A3",
      secondary: "#F7FFFF",
      accent: "#B62F46",
      glow: "rgba(67, 182, 163, 0.42)",
    } satisfies TrophyPalette,
  },
} as const;

export function isMedicalTrophyKey(value: string): value is MedicalTrophyKey {
  return value in MEDICAL_TROPHY_DEFINITIONS;
}
