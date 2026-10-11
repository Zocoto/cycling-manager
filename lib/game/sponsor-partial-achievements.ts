const ACHIEVEMENT_CODES = [
  "near_target", "stage_win", "stage_podium", "stage_top5", "stage_top10",
  "mountain_classification", "sprint_classification", "youth_classification",
  "team_classification", "combativity_stage", "combativity_race",
] as const;

export type SponsorPartialAchievement = {
  code: (typeof ACHIEVEMENT_CODES)[number];
  rank: number;
  count: number;
};

export function readSponsorPartialAchievements(value: unknown): SponsorPartialAchievement[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((item): SponsorPartialAchievement[] => {
    if (!item || typeof item !== "object") return [];
    const { code, rank, count } = item as Record<string, unknown>;
    if (typeof code !== "string" || !ACHIEVEMENT_CODES.includes(code as SponsorPartialAchievement["code"]) || seen.has(code)) return [];
    if (typeof rank !== "number" || !Number.isInteger(rank) || rank < 1 ||
        typeof count !== "number" || !Number.isInteger(count) || count < 1) return [];
    seen.add(code);
    return [{ code: code as SponsorPartialAchievement["code"], rank, count }];
  });
}

export function formatSponsorPartialAchievement(achievement: SponsorPartialAchievement) {
  const { code, rank, count } = achievement;
  const rankLabel = rank === 1 ? "1er" : `${rank}e`;
  switch (code) {
    case "near_target": return `Classement proche de la cible (${rankLabel})`;
    case "stage_win": return `${count} victoire${count > 1 ? "s" : ""} d’étape`;
    case "stage_podium": return `${count} podium${count > 1 ? "s" : ""} d’étape`;
    case "stage_top5": return `${count} top 5 d’étape`;
    case "stage_top10": return `${count} top 10 d’étape`;
    case "mountain_classification": return `${rankLabel} du classement de la montagne`;
    case "sprint_classification": return `${rankLabel} du classement par points`;
    case "youth_classification": return `${rankLabel} du classement des jeunes`;
    case "team_classification": return `${rankLabel} du classement par équipes`;
    case "combativity_stage": return `${count} prix du combatif`;
    case "combativity_race": return "Super-combatif du tour";
  }
}
