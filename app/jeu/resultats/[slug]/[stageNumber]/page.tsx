import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { GameHeader } from "@/components/game/game-header";
import { NationalChampionshipStageResults } from "@/components/game/national-championship-stage-results";
import { RaceStageExperience } from "@/components/game/race-stage-experience";
import { RaceStageNavigation } from "@/components/game/race-stage-navigation";
import Link from "@/components/ui/app-link";
import {
  shouldUseNationalChampionshipResultsOnly,
} from "@/lib/game/national-championship-results-only";
import type { LockedOfficialRaceSimulationDirectory } from "@/lib/game/official-race-simulation";
import { getStageLiveState } from "@/lib/game/race-live";
import { getRaceWeather, getRaceWeatherLabel } from "@/lib/game/race-weather";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import {
  getCurrentTeamNationalChampionshipCountryCodes,
  getNationalChampionshipDiscipline,
} from "@/services/national-championships";
import { getActiveSeasonRaceCalendar } from "@/services/race-calendar";
import { getRaceLiveMessages } from "@/services/race-live-chat";
import { getOfficialRaceResults } from "@/services/race-results";
import { ensureLockedOfficialRaceSimulations } from "@/services/official-race-simulations";
import { getOrCreatePostRaceInterview } from "@/services/post-race-interviews";

export const metadata: Metadata = {
  title: "Résultats de course",
  description:
    "Consultez une course, ses résultats et, hors CN, son direct ou son replay.",
};

type RaceLivePageProps = {
  params: Promise<{
    slug: string;
    stageNumber: string;
  }>;
  searchParams: Promise<{
    classement?: string;
  }>;
};

type DirectorRow = {
  id: string;
};

export default async function RaceLivePage({
  params,
  searchParams,
}: RaceLivePageProps) {
  const [{ slug, stageNumber }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  const parsedStageNumber = Number.parseInt(stageNumber, 10);
  if (!Number.isInteger(parsedStageNumber)) notFound();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);
  if (authenticationError || !user) redirect("/connexion");

  const now = new Date();
  const [headerData, calendar] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getActiveSeasonRaceCalendar(supabase, now, {
      raceSlug: slug,
      includeEngagedRiders: true,
    }),
  ]);
  const edition = calendar?.editions.find(
    (candidate) => candidate.slug === slug,
  );
  const stage = edition?.stages.find(
    (candidate) => candidate.stageNumber === parsedStageNumber,
  );
  if (!calendar || !edition || !stage) notFound();

  const nationalDiscipline = getNationalChampionshipDiscipline(
    edition.competitionType,
  );
  const isNationalChampionship = nationalDiscipline !== null;
  const resultsOnlyNationalChampionship =
    shouldUseNationalChampionshipResultsOnly({
      gameYear: calendar.gameYear,
      competitionType: edition.competitionType,
    });
  if (nationalDiscipline) {
    const relevantCountries =
      await getCurrentTeamNationalChampionshipCountryCodes({
        authUserId: user.id,
        seasonId: calendar.seasonId,
    });
    if (!relevantCountries.includes(edition.countryCode)) {
      redirect("/jeu/championnats-nationaux");
    }
  }

  const state = getStageLiveState(stage, now);
  const lockedSimulationDirectory: LockedOfficialRaceSimulationDirectory =
    state.status === "scheduled" || resultsOnlyNationalChampionship
      ? {}
      : await ensureLockedOfficialRaceSimulations(calendar, now).catch(
          (error: unknown) => {
            console.error(
              "Impossible de verrouiller le scénario officiel :",
              error,
            );
            return {};
          },
        );
  const lockedSimulations = lockedSimulationDirectory[edition.id] ?? [];

  const officialResults =
    state.status === "scheduled"
      ? null
      : await getOfficialRaceResults(calendar)
          .then((directory) => directory[edition.id] ?? null)
          .catch((error: unknown) => {
            console.error(
              "Impossible de charger les résultats de cette course :",
              error,
            );
            return null;
          });

  const directorResult = isNationalChampionship
    ? { data: null as DirectorRow | null, error: null }
    : await supabase
        .from("sporting_directors")
        .select("id")
        .eq("auth_user_id", user.id)
        .single<DirectorRow>();
  if (
    !isNationalChampionship &&
    (directorResult.error || !directorResult.data)
  ) {
    redirect("/jeu/directeur-sportif");
  }

  const initialMessages =
    isNationalChampionship || state.status === "scheduled"
      ? []
      : await getRaceLiveMessages(supabase, edition.id).catch(
          (error: unknown) => {
            console.error(
              "Impossible de charger le chat de cette course :",
              error,
            );
            return [];
          },
        );

  const postRaceInterview =
    !isNationalChampionship && state.status === "finished" && officialResults
      ? await getOrCreatePostRaceInterview({
          authUserId: user.id,
          teamId: headerData.teamId,
          editionId: edition.id,
          raceName: edition.name,
          stageId: stage.id,
          stageNumber: stage.stageNumber,
          stageName:
            edition.raceFormat === "stage_race"
              ? `Étape ${stage.stageNumber} · ${stage.name}`
              : edition.name,
          stageType: stage.stageType,
          weatherLabel: getRaceWeatherLabel(
            getRaceWeather(edition.id + ":" + stage.id + ":weather", {
              countryCode: edition.countryCode,
              profileType: stage.profileType,
            }),
          ),
          officialResults,
        }).catch((error: unknown) => {
          console.error(
            "Impossible de préparer l’interview après-course :",
            error,
          );
          return null;
        })
      : null;

  const archivedNationalChampionship =
    Boolean(nationalDiscipline) &&
    (stage.dayNumber < calendar.currentDayNumber ||
      edition.status === "completed" ||
      edition.status === "cancelled" ||
      state.status === "finished" ||
      state.status === "cancelled");
  const backHref =
    nationalDiscipline && !archivedNationalChampionship
      ? "/jeu/championnats-nationaux"
      : "/jeu/resultats";

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />

      <div className="mx-auto max-w-[1800px] px-2 py-5 sm:px-4 sm:py-8 xl:px-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#278B70]">
              {isNationalChampionship
                ? "Classement du championnat national"
                : "Espace course dédié"}
            </p>
            <h1 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">
              {edition.name}
              {edition.raceFormat === "stage_race"
                ? ` · Étape ${stage.stageNumber}`
                : ""}
            </h1>
          </div>
          <Link
            href={backHref}
            className="inline-flex min-h-10 items-center rounded-xl border border-[#176951]/20 bg-white px-4 text-xs font-black text-[#176951] shadow-sm"
          >
            ←{" "}
            {isNationalChampionship && !archivedNationalChampionship
              ? "Tous les CN concernés"
              : "Toutes les courses"}
          </Link>
        </div>

        {!isNationalChampionship ? (
          <RaceStageNavigation
            edition={edition}
            currentStageNumber={stage.stageNumber}
            currentDayNumber={calendar.currentDayNumber}
          />
        ) : null}

        {isNationalChampionship ? (
          <NationalChampionshipStageResults
            edition={edition}
            stage={stage}
            nowIso={now.toISOString()}
            officialResults={officialResults}
          />
        ) : (
          <RaceStageExperience
            entry={{ edition, stage }}
            nowIso={now.toISOString()}
            officialResults={officialResults}
            currentDirectorId={directorResult.data!.id}
            initialMessages={initialMessages}
            lockedSimulations={lockedSimulations}
            postRaceInterview={postRaceInterview}
            initialClassification={
              resolvedSearchParams.classement === "general"
                ? "general"
                : undefined
            }
          />
        )}
      </div>
    </main>
  );
}
