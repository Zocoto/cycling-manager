import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { saveRacePreparationAction } from "./actions";
import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { GameHeader } from "@/components/game/game-header";
import {
  RacePreparationWorkspace,
  type RacePreparationWorkspaceEdition,
} from "@/components/game/race-preparation-workspace";
import { getStageLiveState } from "@/lib/game/race-live";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import {
  getActiveSeasonRaceCalendar,
  getCurrentTeamRacePreparation,
} from "@/services/race-calendar";

export const metadata: Metadata = {
  title: "Préparation de course",
  description:
    "Définissez les rôles, missions et stratégies de votre équipe avant chaque course.",
};

type RacePreparationPageProps = {
  searchParams: Promise<{
    course?: string | string[];
    etape?: string | string[];
    enregistrement?: string | string[];
    erreur?: string | string[];
  }>;
};

export default async function RacePreparationPage({
  searchParams,
}: RacePreparationPageProps) {
  const resolvedSearchParams = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const now = new Date();
  const [headerData, calendarResult, preparationResult] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getActiveSeasonRaceCalendar(supabase, now, {
      includeEngagedRiders: false,
    })
      .then((calendar) => ({ calendar, error: null }))
      .catch((error: unknown) => ({ calendar: null, error })),
    getCurrentTeamRacePreparation(supabase)
      .then((preparations) => ({ preparations, error: null }))
      .catch((error: unknown) => ({ preparations: [], error })),
  ]);

  if (calendarResult.error) {
    console.error(
      "Impossible de charger les courses à préparer :",
      calendarResult.error,
    );
  }
  if (preparationResult.error) {
    console.error(
      "Impossible de charger les plans de course :",
      preparationResult.error,
    );
  }

  const plansByEditionId = new Map(
    preparationResult.preparations.map((plan) => [plan.editionId, plan]),
  );
  const editions: RacePreparationWorkspaceEdition[] =
    calendarResult.calendar?.editions
      .filter(
        (edition) =>
          plansByEditionId.has(edition.id) &&
          edition.stages.some((stage) => {
            const status = getStageLiveState(stage, now).status;
            return status === "scheduled" || status === "live";
          }),
      )
      .map((edition) => ({
        id: edition.id,
        slug: edition.slug,
        name: edition.name,
        shortName: edition.shortName,
        countryCode: edition.countryCode,
        raceFormat: edition.raceFormat,
        stages: edition.stages,
        plan: plansByEditionId.get(edition.id)!,
      })) ?? [];
  const requestedError = readSingleSearchParam(resolvedSearchParams.erreur);
  const saved =
    readSingleSearchParam(resolvedSearchParams.enregistrement) === "confirme";

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />

      <section className="mx-auto max-w-[1600px] px-4 py-8 sm:px-8 sm:py-12">
        <BackToOfficeLink />

        <header className="relative mt-5 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#071A17,#176951)] px-6 py-8 text-white shadow-[0_24px_70px_rgba(7,26,23,0.2)] sm:px-10 sm:py-10">
          <div
            aria-hidden="true"
            className="absolute -right-14 -top-16 h-64 w-64 rounded-full border-[34px] border-white/5"
          />
          <div className="relative max-w-4xl">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#9BE0BC]">
              Bureau du Directeur Sportif
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              Préparation de course
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-[#D6DFD2] sm:text-base">
              Redéfinissez les rôles, confiez des missions précises et préparez
              jusqu’à deux offensives par étape. Une fois le départ donné, le
              plan est figé dans le scénario officiel.
            </p>
          </div>
        </header>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <PrincipleCard
            number="01"
            title="Une stratégie par étape"
            description="Chaque journée d’un tour garde ses propres rôles et consignes."
          />
          <PrincipleCard
            number="02"
            title="Des choix, pas des garanties"
            description="Forme, énergie, terrain et aléas décident encore de l’exécution."
          />
          <PrincipleCard
            number="03"
            title="Aucun recalcul superflu"
            description="Le plan est lu une fois et réutilisé par tous les spectateurs."
          />
        </div>

        {saved ? (
          <div className="mt-5 rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-900">
            Le plan de course a été enregistré pour cette étape.
          </div>
        ) : null}
        {requestedError ? (
          <div className="mt-5 rounded-2xl border border-red-300 bg-red-50 px-5 py-4 text-sm font-bold text-red-900">
            {requestedError}
          </div>
        ) : null}

        <div className="mt-6">
          {calendarResult.error || preparationResult.error ? (
            <EmptyState
              title="La préparation n’a pas pu être chargée"
              description="Réessayez dans quelques instants. Aucun plan existant n’a été modifié."
            />
          ) : editions.length > 0 ? (
            <RacePreparationWorkspace
              action={saveRacePreparationAction}
              editions={editions}
              nowIso={now.toISOString()}
              initialSlug={readSingleSearchParam(resolvedSearchParams.course)}
            />
          ) : (
            <EmptyState
              title="Aucune course à préparer"
              description="Inscrivez d’abord votre équipe à une course depuis le calendrier. Elle apparaîtra ici dès que l’inscription sera acceptée."
            />
          )}
        </div>
      </section>
    </main>
  );
}

function PrincipleCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-[#315B3E]/12 bg-white px-5 py-4 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#278B70]">
        {number}
      </p>
      <h2 className="mt-1 text-sm font-black text-[#0B302B]">{title}</h2>
      <p className="mt-1 text-xs font-semibold leading-5 text-[#66877C]">
        {description}
      </p>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[2rem] border border-dashed border-[#315B3E]/25 bg-white px-6 py-14 text-center shadow-sm">
      <h2 className="text-xl font-black text-[#0B302B]">{title}</h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#66877C]">
        {description}
      </p>
    </div>
  );
}

function readSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
