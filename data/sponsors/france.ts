import type { Sponsor } from "@/types/sponsor";

export const FRENCH_SPONSORS = [
  {
    id: "veloria-mobilites",
    name: "Veloria Mobilités",
    shortName: "Veloria",
    countryCode: "FR",
    sector: "Mobilité et transports",
    description:
      "Une entreprise française spécialisée dans les mobilités urbaines et les transports durables.",
    prestige: 2,
    minimumReputation: 0,
    budgetRange: {
      min: 450_000,
      max: 600_000,
    },
    contractDurationRange: {
      min: 1,
      max: 2,
    },
    logoPath: "/images/sponsors/veloria-mobilites/logo.png",
    jerseys: [
      {
        id: "veloria-mobilites-classic",
        name: "Élégance française",
        style: "classic",
        imagePath:
          "/images/sponsors/veloria-mobilites/jersey-classic.png",
      },
      {
        id: "veloria-mobilites-modern",
        name: "Lignes urbaines",
        style: "modern",
        imagePath:
          "/images/sponsors/veloria-mobilites/jersey-modern.png",
      },
      {
        id: "veloria-mobilites-bold",
        name: "Échappée électrique",
        style: "bold",
        imagePath:
          "/images/sponsors/veloria-mobilites/jersey-bold.png",
      },
    ],
    colors: {
      primary: "#173F5F",
      secondary: "#E8F1F5",
      accent: "#F2C94C",
      background: "#F5F9FA",
      text: "#102A3A",
    },
  },
  {
    id: "terroirs-unis",
    name: "Terroirs Unis",
    shortName: "Terroirs",
    countryCode: "FR",
    sector: "Agroalimentaire",
    description:
      "Une coopérative agricole attachée aux territoires français et aux circuits courts.",
    prestige: 1,
    minimumReputation: 0,
    budgetRange: {
      min: 300_000,
      max: 420_000,
    },
    contractDurationRange: {
      min: 1,
      max: 3,
    },
    logoPath: "/images/sponsors/terroirs-unis/logo.png",
    jerseys: [
      {
        id: "terroirs-unis-classic",
        name: "Tradition",
        style: "classic",
        imagePath:
          "/images/sponsors/terroirs-unis/jersey-classic.png",
      },
      {
        id: "terroirs-unis-modern",
        name: "Sillons",
        style: "modern",
        imagePath:
          "/images/sponsors/terroirs-unis/jersey-modern.png",
      },
      {
        id: "terroirs-unis-bold",
        name: "Moisson",
        style: "bold",
        imagePath:
          "/images/sponsors/terroirs-unis/jersey-bold.png",
      },
    ],
    colors: {
      primary: "#496B3A",
      secondary: "#F2E7C9",
      accent: "#D99A32",
      background: "#FAF7EE",
      text: "#24321E",
    },
  },
    {
    id: "hexa-batiment",
    name: "Hexa Bâtiment",
    shortName: "Hexa",
    countryCode: "FR",
    sector: "Construction",
    description:
      "Un groupe français du bâtiment souhaitant développer sa notoriété nationale grâce au cyclisme.",
    prestige: 1,
    minimumReputation: 0,
    budgetRange: {
      min: 320_000,
      max: 450_000,
    },
    contractDurationRange: {
      min: 1,
      max: 2,
    },
    logoPath: "/images/sponsors/hexa-batiment/logo.png",
    jerseys: [
      {
        id: "hexa-batiment-classic",
        name: "Fondations",
        style: "classic",
        imagePath:
          "/images/sponsors/hexa-batiment/jersey-classic.png",
      },
      {
        id: "hexa-batiment-modern",
        name: "Architecture",
        style: "modern",
        imagePath:
          "/images/sponsors/hexa-batiment/jersey-modern.png",
      },
      {
        id: "hexa-batiment-bold",
        name: "Chantier",
        style: "bold",
        imagePath:
          "/images/sponsors/hexa-batiment/jersey-bold.png",
      },
    ],
    colors: {
      primary: "#234E52",
      secondary: "#E6ECEB",
      accent: "#F4A261",
      background: "#F7FAF9",
      text: "#17383B",
    },
  },
  {
    id: "nova-assurances",
    name: "Nova Assurances",
    shortName: "Nova",
    countryCode: "FR",
    sector: "Assurance",
    description:
      "Un groupe d’assurance ambitieux souhaitant accroître sa visibilité dans le sport professionnel.",
    prestige: 4,
    minimumReputation: 60,
    budgetRange: {
      min: 900_000,
      max: 1_200_000,
    },
    contractDurationRange: {
      min: 2,
      max: 3,
    },
    logoPath: "/images/sponsors/nova-assurances/logo.png",
    jerseys: [
      {
        id: "nova-assurances-classic",
        name: "Institution",
        style: "classic",
        imagePath:
          "/images/sponsors/nova-assurances/jersey-classic.png",
      },
      {
        id: "nova-assurances-modern",
        name: "Constellation",
        style: "modern",
        imagePath:
          "/images/sponsors/nova-assurances/jersey-modern.png",
      },
      {
        id: "nova-assurances-bold",
        name: "Supernova",
        style: "bold",
        imagePath:
          "/images/sponsors/nova-assurances/jersey-bold.png",
      },
    ],
    colors: {
      primary: "#312E81",
      secondary: "#EDE9FE",
      accent: "#F59E0B",
      background: "#F7F6FF",
      text: "#211D52",
    },
  },
] satisfies readonly Sponsor[];