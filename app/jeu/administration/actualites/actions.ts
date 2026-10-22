"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { getCurrentGameStaffRole } from "@/services/game-staff-access";
import { getGameStaffMembers, toGameNewsEditorArticle } from "@/services/game-product-news";
import {
  GAME_NEWS_CACHE_TAG, GAME_STAFF_CACHE_TAG, gameNewsDocumentSchema, gameNewsDraftDocumentSchema,
  replaceNewsEmojiShortcodes, type GameNewsEditorState, type GameStaffActionState,
} from "@/lib/game/game-product-news";

const uuid = z.string().uuid();
const value = (data: FormData, key: string) => typeof data.get(key) === "string" ? String(data.get(key)) : "";

async function authorize(ownerOnly = false) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await getAuthenticatedUser(supabase);
  if (error || !user) throw new Error("Authentification requise.");
  const role = await getCurrentGameStaffRole(supabase);
  if (!role || (ownerOnly && role !== "owner")) throw new Error("Accès réservé à l’équipe du jeu.");
  return supabase;
}

export async function saveGameNewsAction(_previous: GameNewsEditorState, form: FormData): Promise<GameNewsEditorState> {
  let saved: GameNewsEditorState["article"];
  try {
    const supabase = await authorize();
    const id = value(form, "id");
    const revision = Number(value(form, "revision") || 0);
    const intent = value(form, "intent");
    if ((id && !uuid.safeParse(id).success) || !Number.isSafeInteger(revision) || revision < 0 || !["save_draft", "publish"].includes(intent)) {
      return { status: "error", message: "Référence ou action invalide. Rechargez l’éditeur avant de réessayer." };
    }
    const keys = ["title", "category", "summary", "body", "title_en", "category_en", "summary_en", "body_en", "image_path", "image_alt", "link_url", "link_label"];
    const document = Object.fromEntries(keys.map((key) => [key, ["title", "summary", "body", "title_en", "summary_en", "body_en"].includes(key) ? replaceNewsEmojiShortcodes(value(form, key)) : value(form, key)]));
    const parsed = (intent === "publish" ? gameNewsDocumentSchema : gameNewsDraftDocumentSchema).safeParse(document);
    if (!parsed.success) return { status: "error", message: "Vérifiez le titre (5–160 caractères), la catégorie, le résumé (10–500), le texte (10–30 000) et les liens." };
    const result = await supabase.rpc("save_game_news_draft", {
      p_id: id || null, p_expected_revision: revision, p_document: parsed.data,
    });
    if (result.error) return writeFailure(result.error);
    const row = result.data?.[0];
    if (!row) throw new Error("Enregistrement non confirmé.");
    saved = toGameNewsEditorArticle(row);
    if (intent === "publish") {
      const publication = await supabase.rpc("publish_game_news", { p_id: saved.id, p_expected_revision: saved.revision });
      if (publication.error) return { ...writeFailure(publication.error), article: saved };
      if (!publication.data?.[0]) throw new Error("Publication non confirmée.");
      saved = toGameNewsEditorArticle(publication.data[0]);
      updateTag(GAME_NEWS_CACHE_TAG);
      for (const path of ["/", "/nouveautes", "/jeu", "/jeu/nouveautes", `/nouveautes/${saved.id}`, `/jeu/nouveautes/${saved.id}`]) revalidatePath(path);
    }
    revalidatePath("/jeu/administration/actualites");
    return { status: "success", message: intent === "publish" ? "Actualité publiée sur l’accueil et dans le jeu." : "Brouillon enregistré. La version publiée reste inchangée.", article: saved };
  } catch (error) {
    console.error("Échec de l’édition d’une actualité.", error instanceof Error ? error.message : "Erreur inconnue");
    return { status: "error", message: saved ? "Le brouillon a été enregistré, mais la publication n’a pas pu être confirmée. Vos modifications sont conservées." : "L’actualité n’a pas pu être enregistrée. Vérifiez votre session et réessayez.", ...(saved ? { article: saved } : {}) };
  }
}

function writeFailure(error: { code?: string; message?: string }): GameNewsEditorState {
  const conflict = error.code === "40001" || /revision|version|conflict|modifi[ée]/iu.test(error.message ?? "");
  return { status: conflict ? "conflict" : "error", message: conflict
    ? "Cette actualité a été modifiée ailleurs. Votre texte est conservé ici : copiez-le avant de recharger la dernière version."
    : "L’enregistrement ou la publication a été refusé. Votre texte reste dans l’éditeur." };
}

export async function searchGameStaffAction(_previous: GameStaffActionState, form: FormData): Promise<GameStaffActionState> {
  try {
    const supabase = await authorize(true);
    const query = value(form, "query").trim();
    if (query.length < 2 || query.length > 60) return { status: "error", message: "Saisissez entre 2 et 60 caractères pour rechercher un DS." };
    const result = await supabase.rpc("search_game_staff_candidates", { p_query: query, p_limit: 10 });
    if (result.error) throw new Error("Recherche refusée.");
    return { status: "success", message: "Sélectionnez le membre à ajouter à l’équipe du jeu.", candidates: (result.data ?? []).map((row: { user_id: string; director_id: string; display_name: string; username: string }) => ({ userId: row.user_id, directorId: row.director_id, displayName: row.display_name, username: row.username })) };
  } catch { return { status: "error", message: "La recherche est réservée au propriétaire du jeu ou momentanément indisponible." }; }
}

export async function setGameStaffRoleAction(_previous: GameStaffActionState, form: FormData): Promise<GameStaffActionState> {
  try {
    const supabase = await authorize(true);
    const userId = value(form, "user_id"), enabled = value(form, "enabled");
    if (!uuid.safeParse(userId).success || !["true", "false"].includes(enabled)) return { status: "error", message: "Membre ou rôle invalide." };
    const result = await supabase.rpc("set_game_staff_role", { p_auth_user_id: userId, p_enabled: enabled === "true" });
    if (result.error) throw new Error("Attribution refusée.");
    updateTag(GAME_STAFF_CACHE_TAG);
    revalidatePath("/jeu/administration/actualites");
    const members = await getGameStaffMembers(supabase).catch(() => undefined);
    const confirmation = enabled === "true" ? "Membre ajouté à l’équipe du jeu. Il verra ses outils après actualisation." : "Accès retiré. Les actions protégées sont désormais refusées.";
    return { status: "success", message: members ? confirmation : `${confirmation} La liste n’a pas pu être actualisée : rechargez cette page.`, ...(members ? { members } : {}) };
  } catch { return { status: "error", message: "Le rôle n’a pas pu être modifié. Seul le propriétaire peut gérer l’équipe du jeu." }; }
}
