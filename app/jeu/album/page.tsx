import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { GameHeader } from "@/components/game/game-header";
import { canAccessCollectorAlbum } from "@/lib/game/collector-album-access";
import type { CollectorAlbumSnapshot } from "@/lib/game/collector-album";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";

export const metadata: Metadata = { title: "L’Album du peloton · Aperçu privé", robots: {index: false, follow: false} };

export default async function CollectorAlbumPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await getAuthenticatedUser(supabase);
  if (error || !user) redirect("/connexion");
  if (!canAccessCollectorAlbum(user.id)) notFound();
  // No top-50 DB scan on page views. Snapshot and interactive bundle stay on this route.
  const [{ CollectorAlbum }, { default: snapshot }, header] = await Promise.all([
    import("@/components/game/collector-album"),
    import("@/data/collector-album-pilot.json"),
    getGameHeaderData(supabase, user.id),
  ]);
  return <main className="min-h-screen bg-[#e8e4da] text-[#172d29]">
    <GameHeader simulatorEmail={user.email} displayName={header.displayName} sponsor={header.teamSponsorVisual} maxWidth="wide" />
    <CollectorAlbum snapshot={snapshot as CollectorAlbumSnapshot} storageOwnerId={user.id} />
  </main>;
}
