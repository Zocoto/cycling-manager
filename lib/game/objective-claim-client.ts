import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { RewardsPageObjective } from "@/services/game-objectives";

export type ObjectiveClaimReceipt = {
  objectiveKey: string;
  claimedAt: string;
  alreadyClaimed: boolean;
  itemName?: string | null;
};

type Client = ReturnType<typeof createSupabaseBrowserClient>;
const unconfirmedMessage = "La récompense n’a pas pu être confirmée. Réessayez dans un instant.";

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function claimedDate(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value))
    ? value
    : null;
}

async function requireSameSession(client: Client, expectedAuthUserId: string) {
  const { data, error } = await client.auth.getSession();
  if (error || !expectedAuthUserId || data.session?.user.id !== expectedAuthUserId) {
    throw new Error("Votre session a changé. Rechargez la page avant de récupérer une récompense.");
  }
}

async function readConfirmedClaim(client: Client, objective: RewardsPageObjective): Promise<string | null> {
  // Album tables deliberately have no player SELECT grants. Its existing RPC
  // scopes progress/receipts to auth.uid(); do not widen those permissions.
  const result = objective.album
    ? await client.rpc("get_current_cyclo_stickers_reward_objectives")
        .eq("edition_id", objective.album.editionId)
        .eq("achievement_id", objective.album.achievementId)
        .maybeSingle()
    : await client.from("game_objective_claims")
        .select("claimed_at")
        .eq("objective_key", objective.key)
        .maybeSingle();
  if (result.error) return null;
  return claimedDate(record(result.data)?.claimed_at);
}

/** Only authenticated server receipts can mark a reward received in the UI. */
export async function claimRewardObjective(
  objective: RewardsPageObjective,
  expectedAuthUserId: string,
): Promise<ObjectiveClaimReceipt> {
  if (!objective.completed || objective.claimedAt) {
    throw new Error("Cette récompense n’est pas disponible.");
  }
  const client = createSupabaseBrowserClient();
  await requireSameSession(client, expectedAuthUserId);
  const result = objective.album
    ? await client.rpc("claim_current_cyclo_stickers_achievement", {
        p_edition: objective.album.editionId,
        p_achievement_id: objective.album.achievementId,
      })
    : await client.rpc("claim_current_game_objective", { p_objective_key: objective.key });
  await requireSameSession(client, expectedAuthUserId);
  const data = record(result.data);

  if (!objective.album && !result.error && data?.objectiveKey === objective.key) {
    const claimedAt = claimedDate(data.claimedAt);
    if (claimedAt) return {
      objectiveKey: objective.key,
      claimedAt,
      alreadyClaimed: false,
      itemName: typeof data.itemName === "string" ? data.itemName : null,
    };
  }

  if (objective.album && !result.error) {
    const state = record(data?.state);
    const edition = record(state?.edition);
    const owner = record(state?.owner);
    if (edition?.id !== objective.album.editionId || typeof state?.directorId !== "string" ||
        !state.directorId || state.directorId !== owner?.directorId ||
        !Array.isArray(state.claimedAchievements) ||
        !state.claimedAchievements.includes(objective.album.achievementId) ||
        typeof data?.alreadyClaimed !== "boolean") {
      throw new Error(unconfirmedMessage);
    }
  }

  // A retry or lost response can follow an already committed reward. Confirm
  // the requested own receipt, never infer success from an error message.
  const confirmedAt = await readConfirmedClaim(client, objective);
  await requireSameSession(client, expectedAuthUserId);
  if (!confirmedAt) throw new Error(result.error?.message || unconfirmedMessage);
  return {
    objectiveKey: objective.key,
    claimedAt: confirmedAt,
    alreadyClaimed: Boolean(result.error) || data?.alreadyClaimed === true || !objective.album,
  };
}
