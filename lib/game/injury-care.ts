export type InjuryCareItem = {
  inventoryId: string;
  catalogKey: string;
  name: string;
  recoveryHours: number;
  quantity: number;
  halloweenItem?: "mummy-bandage" | "mummy-resurrection";
  fullRecovery?: boolean;
};

export function groupInjuryCareItems(items: readonly InjuryCareItem[]) {
  const grouped = new Map<string, InjuryCareItem>();
  for (const item of items) {
    const fullRecovery = item.fullRecovery && item.halloweenItem === "mummy-resurrection";
    if ((!fullRecovery && (!Number.isInteger(item.recoveryHours) || item.recoveryHours < 1 || item.recoveryHours > 48)) ||
      !Number.isSafeInteger(item.quantity) || item.quantity < 1) continue;
    const existing = grouped.get(item.catalogKey);
    if (existing) existing.quantity += item.quantity;
    else grouped.set(item.catalogKey, { ...item });
  }
  return [...grouped.values()].sort((a, b) => Number(Boolean(a.fullRecovery)) - Number(Boolean(b.fullRecovery)) || a.recoveryHours - b.recoveryHours || a.name.localeCompare(b.name, "fr"));
}
