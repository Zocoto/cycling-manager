import type { CollectorAlbumSnapshot } from "@/lib/game/collector-album";

/** A live S4 capture may be browsed without describing it as the final print. */
export function isProvisionalCollectorAlbum(snapshot: CollectorAlbumSnapshot & { sourceSeasonStatus?: string }) {
  return snapshot.sourceSeasonStatus === "active";
}
