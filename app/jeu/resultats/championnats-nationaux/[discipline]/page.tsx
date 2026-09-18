import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { GameHeader } from "@/components/game/game-header";
import Link from "@/components/ui/app-link";
import {
  getNationalChampionshipResultHref,
  getNationalChampionshipRiderResultLabel,
} from "@/lib/game/national-championship-result-links";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import {
  getCurrentTeamNationalChampionshipCountries,
  type NationalChampionshipCountry,
  type NationalChampionshipDiscipline,
} from "@/services/national-championships";
import { getActiveSeasonRaceCalendar } from "@/services/race-calendar";

export const metadata: Metadata = {
  title: "Résultats des championnats nationaux",
  description:
    "Retrouvez les classements officiels des CN et les places de vos coureurs en contre-la-montre et sur route.",
};

export default async function NationalChampionshipDisciplineResultsPage({
  params,
}: {
  params: Promise<{ discipline: string }>;
}) {
  const { discipline: requestedDiscipline } = await params;
  if (
    requestedDiscipline !== "route" &&
    requestedDiscipline !== "contre-la-montre"
  ) {
    notFound();
  }
  const discipline: NationalChampionshipDiscipline = requestedDiscipline;
  const title =
    discipline === "route" ? "Course en ligne" : "Contre-la-montre";

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
      includeCancelledEditions: true,
      includeEngagedRiders: false,
    }),
  ]);
  if (!calendar) redirect("/jeu");

  const countries = await getCurrentTeamNationalChampionshipCountries({
    authUserId: user.id,
    calendar,
    discipline,
  });

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorVisual}
        maxWidth="wide"
      />

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
        <nav
          className="flex flex-wrap gap-3 text-sm font-extrabold text-[#176951]"
          aria-label="Navigation des championnats nationaux"
        >
          <Link href="/jeu/resultats" className="hover:underline">
            ← Résultats / Live
          </Link>
          <Link href="/jeu/championnats-nationaux" className="hover:underline">
            Inscriptions aux CN
          </Link>
        </nav>

        <header className="mt-5 rounded-[2rem] bg-[linear-gradient(135deg,#071A17,#176951)] px-6 py-8 text-white shadow-[0_24px_70px_rgba(19,60,46,0.18)] sm:px-10 sm:py-10">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#F2C94C]">
            Saison {calendar.gameYear} · Championnats nationaux
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
            Résultats CN · {title}
          </h1>
          <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-[#D6DFD2] sm:text-base">
            Choisissez un championnat où votre équipe est inscrite pour voir
            les places de vos coureurs et le classement officiel complet.
            Aucun direct ni replay n’est généré pour les CN.
          </p>
        </header>

        <nav
          className="mt-5 grid gap-2 sm:grid-cols-2"
          aria-label="Discipline des championnats nationaux"
        >
          {(["route", "contre-la-montre"] as const).map((value) => (
            <Link
              key={value}
              href={`/jeu/resultats/championnats-nationaux/${value}`}
              aria-current={discipline === value ? "page" : undefined}
              className={`min-h-12 rounded-xl border px-4 py-3 text-center text-sm font-black transition ${
                discipline === value
                  ? "border-[#176951] bg-[#176951] text-white"
                  : "border-[#176951]/20 bg-white text-[#176951] hover:border-[#176951]/50"
              }`}
            >
              {value === "route" ? "Course en ligne" : "Contre-la-montre"}
            </Link>
          ))}
        </nav>

        {countries.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-[#315B3E]/15 bg-white px-6 py-8 text-sm font-semibold text-[#60756E]">
            Aucun coureur de votre équipe n’a été inscrit à un championnat
            national {discipline === "route" ? "en ligne" : "contre-la-montre"}{" "}
            cette saison.
          </p>
        ) : (
          <div className="mt-7">
            <DisciplineResults
              id="cn-pays"
              title="Vos championnats"
              countries={countries}
            />
          </div>
        )}
      </div>
    </main>
  );
}

function DisciplineResults({
  id,
  title,
  countries,
}: {
  id: string;
  title: string;
  countries: NationalChampionshipCountry[];
}) {
  if (countries.length === 0) return null;

  const completedCount = countries.filter(
    ({ edition }) => edition.status === "completed",
  ).length;

  return (
    <section
      aria-labelledby={id}
      className="rounded-[2rem] border border-[#315B3E]/15 bg-white p-5 shadow-[0_16px_45px_rgba(19,60,46,0.08)] sm:p-7"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={id} className="text-2xl font-black text-[#183F37]">
          {title}
        </h2>
        <p className="text-xs font-extrabold text-[#60756E]">
          {completedCount}/{countries.length} classement
          {countries.length > 1 ? "s" : ""} publié
          {countries.length > 1 ? "s" : ""}
        </p>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {countries.map((country) => (
          <CountryResults key={country.edition.id} country={country} />
        ))}
      </div>
    </section>
  );
}

function CountryResults({ country }: { country: NationalChampionshipCountry }) {
  const { edition } = country;
  const completed = edition.status === "completed";
  const cancelled = edition.status === "cancelled";
  const resultHref = getNationalChampionshipResultHref(edition);

  return (
    <article className="min-w-0 rounded-2xl border border-[#315B3E]/15 bg-[#F6FAF7] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-lg font-black text-[#183F37]">
          <span
            className={`fi fi-${country.countryCode.toLowerCase()} rounded shadow-sm`}
            role="img"
            aria-label={`Drapeau ${country.countryName}`}
          />
          {country.countryName}
        </h3>
        <span
          className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide ${
            completed
              ? "bg-[#D7EEE8] text-[#176951]"
              : cancelled
                ? "bg-[#EEE9E5] text-[#72675E]"
                : "bg-[#FFF2C7] text-[#7A5B09]"
          }`}
        >
          {completed ? "Résultats publiés" : cancelled ? "Annulé" : "À venir"}
        </span>
      </div>

      <p className="mt-2 text-xs font-semibold text-[#60756E]">
        {country.enteredRiderCount} coureur
        {country.enteredRiderCount !== 1 ? "s" : ""} de votre équipe engagé
        {country.enteredRiderCount !== 1 ? "s" : ""}
      </p>

      {country.riders.length > 0 ? (
        <ul className="mt-4 divide-y divide-[#315B3E]/10 rounded-xl bg-white px-4">
          {country.riders.map((rider) => (
            <li
              key={rider.rosterId}
              className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
            >
              <Link
                href={`/jeu/coureurs/${rider.id}`}
                className="font-bold text-[#183F37] hover:text-[#176951] hover:underline"
              >
                {rider.firstName} {rider.lastName}
              </Link>
              <span className="font-black text-[#176951]">
                {getNationalChampionshipRiderResultLabel(rider, edition.status)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm font-semibold text-[#60756E]">
          Aucun coureur de votre équipe n’a pris part à cette épreuve.
        </p>
      )}

      {resultHref ? (
        <Link
          href={resultHref}
          className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-[#176951] px-4 text-sm font-black text-white transition hover:bg-[#0B302B]"
        >
          Voir le classement officiel complet →
        </Link>
      ) : (
        <p className="mt-4 text-xs font-semibold leading-5 text-[#60756E]">
          {cancelled
            ? "Aucun classement n’est publié pour ce championnat annulé."
            : "Le classement sera disponible après la course."}
        </p>
      )}
    </article>
  );
}
