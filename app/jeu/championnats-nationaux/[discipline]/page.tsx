import type { Metadata } from "next";
import Link from "@/components/ui/app-link";
import { notFound, redirect } from "next/navigation";

import { GameHeader } from "@/components/game/game-header";
import { getEditionDayRange } from "@/lib/game/race-calendar";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import {
  getCurrentTeamNationalChampionshipCountries,
  type NationalChampionshipDiscipline,
} from "@/services/national-championships";
import { getActiveSeasonRaceCalendar } from "@/services/race-calendar";

type NationalChampionshipsPageProps = {
  params: Promise<{ discipline: string }>;
};

const DISCIPLINE_CONTENT = {
  route: {
    title: "Championnats nationaux sur route",
    eyebrow: "J9 · Course en ligne",
    description:
      "Choisissez le pays puis engagez uniquement les coureurs de cette nationalité.",
  },
  "contre-la-montre": {
    title: "Championnats nationaux contre-la-montre",
    eyebrow: "J8 · Effort individuel",
    description:
      "Choisissez le pays puis engagez uniquement les rouleurs de cette nationalité.",
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
  } = await supabase.auth.getUser();

  if (authenticationError || !user) redirect("/connexion");

  const [headerData, calendar] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getActiveSeasonRaceCalendar(supabase),
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
        <Link
          href="/jeu/calendrier"
          className="inline-flex items-center gap-2 text-sm font-extrabold text-[#176951] transition hover:text-[#0B302B]"
        >
          <span aria-hidden="true">←</span>
          Retour au calendrier
        </Link>

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
              {content.description} Une victoire attribue argent, expérience et
              réputation, sans aucun point UCI.
            </p>
          </div>
        </header>

        <section className="mt-7 rounded-[2rem] border border-[#315B3E]/12 bg-white p-5 shadow-[0_16px_45px_rgba(19,60,46,0.08)] sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
                Pays accessibles
              </p>
              <h2 className="mt-2 text-2xl font-black text-[#183F37]">
                Sélectionnez un championnat
              </h2>
            </div>
            <span className="rounded-full bg-[#FFF2C7] px-4 py-2 text-xs font-black text-[#7A5B09]">
              200 engagés maximum par pays
            </span>
          </div>

          {countries.length > 0 ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {countries.map(({ edition, ...country }) => {
                const { startDay } = getEditionDayRange(edition);
                return (
                  <Link
                    key={edition.id}
                    href={`/jeu/courses/${edition.slug}`}
                    className="group flex items-center gap-4 rounded-2xl border border-[#315B3E]/15 bg-[#F6FAF7] p-5 transition hover:-translate-y-0.5 hover:border-[#278B70]/40 hover:shadow-lg"
                  >
                    <span
                      className={`fi fi-${country.countryCode.toLowerCase()} shrink-0 rounded shadow-md`}
                      style={{ fontSize: "3rem", lineHeight: 1 }}
                      role="img"
                      aria-label={`Drapeau ${country.countryName}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-lg font-black text-[#183F37]">
                        CN {country.countryName}
                      </span>
                      <span className="mt-1 block text-xs font-bold text-[#60756E]">
                        J{startDay} · {country.eligibleRiderCount} coureur
                        {country.eligibleRiderCount > 1 ? "s" : ""} éligible
                        {country.eligibleRiderCount > 1 ? "s" : ""}
                      </span>
                    </span>
                    <span className="text-xl font-black text-[#278B70] transition group-hover:translate-x-1">
                      →
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="mt-6 rounded-2xl border border-dashed border-[#315B3E]/25 bg-[#F6FAF7] px-5 py-6 text-sm font-semibold leading-6 text-[#60756E]">
              Aucun coureur de votre effectif actif ne permet encore d’ouvrir un
              championnat national dans cette discipline.
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
