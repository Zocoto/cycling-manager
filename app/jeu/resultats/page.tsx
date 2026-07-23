import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { GameHeader } from "@/components/game/game-header";
import { RaceLiveDirectory } from "@/components/game/race-live-directory";
import Link from "@/components/ui/app-link";
import { selectRaceStageForLiveAccess } from "@/lib/game/race-live";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import { getActiveSeasonRaceCalendar } from "@/services/race-calendar";

export const metadata: Metadata = {
  title: "Résultats / Live",
  description:
    "Rejoignez les directs et les replays de Cyclostratège.",
};

type RaceResultsPageProps = {
  searchParams: Promise<{
    course?: string | string[];
  }>;
};

export default async function RaceResultsPage({
  searchParams,
}: RaceResultsPageProps) {
  const resolvedSearchParams = await searchParams;
  const initialRaceSlug = readSingleSearchParam(
    resolvedSearchParams.course
  );
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const now = new Date();
  const [headerData, calendarResult] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getActiveSeasonRaceCalendar(supabase, now, {
      includeEngagedRiders: false,
    })
      .then((calendar) => ({ calendar, error: null }))
      .catch((error: unknown) => ({
        calendar: null,
        error,
      })),
  ]);

  if (calendarResult.error) {
    console.error(
      "Impossible de charger le calendrier pour Résultats / Live :",
      calendarResult.error
    );
  }

  if (initialRaceSlug && calendarResult.calendar) {
    const edition = calendarResult.calendar.editions.find(
      (candidate) => candidate.slug === initialRaceSlug
    );
    const stage = edition
      ? selectRaceStageForLiveAccess(edition.stages, now)
      : null;

    if (edition && stage) {
      redirect(
        `/jeu/resultats/${edition.slug}/${stage.stageNumber}`
      );
    }
  }

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={
          headerData.teamSponsorIdentity?.sponsor ?? null
        }
        maxWidth="wide"
      />

      <div className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 sm:py-12">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <header className="max-w-3xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#278B70]">
              Résultats / Live
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] sm:text-5xl">
              Vivez chaque course de la saison.
            </h1>
            <p className="mt-5 text-lg font-medium leading-8 text-[#48665F]">
              Le répertoire reste léger : le moteur de course, la startlist, les résultats et le chat ne sont chargés qu’après l’ouverture d’une épreuve.
            </p>
          </header>

          <Link
            href="/jeu/calendrier"
            className="inline-flex min-h-11 items-center rounded-xl border border-[#176951]/25 bg-white px-4 text-sm font-black text-[#176951] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            ← Retour au calendrier
          </Link>
        </div>

        <div className="mt-8">
          {calendarResult.calendar ? (
            <RaceLiveDirectory
              calendar={calendarResult.calendar}
              nowIso={now.toISOString()}
            />
          ) : (
            <div className="rounded-2xl border border-red-300 bg-red-50 px-6 py-8 text-center font-bold text-red-900">
              Le calendrier des courses ne peut pas être chargé pour le moment.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function readSingleSearchParam(
  value: string | string[] | undefined
) {
  return Array.isArray(value)
    ? value[0] ?? null
    : value ?? null;
}
