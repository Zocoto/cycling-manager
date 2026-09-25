export const SQUAD_STATUS_OPTIONS = [
  { value: "absolute_leader", label: "Leader absolu", rank: 100 },
  { value: "co_leader", label: "Co-leader", rank: 90 },
  { value: "road_captain", label: "Capitaine de route", rank: 80 },
  { value: "lieutenant", label: "Lieutenant", rank: 70 },
  { value: "free_role", label: "Électron libre", rank: 60 },
  {
    value: "stage_hunter",
    label: "Chasseur d’étapes / classicman",
    rank: 50,
  },
  { value: "prospect", label: "Espoir", rank: 40 },
  { value: "domestique", label: "Équipier", rank: 30 },
  { value: "bottle_carrier", label: "Porteur de bidons", rank: 20 },
] as const;

export type SquadStatus = (typeof SQUAD_STATUS_OPTIONS)[number]["value"];

const SQUAD_STATUS_VALUES = new Set<string>(
  SQUAD_STATUS_OPTIONS.map((option) => option.value),
);

export function isSquadStatus(value: unknown): value is SquadStatus {
  return typeof value === "string" && SQUAD_STATUS_VALUES.has(value);
}

export function parseSquadStatus(value: unknown): SquadStatus | null {
  return isSquadStatus(value) ? value : null;
}

export function getSquadStatusLabel(status: SquadStatus | null): string {
  return (
    SQUAD_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    "Non défini"
  );
}

export function getSquadStatusRank(status: SquadStatus | null): number | null {
  return (
    SQUAD_STATUS_OPTIONS.find((option) => option.value === status)?.rank ?? null
  );
}
