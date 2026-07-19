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
    logoPath:
      "/images/sponsors/ardennes-outillage/logo.png",
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
  {
    id: "veloria-bank",
    name: "Veloria Bank",
    shortName: "Veloria",
    countryCode: "BE",
    sector: "Banque et finance",
    description:
      "Un groupe bancaire belge attaché à la stabilité, à l’élégance et à l’accompagnement durable des particuliers comme des entreprises.",
    prestige: 4,
    minimumReputation: 35,
    budgetRange: {
      min: 650_000,
      max: 950_000,
    },
    contractDurationRange: {
      min: 2,
      max: 3,
    },
    logoPath:
      "/images/sponsors/veloria-bank/logo.png",
    jerseys: [
      {
        id: "veloria-bank-classic",
        name: "Héritage",
        style: "classic",
        imagePath:
          "/images/sponsors/veloria-bank/jersey-classic.png",
      },
      {
        id: "veloria-bank-modern",
        name: "Ligne dorée",
        style: "modern",
        imagePath:
          "/images/sponsors/veloria-bank/jersey-modern.png",
      },
      {
        id: "veloria-bank-bold",
        name: "Prestige",
        style: "bold",
        imagePath:
          "/images/sponsors/veloria-bank/jersey-bold.png",
      },
    ],
    colors: {
      primary: "#0D2B5C",
      secondary: "#C7A34B",
      accent: "#FFFFFF",
      background: "#EEF3F9",
      text: "#0D2B5C",
    },
  },
  {
    id: "nordika-glass",
    name: "Nordika Glass",
    shortName: "Nordika",
    countryCode: "BE",
    sector: "Industrie du verre",
    description:
      "Un spécialiste belge du verre technique et architectural, reconnu pour la précision de ses procédés et ses solutions à haute performance.",
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
      "/images/sponsors/nordika-glass/logo.png",
    jerseys: [
      {
        id: "nordika-glass-classic",
        name: "Cristal",
        style: "classic",
        imagePath:
          "/images/sponsors/nordika-glass/jersey-classic.png",
      },
      {
        id: "nordika-glass-modern",
        name: "Prisme",
        style: "modern",
        imagePath:
          "/images/sponsors/nordika-glass/jersey-modern.png",
      },
      {
        id: "nordika-glass-bold",
        name: "Éclats",
        style: "bold",
        imagePath:
          "/images/sponsors/nordika-glass/jersey-bold.png",
      },
    ],
    colors: {
      primary: "#00A7C4",
      secondary: "#4F5D75",
      accent: "#FFFFFF",
      background: "#F3FBFD",
      text: "#263241",
    },
  },
  {
    id: "brassel-foods",
    name: "Brassel Foods",
    shortName: "Brassel",
    countryCode: "BE",
    sector: "Agroalimentaire",
    description:
      "Une entreprise agroalimentaire familiale misant sur la proximité, les recettes accessibles et des produits inspirés des traditions belges.",
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
      "/images/sponsors/brassel-foods/logo.png",
    jerseys: [
      {
        id: "brassel-foods-classic",
        name: "Maison",
        style: "classic",
        imagePath:
          "/images/sponsors/brassel-foods/jersey-classic.png",
      },
      {
        id: "brassel-foods-modern",
        name: "Saveurs",
        style: "modern",
        imagePath:
          "/images/sponsors/brassel-foods/jersey-modern.png",
      },
      {
        id: "brassel-foods-bold",
        name: "Festin",
        style: "bold",
        imagePath:
          "/images/sponsors/brassel-foods/jersey-bold.png",
      },
    ],
    colors: {
      primary: "#D7263D",
      secondary: "#FFD166",
      accent: "#FFFFFF",
      background: "#FFF8EC",
      text: "#5B1722",
    },
  },
  {
    id: "lumen-energy",
    name: "Lumen Energy",
    shortName: "Lumen",
    countryCode: "BE",
    sector: "Énergie renouvelable",
    description:
      "Un énergéticien belge de premier plan investissant dans l’électricité renouvelable, les réseaux intelligents et les infrastructures de la transition énergétique.",
    prestige: 5,
    minimumReputation: 60,
    budgetRange: {
      min: 1_200_000,
      max: 1_700_000,
    },
    contractDurationRange: {
      min: 2,
      max: 3,
    },
    logoPath:
      "/images/sponsors/lumen-energy/logo.png",
    jerseys: [
      {
        id: "lumen-energy-classic",
        name: "Transition",
        style: "classic",
        imagePath:
          "/images/sponsors/lumen-energy/jersey-classic.png",
      },
      {
        id: "lumen-energy-modern",
        name: "Flux",
        style: "modern",
        imagePath:
          "/images/sponsors/lumen-energy/jersey-modern.png",
      },
      {
        id: "lumen-energy-bold",
        name: "Énergie vive",
        style: "bold",
        imagePath:
          "/images/sponsors/lumen-energy/jersey-bold.png",
      },
    ],
    colors: {
      primary: "#00B86B",
      secondary: "#12355B",
      accent: "#FFFFFF",
      background: "#F2FFF8",
      text: "#12355B",
    },
  },
  {
    id: "azur-logistics",
    name: "Azur Logistics",
    shortName: "Azur",
    countryCode: "BE",
    sector: "Transport et logistique",
    description:
      "Un opérateur logistique belge actif dans le Benelux et sur les grands corridors européens, valorisant la rapidité, la fiabilité et la maîtrise des délais.",
    prestige: 3,
    minimumReputation: 20,
    budgetRange: {
      min: 350_000,
      max: 650_000,
    },
    contractDurationRange: {
      min: 1,
      max: 3,
    },
    logoPath:
      "/images/sponsors/azur-logistics/logo.png",
    jerseys: [
      {
        id: "azur-logistics-classic",
        name: "Itinéraire",
        style: "classic",
        imagePath:
          "/images/sponsors/azur-logistics/jersey-classic.png",
      },
      {
        id: "azur-logistics-modern",
        name: "Corridor",
        style: "modern",
        imagePath:
          "/images/sponsors/azur-logistics/jersey-modern.png",
      },
      {
        id: "azur-logistics-bold",
        name: "Grand départ",
        style: "bold",
        imagePath:
          "/images/sponsors/azur-logistics/jersey-bold.png",
      },
    ],
    colors: {
      primary: "#0066CC",
      secondary: "#F28F16",
      accent: "#FFFFFF",
      background: "#F4F9FE",
      text: "#163A5F",
    },
  },
  {
    id: "abbaye-du-lion",
    name: "Abbaye du Lion",
    shortName: "Abbaye du Lion",
    countryCode: "BE",
    sector: "Brasserie artisanale",
    description:
      "Une brasserie belge indépendante puisant dans l’héritage brassicole des abbayes et défendant une identité chaleureuse fondée sur le terroir et la convivialité.",
    prestige: 4,
    minimumReputation: 25,
    budgetRange: {
      min: 550_000,
      max: 850_000,
    },
    contractDurationRange: {
      min: 2,
      max: 3,
    },
    logoPath:
      "/images/sponsors/abbaye-du-lion/logo.png",
    jerseys: [
      {
        id: "abbaye-du-lion-classic",
        name: "Tradition",
        style: "classic",
        imagePath:
          "/images/sponsors/abbaye-du-lion/jersey-classic.png",
      },
      {
        id: "abbaye-du-lion-modern",
        name: "Premium",
        style: "modern",
        imagePath:
          "/images/sponsors/abbaye-du-lion/jersey-modern.png",
      },
      {
        id: "abbaye-du-lion-bold",
        name: "Signature",
        style: "bold",
        imagePath:
          "/images/sponsors/abbaye-du-lion/jersey-bold.png",
      },
    ],
    colors: {
      primary: "#7A3E12",
      secondary: "#D4A017",
      accent: "#F5E6C8",
      background: "#FFF8F1",
      text: "#4B2410",
    },
  },
] satisfies readonly Sponsor[];