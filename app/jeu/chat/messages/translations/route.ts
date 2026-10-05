import { CHAT_TRANSLATION_BATCH_SIZE, isChatTranslationTargetLocale } from "@/lib/game/chat-translation";
import { isUuid } from "@/lib/game/direct-messages";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrCreateGlobalChatTranslations } from "@/services/global-chat-translation";

export async function POST(request: Request) {
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "Demande invalide." }, { status: 400 }); }
  if (!body || !isChatTranslationTargetLocale(body.targetLocale) || !Array.isArray(body.messageIds)
    || body.messageIds.length < 1 || body.messageIds.length > CHAT_TRANSLATION_BATCH_SIZE || !body.messageIds.every(isUuid)) {
    return Response.json({ error: "Lot de traduction invalide." }, { status: 400 });
  }
  const ids = [...new Set<string>(body.messageIds)];
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await getAuthenticatedUser(supabase);
  if (error || !user) return Response.json({ error: "Connexion requise." }, { status: 401 });
  const [identity, messages] = await Promise.all([
    supabase.rpc("get_current_global_chat_identity_v2"),
    supabase.from("global_chat_messages").select("id, sporting_director_id, message, edited_at").in("id", ids),
  ]);
  const directorId = identity.data?.[0]?.sporting_director_id;
  if (identity.error || !directorId) return Response.json({ error: "Profil indisponible." }, { status: 403 });
  if (messages.error) return Response.json({ error: "Messages indisponibles." }, { status: 503 });
  const sources = (messages.data ?? []).filter((message) => message.sporting_director_id !== directorId)
    .map((message) => ({ messageId: message.id, sourceMessage: message.message, sourceEditedAt: message.edited_at }));
  try {
    const translations = sources.length ? await getOrCreateGlobalChatTranslations({ sources,
      targetLocale: body.targetLocale.toLowerCase(), requesterDirectorId: directorId,
      vercelOidcToken: request.headers.get("x-vercel-oidc-token") ?? undefined }) : [];
    return Response.json({ translations }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "Traduction momentanément indisponible. Les messages originaux restent disponibles." },
      { status: 503, headers: { "Cache-Control": "private, no-store", "Retry-After": "120" } });
  }
}
