import "server-only";
import { CHAT_IMAGE_BUCKET } from "@/lib/game/chat-images";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function pruneChatImages(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const startedAt = Date.now();
  let total = 0;
  // Avoid a growing retention backlog without unbounded scans or long maintenance runs.
  for (let batch = 0; batch < 20 && Date.now() - startedAt < 10_000; batch++) {
    const expired = await admin.rpc("get_expired_global_chat_images", { p_limit: 100 });
    if (expired.error) throw expired.error;
    const rows = (expired.data ?? []) as { id: string; path: string }[];
    if (!rows.length) break;
    const removed = await admin.storage.from(CHAT_IMAGE_BUCKET).remove(rows.map((row) => row.path));
    if (removed.error) throw removed.error;
    const finished = await admin.rpc("finish_global_chat_image_cleanup", { p_ids: rows.map((row) => row.id) });
    if (finished.error) throw finished.error;
    total += rows.length;
    if (rows.length < 100) break;
  }
  return total;
}
