import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { GameHeader } from "@/components/game/game-header";
import { JuniorRacePreparationEditor } from "@/components/game/junior-race-preparation-editor";
import { RacePreparationDivisionTabs } from "@/components/game/race-preparation-division-tabs";
import Link from "@/components/ui/app-link";
import { DEVELOPMENT_RACE_PROFILE_LABELS } from "@/lib/game/development-race-profile";
import { getJuniorRacePreparationHref } from "@/lib/game/junior-race-preparation";
import { getIntlLocale } from "@/lib/i18n/config";
import { getRequestLocale } from "@/lib/i18n/server";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import { getCurrentJuniorRacePreparations } from "@/services/junior-race-preparation";

import { saveJuniorRacePreparationAction } from "./actions";

export const metadata: Metadata = {
  title: "Préparation des courses juniors",
};

export default async function JuniorRacePreparationPage({ searchParams }: {
  searchParams: Promise<{
    course?: string | string[];
    etape?: string | string[];
    selection?: string | string[];
    type?: string | string[];
  }>;
}) {
  const [query, supabase, locale] = await Promise.all([searchParams, createSupabaseServerClient(), getRequestLocale()]);
  const { data: { user }, error: authenticationError } = await getAuthenticatedUser(supabase);
  if (!user || authenticationError) redirect("/connexion");

  const [headerData, entries] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getCurrentJuniorRacePreparations(supabase).catch((error: unknown) => {
      console.error("junior_race_preparation_load_failed", error);
      return null;
    }),
  ]);
  const requestedSlug = readQuery(query.course);
  const requestedRegistration = readQuery(query.selection);
  const requestedStage = Number(readQuery(query.etape));
  const selectedEntry = entries?.find(({ slug, registrationId }) => slug === requestedSlug && registrationId === requestedRegistration)
    ?? entries?.find(({ slug }) => slug === requestedSlug)
    ?? (readQuery(query.type) === "selection" ? entries?.find(({ scope }) => scope === "federation") : undefined)
    ?? entries?.[0];
  const selectedStage = selectedEntry?.stages.find(({ number }) => number === requestedStage) ?? selectedEntry?.stages[0];
  const cutoff = selectedStage ? new Intl.DateTimeFormat(getIntlLocale(locale), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(new Date(selectedStage.closesAt)) : null;

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader simulatorEmail={user.email} displayName={headerData.displayName} sponsor={headerData.teamSponsorVisual} maxWidth="wide" />
      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-8 sm:py-12">
        <BackToOfficeLink />
        <RacePreparationDivisionTabs division="junior" />
        <h1 className="mb-5 mt-7 text-3xl font-black tracking-tight text-[#0B302B] sm:text-4xl">Préparation des courses juniors</h1>
        {entries && selectedEntry && selectedStage ? (
          <div className="grid items-start gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
            <nav aria-label="Courses engagées" className="min-w-0 rounded-2xl border border-[#315B3E]/15 bg-white p-4">
              <h2 className="px-1 text-sm font-black text-[#315B3E]">Courses engagées</h2>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:grid lg:overflow-visible">
                {entries.map((entry) => (
                  <Link
                    key={entry.registrationId}
                    href={getJuniorRacePreparationHref({ slug: entry.slug, registrationId: entry.registrationId })}
                    aria-current={entry === selectedEntry ? "page" : undefined}
                    className="block min-w-40 shrink-0 rounded-xl border border-[#315B3E]/15 px-3 py-2 text-sm font-bold text-[#315B3E] transition hover:bg-[#F1F8F4] aria-[current=page]:border-[#278B70] aria-[current=page]:bg-[#EAF5F0] aria-[current=page]:text-[#0B302B] lg:min-w-0"
                  >
                    <span className="block">{entry.name}</span>
                    <span className="mt-1 flex items-center gap-2 text-xs font-medium">
                      {entry.countryCode ? <span aria-hidden="true" className={`fi fi-${entry.countryCode.toLowerCase()} rounded-sm`} /> : null}
                      {entry.scope === "federation" ? "Sélection nationale" : "Dev Team"}
                    </span>
                  </Link>
                ))}
              </div>
            </nav>

            <section className="min-w-0 overflow-hidden rounded-[1.75rem] border border-[#315B3E]/15 bg-white shadow-[0_18px_45px_rgba(19,60,46,0.1)]">
              <header className="bg-[linear-gradient(135deg,#071A17,#176951)] p-5 text-white sm:p-7">
                <h2 className="text-2xl font-black">{selectedEntry.name}</h2>
                <p className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-sm font-bold text-[#D6DFD2]">
                  <span>{DEVELOPMENT_RACE_PROFILE_LABELS[selectedStage.profile]}</span>
                  <span aria-hidden="true">·</span>
                  <span>{new Intl.NumberFormat(getIntlLocale(locale)).format(selectedStage.distanceKm)} km</span>
                  <span aria-hidden="true">·</span>
                  <span>J{selectedStage.day}</span>
                </p>
              </header>

              <div className="p-5 sm:p-7">
                {selectedEntry.stages.length > 1 || selectedStage.number > 1 ? (
                  <nav aria-label="Étapes" className="mb-5 flex flex-wrap gap-2">
                    {selectedEntry.stages.map((stage) => (
                      <Link
                        key={stage.id}
                        href={getJuniorRacePreparationHref({ slug: selectedEntry.slug, registrationId: selectedEntry.registrationId, stageNumber: stage.number })}
                        aria-current={stage === selectedStage ? "page" : undefined}
                        className="inline-flex min-h-11 items-center rounded-xl border border-[#315B3E]/20 px-3 text-sm font-bold text-[#315B3E] transition hover:bg-[#F1F8F4] aria-[current=page]:border-[#278B70] aria-[current=page]:bg-[#EAF5F0]"
                      >
                        Étape {stage.number}
                      </Link>
                    ))}
                  </nav>
                ) : null}
                <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                  <h3 className="text-lg font-black text-[#0B302B]">{selectedStage.name}</h3>
                  <p className="text-sm font-semibold text-[#457162]">
                    Fin de la préparation <time dateTime={selectedStage.closesAt}>{cutoff} (Paris)</time>
                  </p>
                </div>
                <p className="mb-4 max-w-2xl text-sm leading-relaxed text-[#457162]">
                  {selectedStage.type === "individual_time_trial"
                    ? "L’allure régulière conserve l’effort standard. L’effet des allures progressive et engagée dépend des qualités du coureur et du parcours."
                    : "Un équipier aide le leader protégé. Une attaque peut faire gagner ou perdre du temps selon le profil du coureur et le parcours."}
                </p>
                <JuniorRacePreparationEditor
                  key={`${selectedEntry.registrationId}:${selectedStage.id}`}
                  action={saveJuniorRacePreparationAction}
                  stage={selectedStage}
                  scope={selectedEntry.scope}
                  registrationId={selectedEntry.registrationId}
                />
              </div>
            </section>
          </div>
        ) : (
          <section className="rounded-2xl border border-[#315B3E]/15 bg-white px-5 py-8 text-[#315B3E]">
            {entries === null ? (
              <p role="alert" className="font-bold">Impossible de charger les préparations juniors. Réessayez dans quelques instants.</p>
            ) : (
              <>
                <p className="font-bold">Aucune course junior à préparer.</p>
                <Link href="/jeu/centre-de-formation?onglet=development&dev=calendrier" className="mt-3 inline-flex min-h-11 items-center font-bold text-[#176951] underline underline-offset-4">
                  Voir le calendrier Dev Team
                </Link>
              </>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

function readQuery(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
