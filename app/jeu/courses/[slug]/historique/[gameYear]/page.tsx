import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { GameHeader } from "@/components/game/game-header";
import Link from "@/components/ui/app-link";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import {
  getHistoricalRaceClassification,
  type HistoricalRaceClassificationEntry,
} from "@/services/race-history";

export const metadata: Metadata = {
  title: "Classement historique",
  description: "Consultez le classement final d’une ancienne édition.",
};

type HistoricalRacePageProps = {
  params: Promise<{
    slug: string;
    gameYear: string;
  }>;
};

export default async function HistoricalRacePage({
  params,
}: HistoricalRacePageProps) {
  const { slug, gameYear: gameYearParam } = await params;
  const gameYear = Number.parseInt(gameYearParam, 10);
  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
    !Number.isInteger(gameYear) ||
    gameYear < 1
  ) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);
  if (authenticationError || !user) redirect("/connexion");

  const [headerData, raceResult] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    supabase
      .from("races")
      .select("id")
      .eq("slug", slug)
      .maybeSingle<{ id: string }>(),
  ]);
  if (raceResult.error || !raceResult.data) notFound();

  const classification = await getHistoricalRaceClassification({
    supabase,
    raceId: raceResult.data.id,
    gameYear,
  });
  if (!classification) notFound();

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />

      <div className="mx-auto max-w-5xl px-4 py-7 sm:px-8 sm:py-10">
        <Link
          href={`/jeu/courses/${slug}`}
          className="inline-flex min-h-10 items-center rounded-xl border border-[#176951]/20 bg-white px-4 text-xs font-black text-[#176951] shadow-sm"
        >
          ← Retour à l’inscription
        </Link>

        <header className="mt-6 rounded-[2rem] bg-[#0B302B] px-6 py-7 text-white shadow-[0_24px_60px_rgba(7,38,33,0.18)] sm:px-9">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#72D4B7]">
            Archives officielles · Saison {classification.gameYear}
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            {classification.raceName}
          </h1>
          <p className="mt-3 text-sm font-semibold text-[#C8D7D0]">
            {classification.raceFormat === "stage_race"
              ? "Classement général final"
              : "Classement final"}{" "}
            · {classification.seasonName}
          </p>
        </header>

        <section className="mt-6 overflow-hidden rounded-2xl border border-[#315B3E]/15 bg-white shadow-sm">
          <div className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] gap-3 border-b border-[#315B3E]/10 bg-[#F5F9F7] px-4 py-3 text-[10px] font-black uppercase tracking-[0.15em] text-[#5D786D] sm:grid-cols-[4rem_minmax(0,1fr)_minmax(10rem,0.55fr)_7rem] sm:px-6">
            <span>Rang</span>
            <span>Coureur</span>
            <span className="hidden sm:block">Équipe</span>
            <span className="text-right">Temps</span>
          </div>
          <ol className="divide-y divide-[#315B3E]/10">
            {classification.entries.map((entry) => (
              <li
                key={entry.riderId}
                className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 sm:grid-cols-[4rem_minmax(0,1fr)_minmax(10rem,0.55fr)_7rem] sm:px-6"
              >
                <span className="font-black text-[#0B302B]">
                  {entry.rank ?? "—"}
                </span>
                <span className="min-w-0">
                  <Link
                    href={`/jeu/coureurs/${entry.riderId}`}
                    className="block truncate text-sm font-black text-[#0B302B] transition hover:text-[#176951]"
                  >
                    {entry.riderName}
                  </Link>
                  <span className="mt-0.5 block truncate text-xs font-semibold text-[#71877D] sm:hidden">
                    {entry.teamName}
                  </span>
                </span>
                <span className="hidden truncate text-xs font-semibold text-[#5E746D] sm:block">
                  {entry.teamName}
                </span>
                <span className="text-right text-xs font-black text-[#176951]">
                  {formatHistoricalResult(entry)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}

function formatHistoricalResult(entry: HistoricalRaceClassificationEntry) {
  if (entry.status !== "classified") {
    return {
      did_not_start: "DNS",
      did_not_finish: "DNF",
      disqualified: "DSQ",
      outside_time_limit: "HD",
      withdrawn: "Retiré",
      classified: "Classé",
    }[entry.status];
  }

  if (entry.rank === 1 && entry.totalTimeMs !== null) {
    return formatDuration(entry.totalTimeMs);
  }
  if (entry.gapToWinnerMs !== null) {
    return `+${formatDuration(entry.gapToWinnerMs)}`;
  }
  return "Classé";
}

function formatDuration(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}′ ${String(seconds).padStart(2, "0")}″`;
  }
  return `${minutes}′ ${String(seconds).padStart(2, "0")}″`;
}
