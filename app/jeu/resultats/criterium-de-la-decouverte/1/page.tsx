import type { Metadata } from "next";
import Link from "@/components/ui/app-link";
import { redirect } from "next/navigation";

import { GameHeader } from "@/components/game/game-header";
import { RaceLiveLab } from "@/components/game/race-live-lab";
import { CriteriumCompletionButton } from "@/components/tutorial/criterium-completion-button";
import { TutorialRouteResume } from "@/components/tutorial/tutorial-route-resume";
import {
  CRITERIUM_DISCOVERY_KEY,
  CRITERIUM_DISCOVERY_NAME,
  CRITERIUM_DISCOVERY_RACE_ROUTE,
  CRITERIUM_DISCOVERY_RESULTS_ROUTE,
  getCriteriumDiscoveryRunFromMetadata,
} from "@/lib/tutorial/criterium-discovery";
import {
  getAuthenticatedTutorialProgress,
} from "@/lib/tutorial/progress";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";

export const metadata: Metadata = {
  title: `Replay — ${CRITERIUM_DISCOVERY_NAME}`,
  description:
    "Suivez le Critérium de la découverte dans le véritable espace de replay et de résultats de Cyclostratège.",
};

export default async function CriteriumDiscoveryResultsPage() {
  const supabase =
    await createSupabaseServerClient();

  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const [headerData, progress] =
    await Promise.all([
      getGameHeaderData(
        supabase,
        user.id,
      ),
      getAuthenticatedTutorialProgress(
        supabase,
        CRITERIUM_DISCOVERY_KEY,
      ),
    ]);

  const run =
    getCriteriumDiscoveryRunFromMetadata(
      progress?.metadata,
    );

  if (!progress || !run) {
    redirect(CRITERIUM_DISCOVERY_RACE_ROUTE);
  }

  const stage = run.edition.stages[0];

  if (!stage) {
    throw new Error(
      "Le replay du Critérium de la découverte est indisponible.",
    );
  }

  const isCompleted =
    progress.status === "completed";

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      {progress.status === "in_progress" &&
      progress.current_route ===
        CRITERIUM_DISCOVERY_RESULTS_ROUTE &&
      progress.current_step_key ? (
        <TutorialRouteResume
          tutorialKey={
            CRITERIUM_DISCOVERY_KEY
          }
          currentStepKey={
            progress.current_step_key
          }
        />
      ) : null}

      <GameHeader
        simulatorEmail={user.email}
        displayName={
          headerData.displayName
        }
        sponsor={
          headerData.teamSponsorIdentity
            ?.sponsor ?? null
        }
        maxWidth="wide"
      />

      <section className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 sm:py-12">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <header className="max-w-4xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#278B70]">
              Résultats / Replay · formation essentielle
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl">
              {CRITERIUM_DISCOVERY_NAME}
            </h1>
            <p className="mt-5 max-w-3xl text-lg font-medium leading-8 text-[#48665F]">
              Vous êtes dans le même espace que pour les courses officielles. Lancez le replay, accélérez-le en ×2 ou ×4, consultez les écarts puis validez la formation.
            </p>
          </header>

          <Link
            href="/jeu/resultats"
            className="inline-flex min-h-11 items-center rounded-xl border border-[#176951]/25 bg-white px-4 text-sm font-black text-[#176951] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            ← Répertoire Résultats / Live
          </Link>
        </div>

        <div
          data-tutorial-id="criterium-live-replay"
          className="mt-8"
        >
          <RaceLiveLab
            edition={run.edition}
            stage={stage}
            mode="replay"
            nowIso={new Date().toISOString()}
            lockedSimulations={[
              run.lockedSimulation,
            ]}
          />
        </div>

        <section
          data-tutorial-id="criterium-tutorial-completion"
          className="mt-6 overflow-hidden rounded-2xl border border-[#315B3E]/15 bg-white shadow-[0_18px_45px_rgba(19,60,46,0.09)]"
        >
          <div className="border-b border-[#315B3E]/10 bg-[#F5F9F7] px-6 py-5">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
              Formation pratique
            </p>
            <h2 className="mt-2 text-2xl font-black text-[#0B302B]">
              Analyser puis valider votre première course
            </h2>
          </div>

          <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <p className="text-sm font-semibold leading-7 text-[#48665F]">
                Parcourez les onglets du replay, observez le classement et les écarts, puis terminez cette formation. Aucun résultat de cette course ne sera ajouté à la saison officielle.
              </p>

              <div className="mt-4 flex flex-wrap gap-2 text-xs font-black">
                <span className="rounded-full bg-[#DDF3E7] px-3 py-1.5 text-[#176951]">
                  Moteur officiel
                </span>
                <span className="rounded-full bg-[#E9F5F0] px-3 py-1.5 text-[#278B70]">
                  Replay ×1 · ×2 · ×4
                </span>
                <span className="rounded-full bg-[#FFF4D6] px-3 py-1.5 text-[#765A18]">
                  Zéro conséquence sportive
                </span>
              </div>
            </div>

            {isCompleted ? (
              <div className="rounded-xl border border-[#278B70]/25 bg-[#DDF3E7] px-5 py-4 text-[#176951]">
                <p className="font-black">
                  Formation pratique terminée
                </p>
                <p className="mt-1 text-xs font-semibold leading-5 text-[#48665F]">
                  La progression est enregistrée. Le replay reste disponible depuis le menu Didacticiels.
                </p>
                <Link
                  href="/jeu/objectifs"
                  className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-[#176951] px-4 text-xs font-black text-white"
                >
                  Voir mes objectifs
                </Link>
              </div>
            ) : (
              <CriteriumCompletionButton />
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
