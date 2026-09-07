export type BonusBreakdownItem = {
  key: string;
  label: string;
  percentage: number;
  detail?: string;
  /** Les éléments d'un même groupe s'additionnent avant empilement. */
  stackingGroup?: string;
};

export type BonusBreakdown = {
  totalPercentage: number;
  items: BonusBreakdownItem[];
  calculation: "stacked";
};

export function buildStackedBonusBreakdown(
  items: readonly BonusBreakdownItem[],
): BonusBreakdown {
  const normalizedItems = items
    .map((item) => ({
      ...item,
      percentage: roundPercentage(item.percentage),
    }))
    .filter((item) => Number.isFinite(item.percentage) && item.percentage !== 0);
  const percentageByGroup = new Map<string, number>();

  normalizedItems.forEach((item, index) => {
    const group = item.stackingGroup ?? `factor:${index}:${item.key}`;
    percentageByGroup.set(
      group,
      (percentageByGroup.get(group) ?? 0) + item.percentage,
    );
  });

  const multiplier = [...percentageByGroup.values()].reduce(
    (total, percentage) => total * (1 + percentage / 100),
    1,
  );

  return {
    totalPercentage: roundPercentage((multiplier - 1) * 100),
    items: normalizedItems,
    calculation: "stacked",
  };
}

export function roundPercentage(value: number): number {
  return Math.round(value * 10) / 10;
}
