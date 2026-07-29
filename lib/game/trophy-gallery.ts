export type TrophyKind =
  | "grand_tour"
  | "monument"
  | "uci_team"
  | "uci_rider";

export type TrophyPalette = {
  primary: string;
  secondary: string;
  accent: string;
  glow: string;
};

export type CareerTrophy = {
  id: string;
  kind: TrophyKind;
  title: string;
  competitionName: string;
  seasonName: string;
  wonAt: string | null;
  riderName: string | null;
  href: string | null;
  inscription: string;
  palette: TrophyPalette;
};

export type TrophyGallery = {
  trophies: CareerTrophy[];
  counts: {
    total: number;
    grandTours: number;
    monuments: number;
    uciTitles: number;
  };
};

export type TrophyRaceWin = {
  id: string;
  raceSlug: string;
  raceName: string;
  seasonName: string;
  wonAt: string | null;
  riderName: string;
  isGrandTour: boolean;
  isMonument: boolean;
};

export type TrophyTeamUciTitle = {
  id: string;
  seasonName: string;
  teamName: string;
};

export type TrophyRiderUciTitle = {
  id: string;
  seasonName: string;
  riderName: string;
};

type BuildTrophyGalleryInput = {
  raceWins: TrophyRaceWin[];
  teamUciTitles: TrophyTeamUciTitle[];
  riderUciTitles: TrophyRiderUciTitle[];
};

const DEFAULT_MONUMENT_PALETTE: TrophyPalette = {
  primary: "#C78B2C",
  secondary: "#FFE0A0",
  accent: "#183F37",
  glow: "rgba(242, 201, 76, 0.34)",
};

const GRAND_TOUR_IDENTITIES: Record<
  string,
  { title: string; palette: TrophyPalette }
> = {
  "corsa-delle-regioni": {
    title: "Trofeo Rosa delle Regioni",
    palette: {
      primary: "#E45A96",
      secondary: "#FFD4E6",
      accent: "#7B244E",
      glow: "rgba(228, 90, 150, 0.36)",
    },
  },
  "boucle-des-provinces": {
    title: "Grand Trophée des Provinces",
    palette: {
      primary: "#F2C94C",
      secondary: "#FFF2A8",
      accent: "#5A4500",
      glow: "rgba(242, 201, 76, 0.4)",
    },
  },
  "ruta-de-las-sierras": {
    title: "Copa Roja de las Sierras",
    palette: {
      primary: "#D43D42",
      secondary: "#FFB0A6",
      accent: "#6E101D",
      glow: "rgba(212, 61, 66, 0.38)",
    },
  },
};

const MONUMENT_IDENTITIES: Record<
  string,
  { title: string; palette: TrophyPalette }
> = {
  "enfer-des-dunes": {
    title: "Pavé d’Ambre",
    palette: {
      primary: "#C4812D",
      secondary: "#F4D49A",
      accent: "#51300D",
      glow: "rgba(196, 129, 45, 0.34)",
    },
  },
  "paves-de-zelande": {
    title: "Lion d’Acier",
    palette: {
      primary: "#607D8B",
      secondary: "#DDE8ED",
      accent: "#18313B",
      glow: "rgba(96, 125, 139, 0.34)",
    },
  },
  "couronne-des-ardennes": {
    title: "Couronne d’Émeraude",
    palette: {
      primary: "#278B70",
      secondary: "#BDEBD9",
      accent: "#0A4537",
      glow: "rgba(39, 139, 112, 0.34)",
    },
  },
  "classique-des-lacs": {
    title: "Calice des Lacs",
    palette: {
      primary: "#3B82A0",
      secondary: "#C5EBF6",
      accent: "#123E52",
      glow: "rgba(59, 130, 160, 0.34)",
    },
  },
  "traversee-des-flandres": {
    title: "Cloche des Flandres",
    palette: {
      primary: "#D6A600",
      secondary: "#FFF0A5",
      accent: "#171B19",
      glow: "rgba(214, 166, 0, 0.36)",
    },
  },
};

const UCI_TEAM_PALETTE: TrophyPalette = {
  primary: "#F2C94C",
  secondary: "#FFF1A7",
  accent: "#47266C",
  glow: "rgba(242, 201, 76, 0.52)",
};

const UCI_RIDER_PALETTE: TrophyPalette = {
  primary: "#D8E2E7",
  secondary: "#FFFFFF",
  accent: "#6E42A1",
  glow: "rgba(177, 128, 230, 0.48)",
};

export function buildTrophyGallery({
  raceWins,
  teamUciTitles,
  riderUciTitles,
}: BuildTrophyGalleryInput): TrophyGallery {
  const raceTrophies = raceWins.flatMap<CareerTrophy>((win) => {
    if (win.isGrandTour) {
      const identity =
        GRAND_TOUR_IDENTITIES[win.raceSlug] ??
        createFallbackIdentity(`Trophée ${win.raceName}`, "#F2C94C");

      return [
        {
          id: `grand-tour:${win.id}`,
          kind: "grand_tour" as const,
          title: identity.title,
          competitionName: win.raceName,
          seasonName: win.seasonName,
          wonAt: win.wonAt,
          riderName: win.riderName,
          href: `/jeu/resultats/${encodeURIComponent(win.raceSlug)}`,
          inscription: win.riderName,
          palette: identity.palette,
        },
      ];
    }

    if (win.isMonument) {
      const identity = MONUMENT_IDENTITIES[win.raceSlug] ?? {
        title: `Monument de ${win.raceName}`,
        palette: DEFAULT_MONUMENT_PALETTE,
      };

      return [
        {
          id: `monument:${win.id}`,
          kind: "monument" as const,
          title: identity.title,
          competitionName: win.raceName,
          seasonName: win.seasonName,
          wonAt: win.wonAt,
          riderName: win.riderName,
          href: `/jeu/resultats/${encodeURIComponent(win.raceSlug)}`,
          inscription: win.riderName,
          palette: identity.palette,
        },
      ];
    }

    return [];
  });

  const teamTrophies = teamUciTitles.map((title) => ({
    id: `uci-team:${title.id}`,
    kind: "uci_team" as const,
    title: "Coupe UCI des équipes",
    competitionName: "Classement mondial UCI",
    seasonName: title.seasonName,
    wonAt: null,
    riderName: null,
    href: "/jeu/classements",
    inscription: title.teamName,
    palette: UCI_TEAM_PALETTE,
  }));

  const riderTrophies = riderUciTitles.map((title) => ({
    id: `uci-rider:${title.id}`,
    kind: "uci_rider" as const,
    title: "Couronne UCI individuelle",
    competitionName: "Numéro 1 mondial",
    seasonName: title.seasonName,
    wonAt: null,
    riderName: title.riderName,
    href: "/jeu/classements",
    inscription: title.riderName,
    palette: UCI_RIDER_PALETTE,
  }));

  const trophies = [...teamTrophies, ...riderTrophies, ...raceTrophies].sort(
    compareTrophies
  );

  return {
    trophies,
    counts: {
      total: trophies.length,
      grandTours: trophies.filter((trophy) => trophy.kind === "grand_tour")
        .length,
      monuments: trophies.filter((trophy) => trophy.kind === "monument")
        .length,
      uciTitles: trophies.filter(
        (trophy) =>
          trophy.kind === "uci_team" || trophy.kind === "uci_rider"
      ).length,
    },
  };
}

function createFallbackIdentity(title: string, primary: string) {
  return {
    title,
    palette: {
      primary,
      secondary: "#FFF2AD",
      accent: "#423400",
      glow: "rgba(242, 201, 76, 0.36)",
    },
  };
}

function compareTrophies(left: CareerTrophy, right: CareerTrophy) {
  return (
    getTrophyWeight(right.kind) - getTrophyWeight(left.kind) ||
    right.seasonName.localeCompare(left.seasonName, "fr") ||
    left.title.localeCompare(right.title, "fr")
  );
}

function getTrophyWeight(kind: TrophyKind) {
  if (kind === "uci_team") return 400;
  if (kind === "uci_rider") return 350;
  if (kind === "grand_tour") return 250;
  return 150;
}
