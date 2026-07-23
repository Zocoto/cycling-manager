import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { GameHeader } from "@/components/game/game-header";
import { RaceStageExperience } from "@/components/game/race-stage-experience";
import Link from "@/components/ui/app-link";
import type { LockedOfficialRaceSimulationDirectory } from "@/lib/game/official-race-simulation";
import { getStageLiveState } from "@/lib/game/race-live";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import {
  getActiveSeasonRaceCalendar,
  settleFinishedRaceConditions,
} from "@/services/race-calendar";
import { getRaceLiveMessages } from "@/services/race-live-chat";
import {
  getOfficialRaceResults,
  settleFinishedRaceResults,
} from "@/services/race-results";
import { ensureLockedOfficialRaceSimulations } from "@/services/official-race-simulations";

export const metadata: Metadata = {
  title: "Course en direct",
  description:
    "Suivez une course, son replay, ses résultats et le chat des Directeurs Sportifs.",
};

type RaceLivePageProps = {
  params: Promise<{
    slug: string;
    stageNumber: string;
  }>;
};

type DirectorRow = {
  id: string;
};

export default async function RaceLivePage({
  params,
}: RaceLivePageProps) {
  const { slug, stageNumber } = await params;
  const parsedStageNumber = Number.parseInt(stageNumber, 10);
  if (!Number.isInteger(parsedStageNumber)) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const now = new Date();
  const [headerData, calendar] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getActiveSeasonRaceCalendar(supabase, now, {
      raceSlug: slug,
      includeEngagedRiders: true,
    }),
  ]);

  const edition = calendar?.editions.find(
    (candidate) => candidate.slug === slug
  );
  const stage = edition?.stages.find(
    (candidate) =>
      candidate.stageNumber === parsedStageNumber
  );

  if (!calendar || !edition || !stage) {
    notFound();
  }

  const state = getStageLiveState(stage, now);
  const lockedSimulationDirectory: LockedOfficialRaceSimulationDirectory =
    state.status === "scheduled"
      ? {}
      : await ensureLockedOfficialRaceSimulations(calendar, now).catch(
          (error: unknown) => {
            console.error(
              "Impossible de verrouiller le scénario officiel :",
              error,
            );
            return {};
          },
        );
  const lockedSimulations =
    lockedSimulationDirectory[edition.id] ?? [];
  if (state.status === "finished") {
    try {
      await settleFinishedRaceResults(
        calendar,
        now,
        lockedSimulationDirectory,
      );
      await settleFinishedRaceConditions(supabase);
    } catch (error) {
      console.error(
        "Impossible de consolider cette course :",
        error
      );
    }
  }

  const [officialResults, directorResult, initialMessages] =
    await Promise.all([
      state.status === "scheduled"
        ? Promise.resolve(null)
        : getOfficialRaceResults(calendar)
            .then((directory) => directory[edition.id] ?? null)
            .catch((error: unknown) => {
              console.error(
                "Impossible de charger les résultats de cette course :",
                error
              );
              return null;
            }),
      supabase
        .from("sporting_directors")
        .select("id")
        .eq("auth_user_id", user.id)
        .single<DirectorRow>(),
      state.status === "scheduled"
        ? Promise.resolve([])
        : getRaceLiveMessages(supabase, stage.id).catch(
            (error: unknown) => {
              console.error(
                "Impossible de charger le chat de cette course :",
                error
              );
              return [];
            }
          ),
    ]);

  if (directorResult.error || !directorResult.data) {
    redirect("/jeu/directeur-sportif");
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

      <div className="mx-auto max-w-[1800px] px-2 py-5 sm:px-4 sm:py-8 xl:px-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#278B70]">
              Espace course dédié
            </p>
            <h1 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">
              {edition.name}
              {edition.raceFormat === "stage_race"
                ? ` · Étape ${stage.stageNumber}`
                : ""}
            </h1>
          </div>
          <Link
            href="/jeu/resultats"
            className="inline-flex min-h-10 items-center rounded-xl border border-[#176951]/20 bg-white px-4 text-xs font-black text-[#176951] shadow-sm"
          >
            ← Toutes les courses
          </Link>
        </div>

        <RaceStageExperience
          entry={{ edition, stage }}
          nowIso={now.toISOString()}
          officialResults={officialResults}
          currentDirectorId={directorResult.data.id}
          initialMessages={initialMessages}
          lockedSimulations={lockedSimulations}
        />
      </div>
    </main>
  );
}
