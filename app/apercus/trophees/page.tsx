import { notFound } from "next/navigation";

import { TrophyGallery } from "@/components/game/trophy-gallery";
import { buildTrophyGallery } from "@/lib/game/trophy-gallery";
import Link from "@/components/ui/app-link";
import { ACHIEVEMENT_TROPHY_DEFINITIONS } from "@/lib/game/achievement-trophies";
import { AchievementTrophyMark } from "@/components/game/achievement-trophy-mark";

export default async function TrophyPreview({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const query = await searchParams;
  if (query.visuels === "1") {
    return <main className="min-h-screen bg-[#EAF5F3] p-5 sm:p-8">
      <h1 className="text-xl font-black text-[#183F37]">Trophées du DS</h1>
      <p className="mt-2 text-sm text-[#60756E]">Aperçu local · données fictives</p>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Object.entries(ACHIEVEMENT_TROPHY_DEFINITIONS).map(([key, definition]) => <article key={key} className="min-w-0 rounded-2xl border border-white/15 bg-[#102D28] p-3 text-center">
          <AchievementTrophyMark variant={definition.visualVariant} palette={definition.palette} className="mx-auto h-auto w-full max-w-40" />
          <h2 className="mt-2 text-sm font-bold text-[#FFF5D8]">{definition.title}</h2>
        </article>)}
      </div>
    </main>;
  }
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
