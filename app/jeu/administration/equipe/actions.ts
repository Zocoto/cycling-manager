"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { getCurrentGameStaffRole } from "@/services/game-staff-access";
import { getGameStaffMembers } from "@/services/game-product-news";
import { GAME_STAFF_CACHE_TAG, type GameStaffActionState } from "@/lib/game/game-product-news";

const uuid = z.string().uuid();
const value = (data: FormData, key: string) => typeof data.get(key) === "string" ? String(data.get(key)) : "";

async function authorizeOwner() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await getAuthenticatedUser(supabase);
  if (error || !user) throw new Error("Authentification requise.");
  const role = await getCurrentGameStaffRole(supabase);
  if (role !== "owner") throw new Error("Accès réservé à l’équipe du jeu.");
  return supabase;
}

export async function searchGameStaffAction(_previous: GameStaffActionState, form: FormData): Promise<GameStaffActionState> {
  try {
    const supabase = await authorizeOwner();
    const query = value(form, "query").trim();
    if (query.length < 2 || query.length > 60) return { status: "error", message: "Saisissez entre 2 et 60 caractères pour rechercher un DS." };
    const result = await supabase.rpc("search_game_staff_candidates", { p_query: query, p_limit: 10 });
    if (result.error) throw new Error("Recherche refusée.");
    return { status: "success", message: "Sélectionnez le membre à ajouter à l’équipe du jeu.", candidates: (result.data ?? []).map((row: { user_id: string; director_id: string; display_name: string; username: string }) => ({ userId: row.user_id, directorId: row.director_id, displayName: row.display_name, username: row.username })) };
  } catch { return { status: "error", message: "La recherche est réservée au propriétaire du jeu ou momentanément indisponible." }; }
}

export async function setGameStaffRoleAction(_previous: GameStaffActionState, form: FormData): Promise<GameStaffActionState> {
  try {
    const supabase = await authorizeOwner();
    const userId = value(form, "user_id"), enabled = value(form, "enabled");
    if (!uuid.safeParse(userId).success || !["true", "false"].includes(enabled)) return { status: "error", message: "Membre ou rôle invalide." };
    const result = await supabase.rpc("set_game_staff_role", { p_auth_user_id: userId, p_enabled: enabled === "true" });
    if (result.error) throw new Error("Attribution refusée.");
    updateTag(GAME_STAFF_CACHE_TAG);
    revalidatePath("/jeu/administration/equipe");
    const members = await getGameStaffMembers(supabase).catch(() => undefined);
    const confirmation = enabled === "true" ? "Membre ajouté à l’équipe du jeu. Il verra ses outils après actualisation." : "Accès retiré. Les actions protégées sont désormais refusées.";
    return { status: "success", message: members ? confirmation : `${confirmation} La liste n’a pas pu être actualisée : rechargez cette page.`, ...(members ? { members } : {}) };
  } catch { return { status: "error", message: "Le rôle n’a pas pu être modifié. Seul le propriétaire peut gérer l’équipe du jeu." }; }
}
