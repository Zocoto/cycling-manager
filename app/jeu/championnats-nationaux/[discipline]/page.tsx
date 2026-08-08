import type { Metadata } from "next";
import Link from "@/components/ui/app-link";
import { notFound, redirect } from "next/navigation";

import { withdrawNationalChampionshipRiderAction } from "../actions";
import { GameHeader } from "@/components/game/game-header";
import { getEditionDayRange } from "@/lib/game/race-calendar";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import {
  getCurrentTeamNationalChampionshipCountries,
  syncNationalChampionshipRegistrations,
  type NationalChampionshipDiscipline,
} from "@/services/national-championships";
import { getActiveSeasonRaceCalendar } from "@/services/race-calendar";

type NationalChampionshipsPageProps = {
  params: Promise<{ discipline: string }>;
};

const DISCIPLINE_CONTENT = {
  route: {
    title: "Championnats nationaux sur route",
    eyebrow: "J8 · Course en ligne à 18 h",
    shortLabel: "Route",
    description:
      "Les coureurs du top 200 mondial sont engagés automatiquement dans le championnat de leur pays.",
  },
  "contre-la-montre": {
    title: "Championnats nationaux contre-la-montre",
    eyebrow: "J8 · Effort individuel à 14 h",
    shortLabel: "Contre-la-montre",
    description:
      "Les coureurs du top 200 mondial sont engagés automatiquement dans le championnat de leur pays.",
  },
} as const;

export async function generateMetadata({
  params,
}: NationalChampionshipsPageProps): Promise<Metadata> {
  const { discipline } = await params;
  const content = isDiscipline(discipline)
    ? DISCIPLINE_CONTENT[discipline]
    : null;

  return {
    title: content?.title ?? "Championnats nationaux",
    description: content?.description,
  };
}

export default async function NationalChampionshipsPage({
  params,
}: NationalChampionshipsPageProps) {
  const { discipline } = await params;
  if (!isDiscipline(discipline)) notFound();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);
  if (authenticationError || !user) redirect("/connexion");

  const now = new Date();
  await syncNationalChampionshipRegistrations(now).catch((error: unknown) => {
    console.error("Impossible de synchroniser les sélections CN :", error);
  });

  const [headerData, calendar] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getActiveSeasonRaceCalendar(supabase, now),
  ]);
  if (!calendar) redirect("/jeu");

  const countries = await getCurrentTeamNationalChampionshipCountries({
    authUserId: user.id,
    calendar,
    discipline,
  });
  const content = DISCIPLINE_CONTENT[discipline];

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />

      <section className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/jeu/calendrier"
            className="inline-flex items-center gap-2 text-sm font-extrabold text-[#176951] transition hover:text-[#0B302B]"
          >
            <span aria-hidden="true">←</span>
            Retour aux inscriptions
          </Link>
          <Link
            href="/jeu/resultats"
            className="inline-flex min-h-10 items-center rounded-xl border border-[#176951]/20 bg-white px-4 text-xs font-black text-[#176951] shadow-sm"
          >
            Voir tous les résultats
          </Link>
        </div>

        <header className="relative mt-5 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#071A17,#176951)] px-6 py-8 text-white shadow-[0_24px_70px_rgba(19,60,46,0.18)] sm:px-10 sm:py-10">
          <div
            aria-hidden="true"
            className="absolute -right-12 -top-24 h-72 w-72 rounded-full border-[42px] border-white/10"
          />
          <div className="relative max-w-3xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#F2C94C]">
              {content.eyebrow}
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
              {content.title}
            </h1>
            <p className="mt-4 text-sm font-semibold leading-6 text-[#D6DFD2] sm:text-base">
              {content.description} Il n’y a ni direct ni replay : toutes les
              nations sont simulées ensemble et les classements sont publiés ici
              et dans votre fil d’activité.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-black">
              <span className="rounded-full bg-white/10 px-3 py-2 text-[#DCE9E3]">
                Aucune inscription manuelle
              </span>
              <span className="rounded-full bg-white/10 px-3 py-2 text-[#DCE9E3]">
                Coureurs libres inclus
              </span>
              <span className="rounded-full bg-[#F2C94C] px-3 py-2 text-[#17261E]">
                Victoire : +1 réputation
              </span>
            </div>
          </div>
        </header>

        <nav
          aria-label="Disciplines des championnats nationaux"
          className="mt-5 grid grid-cols-2 gap-2 rounded-2xl border border-[#315B3E]/15 bg-white p-2 shadow-sm"
        >
          {(Object.keys(DISCIPLINE_CONTENT) as NationalChampionshipDiscipline[]).map(
            (value) => (
              <Link
                key={value}
                href={`/jeu/championnats-nationaux/${value}`}
                aria-current={value === discipline ? "page" : undefined}
                className={`inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-center text-xs font-black uppercase tracking-wider transition ${
                  value === discipline
                    ? "bg-[#0B302B] text-white"
                    : "text-[#315B3E] hover:bg-[#EAF5F0]"
                }`}
              >
                {DISCIPLINE_CONTENT[value].shortLabel}
              </Link>
            ),
          )}
        </nav>

        <section className="mt-7 rounded-[2rem] border border-[#315B3E]/12 bg-white p-5 shadow-[0_16px_45px_rgba(19,60,46,0.08)] sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
                Nations de votre effectif
              </p>
              <h2 className="mt-2 text-2xl font-black text-[#183F37]">
                Sélections automatiques
              </h2>
            </div>
            <span className="rounded-full bg-[#FFF2C7] px-4 py-2 text-xs font-black text-[#7A5B09]">
              Top 200 mondial
            </span>
          </div>

          {countries.length > 0 ? (
            <div className="mt-6 space-y-4">
              {countries.map((country) => {
                const { edition } = country;
                const { startDay } = getEditionDayRange(edition);
                const stage = edition.stages[0];
                const departureAt = stage?.departureAt
                  ? new Date(stage.departureAt)
                  : null;
                const canWithdraw = Boolean(
                  departureAt &&
                    departureAt.getTime() > now.getTime() &&
                    edition.status !== "completed" &&
                    edition.status !== "cancelled",
                );
                const resultsAvailable =
                  edition.status === "completed" &&
                  country.riders.some((rider) => rider.finalRank !== null);

                return (
                  <article
                    key={edition.id}
                    className="overflow-hidden rounded-2xl border border-[#315B3E]/15 bg-[#F6FAF7]"
                  >
                    <header className="flex flex-wrap items-center gap-4 border-b border-[#315B3E]/10 bg-white p-5">
                      <span
                        className={`fi fi-${country.countryCode.toLowerCase()} shrink-0 rounded shadow-md`}
                        style={{ fontSize: "2.5rem", lineHeight: 1 }}
                        role="img"
                        aria-label={`Drapeau ${country.countryName}`}
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-black text-[#183F37]">
                          CN {country.countryName}
                        </h3>
                        <p className="mt-1 text-xs font-bold text-[#60756E]">
                          J{startDay} · {country.enteredRiderCount} engagé
                          {country.enteredRiderCount > 1 ? "s" : ""} sur {country.eligibleRiderCount} coureur
                          {country.eligibleRiderCount > 1 ? "s" : ""} de votre effectif
                        </p>
                      </div>
                      {resultsAvailable && stage ? (
                        <Link
                          href={`/jeu/resultats/${edition.slug}/${stage.stageNumber}`}
                          className="inline-flex min-h-10 items-center rounded-xl bg-[#176951] px-4 text-xs font-black text-white transition hover:bg-[#0B302B]"
                        >
                          Voir le classement
                        </Link>
                      ) : (
                        <span className="rounded-full bg-[#176951]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#176951]">
                          {edition.status === "cancelled" || edition.status === "completed"
                            ? "Aucun qualifié"
                            : canWithdraw
                              ? "Sélection publiée"
                              : "Simulation en cours"}
                        </span>
                      )}
                    </header>

                    {country.riders.length > 0 ? (
                      <ul className="divide-y divide-[#315B3E]/10">
                        {country.riders.map((rider) => (
                          <li
                            key={rider.rosterId}
                            className="flex flex-wrap items-center gap-3 px-5 py-4"
                          >
                            {rider.finalRank ? (
                              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#0B302B] text-xs font-black text-white">
                                {rider.finalRank}
                              </span>
                            ) : null}
                            <Link
                              href={`/jeu/coureurs/${rider.id}`}
                              className="min-w-0 flex-1 font-black text-[#183F37] hover:text-[#176951]"
                            >
                              {rider.firstName} {rider.lastName}
                            </Link>
                            {rider.status === "withdrawn" ? (
                              <span className="rounded-full bg-[#60756E]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#60756E]">
                                Retiré
                              </span>
                            ) : canWithdraw ? (
                              <form action={withdrawNationalChampionshipRiderAction}>
                                <input type="hidden" name="editionId" value={edition.id} />
                                <input type="hidden" name="riderId" value={rider.id} />
                                <input type="hidden" name="discipline" value={discipline} />
                                <button
                                  type="submit"
                                  className="min-h-10 rounded-xl border border-[#B83D48]/30 bg-white px-4 text-xs font-black text-[#B83D48] transition hover:bg-[#FFF0F1]"
                                >
                                  Retirer
                                </button>
                              </form>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="px-5 py-5 text-sm font-semibold leading-6 text-[#60756E]">
                        Aucun coureur de cette nationalité n’est actuellement dans
                        le top 200 mondial.
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="mt-6 rounded-2xl border border-dashed border-[#315B3E]/25 bg-[#F6FAF7] px-5 py-6 text-sm font-semibold leading-6 text-[#60756E]">
              Aucun pays de votre effectif actif n’est concerné par cette
              discipline.
            </p>
          )}
        </section>
      </section>
    </main>
  );
}

function isDiscipline(value: string): value is NationalChampionshipDiscipline {
  return value === "route" || value === "contre-la-montre";
}
