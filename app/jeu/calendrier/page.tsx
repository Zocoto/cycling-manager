import type { Metadata } from "next";
import Link from "@/components/ui/app-link";
import { redirect } from "next/navigation";

import { GameHeader } from "@/components/game/game-header";
import { SeasonCalendar } from "@/components/game/season-calendar";
import { RACE_CATEGORY_STYLE } from "@/lib/game/race-calendar";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import { getActiveSeasonRaceCalendar } from "@/services/race-calendar";

export const metadata: Metadata = {
  title: "Calendrier des courses",
  description:
    "Consultez les 28 jours de la saison et les courses accessibles dans Cyclostratège.",
};

type RaceCalendarPageProps = {
  searchParams: Promise<{
    inscription?: string | string[];
    desinscription?: string | string[];
    erreur?: string | string[];
  }>;
};

type SportingDirectorReputation = {
  reputation_points: number | null;
};

export default async function RaceCalendarPage({
  searchParams,
}: RaceCalendarPageProps) {
  const resolvedSearchParams = await searchParams;
  const supabase =
    await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const [headerData, calendarResult, reputationResult] =
    await Promise.all([
      getGameHeaderData(supabase, user.id),
      getActiveSeasonRaceCalendar(supabase)
        .then((calendar) => ({
          calendar,
          error: null,
        }))
        .catch((error: unknown) => ({
          calendar: null,
          error,
        })),
      supabase
        .from("sporting_directors")
        .select("reputation_points")
        .eq("auth_user_id", user.id)
        .maybeSingle<SportingDirectorReputation>(),
    ]);

  if (calendarResult.error) {
    console.error(
      "Impossible de charger le calendrier des courses :",
      calendarResult.error
    );
  }

  if (reputationResult.error) {
    console.error(
      "Impossible de charger la réputation pour filtrer les courses :",
      reputationResult.error
    );
  }

  const calendar = calendarResult.calendar;

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        displayName={headerData.displayName}
        sponsor={
          headerData.teamSponsorIdentity
            ?.sponsor ?? null
        }
        maxWidth="wide"
      />

      <section className="mx-auto max-w-[1600px] px-4 py-8 sm:px-8 sm:py-12">
        <Link
          href="/jeu"
          className="inline-flex items-center gap-2 text-sm font-extrabold text-[#176951] transition hover:text-[#0B302B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176951]"
        >
          <span aria-hidden="true">←</span>
          Retour au bureau
        </Link>

        <div className="mt-5 overflow-hidden rounded-[2rem] border border-[#315B3E]/15 bg-white/90 shadow-[0_24px_70px_rgba(19,60,46,0.12)] backdrop-blur">
          <div className="relative overflow-hidden bg-[linear-gradient(135deg,#071A17,#176951)] px-6 py-8 text-[#FFFDF4] sm:px-10 sm:py-10">
            <div
              aria-hidden="true"
              className="absolute -right-16 -top-20 h-64 w-64 rounded-full border-[36px] border-white/5"
            />

            <div className="relative flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#A8DEC6]">
                  Saison de 28 jours
                </p>

                <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                  Calendrier des courses
                </h1>

                <p className="mt-3 max-w-3xl text-sm leading-6 text-[#D6DFD2] sm:text-base">
                  Visualisez les épreuves qui se chevauchent, filtrez le circuit par niveau et ouvrez chaque fiche pour préparer votre programme sportif.
                </p>
              </div>

              {calendar ? (
                <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 text-right backdrop-blur">
                  <p className="text-xs font-extrabold uppercase tracking-widest text-[#A8DEC6]">
                    {calendar.seasonName}
                  </p>
                  <p className="mt-1 text-2xl font-black text-[#F2C94C]">
                    J{calendar.currentDayNumber} / 28
                  </p>
                </div>
              ) : null}
            </div>

            {calendar ? (
              <div className="relative mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:max-w-4xl">
                {Object.entries(
                  RACE_CATEGORY_STYLE
                ).map(([code, style]) => {
                  const count =
                    calendar.editions.filter(
                      (edition) =>
                        edition.competitionType === "standard" &&
                        edition.categoryCode === code
                    ).length;

                  return (
                    <div
                      key={code}
                      className="rounded-xl border border-white/10 bg-black/10 px-4 py-3"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="h-2.5 w-2.5 rounded-full"
                          style={{
                            backgroundColor:
                              style.background,
                          }}
                        />
                        <span className="text-xs font-extrabold uppercase tracking-wider text-[#D6DFD2]">
                          {style.label}
                        </span>
                      </div>
                      <p className="mt-2 text-xl font-black">
                        {count} épreuve
                        {count > 1 ? "s" : ""}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="p-5 sm:p-8 lg:p-10">
            {readSingleSearchParam(
              resolvedSearchParams.inscription
            ) === "confirmee" ? (
              <div className="mb-6 rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-900">
                L’équipe et sa composition sont inscrites. Les coureurs apparaissent immédiatement sur la fiche de course.
              </div>
            ) : null}

            {readSingleSearchParam(
              resolvedSearchParams.desinscription
            ) === "confirmee" ? (
              <div className="mb-6 rounded-xl border border-sky-300 bg-sky-50 px-5 py-4 text-sm font-bold text-sky-900">
                Toute l’équipe a été désinscrite. La place et les coureurs sont de nouveau disponibles.
              </div>
            ) : null}

            {readSingleSearchParam(
              resolvedSearchParams.erreur
            ) ? (
              <div className="mb-6 rounded-xl border border-red-300 bg-red-50 px-5 py-4 text-sm font-bold text-red-900">
                {readSingleSearchParam(
                  resolvedSearchParams.erreur
                )?.slice(0, 300)}
              </div>
            ) : null}

            {calendar ? (
              <SeasonCalendar
                calendar={calendar}
                reputationPoints={
                  reputationResult.data
                    ?.reputation_points ?? 0
                }
                nowIso={new Date().toISOString()}
              />
            ) : (
              <CalendarUnavailable />
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function readSingleSearchParam(
  value: string | string[] | undefined
) {
  return Array.isArray(value) ? value[0] : value;
}

function CalendarUnavailable() {
  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 px-6 py-8 text-amber-950">
      <p className="text-lg font-black">
        Le calendrier n’a pas pu être chargé.
      </p>
      <p className="mt-2 text-sm leading-6">
        La saison reste accessible, mais les données de course sont momentanément indisponibles. Réessayez dans quelques instants.
      </p>
    </div>
  );
}
