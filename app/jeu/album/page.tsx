import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { GameHeader } from "@/components/game/game-header";
import { canAccessCollectorAlbum } from "@/lib/game/collector-album-access";
import type { CollectorAlbumSnapshot } from "@/lib/game/collector-album";
import { ALBUM_PILOT_SEASON, ALBUM_SOURCE_SEASON } from "@/lib/game/collector-album";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import { CYCLO_STICKERS_RELEASE, createCycloStickersPreview } from "@/lib/game/cyclo-stickers-release";

export const metadata: Metadata = { title: "Album de Cyclo-Stickers", robots: {index: false, follow: false} };

export default async function CollectorAlbumPage({searchParams}: {searchParams?: Promise<{saison?:string;onglet?:string}>}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await getAuthenticatedUser(supabase);
  if (error || !user) redirect("/connexion");
  const params = await searchParams;
  const initialTab = params?.onglet === "boosters" ? "boosters" : params?.onglet === "succes" ? "achievements" : params?.onglet === "echanges" ? "trades" : "album";
  // Preparation alone never opens the public catalogue or causes additional RPCs.
  // Keep the private previews, but incoming trade mail must reach the real collection after launch.
  const incomingTrade = params?.saison !== "3" && params?.onglet === "echanges";
  if (CYCLO_STICKERS_RELEASE.publicReady && (!canAccessCollectorAlbum(user.id) || params?.saison === "5" || incomingTrade)) {
    if (params?.saison !== undefined && params.saison !== "4" && params.saison !== "5") notFound();
    const { getPublicCycloStickersAlbum } = await import("@/services/cyclo-stickers-album");
    const album = await getPublicCycloStickersAlbum(supabase);
    if (!album) notFound();
    const [{ CycloStickersPersistentAlbum }, header] = await Promise.all([
      import("@/components/game/cyclo-stickers-persistent-album"), getGameHeaderData(supabase, user.id),
    ]);
    return <main className="min-h-screen bg-[#e8efed] text-[#172d29]">
      <GameHeader simulatorEmail={user.email} displayName={header.displayName} sponsor={header.teamSponsorVisual} maxWidth="wide" collectorAlbumAvailable />
      <CycloStickersPersistentAlbum key={album.snapshot.edition} snapshot={album.snapshot} initialState={album.state} initialTab={initialTab} />
    </main>;
  }
  if (!canAccessCollectorAlbum(user.id)) notFound();
  // Edition S3 is canonical; keep old S4 preview links working without changing stored progress.
  if (params?.saison !== undefined && params.saison !== String(ALBUM_SOURCE_SEASON) && params.saison !== String(ALBUM_PILOT_SEASON)) notFound();
  const preview = params?.saison !== "3";
  // No top-50 DB scan on page views. Snapshot and interactive bundle stay on this route.
  const [{ CollectorAlbum }, { default: snapshot }, header] = await Promise.all([
    import("@/components/game/collector-album"),
    import("@/data/collector-album-pilot.json"),
    getGameHeaderData(supabase, user.id),
  ]);
  const catalogue = preview ? createCycloStickersPreview(snapshot as CollectorAlbumSnapshot, (await import("@/data/collector-album-intro-pilot.json")).default) : snapshot as CollectorAlbumSnapshot;
  return <main className="min-h-screen bg-[#e8efed] text-[#172d29]">
    <GameHeader simulatorEmail={user.email} displayName={header.displayName} sponsor={header.teamSponsorVisual} maxWidth="wide" collectorAlbumAvailable={preview} />
    <CollectorAlbum snapshot={catalogue} storageOwnerId={user.id} initialTab={initialTab} initialIntroduction={preview&&params?.onglet==="introduction"} />
  </main>;
}
