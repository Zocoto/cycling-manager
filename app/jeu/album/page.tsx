import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { GameHeader } from "@/components/game/game-header";
import { canAccessCollectorAlbum } from "@/lib/game/collector-album-access";
import type { CollectorAlbumSnapshot } from "@/lib/game/collector-album";
import { ALBUM_PILOT_SEASON, ALBUM_SOURCE_SEASON } from "@/lib/game/collector-album";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import { createCycloStickersPreview } from "@/lib/game/cyclo-stickers-release";

export const metadata: Metadata = { title: "Album de Cyclo-Stickers · Aperçu privé", robots: {index: false, follow: false} };

export default async function CollectorAlbumPage({searchParams}: {searchParams?: Promise<{saison?:string;onglet?:string}>}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await getAuthenticatedUser(supabase);
  if (error || !user) redirect("/connexion");
  if (!canAccessCollectorAlbum(user.id)) notFound();
  const params = await searchParams;
  // Edition S3 is canonical; keep old S4 preview links working without changing stored progress.
  if (params?.saison !== undefined && params.saison !== String(ALBUM_SOURCE_SEASON) && params.saison !== String(ALBUM_PILOT_SEASON)) notFound();
  const preview = params?.saison !== "3";
  const initialTab = params?.onglet === "boosters" ? "boosters" : params?.onglet === "succes" ? "achievements" : params?.onglet === "echanges" ? "trades" : "album";
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
