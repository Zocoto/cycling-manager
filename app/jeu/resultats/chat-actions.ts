"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  mapRaceLiveMessage,
  type RaceLiveMessage,
} from "@/services/race-live-chat";

type MessageRow = {
  id: string;
  source_stage_id: string | null;
  source_race_edition_id: string | null;
  sporting_director_id: string;
  author_display_name: string;
  message: string;
  created_at: string;
};

export async function postRaceLiveMessageAction(
  stageId: string,
  rawMessage: string
): Promise<RaceLiveMessage> {
  const message = rawMessage.trim().replace(/\s+/g, " ");

  if (!stageId) {
    throw new Error("Cette étape est introuvable.");
  }

  if (message.length < 1 || message.length > 280) {
    throw new Error(
      "Le message doit contenir entre 1 et 280 caractères."
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    throw new Error("Vous devez être connecté pour commenter.");
  }

  const { data, error } = await supabase
    .rpc("post_race_context_global_chat_message", {
      p_stage_id: stageId,
      p_message: message,
    });

  if (error || !data) {
    throw new Error(
      `Impossible d’envoyer le message : ${error?.message ?? "erreur inconnue"}`
    );
  }

  const row = data as MessageRow;
  if (!row.source_stage_id || !row.source_race_edition_id) {
    throw new Error("Le contexte de la course n’a pas pu être enregistré.");
  }

  return mapRaceLiveMessage({
    id: row.id,
    stage_id: row.source_stage_id,
    race_edition_id: row.source_race_edition_id,
    sporting_director_id: row.sporting_director_id,
    author_display_name: row.author_display_name,
    message: row.message,
    created_at: row.created_at,
  });
}
