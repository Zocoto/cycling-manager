import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { GameHeader } from "@/components/game/game-header";
import { RaceStageProfile } from "@/components/game/race-stage-profile";
import Link from "@/components/ui/app-link";
import {
  RACE_CATEGORY_STYLE,
  RACE_DAY_SLOT_CONFIG,
  RACE_PROFILE_LABELS,
  type RaceCalendarStage,
} from "@/lib/game/race-calendar";
import { getStageLiveState } from "@/lib/game/race-live";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import { getActiveSeasonRaceCalendar } from "@/services/race-calendar";

export const metadata: Metadata = {
  title: "Étapes du tour",
  description: "Choisissez une étape et consultez son direct ou son replay.",
};

type RaceTourPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function RaceTourPage({ params }: RaceTourPageProps) {
  const { slug } = await params;
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
      includeEngagedRiders: false,
    }),
  ]);
  const edition = calendar?.editions.find(
    (candidate) => candidate.slug === slug,
  );

  if (!calendar || !edition) {
    notFound();
  }

  const availableStages = [...edition.stages]
    .filter((stage) => stage.dayNumber <= calendar.currentDayNumber)
    .sort((first, second) => first.stageNumber - second.stageNumber);

  if (edition.raceFormat !== "stage_race") {
    const stage = availableStages.at(-1);
    if (stage) {
      redirect(`/jeu/resultats/${edition.slug}/${stage.stageNumber}`);
    }
    redirect("/jeu/resultats");
  }

  const categoryStyle = RACE_CATEGORY_STYLE[edition.categoryCode];
  const futureStageCount = edition.stages.length - availableStages.length;

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />

      <div className="mx-auto max-w-[1500px] px-4 py-7 sm:px-8 sm:py-12">
        <Link
          href="/jeu/resultats"
          className="inline-flex min-h-10 items-center rounded-xl border border-[#176951]/20 bg-white px-4 text-xs font-black text-[#176951] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          ← Résultats / Live
        </Link>

        <header className="mt-5 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#071A17,#176951)] p-6 text-white shadow-[0_22px_60px_rgba(11,48,43,0.2)] sm:p-9">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className="rounded px-2.5 py-1 text-[10px] font-black uppercase tracking-wider"
                  style={{
                    backgroundColor: categoryStyle.background,
                    color: categoryStyle.foreground,
                  }}
                >
                  {categoryStyle.shortLabel}
                </span>
                <span
                  className={`fi fi-${edition.countryCode.toLowerCase()} rounded shadow-sm`}
                  aria-label={edition.countryName}
                />
                <span className="text-xs font-black uppercase tracking-[0.18em] text-[#9BE0CA]">
                  Tour · {edition.stages.length} étapes
                </span>
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-[-0.04em] sm:text-5xl">
                {edition.name}
              </h1>
              <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#C1D3CA] sm:text-base">
                Choisissez une étape déjà disputée ou celle du jour pour ouvrir
                ses résultats, son replay et son live.
              </p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 text-right">
              <span className="block text-3xl font-black">
                {availableStages.length}
              </span>
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#C1D3CA]">
                étape{availableStages.length > 1 ? "s" : ""} disponible
                {availableStages.length > 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </header>

        <section className="mt-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
                Parcours du tour
              </p>
              <h2 className="mt-1 text-2xl font-black">
                Replays et étape du jour
              </h2>
            </div>
            {futureStageCount > 0 ? (
              <span className="rounded-full bg-[#176951]/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#176951]">
                {futureStageCount} étape{futureStageCount > 1 ? "s" : ""} à
                venir
              </span>
            ) : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {availableStages.map((stage) => (
              <TourStageCard
                key={stage.id}
                editionSlug={edition.slug}
                stage={stage}
                now={now}
              />
            ))}
          </div>

          {availableStages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#315B3E]/25 bg-white px-6 py-12 text-center">
              <p className="font-black text-[#0B302B]">
                La première étape n’est pas encore disponible.
              </p>
              <p className="mt-2 text-sm font-semibold text-[#688176]">
                Elle apparaîtra automatiquement le jour de la course.
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function TourStageCard({
  editionSlug,
  stage,
  now,
}: {
  editionSlug: string;
  stage: RaceCalendarStage;
  now: Date;
}) {
  const state = getStageLiveState(stage, now);
  const statusStyle = {
    live: "bg-[#EF5B65] text-white shadow-[0_0_18px_rgba(239,91,101,0.34)]",
    finished: "bg-[#176951]/10 text-[#176951]",
    scheduled: "bg-[#F2C94C]/25 text-[#705A08]",
    cancelled: "bg-red-100 text-red-800",
  }[state.status];
  const statusLabel = {
    live: "● En direct",
    finished: "Replay disponible",
    scheduled: RACE_DAY_SLOT_CONFIG[stage.daySlot].label,
    cancelled: "Annulée",
  }[state.status];

  return (
    <Link
      href={`/jeu/resultats/${editionSlug}/${stage.stageNumber}`}
      prefetch={false}
      className="group overflow-hidden rounded-2xl border border-[#315B3E]/15 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-[#176951]/35 hover:shadow-lg"
    >
      <div className="flex items-center gap-3 border-b border-[#315B3E]/10 bg-[#F8FBF9] px-4 py-3">
        <span className="rounded-lg bg-[#0B302B] px-2.5 py-1.5 text-xs font-black text-white">
          E{stage.stageNumber}
        </span>
        <span className="min-w-0 flex-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#688176]">
          Jour {stage.dayNumber} ·{" "}
          {RACE_DAY_SLOT_CONFIG[stage.daySlot].shortLabel}
        </span>
        <span
          className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ${statusStyle}`}
        >
          {statusLabel}
        </span>
      </div>
      <div className="grid gap-5 p-5 sm:grid-cols-[minmax(0,0.9fr)_minmax(190px,1.1fr)] sm:items-center">
        <div className="min-w-0">
          <h3 className="truncate text-base font-black text-[#0B302B]">
            {stage.name}
          </h3>
          <p className="mt-2 text-xs font-bold text-[#48665F]">
            {RACE_PROFILE_LABELS[stage.profileType]} ·{" "}
            {stage.distanceKm.toLocaleString("fr-FR", {
              maximumFractionDigits: 1,
            })}{" "}
            km
          </p>
          <span className="mt-4 inline-flex text-xs font-black text-[#176951]">
            Ouvrir l’étape →
          </span>
        </div>
        <RaceStageProfile segments={stage.segments} compact />
      </div>
    </Link>
  );
}
