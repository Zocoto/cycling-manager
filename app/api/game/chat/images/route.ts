import { CHAT_IMAGE_BUCKET, CHAT_IMAGE_UPLOAD_MAX_BYTES, isChatImageUuid } from "@/lib/game/chat-images";
import { extractGlobalChatPreviewReference, GLOBAL_CHAT_MESSAGE_MAX_LENGTH, GLOBAL_CHAT_MENTION_MAX_RECIPIENTS, hasForbiddenGlobalChatLink, normalizeGlobalChatMessage } from "@/lib/game/global-chat";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { processChatImage } from "@/services/chat-image-processing";
import { mapGlobalChatMessage, type GlobalChatMessageRow } from "@/services/global-chat";
import { resolveGlobalChatPreviewPalette } from "@/services/global-chat-preview";

export const runtime = "nodejs";
export const maxDuration = 30;

function failure(error: string, status = 400) { return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } }); }

export async function POST(request: Request) {
  // Route Handlers don't inherit Server Action origin protection.
  if (request.headers.get("origin") !== new URL(request.url).origin) return failure("Origine de la requête refusée.", 403);
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) return failure("Format d’envoi invalide.");
  const length = Number(request.headers.get("content-length"));
  if (length > CHAT_IMAGE_UPLOAD_MAX_BYTES + 32_768) return failure("L’image est trop volumineuse.", 413);
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return failure("Connectez-vous pour envoyer une image.", 401);
    // Bound streamed/chunked bodies too, before multipart decoding.
    const reader = request.body?.getReader();
    if (!reader) return failure("Image manquante.");
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > CHAT_IMAGE_UPLOAD_MAX_BYTES + 32_768) { await reader.cancel(); return failure("L’image est trop volumineuse.", 413); }
      chunks.push(value);
    }
    const form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": request.headers.get("content-type")! } }).formData();
    const requestId = form.get("requestId");
    const file = form.get("image");
    const message = normalizeGlobalChatMessage(String(form.get("message") ?? ""));
    const replyId = String(form.get("replyToMessageId") ?? "") || null;
    const mentions: unknown = JSON.parse(String(form.get("mentionedDirectorIds") ?? "[]"));
    if (!isChatImageUuid(requestId) || !(file instanceof File) || form.getAll("image").length !== 1) return failure("Image ou identifiant d’envoi invalide.");
    if (message.length > GLOBAL_CHAT_MESSAGE_MAX_LENGTH || hasForbiddenGlobalChatLink(message)) return failure("Message trop long ou lien non autorisé.");
    if (replyId && !isChatImageUuid(replyId)) return failure("La réponse est invalide.");
    if (!Array.isArray(mentions) || mentions.length > GLOBAL_CHAT_MENTION_MAX_RECIPIENTS || !mentions.every(isChatImageUuid)) return failure("Les mentions sont invalides.");
    const admin = createSupabaseAdminClient();
    const reserved = await admin.rpc("reserve_global_chat_image_upload", { p_user_id: user.id, p_request_id: requestId });
    if (reserved.error || !reserved.data) return failure(reserved.error?.message ?? "L’envoi est indisponible.", 429);
    const reservation = reserved.data as { message_id: string | null; width: number | null; height: number | null };
    if (reservation.message_id) {
      const existing = await supabase.from("global_chat_messages").select("*").eq("id", reservation.message_id).single();
      if (existing.error) throw existing.error;
      return Response.json({ message: mapGlobalChatMessage(existing.data as GlobalChatMessageRow) });
    }
    const path = `${user.id}/${requestId}.webp`;
    if (!reservation.width || !reservation.height) {
      const processed = await processChatImage(file);
      const uploaded = await admin.storage.from(CHAT_IMAGE_BUCKET).upload(path, processed.data, { contentType: "image/webp", upsert: false, cacheControl: "3600" });
      // Never overwrite an object or its dimensions, even on simultaneous retries.
      if (uploaded.error) return failure("Un envoi de cette image est déjà en cours ou a échoué. Patientez puis réessayez.");
      const saved = await admin.from("global_chat_image_uploads").update({ width: processed.width, height: processed.height }).eq("id", requestId).eq("auth_user_id", user.id);
      if (saved.error) throw saved.error;
    }
    const preview = extractGlobalChatPreviewReference(message);
    let palette: Awaited<ReturnType<typeof resolveGlobalChatPreviewPalette>> | null = null;
    if (preview) { try { palette = await resolveGlobalChatPreviewPalette(preview); } catch { /* Optional decoration must not prevent an image send. */ } }
    const posted = await supabase.rpc("post_global_chat_image_message", {
      p_request_id: requestId, p_message: message,
      p_preview_type: preview?.type ?? null, p_preview_entity_identifier: preview?.entityId ?? null,
      p_reply_to_message_id: replyId, p_mentioned_sporting_director_ids: mentions,
      p_preview_team_primary_color: palette?.primaryColor ?? null, p_preview_team_secondary_color: palette?.secondaryColor ?? null,
      p_preview_team_accent_color: palette?.accentColor ?? null, p_preview_jersey_pattern: palette?.jerseyPattern ?? null, p_preview_jersey_status: palette?.jerseyStatus ?? null,
    });
    if (posted.error || !posted.data) return failure(posted.error?.message ?? "L’image n’a pas pu être envoyée.");
    return Response.json({ message: mapGlobalChatMessage(posted.data as GlobalChatMessageRow) }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    // Keep failed/resolved uploads for retries; bounded orphan cleanup handles ambiguous network failures safely.
    console.error("chat_image_send_failed", cause);
    return failure("L’image n’a pas pu être envoyée. Votre brouillon est conservé, vous pouvez réessayer.");
  }
}
