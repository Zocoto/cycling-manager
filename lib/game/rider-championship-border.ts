import {
  CONTINENTAL_CHAMPION_PALETTES,
  getNationalChampionPalette,
  type ContinentalChampionshipCode,
} from "@/lib/rider-jersey";

type ChampionshipDiscipline = "road" | "time_trial";

type RiderChampionshipHistory = {
  worldTitles: Array<{
    type: ChampionshipDiscipline;
    seasonName: string;
    isActive: boolean;
  }>;
  continentalTitles: Array<{
    type: ChampionshipDiscipline;
    continentCode: ContinentalChampionshipCode;
    continentName: string;
    seasonName: string;
    isActive: boolean;
  }>;
  nationalTitles: Array<{
    type: ChampionshipDiscipline;
    countryCode: string;
    countryName: string;
    seasonName: string;
    isActive: boolean;
  }>;
};

export type RiderChampionshipBorder = {
  kind: "world" | "continental" | "national";
  colors: readonly string[];
  label: string;
};

const WORLD_CHAMPION_COLORS = [
  "#2166B1",
  "#E32636",
  "#111111",
  "#F2C94C",
  "#16834A",
] as const;

/**
 * Le liseré distingue uniquement les anciens champions. Un tenant du titre
 * conserve son maillot distinctif et recevra le liseré lorsqu'il le cédera.
 * La distinction la plus prestigieuse reste prioritaire.
 */
export function resolveFormerChampionshipBorder(
  profile: RiderChampionshipHistory,
): RiderChampionshipBorder | null {
  const formerWorldTitles = profile.worldTitles.filter(
    (title) => !title.isActive,
  );
  if (formerWorldTitles.length > 0) {
    return {
      kind: "world",
      colors: WORLD_CHAMPION_COLORS,
      label: `Ancien champion du monde ${formatDisciplines(formerWorldTitles)}`,
    };
  }

  const formerContinentalTitles = profile.continentalTitles.filter(
    (title) => !title.isActive,
  );
  const continentalTitle = mostRecentTitle(formerContinentalTitles);
  if (continentalTitle) {
    const palette =
      CONTINENTAL_CHAMPION_PALETTES[continentalTitle.continentCode];
    const sameChampionshipTitles = formerContinentalTitles.filter(
      (title) => title.continentCode === continentalTitle.continentCode,
    );
    return {
      kind: "continental",
      colors: [palette.primary, palette.secondary, palette.accent],
      label: `Ancien champion ${continentalTitle.continentName} ${formatDisciplines(sameChampionshipTitles)}`,
    };
  }

  const formerNationalTitles = profile.nationalTitles.filter(
    (title) => !title.isActive,
  );
  const nationalTitle = mostRecentTitle(formerNationalTitles);
  if (nationalTitle) {
    const sameChampionshipTitles = formerNationalTitles.filter(
      (title) => title.countryCode === nationalTitle.countryCode,
    );
    return {
      kind: "national",
      colors: getNationalChampionPalette(nationalTitle.countryCode)
        .dominantColors,
      label: `Ancien champion national ${nationalTitle.countryName} ${formatDisciplines(sameChampionshipTitles)}`,
    };
  }

  return null;
}

export function getRiderChampionshipBorderBackground(
  border: RiderChampionshipBorder,
) {
  const colors = border.colors.length > 0 ? border.colors : ["#176951"];
  const stops = colors.flatMap((color, index) => {
    const start = (index / colors.length) * 100;
    const end = ((index + 1) / colors.length) * 100;
    return [`${color} ${start}%`, `${color} ${end}%`];
  });
  return `linear-gradient(135deg, ${stops.join(", ")})`;
}

function mostRecentTitle<
  T extends {
    seasonName: string;
  },
>(titles: T[]) {
  return [...titles].sort(
    (left, right) => seasonNumber(right.seasonName) - seasonNumber(left.seasonName),
  )[0];
}

function seasonNumber(seasonName: string) {
  const value = Number(seasonName.match(/\d+/)?.[0]);
  return Number.isFinite(value) ? value : 0;
}

function formatDisciplines(titles: Array<{ type: ChampionshipDiscipline }>) {
  const disciplines = new Set(titles.map((title) => title.type));
  if (disciplines.size > 1) return "route et CLM";
  return disciplines.has("time_trial") ? "CLM" : "route";
}
