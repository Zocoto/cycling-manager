import type { Sponsor } from "@/types/sponsor";

export const VIETNAM_PRIORITY_BATCH_01_SPONSORS = [
  {
    id: "gom-lam-viet",
    name: "Gốm Lam Việt",
    shortName: "Lam Việt",
    countryCode: "VN",
    sector: "Céramique, arts de la table et carreaux décoratifs",
    description:
      "Une manufacture vietnamienne accessible qui produit de la vaisselle émaillée, des objets décoratifs et de petits carreaux en s'inspirant des bleus traditionnels.",
    prestige: 1,
    minimumReputation: 0,
    budgetRange: { min: 90_000, max: 180_000 },
    contractDurationRange: { min: 1, max: 2 },
    logoPath: "/images/sponsors/gom-lam-viet/logo.webp",
    jerseys: [
      { id: "gom-lam-viet-classic", name: "Porcelaine bleue", style: "classic", imagePath: "/images/sponsors/gom-lam-viet/jersey-classic.webp" },
      { id: "gom-lam-viet-modern", name: "Trait de cobalt", style: "modern", imagePath: "/images/sponsors/gom-lam-viet/jersey-modern.webp" },
      { id: "gom-lam-viet-bold", name: "Four de terre", style: "bold", imagePath: "/images/sponsors/gom-lam-viet/jersey-bold.webp" },
    ],
    colors: { primary: "#174A7E", secondary: "#F3EAD7", accent: "#C85A3E", background: "#F8F3E8", text: "#123653" },
  },
  {
    id: "dong-duong-phanh",
    name: "Đông Dương Phanh",
    shortName: "Đông Dương",
    countryCode: "VN",
    sector: "Systèmes de freinage et composants de mobilité",
    description:
      "Un équipementier vietnamien qui fabrique des disques, étriers et systèmes de freinage pour motos, autobus et véhicules utilitaires légers.",
    prestige: 2,
    minimumReputation: 30,
    budgetRange: { min: 250_000, max: 440_000 },
    contractDurationRange: { min: 1, max: 2 },
    logoPath: "/images/sponsors/dong-duong-phanh/logo.webp",
    jerseys: [
      { id: "dong-duong-phanh-classic", name: "Étrier", style: "classic", imagePath: "/images/sponsors/dong-duong-phanh/jersey-classic.webp" },
      { id: "dong-duong-phanh-modern", name: "Point de freinage", style: "modern", imagePath: "/images/sponsors/dong-duong-phanh/jersey-modern.webp" },
      { id: "dong-duong-phanh-bold", name: "Rotor", style: "bold", imagePath: "/images/sponsors/dong-duong-phanh/jersey-bold.webp" },
    ],
    colors: { primary: "#20282D", secondary: "#E76F2E", accent: "#C9D1D4", background: "#F1F3F2", text: "#161D20" },
  },
  {
    id: "hai-au-dong-tau",
    name: "Hải Âu Đóng Tàu",
    shortName: "Hải Âu",
    countryCode: "VN",
    sector: "Construction navale, ferries et maintenance maritime",
    description:
      "Un chantier naval vietnamien qui construit des ferries côtiers, modernise des navires de service et assure leur maintenance dans les ports du pays.",
    prestige: 3,
    minimumReputation: 100,
    budgetRange: { min: 560_000, max: 900_000 },
    contractDurationRange: { min: 1, max: 3 },
    logoPath: "/images/sponsors/hai-au-dong-tau/logo.webp",
    jerseys: [
      { id: "hai-au-dong-tau-classic", name: "Ligne de flottaison", style: "classic", imagePath: "/images/sponsors/hai-au-dong-tau/jersey-classic.webp" },
      { id: "hai-au-dong-tau-modern", name: "Étrave", style: "modern", imagePath: "/images/sponsors/hai-au-dong-tau/jersey-modern.webp" },
      { id: "hai-au-dong-tau-bold", name: "Cale sèche", style: "bold", imagePath: "/images/sponsors/hai-au-dong-tau/jersey-bold.webp" },
    ],
    colors: { primary: "#0C3559", secondary: "#0B8E92", accent: "#D48A3A", background: "#F2F4EF", text: "#08253E" },
  },
] satisfies readonly Sponsor[];
