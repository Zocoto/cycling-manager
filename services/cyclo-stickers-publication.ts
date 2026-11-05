import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import stageData from "@/data/collector-album-s4-identity-stage.json";
import { assembleCompletedCycloStickersS4Source, type CycloStickersS4IdentityStage } from "@/lib/game/cyclo-stickers-source";
import { assertReviewedCycloStickersFinalSnapshot, createCycloStickersFinalSnapshot, serializeCycloStickersSnapshot } from "@/lib/game/cyclo-stickers-final-snapshot";
import { isCycloStickersPublicationWindow } from "@/lib/game/cyclo-stickers-publication-window";

type Lease = { jobId: string; leaseToken: string; editionId: string; sourceSeasonId: string; identityStageSha256: string };
export type CycloStickersPublicationResult = { status: "outside_window" | "not_due" | "published"; editionId?: string; sha256?: string };

/** Called only by existing authorized maintenance, after the rollover transaction. */
export async function publishDueCycloStickersAlbum(admin: SupabaseClient, at = new Date()): Promise<CycloStickersPublicationResult> {
  if (!isCycloStickersPublicationWindow(at)) return { status: "outside_window" };
  const claim = await admin.rpc("claim_cyclo_stickers_publication", { p_worker_id: randomUUID(), p_lease_seconds: 120 }).abortSignal(AbortSignal.timeout(5000));
  if (claim.error) throw Error(claim.error.message);
  if (!claim.data) return { status: "not_due" };
  const lease = claim.data as Lease;
  try {
    if (lease.sourceSeasonId !== stageData.sourceSeasonId || lease.identityStageSha256 !== stageData.sha256) throw Error("S4 publication identity evidence mismatch");
    const facts = await admin.rpc("get_cyclo_stickers_final_source_facts", { p_job_id: lease.jobId, p_lease_token: lease.leaseToken }).abortSignal(AbortSignal.timeout(12000));
    if (facts.error || !facts.data) throw Error(facts.error?.message ?? "Missing completed S4 source facts");
    const source = assembleCompletedCycloStickersS4Source(stageData as unknown as CycloStickersS4IdentityStage, facts.data as Record<string, unknown>);
    const snapshot = createCycloStickersFinalSnapshot(source);
    assertReviewedCycloStickersFinalSnapshot(snapshot, source.season.status);
    if (snapshot.edition !== lease.editionId) throw Error("S4 publication edition mismatch");
    const sha256 = createHash("sha256").update(serializeCycloStickersSnapshot(snapshot)).digest("hex");
    const published = await admin.rpc("publish_cyclo_stickers_publication", { p_job_id: lease.jobId, p_lease_token: lease.leaseToken, p_snapshot: snapshot, p_sha256: sha256 }).abortSignal(AbortSignal.timeout(12000));
    if (published.error || published.data?.published !== true || published.data.sha256 !== sha256) throw Error(published.error?.message ?? "S4 publication was not confirmed");
    return { status: "published", editionId: snapshot.edition, sha256 };
  } catch (error) {
    const message = (error instanceof Error ? error.message : "S4 publication failed").slice(0, 2000);
    try {
      const failed = await admin.rpc("fail_cyclo_stickers_publication", { p_job_id: lease.jobId, p_lease_token: lease.leaseToken, p_error: message }).abortSignal(AbortSignal.timeout(3000));
      if (failed.error) console.error("cyclo_stickers_publication_retry_tracking_failed", failed.error.message);
    } catch { console.error("cyclo_stickers_publication_retry_tracking_unavailable"); }
    throw error;
  }
}
