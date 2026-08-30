import {
  REFERRAL_TROPHY_MILESTONES,
  type ReferralTrophyMilestone,
} from "@/lib/game/referrals";
import {
  RACE_PRESTIGE_DEFINITIONS,
  type RacePrestigeTrophyVisualVariant,
} from "@/lib/game/race-prestige";
import {
  ACHIEVEMENT_TROPHY_DEFINITIONS,
  type AchievementTrophyKey,
  type AchievementTrophyVisualVariant,
} from "@/lib/game/achievement-trophies";
import {
  isMedicalTrophyKey,
  MEDICAL_TROPHY_DEFINITIONS,
  type MedicalTrophyKey,
  type MedicalTrophyVisualVariant,
} from "@/lib/game/medical-trophies";

export type TrophyKind =
  | "grand_tour"
  | "monument"
  | "world_championship"
  | "continental_championship"
  | "uci_team"
  | "uci_rider"
  | "special"
  | "achievement"
  | "medical"
  | "sponsor"
  | "attendance"
  | "referral";

export const ALPHA_TESTER_TROPHY_KEY = "alpha_tester";
export const ALPHA_TESTER_AVATAR_FRAME_KEY = "alpha_tester";

export type SportingDirectorAvatarFrameKey =
  typeof ALPHA_TESTER_AVATAR_FRAME_KEY;

export type TrophyPalette = {
  primary: string;
  secondary: string;
  accent: string;
  glow: string;
};

export type ChampionshipTrophyVisualVariant =
  | "world-road"
  | "world-time-trial"
  | "continental-road"
  | "continental-time-trial";

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
  description?: string | null;
  prestigeVisualVariant?: RacePrestigeTrophyVisualVariant | null;
  seasonNames?: string[];
  avatarFrameKey?: SportingDirectorAvatarFrameKey | null;
  visualVariant?: AchievementTrophyVisualVariant | null;
  medicalVariant?: MedicalTrophyVisualVariant | null;
  championshipVisualVariant?: ChampionshipTrophyVisualVariant | null;
  referralMilestone?: number | null;
};

export type ClaimableTrophyReward = {
  key: typeof ALPHA_TESTER_TROPHY_KEY;
  availableAt: string;
  title: string;
  description: string;
  avatarFrameKey: SportingDirectorAvatarFrameKey;
  palette: TrophyPalette;
};

export type TrophyGallery = {
  trophies: CareerTrophy[];
  claimableTrophies: ClaimableTrophyReward[];
  counts: {
    total: number;
    grandTours: number;
    monuments: number;
    championships: number;
    uciTitles: number;
    special: number;
    achievements: number;
    medical: number;
    sponsor: number;
    attendance: number;
    referrals: number;
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
  competitionType?:
    "standard" | "world_championship" | "continental_championship";
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

export type TrophyAttendance = {
  id: string;
  seasonName: string;
  awardedAt: string;
};

export type TrophySponsorAmbassador = {
  id: string;
  seasonName: string;
  awardedAt: string;
};

export type TrophySpecialAward = {
  id: string;
  trophyKey:
    | typeof ALPHA_TESTER_TROPHY_KEY
    | AchievementTrophyKey
    | MedicalTrophyKey;
  availableAt: string;
  claimedAt: string;
  href: string | null;
};

type BuildTrophyGalleryInput = {
  raceWins: TrophyRaceWin[];
  teamUciTitles: TrophyTeamUciTitle[];
  riderUciTitles: TrophyRiderUciTitle[];
  specialAwards?: TrophySpecialAward[];
  claimableTrophies?: ClaimableTrophyReward[];
  attendanceTrophies?: TrophyAttendance[];
  sponsorAmbassadorTrophies?: TrophySponsorAmbassador[];
  referralTrophies?: ReferralTrophyMilestone[];
};

export const ALPHA_TESTER_TROPHY_DEFINITION = {
  key: ALPHA_TESTER_TROPHY_KEY,
  title: "Alphatesteur",
  competitionName: "Cyclostratège · Phase Alpha",
  seasonName: "Phase Alpha",
  inscription: "Pionnier du peloton numérique",
  description:
    "Distinction réservée aux Directeurs Sportifs qui accompagnent la phase Alpha. Son liseré numérique peut être activé ou désactivé depuis l’édition du profil DS.",
  avatarFrameKey: ALPHA_TESTER_AVATAR_FRAME_KEY,
  palette: {
    primary: "#48D9C0",
    secondary: "#D7FFF8",
    accent: "#342A64",
    glow: "rgba(72, 217, 192, 0.42)",
  } satisfies TrophyPalette,
} as const;

const DEFAULT_MONUMENT_PALETTE: TrophyPalette = {
  primary: "#C78B2C",
  secondary: "#FFE0A0",
  accent: "#183F37",
  glow: "rgba(242, 201, 76, 0.34)",
};

const WORLD_CHAMPIONSHIP_PALETTE: TrophyPalette = {
  primary: "#F4D44D",
  secondary: "#F8FBFF",
  accent: "#205DA8",
  glow: "rgba(244, 212, 77, 0.42)",
};

const CONTINENTAL_CHAMPIONSHIP_PALETTE: TrophyPalette = {
  primary: "#58C59B",
  secondary: "#E8FFF6",
  accent: "#174F78",
  glow: "rgba(88, 197, 155, 0.4)",
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

const ATTENDANCE_PALETTE: TrophyPalette = {
  primary: "#D7A928",
  secondary: "#FFF2B8",
  accent: "#173F37",
  glow: "rgba(215, 169, 40, 0.46)",
};

export const SPONSOR_AMBASSADOR_TROPHY_DEFINITION = {
  title: "Ambassadeur exemplaire",
  competitionName: "Satisfaction sponsor · 100 %",
  inscription: "Parole tenue, saison après saison",
  description:
    "Décerné pour une saison conclue à 100 % de satisfaction sponsor. La première obtention débloque définitivement le Maillot d’Or des Ambassadeurs dans l’éditeur d’avatar.",
  palette: {
    primary: "#D6AE3B",
    secondary: "#FFF3B0",
    accent: "#123B34",
    glow: "rgba(214, 174, 59, 0.44)",
  } satisfies TrophyPalette,
} as const;

const PRESTIGE_RACE_NAMES: Record<string, string> = {
  "corsa-delle-regioni": "Corsa delle Regioni",
  "boucle-des-provinces": "Boucle des Provinces",
  "ruta-de-las-sierras": "Ruta de las Sierras",
  "enfer-des-dunes": "L’Enfer des Dunes",
  "paves-de-zelande": "Les Pavés de Zélande",
  "couronne-des-ardennes": "La Couronne des Ardennes",
  "classique-des-lacs": "La Classique des Lacs",
  "traversee-des-flandres": "La Traversée des Flandres",
};

const CHAMPIONSHIP_TARGETS: readonly CareerTrophy[] = [
  {
    id: "locked:world-championship:road",
    kind: "world_championship",
    title: "Maillot arc-en-ciel — Route",
    competitionName: "Championnat du monde",
    seasonName: "À conquérir",
    wonAt: null,
    riderName: null,
    href: "/jeu/calendrier",
    inscription: "Remporter la course en ligne mondiale",
    palette: WORLD_CHAMPIONSHIP_PALETTE,
    championshipVisualVariant: "world-road",
    description:
      "Le titre suprême sur route, remporté sous les couleurs de l’équipe nationale.",
  },
  {
    id: "locked:world-championship:time-trial",
    kind: "world_championship",
    title: "Maillot arc-en-ciel — CLM",
    competitionName: "Championnat du monde",
    seasonName: "À conquérir",
    wonAt: null,
    riderName: null,
    href: "/jeu/calendrier",
    inscription: "Remporter le contre-la-montre mondial",
    palette: WORLD_CHAMPIONSHIP_PALETTE,
    championshipVisualVariant: "world-time-trial",
    description:
      "La couronne mondiale de l’effort solitaire, remportée avec une sélection nationale.",
  },
  {
    id: "locked:continental-championship:road",
    kind: "continental_championship",
    title: "Champion continental — Route",
    competitionName: "Championnat continental",
    seasonName: "À conquérir",
    wonAt: null,
    riderName: null,
    href: "/jeu/calendrier",
    inscription: "Remporter la course en ligne continentale",
    palette: CONTINENTAL_CHAMPIONSHIP_PALETTE,
    championshipVisualVariant: "continental-road",
    description:
      "Conquérir le maillot distinctif de son continent sur la course en ligne.",
  },
  {
    id: "locked:continental-championship:time-trial",
    kind: "continental_championship",
    title: "Champion continental — CLM",
    competitionName: "Championnat continental",
    seasonName: "À conquérir",
    wonAt: null,
    riderName: null,
    href: "/jeu/calendrier",
    inscription: "Remporter le contre-la-montre continental",
    palette: CONTINENTAL_CHAMPIONSHIP_PALETTE,
    championshipVisualVariant: "continental-time-trial",
    description:
      "Signer le meilleur temps de son continent avec une sélection nationale.",
  },
];

/**
 * Builds the visible catalogue of obtainable trophies that are not in the
 * sporting director's record yet. Retired and secret distinctions are
 * deliberately excluded from this catalogue.
 */
export function getLockedTrophyTargets(
  earnedTrophies: readonly CareerTrophy[],
): CareerTrophy[] {
  const achievementTargets = Object.entries(
    ACHIEVEMENT_TROPHY_DEFINITIONS,
  ).flatMap<CareerTrophy>(([key, definition]) => {
    if (definition.objectiveKey === null) return [];
    if (
      earnedTrophies.some(
        (trophy) =>
          trophy.kind === "achievement" && trophy.title === definition.title,
      )
    ) {
      return [];
    }

    return [
      {
        id: `locked:achievement:${key}`,
        kind: "achievement",
        title: definition.title,
        competitionName: definition.competitionName,
        seasonName: "À conquérir",
        wonAt: null,
        riderName: null,
        href: definition.href,
        inscription: definition.inscription,
        palette: definition.palette,
        description: definition.description,
        visualVariant: definition.visualVariant,
      },
    ];
  });

  const referralTargets = REFERRAL_TROPHY_MILESTONES.flatMap<CareerTrophy>(
    (milestone) => {
      if (
        earnedTrophies.some(
          (trophy) => trophy.id === `referral:${milestone.count}`,
        )
      ) {
        return [];
      }

      return [
        {
          id: `locked:referral:${milestone.count}`,
          kind: "referral",
          title: milestone.title,
          competitionName: "Programme de parrainage",
          seasonName: "À conquérir",
          wonAt: null,
          riderName: null,
          href: "/jeu/parrainage",
          inscription: milestone.inscription,
          palette: milestone.palette,
          referralMilestone: milestone.count,
        },
      ];
    },
  );

  const attendanceTargets: CareerTrophy[] = earnedTrophies.some(
    (trophy) => trophy.kind === "attendance",
  )
    ? []
    : [
        {
          id: "locked:attendance",
          kind: "attendance",
          title: "Assidu",
          competitionName: "Présence parfaite",
          seasonName: "À conquérir",
          wonAt: null,
          riderName: null,
          href: "/jeu/directeur-sportif#assidu-avatar-accessory",
          inscription: "Se connecter tous les jours d’une saison complète",
          palette: ATTENDANCE_PALETTE,
          description:
            "Débloque les lunettes Premier de la classe dans l’éditeur d’avatar.",
        },
      ];

  const sponsorTargets: CareerTrophy[] = earnedTrophies.some(
    (trophy) => trophy.kind === "sponsor",
  )
    ? []
    : [
        {
          id: "locked:sponsor:ambassador",
          kind: "sponsor",
          title: SPONSOR_AMBASSADOR_TROPHY_DEFINITION.title,
          competitionName:
            SPONSOR_AMBASSADOR_TROPHY_DEFINITION.competitionName,
          seasonName: "À conquérir",
          wonAt: null,
          riderName: null,
          href: "/jeu/sponsoring",
          inscription: "Terminer une saison à 100 % de satisfaction sponsor",
          palette: SPONSOR_AMBASSADOR_TROPHY_DEFINITION.palette,
          description: SPONSOR_AMBASSADOR_TROPHY_DEFINITION.description,
        },
      ];

  const medicalTargets = Object.entries(
    MEDICAL_TROPHY_DEFINITIONS,
  ).flatMap<CareerTrophy>(([key, definition]) => {
    if (
      earnedTrophies.some(
        (trophy) => trophy.kind === "medical" && trophy.title === definition.title,
      )
    ) {
      return [];
    }

    return [
      {
        id: `locked:medical:${key}`,
        kind: "medical",
        title: definition.title,
        competitionName: definition.competitionName,
        seasonName: "À conquérir",
        wonAt: null,
        riderName: null,
        href: definition.href,
        inscription: `${definition.threshold} coureurs blessés simultanément`,
        palette: definition.palette,
        description: definition.description,
        medicalVariant: definition.visualVariant,
      },
    ];
  });

  const uciTargets = ([
    {
      id: "locked:uci-team",
      kind: "uci_team",
      title: "Coupe UCI des équipes",
      competitionName: "Classement mondial UCI",
      seasonName: "À conquérir",
      wonAt: null,
      riderName: null,
      href: "/jeu/classements",
      inscription: "Terminer la saison numéro 1 mondial par équipes",
      palette: UCI_TEAM_PALETTE,
    },
    {
      id: "locked:uci-rider",
      kind: "uci_rider",
      title: "Couronne UCI individuelle",
      competitionName: "Numéro 1 mondial",
      seasonName: "À conquérir",
      wonAt: null,
      riderName: null,
      href: "/jeu/classements",
      inscription: "Placer un coureur au sommet du classement UCI",
      palette: UCI_RIDER_PALETTE,
    },
  ] satisfies CareerTrophy[]).filter(
    (target) =>
      !earnedTrophies.some((trophy) => trophy.kind === target.kind),
  );

  const championshipTargets = CHAMPIONSHIP_TARGETS.filter((target) => {
    const targetIsTimeTrial = target.id.endsWith(":time-trial");
    return !earnedTrophies.some((trophy) => {
      if (trophy.kind !== target.kind) return false;
      const earnedIsTimeTrial = isTimeTrialTrophy(trophy);
      return earnedIsTimeTrial === targetIsTimeTrial;
    });
  });

  const prestigiousRaceTargets = RACE_PRESTIGE_DEFINITIONS.flatMap<CareerTrophy>(
    (race) => {
      const raceName = PRESTIGE_RACE_NAMES[race.slug] ?? race.trophyTitle;
      if (
        earnedTrophies.some(
          (trophy) =>
            trophy.href === `/jeu/resultats/${encodeURIComponent(race.slug)}` ||
            trophy.title === raceName,
        )
      ) {
        return [];
      }

      const isGrandTour = race.kind === "grand_tour";
      return [
        {
          id: `locked:race:${race.slug}`,
          kind: isGrandTour ? "grand_tour" : "monument",
          title: raceName,
          competitionName: race.trophyTitle,
          seasonName: "À conquérir",
          wonAt: null,
          riderName: null,
          href: `/jeu/courses/${encodeURIComponent(race.slug)}`,
          inscription: isGrandTour
            ? "Remporter le classement général"
            : "Remporter la course",
          palette: race.palette,
          description: race.trophyDescription,
          prestigeVisualVariant: race.trophyVisualVariant,
        },
      ];
    },
  );

  return [
    ...achievementTargets,
    ...sponsorTargets,
    ...medicalTargets,
    ...referralTargets,
    ...attendanceTargets,
    ...uciTargets,
    ...championshipTargets,
    ...prestigiousRaceTargets,
  ];
}

function isTimeTrialLabel(value: string) {
  return /contre-la-montre|\bclm\b|time-trial/i.test(value);
}

function isTimeTrialTrophy(trophy: CareerTrophy) {
  const searchableText = `${trophy.id} ${trophy.title} ${trophy.competitionName} ${trophy.href ?? ""}`;
  return isTimeTrialLabel(searchableText);
}

export function buildTrophyGallery({
  raceWins,
  teamUciTitles,
  riderUciTitles,
  specialAwards = [],
  claimableTrophies = [],
  attendanceTrophies = [],
  sponsorAmbassadorTrophies = [],
  referralTrophies = [],
}: BuildTrophyGalleryInput): TrophyGallery {
  const raceTrophies = raceWins.flatMap<CareerTrophy>((win) => {
    if (win.competitionType === "world_championship") {
      return [
        {
          id: `world-championship:${win.id}`,
          kind: "world_championship" as const,
          title: win.raceName,
          competitionName: "Championnat du monde · 1re place",
          seasonName: win.seasonName,
          wonAt: win.wonAt,
          riderName: win.riderName,
          href: `/jeu/resultats/${encodeURIComponent(win.raceSlug)}`,
          inscription: win.riderName,
          palette: WORLD_CHAMPIONSHIP_PALETTE,
          championshipVisualVariant: isTimeTrialLabel(
            `${win.raceSlug} ${win.raceName}`,
          )
            ? "world-time-trial"
            : "world-road",
        },
      ];
    }

    if (win.competitionType === "continental_championship") {
      return [
        {
          id: `continental-championship:${win.id}`,
          kind: "continental_championship" as const,
          title: win.raceName,
          competitionName: "Championnat continental · 1re place",
          seasonName: win.seasonName,
          wonAt: win.wonAt,
          riderName: win.riderName,
          href: `/jeu/resultats/${encodeURIComponent(win.raceSlug)}`,
          inscription: win.riderName,
          palette: CONTINENTAL_CHAMPIONSHIP_PALETTE,
          championshipVisualVariant: isTimeTrialLabel(
            `${win.raceSlug} ${win.raceName}`,
          )
            ? "continental-time-trial"
            : "continental-road",
        },
      ];
    }

    if (win.isGrandTour) {
      const prestigeDefinition = RACE_PRESTIGE_DEFINITIONS.find(
        (race) => race.slug === win.raceSlug,
      );
      const identity =
        GRAND_TOUR_IDENTITIES[win.raceSlug] ??
        createFallbackIdentity(`Trophée ${win.raceName}`, "#F2C94C");

      return [
        {
          id: `grand-tour:${win.id}`,
          kind: "grand_tour" as const,
          title: win.raceName,
          competitionName: `${identity.title} · 1re place au général`,
          seasonName: win.seasonName,
          wonAt: win.wonAt,
          riderName: win.riderName,
          href: `/jeu/resultats/${encodeURIComponent(win.raceSlug)}`,
          inscription: win.riderName,
          palette: identity.palette,
          description: prestigeDefinition?.trophyDescription ?? null,
          prestigeVisualVariant:
            prestigeDefinition?.trophyVisualVariant ?? null,
        },
      ];
    }

    if (win.isMonument) {
      const prestigeDefinition = RACE_PRESTIGE_DEFINITIONS.find(
        (race) => race.slug === win.raceSlug,
      );
      const identity = MONUMENT_IDENTITIES[win.raceSlug] ?? {
        title: `Monument de ${win.raceName}`,
        palette: DEFAULT_MONUMENT_PALETTE,
      };

      return [
        {
          id: `monument:${win.id}`,
          kind: "monument" as const,
          title: win.raceName,
          competitionName: `${identity.title} · 1re place`,
          seasonName: win.seasonName,
          wonAt: win.wonAt,
          riderName: win.riderName,
          href: `/jeu/resultats/${encodeURIComponent(win.raceSlug)}`,
          inscription: win.riderName,
          palette: identity.palette,
          description: prestigeDefinition?.trophyDescription ?? null,
          prestigeVisualVariant:
            prestigeDefinition?.trophyVisualVariant ?? null,
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

  const specialTrophies = specialAwards.map<CareerTrophy>((award) => {
    if (award.trophyKey === ALPHA_TESTER_TROPHY_KEY) {
      return {
        id: `special:${award.id}`,
        kind: "special",
        title: ALPHA_TESTER_TROPHY_DEFINITION.title,
        competitionName: ALPHA_TESTER_TROPHY_DEFINITION.competitionName,
        seasonName: ALPHA_TESTER_TROPHY_DEFINITION.seasonName,
        wonAt: award.claimedAt,
        riderName: null,
        href: award.href,
        inscription: ALPHA_TESTER_TROPHY_DEFINITION.inscription,
        palette: ALPHA_TESTER_TROPHY_DEFINITION.palette,
        description: ALPHA_TESTER_TROPHY_DEFINITION.description,
        avatarFrameKey: ALPHA_TESTER_TROPHY_DEFINITION.avatarFrameKey,
      };
    }

    if (isMedicalTrophyKey(award.trophyKey)) {
      const definition = MEDICAL_TROPHY_DEFINITIONS[award.trophyKey];
      return {
        id: `medical:${award.id}`,
        kind: "medical",
        title: definition.title,
        competitionName: definition.competitionName,
        seasonName: definition.seasonName,
        wonAt: award.claimedAt,
        riderName: null,
        href: award.href,
        inscription: definition.inscription,
        palette: definition.palette,
        description: definition.description,
        medicalVariant: definition.visualVariant,
      };
    }

    const definition = ACHIEVEMENT_TROPHY_DEFINITIONS[award.trophyKey];
    return {
      id: `achievement:${award.id}`,
      kind: "achievement",
      title: definition.title,
      competitionName: definition.competitionName,
      seasonName: definition.seasonName,
      wonAt: award.claimedAt,
      riderName: null,
      href: award.href,
      inscription: definition.inscription,
      palette: definition.palette,
      description: definition.description,
      visualVariant: definition.visualVariant,
    };
  });

  const attendanceCareerTrophies = attendanceTrophies.map<CareerTrophy>(
    (trophy) => ({
      id: `attendance:${trophy.id}`,
      kind: "attendance",
      title: "Assidu",
      competitionName: "Présence parfaite",
      seasonName: trophy.seasonName,
      wonAt: trophy.awardedAt,
      riderName: null,
      href: "/jeu/directeur-sportif#assidu-avatar-accessory",
      inscription: "Tous les jours · Saison complète",
      palette: ATTENDANCE_PALETTE,
      description:
        "Décerné après une saison entière sans manquer un seul jour de connexion. Débloque les lunettes Premier de la classe dans l’éditeur d’avatar.",
    }),
  );

  const sponsorCareerTrophies: CareerTrophy[] =
    sponsorAmbassadorTrophies.length > 0
      ? [
          {
            id: `sponsor-ambassador:${sponsorAmbassadorTrophies[0]?.id}`,
            kind: "sponsor",
            title: SPONSOR_AMBASSADOR_TROPHY_DEFINITION.title,
            competitionName:
              SPONSOR_AMBASSADOR_TROPHY_DEFINITION.competitionName,
            seasonName:
              sponsorAmbassadorTrophies.at(-1)?.seasonName ?? "Saison",
            seasonNames: sponsorAmbassadorTrophies.map(
              (trophy) => trophy.seasonName,
            ),
            wonAt: sponsorAmbassadorTrophies.at(-1)?.awardedAt ?? null,
            riderName: null,
            href: "/jeu/directeur-sportif#sponsor-ambassador-avatar-outfit",
            inscription: SPONSOR_AMBASSADOR_TROPHY_DEFINITION.inscription,
            palette: SPONSOR_AMBASSADOR_TROPHY_DEFINITION.palette,
            description: SPONSOR_AMBASSADOR_TROPHY_DEFINITION.description,
          },
        ]
      : [];

  const referralCareerTrophies = referralTrophies.map((trophy) => ({
    id: `referral:${trophy.count}`,
    kind: "referral" as const,
    title: trophy.title,
    competitionName: "Programme de parrainage",
    seasonName: "Carrière",
    wonAt: null,
    riderName: null,
    href: "/jeu/parrainage",
    inscription: trophy.inscription,
    palette: trophy.palette,
    referralMilestone: trophy.count,
  }));

  const trophies = [
    ...specialTrophies,
    ...sponsorCareerTrophies,
    ...referralCareerTrophies,
    ...attendanceCareerTrophies,
    ...teamTrophies,
    ...riderTrophies,
    ...raceTrophies,
  ].sort(compareTrophies);

  return {
    trophies,
    claimableTrophies,
    counts: {
      total: trophies.length,
      grandTours: trophies.filter((trophy) => trophy.kind === "grand_tour")
        .length,
      monuments: trophies.filter((trophy) => trophy.kind === "monument").length,
      championships: trophies.filter(
        (trophy) =>
          trophy.kind === "world_championship" ||
          trophy.kind === "continental_championship",
      ).length,
      uciTitles: trophies.filter(
        (trophy) => trophy.kind === "uci_team" || trophy.kind === "uci_rider",
      ).length,
      special: specialTrophies.filter((trophy) => trophy.kind === "special")
        .length,
      achievements: specialTrophies.filter(
        (trophy) => trophy.kind === "achievement",
      ).length,
      medical: specialTrophies.filter((trophy) => trophy.kind === "medical")
        .length,
      sponsor: sponsorCareerTrophies.length,
      attendance: attendanceCareerTrophies.length,
      referrals: trophies.filter((trophy) => trophy.kind === "referral").length,
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
  if (kind === "special") return 500;
  if (kind === "achievement") return 475;
  if (kind === "sponsor") return 450;
  if (kind === "medical") return 440;
  if (kind === "uci_team") return 400;
  if (kind === "world_championship") return 380;
  if (kind === "uci_rider") return 350;
  if (kind === "continental_championship") return 330;
  if (kind === "attendance") return 300;
  if (kind === "referral") return 325;
  if (kind === "grand_tour") return 250;
  return 150;
}
