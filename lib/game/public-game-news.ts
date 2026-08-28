import type { RaceStageSegment } from "@/lib/game/race-profiles";
import { getEstimatedStageFinishAt } from "@/lib/game/race-live";
import type { StaffRole } from "@/lib/game/staff";
import type { AmateurJerseyConfig } from "@/lib/amateur-team";
import {
  createAmateurRiderJersey,
  createSponsoredRiderJersey,
  type RiderJerseyAppearance,
} from "@/lib/rider-jersey";
import type { JerseyStyle, SponsorColors } from "@/types/sponsor";

export type PublicGameNewsKind =
  | "race_recap"
  | "victory"
  | "gazette"
  | "arrival"
  | "movement"
  | "staff";

export type PublicGameNewsTeamJerseyArtwork =
  | {
      kind: "sponsor";
      imagePath: string;
    }
  | {
      kind: "amateur";
      jersey: AmateurJerseyConfig;
    };

export type PublicGameNewsTeamVisual = {
  name: string;
  logoPath: string | null;
  sponsorName: string | null;
  jersey: RiderJerseyAppearance;
  jerseyArtwork: PublicGameNewsTeamJerseyArtwork;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
};

export function resolvePublicGameNewsTeamJersey({
  amateurJersey,
  sponsor,
}: {
  amateurJersey: AmateurJerseyConfig;
  sponsor?: {
    colors: SponsorColors;
    jerseyStyle: JerseyStyle;
    jerseyImagePath: string;
  } | null;
}): RiderJerseyAppearance {
  return sponsor
    ? createSponsoredRiderJersey({
        colors: sponsor.colors,
        style: sponsor.jerseyStyle,
        imagePath: sponsor.jerseyImagePath,
      })
    : createAmateurRiderJersey(amateurJersey);
}

export function resolvePublicGameNewsTeamJerseyArtwork({
  amateurJersey,
  sponsorJerseyImagePath,
}: {
  amateurJersey: AmateurJerseyConfig;
  sponsorJerseyImagePath?: string | null;
}): PublicGameNewsTeamJerseyArtwork {
  return sponsorJerseyImagePath
    ? { kind: "sponsor", imagePath: sponsorJerseyImagePath }
    : { kind: "amateur", jersey: amateurJersey };
}

export type PublicGameNewsPersonVisual =
  | {
      kind: "rider";
      profileKey: string | null;
      seed: string;
      age: number;
      label: string;
    }
  | {
      kind: "director";
      avatarKey: string | null;
      avatarFrameKey: "alpha_tester" | null;
      label: string;
    }
  | {
      kind: "staff";
      profileKey: string | null;
      seed: string;
      role: StaffRole;
      label: string;
    };

export type PublicGameNewsVisual = {
  person: PublicGameNewsPersonVisual;
  team?: PublicGameNewsTeamVisual | null;
  raceProfile?: RaceStageSegment[];
};

export type PublicGameNewsItem = {
  id: string;
  kind: PublicGameNewsKind;
  raceEventKind?: "breakaway" | "incident" | "classification";
  title: string;
  detail: string;
  happenedAt: string;
  href?: string;
  significance?: "major" | "standard";
  teamColors?: PublicGameNewsTeamVisual["colors"];
  visual?: PublicGameNewsVisual;
};

export function resolveRaceVictoryHappenedAt({
  resultCreatedAt,
  stages,
}: {
  resultCreatedAt: string;
  stages: Array<{
    stageNumber: number;
    departureAt: string | null;
    distanceKm: number;
  }>;
}) {
  const finalStage = [...stages].sort(
    (first, second) => second.stageNumber - first.stageNumber,
  )[0];
  const estimatedFinishAt = finalStage
    ? getEstimatedStageFinishAt({
        departureAt: finalStage.departureAt,
        distanceKm: finalStage.distanceKm,
      })
    : null;

  return estimatedFinishAt ?? resultCreatedAt;
}

export function getPublicGameNewsTeamColors(
  item: PublicGameNewsItem,
): PublicGameNewsTeamVisual["colors"] | null {
  return item.visual?.team?.colors ?? item.teamColors ?? null;
}

export type PublicGameNewsTotals = {
  directors: number | null;
  victories: number | null;
  gazettes: number | null;
};

export type PublicGameNewsSnapshot = {
  items: PublicGameNewsItem[];
  totals: PublicGameNewsTotals;
  isLive: boolean;
};

const kindPriority: Record<PublicGameNewsKind, number> = {
  victory: 0,
  gazette: 1,
  race_recap: 2,
  movement: 3,
  staff: 4,
  arrival: 5,
};

export function isPublicPelotonAnnouncement(item: PublicGameNewsItem) {
  return item.kind === "victory" || item.kind === "gazette";
}

export function createPublicGameNewsSnapshot({
  items,
  totals,
  isLive,
}: {
  items: PublicGameNewsItem[];
  totals: PublicGameNewsTotals;
  isLive: boolean;
}): PublicGameNewsSnapshot {
  return {
    items: [...items]
      .filter(isPublicPelotonAnnouncement)
      .filter((item) => Number.isFinite(new Date(item.happenedAt).getTime()))
      .sort(
        (first, second) =>
          new Date(second.happenedAt).getTime() -
            new Date(first.happenedAt).getTime() ||
          kindPriority[first.kind] - kindPriority[second.kind]
      )
      .slice(0, 7),
    totals,
    isLive,
  };
}

export function createEmptyPublicGameNewsSnapshot(): PublicGameNewsSnapshot {
  return createPublicGameNewsSnapshot({
    items: [],
    totals: {
      directors: null,
      victories: null,
      gazettes: null,
    },
    isLive: false,
  });
}

export function selectDashboardPelotonHighlights(
  items: PublicGameNewsItem[],
  limit = 8
): PublicGameNewsItem[] {
  return [...items]
    .filter(
      (item) =>
        item.kind === "victory" ||
        item.kind === "arrival" ||
        item.kind === "staff" ||
        (item.kind === "movement" && item.significance === "major")
    )
    .filter((item) => Number.isFinite(new Date(item.happenedAt).getTime()))
    .sort(
      (first, second) =>
        new Date(second.happenedAt).getTime() -
          new Date(first.happenedAt).getTime() ||
        kindPriority[first.kind] - kindPriority[second.kind]
    )
    .slice(0, Math.max(0, limit));
}

export function formatPublicGameNewsDate(
  value: string,
  now = new Date()
): string {
  const date = new Date(value);
  const elapsedMs = now.getTime() - date.getTime();

  if (!Number.isFinite(date.getTime())) return "Récemment";
  if (elapsedMs < 60_000) return "À l’instant";
  if (elapsedMs < 3_600_000) {
    return `Il y a ${Math.max(1, Math.floor(elapsedMs / 60_000))} min`;
  }
  if (elapsedMs < 86_400_000) {
    return `Il y a ${Math.max(1, Math.floor(elapsedMs / 3_600_000))} h`;
  }
  if (elapsedMs < 172_800_000) return "Hier";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Paris",
  }).format(date);
}

export function formatPublicGameNewsTotal(value: number | null): string {
  return value === null ? "—" : new Intl.NumberFormat("fr-FR").format(value);
}

export function normalizePublicGameNewsTotal(
  value: number | string | bigint | null | undefined,
): number {
  const total = Number(value);

  return Number.isSafeInteger(total) && total >= 0 ? total : 0;
}
