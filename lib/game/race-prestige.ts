export type RacePrestigeKind =
  | "grand_tour"
  | "monument_cobbled"
  | "monument_hilly";

export type RacePrestigeTrophyVisualVariant =
  | "regional_rose"
  | "province_wheel"
  | "sierra_peaks"
  | "amber_cobble"
  | "zeeland_lion"
  | "flanders_bell"
  | "ardennes_crown"
  | "lake_chalice";

export type RacePrestigeDefinition = {
  slug: string;
  kind: RacePrestigeKind;
  label: "Grand Tour" | "Monument";
  detailLabel: string;
  shortLabel: "GT" | "MON";
  trophyTitle: string;
  trophyVisualVariant: RacePrestigeTrophyVisualVariant;
  trophyDescription: string;
  palette: {
    primary: string;
    secondary: string;
    accent: string;
    glow: string;
  };
};

const PRESTIGE_RACES = [
  {
    slug: "corsa-delle-regioni",
    kind: "grand_tour",
    label: "Grand Tour",
    detailLabel: "Grand Tour",
    shortLabel: "GT",
    trophyTitle: "Trofeo Rosa delle Regioni",
    trophyVisualVariant: "regional_rose",
    trophyDescription:
      "Une rose d’or portée par les routes et les reliefs des régions.",
    palette: {
      primary: "#E45A96",
      secondary: "#FFD4E6",
      accent: "#7B244E",
      glow: "rgba(228, 90, 150, 0.36)",
    },
  },
  {
    slug: "boucle-des-provinces",
    kind: "grand_tour",
    label: "Grand Tour",
    detailLabel: "Grand Tour",
    shortLabel: "GT",
    trophyTitle: "Grand Trophée des Provinces",
    trophyVisualVariant: "province_wheel",
    trophyDescription:
      "Une roue d’or dont les reliefs racontent toutes les provinces traversées.",
    palette: {
      primary: "#F2C94C",
      secondary: "#FFF2A8",
      accent: "#5A4500",
      glow: "rgba(242, 201, 76, 0.4)",
    },
  },
  {
    slug: "ruta-de-las-sierras",
    kind: "grand_tour",
    label: "Grand Tour",
    detailLabel: "Grand Tour",
    shortLabel: "GT",
    trophyTitle: "Copa Roja de las Sierras",
    trophyVisualVariant: "sierra_peaks",
    trophyDescription:
      "Une lame rouge s’élève entre les crêtes de bronze des sierras.",
    palette: {
      primary: "#D43D42",
      secondary: "#FFB0A6",
      accent: "#6E101D",
      glow: "rgba(212, 61, 66, 0.38)",
    },
  },
  {
    slug: "enfer-des-dunes",
    kind: "monument_cobbled",
    label: "Monument",
    detailLabel: "Monument pavé",
    shortLabel: "MON",
    trophyTitle: "Pavé d’Ambre",
    trophyVisualVariant: "amber_cobble",
    trophyDescription:
      "Un pavé d’ambre marqué par la roue et poli par le vent des dunes.",
    palette: {
      primary: "#C4812D",
      secondary: "#F4D49A",
      accent: "#51300D",
      glow: "rgba(196, 129, 45, 0.34)",
    },
  },
  {
    slug: "paves-de-zelande",
    kind: "monument_cobbled",
    label: "Monument",
    detailLabel: "Monument pavé",
    shortLabel: "MON",
    trophyTitle: "Lion d’Acier",
    trophyVisualVariant: "zeeland_lion",
    trophyDescription:
      "Un lion d’acier veille sur les pavés battus par la mer du Nord.",
    palette: {
      primary: "#607D8B",
      secondary: "#DDE8ED",
      accent: "#18313B",
      glow: "rgba(96, 125, 139, 0.34)",
    },
  },
  {
    slug: "traversee-des-flandres",
    kind: "monument_cobbled",
    label: "Monument",
    detailLabel: "Monument pavé",
    shortLabel: "MON",
    trophyTitle: "Cloche des Flandres",
    trophyVisualVariant: "flanders_bell",
    trophyDescription:
      "Une cloche d’argent sonne au-dessus des routes pavées des Flandres.",
    palette: {
      primary: "#D6A600",
      secondary: "#FFF0A5",
      accent: "#171B19",
      glow: "rgba(214, 166, 0, 0.36)",
    },
  },
  {
    slug: "couronne-des-ardennes",
    kind: "monument_hilly",
    label: "Monument",
    detailLabel: "Monument vallonné",
    shortLabel: "MON",
    trophyTitle: "Couronne d’Émeraude",
    trophyVisualVariant: "ardennes_crown",
    trophyDescription:
      "Une couronne de bronze et d’émeraude façonnée par les côtes ardennaises.",
    palette: {
      primary: "#278B70",
      secondary: "#BDEBD9",
      accent: "#0A4537",
      glow: "rgba(39, 139, 112, 0.34)",
    },
  },
  {
    slug: "classique-des-lacs",
    kind: "monument_hilly",
    label: "Monument",
    detailLabel: "Monument vallonné",
    shortLabel: "MON",
    trophyTitle: "Calice des Lacs",
    trophyVisualVariant: "lake_chalice",
    trophyDescription:
      "Un calice de bronze aux reflets des lacs et des collines environnantes.",
    palette: {
      primary: "#3B82A0",
      secondary: "#C5EBF6",
      accent: "#123E52",
      glow: "rgba(59, 130, 160, 0.34)",
    },
  },
] as const satisfies readonly RacePrestigeDefinition[];

export const RACE_PRESTIGE_DEFINITIONS = PRESTIGE_RACES;

const PRESTIGE_RACE_BY_SLUG = new Map<string, RacePrestigeDefinition>(
  PRESTIGE_RACES.map((race) => [race.slug, race]),
);

export function getRacePrestigeDefinition(
  slug: string,
): RacePrestigeDefinition | null {
  return PRESTIGE_RACE_BY_SLUG.get(slug.trim().toLowerCase()) ?? null;
}

export function getRacePrestigeCalendarStyle(
  definition: RacePrestigeDefinition | null,
) {
  if (!definition) return null;

  if (definition.kind === "monument_cobbled") {
    return {
      borderColor: "#B8C1C7",
      boxShadow:
        "0 0 0 2px rgba(184,193,199,0.72), 0 6px 16px rgba(65,76,83,0.18)",
    };
  }

  if (definition.kind === "monument_hilly") {
    return {
      borderColor: "#A87838",
      boxShadow:
        "0 0 0 2px rgba(168,120,56,0.72), 0 6px 16px rgba(92,58,22,0.2)",
    };
  }

  return {
    borderColor: "#F2C94C",
    boxShadow:
      "0 0 0 2px rgba(242,201,76,0.78), 0 7px 18px rgba(126,95,8,0.24)",
  };
}
