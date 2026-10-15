import { getProspectiveAchievement } from "@/lib/game/prospective-achievements";
import { normalizeGameObjective } from "@/lib/game/objectives";

export function careerObjective(tier: "bronze" | "silver" | "gold", state: "locked" | "ready" | "claimed" = "locked", family = "shopkeeper") {
  const index = ["bronze", "silver", "gold"].indexOf(tier);
  const definition = getProspectiveAchievement(`journey_${family}_${tier}`)!.definition;
  return normalizeGameObjective({
    objective_key: `journey_${family}_${tier}`, objective_type: "secondary", objective_group: definition.group,
    title: definition.title, description: definition.descriptions[index], current_value: state === "locked" ? 0 : definition.targets[index],
    target_value: definition.targets[index], reward_cash: [5000,15000,35000][index], reward_experience: [75,150,300][index],
    reward_reputation: [1,2,5][index], reward_item_name: null, reward_item_kind: null, display_order: 2000+index,
    claimed_at: state === "claimed" ? "2026-10-16T12:00:00Z" : null, is_completed: state !== "locked",
  });
}
