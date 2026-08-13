import type { Sponsor } from "@/types/sponsor";

function buildJerseys(
  sponsorId: string,
  names: readonly [classic: string, modern: string, bold: string]
): Sponsor["jerseys"] {
  return [
    {
      id: `${sponsorId}-classic`,
      name: names[0],
      style: "classic",
      imagePath: `/images/sponsors/${sponsorId}/jersey-classic.png`,
    },
    {
      id: `${sponsorId}-modern`,
      name: names[1],
      style: "modern",
      imagePath: `/images/sponsors/${sponsorId}/jersey-modern.png`,
    },
    {
      id: `${sponsorId}-bold`,
      name: names[2],
      style: "bold",
      imagePath: `/images/sponsors/${sponsorId}/jersey-bold.png`,
    },
  ];
}

export const BRETON_SPONSORS = [
  {
    id: "caramels-de-keravel",
    name: "Caramels de Keravel",
    shortName: "Keravel",
    countryCode: "FR",
    sector: "Confiserie bretonne",
    description:
      "Une maison morbihannaise de caramels au beurre sal\u00e9 qui d\u00e9fend un savoir-faire gourmand et une identit\u00e9 bretonne contemporaine.",
    prestige: 1,
    minimumReputation: 0,
    budgetRange: { min: 280_000, max: 420_000 },
    contractDurationRange: { min: 1, max: 2 },
    logoPath: "/images/sponsors/caramels-de-keravel/logo.png",
    jerseys: buildJerseys("caramels-de-keravel", [
      "Marine sal\u00e9e",
      "Ruban de caramel",
      "Caramel en fusion",
    ]),
    colors: {
      primary: "#102A43",
      secondary: "#B96824",
      accent: "#FFF1D2",
      background: "#FFF8EC",
      text: "#3A2118",
    },
  },
  {
    id: "maison-lannic",
    name: "Maison Lannic",
    shortName: "Lannic",
    countryCode: "FR",
    sector: "P\u00e2tisserie bretonne",
    description:
      "Une fabrique finist\u00e9rienne de kouign-amann qui associe feuilletage traditionnel, beurre breton et distribution r\u00e9gionale ambitieuse.",
    prestige: 2,
    minimumReputation: 30,
    budgetRange: { min: 430_000, max: 650_000 },
    contractDurationRange: { min: 1, max: 2 },
    logoPath: "/images/sponsors/maison-lannic/logo.png",
    jerseys: buildJerseys("maison-lannic", [
      "Beurre noir",
      "Feuilletage",
      "Soleil feuillet\u00e9",
    ]),
    colors: {
      primary: "#151515",
      secondary: "#F2C14E",
      accent: "#9A4F22",
      background: "#FFF7E5",
      text: "#2F2118",
    },
  },
  {
    id: "cidrerie-aulne",
    name: "Cidrerie de l\u2019Aulne",
    shortName: "L\u2019Aulne",
    countryCode: "FR",
    sector: "Cidrerie",
    description:
      "Une cidrerie du Finist\u00e8re issue de vergers locaux, reconnue pour ses cuv\u00e9es artisanales et son ancrage le long de l\u2019Aulne.",
    prestige: 3,
    minimumReputation: 100,
    budgetRange: { min: 720_000, max: 980_000 },
    contractDurationRange: { min: 2, max: 3 },
    logoPath: "/images/sponsors/cidrerie-aulne/logo.png",
    jerseys: buildJerseys("cidrerie-aulne", [
      "Le Verger",
      "Rivi\u00e8re d\u2019or",
      "Pomme temp\u00eate",
    ]),
    colors: {
      primary: "#2F6B4F",
      secondary: "#18333D",
      accent: "#D9A441",
      background: "#F7F1DE",
      text: "#18333D",
    },
  },
  {
    id: "penn-kreiz-crepes",
    name: "Penn Kreiz Cr\u00eapes",
    shortName: "Penn Kreiz",
    countryCode: "FR",
    sector: "Cr\u00eapes et produits frais",
    description:
      "Un fabricant du Centre-Bretagne sp\u00e9cialis\u00e9 dans les cr\u00eapes pr\u00eates \u00e0 consommer, avec une production moderne et un approvisionnement r\u00e9gional.",
    prestige: 2,
    minimumReputation: 30,
    budgetRange: { min: 480_000, max: 700_000 },
    contractDurationRange: { min: 1, max: 3 },
    logoPath: "/images/sponsors/penn-kreiz-crepes/logo.png",
    jerseys: buildJerseys("penn-kreiz-crepes", [
      "Bl\u00e9 bleu",
      "Cadence",
      "Grand disque",
    ]),
    colors: {
      primary: "#175E8C",
      secondary: "#D5B878",
      accent: "#C84832",
      background: "#FFF3D9",
      text: "#17303A",
    },
  },
  {
    id: "sardines-du-raz",
    name: "Sardines du Raz",
    shortName: "Le Raz",
    countryCode: "FR",
    sector: "Conserverie de poissons",
    description:
      "Une conserverie maritime de la pointe bretonne qui valorise la sardine locale \u00e0 travers des recettes simples et une identit\u00e9 graphique forte.",
    prestige: 3,
    minimumReputation: 100,
    budgetRange: { min: 680_000, max: 940_000 },
    contractDurationRange: { min: 2, max: 3 },
    logoPath: "/images/sponsors/sardines-du-raz/logo.png",
    jerseys: buildJerseys("sardines-du-raz", [
      "Bleu conserverie",
      "Le Courant",
      "Banc du Raz",
    ]),
    colors: {
      primary: "#0D3552",
      secondary: "#2C8C91",
      accent: "#E45C3A",
      background: "#F4F7F7",
      text: "#12324A",
    },
  },
] satisfies readonly Sponsor[];
