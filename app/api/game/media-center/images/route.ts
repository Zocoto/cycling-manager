import { CHAT_IMAGE_UPLOAD_MAX_BYTES } from "@/lib/game/chat-images";
import { MEDIA_CENTER_IMAGE_BUCKET, MEDIA_CENTER_IMAGE_UPLOAD_URL } from "@/lib/game/media-center-images";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { processChatImage } from "@/services/chat-image-processing";

export const runtime = "nodejs";
export const maxDuration = 30;

const bodyLimit = CHAT_IMAGE_UPLOAD_MAX_BYTES + 32_768;
const headers = { "Cache-Control": "no-store" };
const importError = "L’illustration n’a pas pu être importée. Réessayez.";

function failure(error: string, status = 400) {
  return Response.json({ error }, { status, headers });
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return failure("Origine de la requête refusée.", 403);
  }
  const contentType = request.headers.get("content-type");
  if (!contentType?.startsWith("multipart/form-data")) return failure("Format d’envoi invalide.");
  if (Number(request.headers.get("content-length")) > bodyLimit) return failure("L’image est trop volumineuse.", 413);

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return failure("Authentification requise.", 401);

    const reader = request.body?.getReader();
    if (!reader) return failure("Image manquante.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > bodyLimit) {
        await reader.cancel();
        return failure("L’image est trop volumineuse.", 413);
      }
      chunks.push(value);
    }

    const form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": contentType } })
      .formData().catch(() => null);
    const file = form?.get("image");
    if (!(file instanceof File) || form?.getAll("image").length !== 1) return failure("Image manquante.");

    const admin = createSupabaseAdminClient();
    const reservation = await admin.rpc("reserve_media_center_article_image", { p_auth_user_id: user.id });
    if (reservation.error?.code === "42501") return failure("Accès au Média Center requis.", 403);
    if (reservation.error?.code === "PT429") return failure("Limite de 12 illustrations par période de 24 heures atteinte.", 429);
    if (reservation.error || !reservation.data) throw new Error("media_center_image_reservation_failed");
    const { id, team_id: teamId } = reservation.data as { id: string; team_id: string };

    let image: Awaited<ReturnType<typeof processChatImage>>;
    try { image = await processChatImage(file); }
    catch { return failure("Formats acceptés : PNG, JPEG et WebP (images fixes). Maximum 2 Mo."); }

    const path = `${teamId}/${id}.webp`;
    const uploaded = await admin.storage.from(MEDIA_CENTER_IMAGE_BUCKET)
      .upload(path, image.data, { contentType: "image/webp", upsert: false, cacheControl: "31536000" });
    if (uploaded.error) throw uploaded.error;

    const saved = await admin.from("media_center_article_images")
      .update({ width: image.width, height: image.height }).eq("id", id).select("id").single();
    if (saved.error) throw saved.error;

    return Response.json({ image: {
      assetId: id,
      src: `${MEDIA_CENTER_IMAGE_UPLOAD_URL}/${path}`,
      width: image.width,
      height: image.height,
    } }, { headers });
  } catch {
    console.error("media_center_image_upload_failed");
    return failure(importError, 503);
  }
}
