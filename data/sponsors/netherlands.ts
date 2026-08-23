import type { Sponsor } from "@/types/sponsor";

export const DUTCH_SPONSORS = [
  {
    id: "deltaflow-engineering",
    name: "DeltaFlow Engineering",
    shortName: "DeltaFlow",
    countryCode: "NL",
    sector: "Génie hydraulique",
    description:
      "Un groupe d’ingénierie néerlandais spécialisé dans la maîtrise de l’eau, les ouvrages hydrauliques et les infrastructures résilientes.",
    prestige: 5,
    minimumReputation: 55,
    budgetRange: {
      min: 1_100_000,
      max: 1_700_000,
    },
    contractDurationRange: {
      min: 2,
      max: 3,
    },
    logoPath:
      "/images/sponsors/deltaflow-engineering/logo.webp",
    jerseys: [
      {
        id: "deltaflow-engineering-classic",
        name: "Digue",
        style: "classic",
        imagePath:
          "/images/sponsors/deltaflow-engineering/jersey-classic.webp",
      },
      {
        id: "deltaflow-engineering-modern",
        name: "Courant",
        style: "modern",
        imagePath:
          "/images/sponsors/deltaflow-engineering/jersey-modern.webp",
      },
      {
        id: "deltaflow-engineering-bold",
        name: "Maîtrise des eaux",
        style: "bold",
        imagePath:
          "/images/sponsors/deltaflow-engineering/jersey-bold.webp",
      },
    ],
    colors: {
      primary: "#0057B8",
      secondary: "#4CC9F0",
      accent: "#FFFFFF",
      background: "#EEF8FD",
      text: "#003B7A",
    },
  },
  {
    id: "tulipa-flora",
    name: "Tulipa Flora",
    shortName: "Tulipa Flora",
    countryCode: "NL",
    sector: "Horticulture",
    description:
      "Une maison horticole néerlandaise qui valorise la culture des tulipes, l’élégance florale et un savoir-faire exporté dans toute l’Europe.",
    prestige: 3,
    minimumReputation: 15,
    budgetRange: {
      min: 320_000,
      max: 520_000,
    },
    contractDurationRange: {
      min: 1,
      max: 2,
    },
    logoPath:
      "/images/sponsors/tulipa-flora/logo.webp",
    jerseys: [
      {
        id: "tulipa-flora-classic",
        name: "Jardin",
        style: "classic",
        imagePath:
          "/images/sponsors/tulipa-flora/jersey-classic.webp",
      },
      {
        id: "tulipa-flora-modern",
        name: "Pétales",
        style: "modern",
        imagePath:
          "/images/sponsors/tulipa-flora/jersey-modern.webp",
      },
      {
        id: "tulipa-flora-bold",
        name: "Champ de tulipes",
        style: "bold",
        imagePath:
          "/images/sponsors/tulipa-flora/jersey-bold.webp",
      },
    ],
    colors: {
      primary: "#E83F6F",
      secondary: "#63B64F",
      accent: "#FFFFFF",
      background: "#FFF5F8",
      text: "#5B1831",
    },
  },
  {
    id: "orange-freight",
    name: "Orange Freight",
    shortName: "Orange Freight",
    countryCode: "NL",
    sector: "Transport et logistique",
    description:
      "Un opérateur logistique néerlandais reliant les grands ports, plateformes et corridors routiers européens avec rapidité et fiabilité.",
    prestige: 4,
    minimumReputation: 30,
    budgetRange: {
      min: 600_000,
      max: 900_000,
    },
    contractDurationRange: {
      min: 2,
      max: 3,
    },
    logoPath:
      "/images/sponsors/orange-freight/logo.webp",
    jerseys: [
      {
        id: "orange-freight-classic",
        name: "Corridor",
        style: "classic",
        imagePath:
          "/images/sponsors/orange-freight/jersey-classic.webp",
      },
      {
        id: "orange-freight-modern",
        name: "Connexions",
        style: "modern",
        imagePath:
          "/images/sponsors/orange-freight/jersey-modern.webp",
      },
      {
        id: "orange-freight-bold",
        name: "Réseau européen",
        style: "bold",
        imagePath:
          "/images/sponsors/orange-freight/jersey-bold.webp",
      },
    ],
    colors: {
      primary: "#F58220",
      secondary: "#003A70",
      accent: "#FFFFFF",
      background: "#FFF8F0",
      text: "#003A70",
    },
  },
  {
    id: "urbanride-mobility",
    name: "UrbanRide Mobility",
    shortName: "UrbanRide",
    countryCode: "NL",
    sector: "Mobilité douce",
    description:
      "Un acteur néerlandais de la mobilité douce qui développe des solutions cyclables et des services urbains connectés pour les villes européennes.",
    prestige: 3,
    minimumReputation: 20,
    budgetRange: {
      min: 350_000,
      max: 600_000,
    },
    contractDurationRange: {
      min: 1,
      max: 3,
    },
    logoPath:
      "/images/sponsors/urbanride-mobility/logo.webp",
    jerseys: [
      {
        id: "urbanride-mobility-classic",
        name: "Piste urbaine",
        style: "classic",
        imagePath:
          "/images/sponsors/urbanride-mobility/jersey-classic.webp",
      },
      {
        id: "urbanride-mobility-modern",
        name: "Mobilité",
        style: "modern",
        imagePath:
          "/images/sponsors/urbanride-mobility/jersey-modern.webp",
      },
      {
        id: "urbanride-mobility-bold",
        name: "Ville cyclable",
        style: "bold",
        imagePath:
          "/images/sponsors/urbanride-mobility/jersey-bold.webp",
      },
    ],
    colors: {
      primary: "#1B998B",
      secondary: "#2D3047",
      accent: "#FFFFFF",
      background: "#F1FCFA",
      text: "#2D3047",
    },
  },
  {
    id: "windmill-foods",
    name: "WindMill Foods",
    shortName: "WindMill",
    countryCode: "NL",
    sector: "Agroalimentaire",
    description:
      "Une entreprise agroalimentaire néerlandaise attachée aux produits du terroir, à la qualité des filières agricoles et aux traditions du pays.",
    prestige: 2,
    minimumReputation: 0,
    budgetRange: {
      min: 180_000,
      max: 320_000,
    },
    contractDurationRange: {
      min: 1,
      max: 2,
    },
    logoPath:
      "/images/sponsors/windmill-foods/logo.webp",
    jerseys: [
      {
        id: "windmill-foods-classic",
        name: "Tradition",
        style: "classic",
        imagePath:
          "/images/sponsors/windmill-foods/jersey-classic.webp",
      },
      {
        id: "windmill-foods-modern",
        name: "Grands vents",
        style: "modern",
        imagePath:
          "/images/sponsors/windmill-foods/jersey-modern.webp",
      },
      {
        id: "windmill-foods-bold",
        name: "Terres du Nord",
        style: "bold",
        imagePath:
          "/images/sponsors/windmill-foods/jersey-bold.webp",
      },
    ],
    colors: {
      primary: "#204E5F",
      secondary: "#F4D35E",
      accent: "#FFFFFF",
      background: "#FAF9F2",
      text: "#204E5F",
    },
  },
] satisfies readonly Sponsor[];
