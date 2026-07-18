import type { Sponsor } from "@/types/sponsor";

export const SPANISH_SPONSORS = [
  {
    id: "sol-del-sur",
    name: "Sol del Sur",
    shortName: "Sol",
    countryCode: "ES",
    sector: "Énergie solaire",
    description:
      "Un producteur espagnol d’énergie renouvelable désireux de rayonner sur les routes européennes.",
    prestige: 3,
    minimumReputation: 30,
    budgetRange: {
      min: 650_000,
      max: 850_000,
    },
    contractDurationRange: {
      min: 1,
      max: 3,
    },
    logoPath: "/images/sponsors/sol-del-sur/logo.png",
    jerseys: [
      {
        id: "sol-del-sur-classic",
        name: "Horizon",
        style: "classic",
        imagePath:
          "/images/sponsors/sol-del-sur/jersey-classic.png",
      },
      {
        id: "sol-del-sur-modern",
        name: "Rayonnement",
        style: "modern",
        imagePath:
          "/images/sponsors/sol-del-sur/jersey-modern.png",
      },
      {
        id: "sol-del-sur-bold",
        name: "Plein soleil",
        style: "bold",
        imagePath:
          "/images/sponsors/sol-del-sur/jersey-bold.png",
      },
    ],
    colors: {
      primary: "#D97706",
      secondary: "#FFF3C4",
      accent: "#DC2626",
      background: "#FFFBEB",
      text: "#4A2B08",
    },
  },
] satisfies readonly Sponsor[];