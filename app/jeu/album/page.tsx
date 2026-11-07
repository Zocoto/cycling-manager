import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { GameHeader } from "@/components/game/game-header";
import { canAccessCollectorAlbum } from "@/lib/game/collector-album-access";
import type { CollectorAlbumSnapshot } from "@/lib/game/collector-album";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import { CYCLO_STICKERS_RELEASE } from "@/lib/game/cyclo-stickers-release";
import { getCycloStickersLeaderboard } from "@/lib/game/cyclo-stickers-leaderboard";

export const metadata: Metadata = { title: "Album de Cyclo-Stickers", robots: {index: false, follow: false} };

export default async function CollectorAlbumPage({searchParams}: {searchParams?: Promise<{saison?:string;onglet?:string}>}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await getAuthenticatedUser(supabase);
  if (error || !user) redirect("/connexion");
  const params = await searchParams;
  if (params?.saison !== undefined && !["3", "4", "5"].includes(params.saison)) notFound();
  const ownerPreview = canAccessCollectorAlbum(user.id);
  const legacyS3 = params?.saison === "3";
  if (legacyS3 && !ownerPreview) notFound();
  const initialTab = params?.onglet === "boosters" ? "boosters" : params?.onglet === "succes" ? "achievements" : params?.onglet === "echanges" ? "trades" : "album";
  // Code readiness only arms the DB gate: completed S4, sealed enabled edition, active S5+.
  // Once it opens, the owner and every other player use exactly the same real inventory.
  if (!legacyS3 && CYCLO_STICKERS_RELEASE.publicReady) {
    const { getPublicCycloStickersAlbum } = await import("@/services/cyclo-stickers-album");
    const album = await getPublicCycloStickersAlbum(supabase);
    if (album) {
      const [{ CycloStickersPersistentAlbum }, header, leaderboard] = await Promise.all([
        import("@/components/game/cyclo-stickers-persistent-album"),
        getGameHeaderData(supabase, user.id),
        getCycloStickersLeaderboard(supabase, album.snapshot.edition),
      ]);
      return <main className="min-h-screen bg-[#e8efed] text-[#172d29]">
        <GameHeader simulatorEmail={user.email} displayName={header.displayName} sponsor={header.teamSponsorVisual} maxWidth="wide" collectorAlbumAvailable />
        <CycloStickersPersistentAlbum
          key={album.snapshot.edition}
          snapshot={album.snapshot}
          initialState={album.state}
          initialLeaderboard={leaderboard}
          initialTab={params?.onglet === "classement" ? "leaderboard" : initialTab}
        />
      </main>;
    }
    // A real offer or an explicit public-edition link must never enter local test trades.
    if (!ownerPreview || params?.saison === "5" || params?.onglet === "echanges") notFound();
  }
  if (!ownerPreview || params?.saison === "5") notFound();
  // The explicit S3 route is the only place that loads the old prototype.
  // The default owner preview contains genuine S4 rows in its own isolated edition.
  const [{ CollectorAlbum }, { default: snapshot }, header] = await Promise.all([
    import("@/components/game/collector-album"),
    legacyS3 ? import("@/data/collector-album-pilot.json") : import("@/data/collector-album-s4-preview.json"),
    getGameHeaderData(supabase, user.id),
  ]);
  const catalogue = snapshot as CollectorAlbumSnapshot;
  if (!legacyS3 && (catalogue.sourceSeason !== 4 || catalogue.ratingsFrozenFromSeason !== 4 || catalogue.cards.length !== 72)) notFound();
  return <main className="min-h-screen bg-[#e8efed] text-[#172d29]">
    <GameHeader simulatorEmail={user.email} displayName={header.displayName} sponsor={header.teamSponsorVisual} maxWidth="wide" collectorAlbumAvailable />
    <CollectorAlbum snapshot={catalogue} storageOwnerId={user.id} initialTab={initialTab} initialIntroduction={!legacyS3&&params?.onglet==="introduction"} />
  </main>;
}
