export type GameObjectiveType = "primary" | "secondary";

export type GameObjectiveRewardItemKind =
  | "equipment"
  | "special_ability"
  | "potential_boost"
  | "rating_boost"
  | "other";

export type GameObjective = {
  key: string;
  type: GameObjectiveType;
  group: string;
  title: string;
  description: string;
  currentValue: number;
  targetValue: number;
  progressPercent: number;
  reward: {
    cash: number;
    experience: number;
    reputation: number;
    itemName: string | null;
    itemKind: GameObjectiveRewardItemKind | null;
  };
  displayOrder: number;
  completed: boolean;
  claimedAt: string | null;
};

export type GameObjectiveRow = {
  objective_key: string;
  objective_type: string;
  objective_group: string;
  title: string;
  description: string;
  current_value: number | string;
  target_value: number | string;
  reward_cash: number | string;
  reward_experience: number | string;
  reward_reputation: number | string;
  reward_item_name: string | null;
  reward_item_kind: string | null;
  display_order: number | string;
  claimed_at: string | null;
  is_completed: boolean;
};

const rewardItemKinds = new Set<GameObjectiveRewardItemKind>([
  "equipment",
  "special_ability",
  "potential_boost",
  "rating_boost",
  "other",
]);

export function normalizeGameObjective(row: GameObjectiveRow): GameObjective {
  const currentValue = toNonNegativeNumber(row.current_value);
  const targetValue = Math.max(1, toNonNegativeNumber(row.target_value));

  return {
    key: row.objective_key,
    type: row.objective_type === "primary" ? "primary" : "secondary",
    group: row.objective_group,
    title: row.title,
    description: row.description,
    currentValue,
    targetValue,
    progressPercent: Math.min(
      100,
      Math.max(0, Math.round((currentValue / targetValue) * 100))
    ),
    reward: {
      cash: toNonNegativeNumber(row.reward_cash),
      experience: toNonNegativeNumber(row.reward_experience),
      reputation: toNonNegativeNumber(row.reward_reputation),
      itemName: row.reward_item_name,
      itemKind: isRewardItemKind(row.reward_item_kind)
        ? row.reward_item_kind
        : null,
    },
    displayOrder: toNonNegativeNumber(row.display_order),
    completed: row.is_completed,
    claimedAt: row.claimed_at,
  };
}

export function selectDashboardObjectives(
  objectives: GameObjective[],
  limit = 3
): GameObjective[] {
  return objectives
    .filter((objective) => !objective.claimedAt)
    .sort(compareDashboardObjectives)
    .slice(0, Math.max(0, limit));
}

export function compareDashboardObjectives(
  left: GameObjective,
  right: GameObjective
): number {
  const readinessDifference = Number(right.completed) - Number(left.completed);
  if (readinessDifference !== 0) return readinessDifference;

  const typeDifference =
    Number(right.type === "primary") - Number(left.type === "primary");
  if (typeDifference !== 0) return typeDifference;

  const progressDifference = right.progressPercent - left.progressPercent;
  if (progressDifference !== 0) return progressDifference;

  return left.displayOrder - right.displayOrder;
}

function isRewardItemKind(
  value: string | null
): value is GameObjectiveRewardItemKind {
  return Boolean(value && rewardItemKinds.has(value as GameObjectiveRewardItemKind));
}

function toNonNegativeNumber(value: number | string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}
