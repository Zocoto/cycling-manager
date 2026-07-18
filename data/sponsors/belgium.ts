import type { Sponsor } from "@/types/sponsor";

export const BELGIAN_SPONSORS = [
  {
    id: "ardennes-outillage",
    name: "Ardennes Outillage",
    shortName: "Ardennes",
    countryCode: "BE",
    sector: "Outillage industriel",
    description:
      "Un fabricant belge d’outillage robuste, historiquement lié aux entreprises et artisans locaux.",
    prestige: 2,
    minimumReputation: 10,
    budgetRange: {
      min: 420_000,
      max: 580_000,
    },
    contractDurationRange: {
      min: 1,
      max: 2,
    },
    logoPath: "/images/sponsors/ardennes-outillage/logo.png",
    jerseys: [
      {
        id: "ardennes-outillage-classic",
        name: "Atelier",
        style: "classic",
        imagePath:
          "/images/sponsors/ardennes-outillage/jersey-classic.png",
      },
      {
        id: "ardennes-outillage-modern",
        name: "Acier",
        style: "modern",
        imagePath:
          "/images/sponsors/ardennes-outillage/jersey-modern.png",
      },
      {
        id: "ardennes-outillage-bold",
        name: "Étincelles",
        style: "bold",
        imagePath:
          "/images/sponsors/ardennes-outillage/jersey-bold.png",
      },
    ],
    colors: {
      primary: "#20252B",
      secondary: "#D9DEE3",
      accent: "#E4572E",
      background: "#F4F5F6",
      text: "#161A1E",
    },
  },
] satisfies readonly Sponsor[];