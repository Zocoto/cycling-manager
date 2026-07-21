import type { RaceStageSegment } from "@/lib/game/race-profiles";
import type { StaffRole } from "@/lib/game/staff";

export type PublicGameNewsKind =
  | "victory"
  | "arrival"
  | "movement"
  | "staff";

export type PublicGameNewsTeamVisual = {
  name: string;
  logoPath: string | null;
  sponsorName: string | null;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
};

export type PublicGameNewsPersonVisual =
  | {
      kind: "rider";
      profileKey: string | null;
      seed: string;
      label: string;
    }
  | {
      kind: "director";
      avatarKey: string | null;
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
  title: string;
  detail: string;
  happenedAt: string;
  visual?: PublicGameNewsVisual;
};

export type PublicGameNewsTotals = {
  directors: number | null;
  victories: number | null;
  movements: number | null;
};

export type PublicGameNewsSnapshot = {
  items: PublicGameNewsItem[];
  totals: PublicGameNewsTotals;
  isLive: boolean;
};

const kindPriority: Record<PublicGameNewsKind, number> = {
  victory: 0,
  movement: 1,
  staff: 2,
  arrival: 3,
};

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
      movements: null,
    },
    isLive: false,
  });
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
