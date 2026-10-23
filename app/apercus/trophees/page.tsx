import { notFound } from "next/navigation";

import { TrophyGallery } from "@/components/game/trophy-gallery";
import { buildTrophyGallery } from "@/lib/game/trophy-gallery";
import Link from "@/components/ui/app-link";

export default async function TrophyPreview({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const query = await searchParams;
  const gallery = buildTrophyGallery({
    raceWins: [1, 2, 3, 4].map((season) => ({
      id: `demo-${season}`, raceSlug: "tour-de-france", raceName: "Tour de France",
      seasonName: `Saison ${season}`, wonAt: null,
      riderName: season === 4 ? "Pierre Démonstration" : "Ancien lauréat",
      isGrandTour: true, isMonument: false,
    })),
    teamUciTitles: [], riderUciTitles: [],
  });
  if (query.nouveaux !== "non") gallery.unseenAwards = [{ sourceReference: "race:demo-4", kind: "grand_tour" }];
  return (
    <main className="min-h-screen bg-[#EAF5F3] p-5 sm:p-8">
      <p className="text-sm font-bold text-[#082A2A]">Aperçu local · données fictives</p>
      <nav className="mt-3 flex flex-wrap gap-4 text-sm font-bold text-[#082A2A]" aria-label="Scénarios de démonstration">
        <Link href="/apercus/trophees">Simuler un nouveau trophée</Link>
        <Link href="/apercus/trophees?nouveaux=non&trophee=race%3Ademo-2">Ouvrir un ancien courrier</Link>
        <Link href="/apercus/trophees?nouveaux=non">Galerie sans nouveauté</Link>
      </nav>
      <TrophyGallery key={query.nouveaux === "non" ? "history" : "arrival"} gallery={gallery} focusedSource={typeof query.trophee === "string" ? query.trophee : undefined} />
    </main>
  );
}
