import type { Metadata } from "next";
import Link from "@/components/ui/app-link";
import { redirect } from "next/navigation";

import { GameHeader } from "@/components/game/game-header";
import { RaceSimulatorWorkbench } from "@/components/game/race-simulator-workbench";
import { canAccessRaceSimulator } from "@/lib/game/race-simulator-access";
import type { RaceSimulatorStageOption } from "@/lib/game/race-simulator";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import { getActiveSeasonRaceCalendar } from "@/services/race-calendar";
import { getRaceSimulatorTeams } from "@/services/race-simulator";

export const metadata: Metadata = {
  title: "Laboratoire de course",
  description:
    "Composez une start-list de test et exécutez le moteur de simulation sans affecter la saison officielle.",
};

export default async function RaceSimulatorPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  if (!canAccessRaceSimulator(user.email)) {
    redirect("/jeu");
  }

  const [headerData, calendarResult, teamsResult] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getActiveSeasonRaceCalendar(supabase, new Date())
      .then((calendar) => ({ calendar, error: null }))
      .catch((error: unknown) => ({ calendar: null, error })),
    getRaceSimulatorTeams()
      .then((teams) => ({ teams, error: null }))
      .catch((error: unknown) => ({ teams: [], error })),
  ]);

  if (calendarResult.error) {
    console.error(
      "Impossible de charger les profils du laboratoire de course :",
      calendarResult.error
    );
  }
  if (teamsResult.error) {
    console.error(
      "Impossible de charger les équipes du laboratoire de course :",
      teamsResult.error
    );
  }

  const stages: RaceSimulatorStageOption[] =
    calendarResult.calendar?.editions.flatMap((edition) =>
      edition.stages.map((stage) => ({
        id: stage.id,
        editionId: edition.id,
        editionName: edition.name,
        stageName: stage.name,
        label:
          edition.raceFormat === "stage_race"
            ? `${edition.name} — étape ${stage.stageNumber} · ${stage.name}`
            : edition.name,
        stageNumber: stage.stageNumber,
        stageType: stage.stageType,
        profileType: stage.profileType,
        distanceKm: stage.distanceKm,
        isStageRace: edition.raceFormat === "stage_race",
        segments: stage.segments,
      }))
    ) ?? [];

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />

      <section className="mx-auto max-w-[1500px] px-4 py-8 sm:px-8 sm:py-12">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <header className="max-w-4xl">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#278B70]">
                Outil privé · moteur officiel isolé
              </p>
              <span className="rounded-full bg-[#F2C94C] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#17261E]">
                Aucune écriture en base
              </span>
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-[-0.045em] sm:text-5xl">
              Laboratoire de course
            </h1>
            <p className="mt-5 max-w-3xl text-lg font-medium leading-8 text-[#48665F]">
              Choisissez un profil existant, composez librement la start-list
              avec les équipes de la saison ou le bassin des agents libres,
              puis inspectez le classement, les notes et chaque décision
              visible du moteur.
            </p>
          </header>

          <Link
            href="/jeu"
            className="inline-flex min-h-11 items-center rounded-xl border border-[#176951]/25 bg-white px-4 text-sm font-black text-[#176951] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            ← Retour au bureau
          </Link>
        </div>

        {stages.length > 0 && teamsResult.teams.length > 0 ? (
          <div className="mt-8">
            <RaceSimulatorWorkbench
              stages={stages}
              teams={teamsResult.teams}
            />
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-amber-300 bg-amber-50 px-6 py-8 text-center">
            <p className="font-black text-amber-950">
              Le laboratoire ne peut pas être initialisé.
            </p>
            <p className="mt-2 text-sm font-semibold text-amber-800">
              Vérifiez qu’une saison active contient au moins un profil de
              course et deux coureurs disponibles.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
