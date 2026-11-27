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
import { CycloStickersLibrary, CycloStickersLibraryNavigation } from "@/components/game/cyclo-stickers-library";

export const metadata: Metadata = { title: "Album de Cyclo-Stickers", robots: {index: false, follow: false} };

export default async function CollectorAlbumPage({searchParams}: {searchParams?: Promise<{saison?:string;edition?:string;onglet?:string;vue?:string}>}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await getAuthenticatedUser(supabase);
  if (error || !user) redirect("/connexion");
  const params = await searchParams;
  if (params?.saison !== undefined && (typeof params.saison !== "string" || !/^[1-9]\d{0,3}$/.test(params.saison) || Number(params.saison) < 3)) notFound();
  if (params?.edition !== undefined && (typeof params.edition !== "string" || !/^[a-z0-9][a-z0-9_-]{2,100}$/.test(params.edition))) notFound();
  const ownerPreview = canAccessCollectorAlbum(user.id);
  const legacyS3 = params?.saison === "3";
  if (legacyS3 && (!ownerPreview || params?.edition)) notFound();
  const initialTab = params?.onglet === "boosters" ? "boosters" : params?.onglet === "succes" ? "achievements" : params?.onglet === "echanges" ? "trades" : "album";
  // A bare entry opens the shelf. Existing notifications and action links with
  // an onglet still open an album directly, so inbox links keep working.
  if (!legacyS3 && CYCLO_STICKERS_RELEASE.publicReady) {
    const { getPublicCycloStickersAlbum, getCycloStickersLibrary } = await import("@/services/cyclo-stickers-album");
    const editions = await getCycloStickersLibrary(supabase);
    if (!params?.edition && !params?.saison && !params?.onglet && !params?.vue) {
      const header = await getGameHeaderData(supabase, user.id);
      return <main className="min-h-screen bg-[#e8efed] text-[#172d29]">
        <GameHeader simulatorEmail={user.email} displayName={header.displayName} sponsor={header.teamSponsorVisual} maxWidth="wide" collectorAlbumAvailable={editions.length > 0 || ownerPreview} />
        <CycloStickersLibrary editions={editions} ownerPreview={ownerPreview} />
      </main>;
    }
    // S4/S5 were both historical aliases of the real S4 collection. Keep these
    // pinned when newer albums open; future numeric aliases use collection year.
    const legacyEdition = params?.saison ? editions.find(edition => Number(params.saison) <= 5
      ? edition.sourceSeason === 4 : edition.collectionSeason === Number(params.saison)) : undefined;
    if (params?.edition && params?.saison && (!legacyEdition || params.edition !== legacyEdition.editionId)) notFound();
    const boosterEdition = params?.onglet === "boosters" ? editions.find(edition => (edition.unopenedBoosterCount ?? 0) > 0) : undefined;
    const selectedEdition = params?.edition ?? legacyEdition?.editionId ?? boosterEdition?.editionId ?? editions[0]?.editionId;
    const album = params?.saison && !legacyEdition ? null
      : await getPublicCycloStickersAlbum(supabase, selectedEdition);
    if (album) {
      const [{ CycloStickersPersistentAlbum }, header, leaderboard] = await Promise.all([
        import("@/components/game/cyclo-stickers-persistent-album"),
        getGameHeaderData(supabase, user.id),
        getCycloStickersLeaderboard(supabase, album.snapshot.edition),
      ]);
      return <main className="min-h-screen bg-[#e8efed] text-[#172d29]">
        <GameHeader simulatorEmail={user.email} displayName={header.displayName} sponsor={header.teamSponsorVisual} maxWidth="wide" collectorAlbumAvailable />
        <CycloStickersLibraryNavigation editions={editions} selectedEditionId={album.snapshot.edition} />
        <CycloStickersPersistentAlbum
          key={`${album.snapshot.edition}:${params?.onglet ?? "album"}:${params?.vue ?? ""}`}
          authUserId={user.id}
          snapshot={album.snapshot}
          initialState={album.state}
          initialLeaderboard={leaderboard}
          initialTab={params?.onglet === "classement" ? "leaderboard" : initialTab}
          initialTradeView={params?.onglet === "echanges" && params?.vue === "recues" ? "inbox" : "compose"}
          loginBoosterProgress={album.loginBoosterProgress}
        />
      </main>;
    }
    // A real offer or an explicit public-edition link must never enter local test trades.
    if (!ownerPreview || params?.edition || (params?.saison && params.saison !== "4") || params?.onglet === "echanges") notFound();
  }
  if (!ownerPreview || params?.edition || (params?.saison && !["3", "4"].includes(params.saison))) notFound();
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
