import type { Sponsor } from "@/types/sponsor";

export const BAHAMIAN_SPONSORS = [
  {
    id: "arawak-cay-conch-kitchens",
    name: "Arawak Cay Conch Kitchens",
    shortName: "Arawak Cay",
    countryCode: "BS",
    sector: "Restauration de conque et gastronomie bahaméenne",
    description:
      "Un collectif de cuisines de Nassau qui prépare conque, poissons et recettes bahaméennes pour les marchés, événements et établissements d’Arawak Cay.",
    prestige: 1,
    minimumReputation: 0,
    budgetRange: { min: 120_000, max: 230_000 },
    contractDurationRange: { min: 1, max: 2 },
    logoPath: "/images/sponsors/arawak-cay-conch-kitchens/logo.webp",
    jerseys: [
      {
        id: "arawak-cay-conch-kitchens-classic",
        name: "Conque",
        style: "classic",
        imagePath:
          "/images/sponsors/arawak-cay-conch-kitchens/jersey-classic.webp",
      },
      {
        id: "arawak-cay-conch-kitchens-modern",
        name: "Arawak",
        style: "modern",
        imagePath:
          "/images/sponsors/arawak-cay-conch-kitchens/jersey-modern.webp",
      },
      {
        id: "arawak-cay-conch-kitchens-bold",
        name: "Caye épicée",
        style: "bold",
        imagePath:
          "/images/sponsors/arawak-cay-conch-kitchens/jersey-bold.webp",
      },
    ],
    colors: {
      primary: "#123D54",
      secondary: "#F4B5A6",
      accent: "#F2C94C",
      background: "#F8EFE0",
      text: "#123D54",
    },
  },
  {
    id: "junkanoo-brass-feather",
    name: "Junkanoo Brass & Feather",
    shortName: "Brass & Feather",
    countryCode: "BS",
    sector: "Costumes de parade et instruments de fanfare",
    description:
      "Un atelier bahaméen qui conçoit costumes, coiffes, cuivres et percussions pour les parades Junkanoo, les groupes culturels et les productions scéniques.",
    prestige: 2,
    minimumReputation: 30,
    budgetRange: { min: 260_000, max: 460_000 },
    contractDurationRange: { min: 1, max: 2 },
    logoPath: "/images/sponsors/junkanoo-brass-feather/logo.webp",
    jerseys: [
      {
        id: "junkanoo-brass-feather-classic",
        name: "Parade",
        style: "classic",
        imagePath:
          "/images/sponsors/junkanoo-brass-feather/jersey-classic.webp",
      },
      {
        id: "junkanoo-brass-feather-modern",
        name: "Cuivres",
        style: "modern",
        imagePath:
          "/images/sponsors/junkanoo-brass-feather/jersey-modern.webp",
      },
      {
        id: "junkanoo-brass-feather-bold",
        name: "Rush Out",
        style: "bold",
        imagePath:
          "/images/sponsors/junkanoo-brass-feather/jersey-bold.webp",
      },
    ],
    colors: {
      primary: "#161826",
      secondary: "#CE2E78",
      accent: "#F0B429",
      background: "#F7F1DF",
      text: "#161826",
    },
  },
  {
    id: "freeport-drydock-alliance",
    name: "Freeport Drydock Alliance",
    shortName: "Freeport Drydock",
    countryCode: "BS",
    sector: "Cales sèches et réparation navale",
    description:
      "Un consortium industriel de Grand Bahama spécialisé dans l’entretien de coques, la réparation de navires et les opérations techniques en cale sèche.",
    prestige: 4,
    minimumReputation: 500,
    budgetRange: { min: 1_000_000, max: 1_650_000 },
    contractDurationRange: { min: 2, max: 3 },
    logoPath: "/images/sponsors/freeport-drydock-alliance/logo.webp",
    jerseys: [
      {
        id: "freeport-drydock-alliance-classic",
        name: "Dockline",
        style: "classic",
        imagePath:
          "/images/sponsors/freeport-drydock-alliance/jersey-classic.webp",
      },
      {
        id: "freeport-drydock-alliance-modern",
        name: "Portique",
        style: "modern",
        imagePath:
          "/images/sponsors/freeport-drydock-alliance/jersey-modern.webp",
      },
      {
        id: "freeport-drydock-alliance-bold",
        name: "Carène",
        style: "bold",
        imagePath:
          "/images/sponsors/freeport-drydock-alliance/jersey-bold.webp",
      },
    ],
    colors: {
      primary: "#102C44",
      secondary: "#748995",
      accent: "#F27A2D",
      background: "#EEF3F4",
      text: "#102C44",
    },
  },
] satisfies readonly Sponsor[];
