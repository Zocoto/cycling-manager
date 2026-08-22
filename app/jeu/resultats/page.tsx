import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { GameHeader } from "@/components/game/game-header";
import {
  NationalChampionshipResultsDirectory,
  buildNationalChampionshipGroups,
  splitNationalChampionshipGroupsForResults,
} from "@/components/game/national-championship-results-directory";
import { RaceLiveDirectory } from "@/components/game/race-live-directory";
import Link from "@/components/ui/app-link";
import { selectRaceStageForLiveAccess } from "@/lib/game/race-live";
import {
  CRITERIUM_DISCOVERY_KEY,
  CRITERIUM_DISCOVERY_RESULTS_ROUTE,
  CRITERIUM_DISCOVERY_SLUG,
  appendCriteriumDiscoveryEdition,
  getCriteriumDiscoveryRunFromMetadata,
} from "@/lib/tutorial/criterium-discovery";
import { getAuthenticatedTutorialProgress } from "@/lib/tutorial/progress";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import {
  getCurrentTeamNationalChampionshipCountryCodes,
} from "@/services/national-championships";
import { getActiveSeasonRaceCalendar } from "@/services/race-calendar";

export const metadata: Metadata = {
  title: "Résultats / Live",
  description: "Consultez les résultats, directs et replays de Cyclostratège.",
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
  const initialRaceSlug = readSingleSearchParam(resolvedSearchParams.course);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) redirect("/connexion");

  const now = new Date();
  const [headerData, calendarResult, criteriumProgress] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getActiveSeasonRaceCalendar(supabase, now, {
      includeEngagedRiders: false,
    })
      .then((calendar) => ({ calendar, error: null }))
      .catch((error: unknown) => ({ calendar: null, error })),
    getAuthenticatedTutorialProgress(supabase, CRITERIUM_DISCOVERY_KEY),
  ]);

  if (calendarResult.error) {
    console.error(
      "Impossible de charger le calendrier pour Résultats / Live :",
      calendarResult.error,
    );
  }

  const criteriumRun = getCriteriumDiscoveryRunFromMetadata(
    criteriumProgress?.metadata,
  );
  const calendar =
    calendarResult.calendar && criteriumRun
      ? {
          ...calendarResult.calendar,
          editions: appendCriteriumDiscoveryEdition({
            editions: calendarResult.calendar.editions,
            edition: criteriumRun.edition,
          }),
        }
      : calendarResult.calendar;

  if (initialRaceSlug === CRITERIUM_DISCOVERY_SLUG && criteriumRun) {
    redirect(CRITERIUM_DISCOVERY_RESULTS_ROUTE);
  }

  if (initialRaceSlug && calendar) {
    const edition = calendar.editions.find(
      (candidate) => candidate.slug === initialRaceSlug,
    );
    if (
      edition?.competitionType === "national_road" ||
      edition?.competitionType === "national_time_trial"
    ) {
      redirect("/jeu/championnats-nationaux");
    }
    if (edition?.raceFormat === "stage_race") {
      redirect(`/jeu/resultats/${edition.slug}`);
    }

    const stage = edition
      ? selectRaceStageForLiveAccess(edition.stages, now)
      : null;
    if (edition && stage && stage.dayNumber <= calendar.currentDayNumber) {
      redirect(`/jeu/resultats/${edition.slug}/${stage.stageNumber}`);
    }
  }

  const nationalCountryCodes = calendar
    ? await getCurrentTeamNationalChampionshipCountryCodes({
        authUserId: user.id,
        seasonId: calendar.seasonId,
      }).catch((error: unknown) => {
        console.error("Impossible de charger les nations CN du DS :", error);
        return [];
      })
    : [];
  const spectatorCalendar = calendar
    ? {
        ...calendar,
        editions: calendar.editions.filter(
          (edition) =>
            edition.competitionType === "standard" ||
            edition.competitionType === "world_championship" ||
            edition.competitionType === "continental_championship",
        ),
      }
    : null;
  const nationalChampionshipGroups = calendar
    ? buildNationalChampionshipGroups(
        calendar,
        new Set(nationalCountryCodes.map((code) => code.toUpperCase())),
      )
    : [];
  const nationalChampionshipResults = calendar
    ? splitNationalChampionshipGroupsForResults(
        nationalChampionshipGroups,
        calendar.currentDayNumber,
      )
    : { current: [], past: [] };

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
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
              Les courses ordinaires proposent direct et replay. Les
              championnats nationaux sont simulés sans rendu graphique et
              regroupés par discipline.
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
          {calendar && spectatorCalendar ? (
            <>
              <NationalChampionshipResultsDirectory
                groups={nationalChampionshipResults.current}
              />
              <RaceLiveDirectory
                calendar={spectatorCalendar}
                nowIso={now.toISOString()}
                pastNationalChampionshipGroups={
                  nationalChampionshipResults.past
                }
              />
            </>
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

function readSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}
