"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { getCurrentGameStaffRole } from "@/services/game-staff-access";
import { toGameNewsEditorArticle } from "@/services/game-product-news";
import {
  GAME_NEWS_CACHE_TAG, gameNewsDocumentSchema, gameNewsDraftDocumentSchema,
  replaceNewsEmojiShortcodes, type GameNewsEditorState,
} from "@/lib/game/game-product-news";

const uuid = z.string().uuid();
const value = (data: FormData, key: string) => typeof data.get(key) === "string" ? String(data.get(key)) : "";

async function authorize() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await getAuthenticatedUser(supabase);
  if (error || !user) throw new Error("Authentification requise.");
  const role = await getCurrentGameStaffRole(supabase);
  if (!role) throw new Error("Accès réservé à l’équipe du jeu.");
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
