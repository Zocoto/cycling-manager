"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";

const inputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("preferences"), editionId: z.uuid(), riders: z.array(z.uuid()).max(10000), auto: z.boolean() }),
  z.object({ kind: z.literal("pick"), editionId: z.uuid(), riderId: z.uuid() }),
  z.object({ kind: z.literal("pass"), editionId: z.uuid() }),
]);

export async function updateSeasonDraft(input: unknown): Promise<{ error?: string }> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { error: "La sélection transmise est invalide." };
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await getAuthenticatedUser(supabase);
  if (!user || authError) return { error: "Reconnectez-vous pour participer à la draft." };
  const value = parsed.data;
  const result = value.kind === "preferences"
    ? await supabase.rpc("save_current_season_draft_preferences", { p_edition: value.editionId, p_riders: value.riders, p_auto: value.auto })
    : await supabase.rpc("select_current_season_draft_rider", { p_edition: value.editionId, p_rider: value.kind === "pick" ? value.riderId : null, p_pass: value.kind === "pass" });
  if (result.error) return { error: result.error.message };
  for (const route of ["/jeu/draft", "/jeu", "/jeu/effectif", "/jeu/transferts", "/jeu/finances", "/jeu/messagerie"]) revalidatePath(route);
  return {};
}
