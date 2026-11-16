import "server-only";

import { MEDIA_CENTER_IMAGE_BUCKET } from "@/lib/game/media-center-images";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function pruneMediaCenterImages(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const expired = await admin.rpc("claim_expired_media_center_article_images");
  if (expired.error) throw expired.error;
  const images = (expired.data ?? []) as { id: string; path: string }[];
  if (!images.length) return;

  const removed = await admin.storage.from(MEDIA_CENTER_IMAGE_BUCKET).remove(images.map(({ path }) => path));
  if (removed.error) throw removed.error;

  const deleted = await admin.from("media_center_article_images").delete()
    .in("id", images.map(({ id }) => id)).is("article_id", null);
  if (deleted.error) throw deleted.error;
}
