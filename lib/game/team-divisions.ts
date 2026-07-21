import type { TeamDivisionCode } from "@/lib/game/economy";

export const TEAM_DIVISION_LABELS: Record<TeamDivisionCode, string> = {
  elite: "Élite",
  world: "World",
  continental: "Continentale",
  national: "Nationale",
  amateur: "Amateur",
};

export function normalizeTeamDivisionCode(
  value: string | null | undefined
): TeamDivisionCode {
  if (
    value === "elite" ||
    value === "world" ||
    value === "continental" ||
    value === "national"
  ) {
    return value;
  }

  return "amateur";
}

export function getTeamDivisionLabel(
  value: string | null | undefined
): string {
  return TEAM_DIVISION_LABELS[normalizeTeamDivisionCode(value)];
}
