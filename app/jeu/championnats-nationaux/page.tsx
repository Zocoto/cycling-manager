import type { Metadata } from "next";
import Link from "@/components/ui/app-link";
import { redirect } from "next/navigation";

import { saveNationalChampionshipSelectionsAction } from "./actions";
import { GameHeader } from "@/components/game/game-header";
import { NationalChampionshipSelectionSubmitButton } from "@/components/game/national-championship-selection-submit-button";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import {
  getCurrentTeamNationalChampionshipSelectionMatrix,
  syncNationalChampionshipRegistrations,
  type NationalChampionshipSelectionCell,
} from "@/services/national-championships";
import { getActiveSeasonRaceCalendar } from "@/services/race-calendar";

export const metadata: Metadata = {
  title: "Inscriptions aux championnats nationaux",
  description:
    "Gérez les inscriptions de toute votre équipe aux CN en ligne et contre-la-montre depuis une seule grille.",
};

type NationalChampionshipsPageProps = {
  searchParams: Promise<{ enregistrement?: string | string[] }>;
};

export default async function NationalChampionshipsPage({
  searchParams,
}: NationalChampionshipsPageProps) {
  const resolvedSearchParams = await searchParams;
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
    getActiveSeasonRaceCalendar(supabase, now, {
      includeCancelledEditions: true,
      includeEngagedRiders: false,
    }),
  ]);
  if (!calendar) redirect("/jeu");

  const matrix = await getCurrentTeamNationalChampionshipSelectionMatrix({
    authUserId: user.id,
    calendar,
    now,
  });
  const canEdit =
    matrix.missingEditionCount === 0 &&
    matrix.rows.some((row) => row.road.editable || row.timeTrial.editable);
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

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/jeu/calendrier"
            className="inline-flex items-center gap-2 text-sm font-extrabold text-[#176951] transition hover:text-[#0B302B]"
          >
            <span aria-hidden="true">←</span>
            Retour aux inscriptions courses
          </Link>
          <Link
            href="/jeu/resultats"
            className="inline-flex min-h-10 items-center rounded-xl border border-[#176951]/20 bg-white px-4 text-xs font-black text-[#176951] shadow-sm"
          >
            Voir les résultats
          </Link>
        </div>

        <header className="relative mt-5 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#071A17,#176951)] px-6 py-8 text-white shadow-[0_24px_70px_rgba(19,60,46,0.18)] sm:px-10 sm:py-10">
          <div
            aria-hidden="true"
            className="absolute -right-12 -top-24 h-72 w-72 rounded-full border-[42px] border-white/10"
          />
          <div className="relative max-w-4xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#F2C94C]">
              J8 · Deux disciplines · Une seule grille
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
              Championnats nationaux
            </h1>
            <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-[#D6DFD2] sm:text-base">
              Tous les coureurs sont regroupés ci-dessous. Le top 200 de chaque
              pays est coché par défaut ; vous pouvez ensuite confirmer ou
              retirer chaque participation jusqu’au départ de la discipline.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-black">
              <ScheduleBadge
                label="CN CLM"
                fallback="J8 · 14 h"
                departureAt={matrix.timeTrialDepartureAt}
              />
              <ScheduleBadge
                label="CN en ligne"
                fallback="J8 · 18 h"
                departureAt={matrix.roadDepartureAt}
              />
              <span className="rounded-full bg-[#F2C94C] px-3 py-2 text-[#17261E]">
                Top 200 national par défaut
              </span>
            </div>
          </div>
        </header>

        {saved ? (
          <p className="mt-5 rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-900">
            Les inscriptions aux deux championnats ont bien été enregistrées.
          </p>
        ) : null}

        {matrix.missingEditionCount > 0 ? (
          <p className="mt-5 rounded-2xl border border-red-300 bg-red-50 px-5 py-4 text-sm font-bold leading-6 text-red-900">
            {matrix.missingEditionCount} épreuve
            {matrix.missingEditionCount > 1 ? "s sont absentes" : " est absente"}
            du calendrier. L’enregistrement est temporairement bloqué afin de
            ne perdre aucun choix.
          </p>
        ) : null}

        <section className="mt-7 overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_45px_rgba(19,60,46,0.08)]">
          <div className="border-b border-[#315B3E]/10 px-5 py-5 sm:px-8 sm:py-6">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
              Effectif complet
            </p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-[#183F37]">
                  Inscriptions de l’équipe
                </h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-[#60756E]">
                  Une case décochée signifie que le coureur ne prendra pas le
                  départ. Chaque colonne se verrouille à l’heure de son CN.
                </p>
              </div>
              <span className="rounded-full bg-[#EAF5F0] px-4 py-2 text-xs font-black text-[#176951]">
                {matrix.rows.length} coureur{matrix.rows.length > 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {matrix.rows.length > 0 ? (
            <form action={saveNationalChampionshipSelectionsAction}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left">
                  <thead className="bg-[#F3F8F5] text-[10px] font-black uppercase tracking-[0.13em] text-[#60756E]">
                    <tr>
                      <th scope="col" className="px-5 py-4 sm:px-8">
                        Coureur
                      </th>
                      <th scope="col" className="px-4 py-4">
                        Pays / rang
                      </th>
                      <th scope="col" className="px-4 py-4 text-center">
                        CN en ligne
                      </th>
                      <th scope="col" className="px-4 py-4 text-center sm:pr-8">
                        CN CLM
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#315B3E]/10">
                    {matrix.rows.map((row) => (
                      <tr key={row.riderId} className="hover:bg-[#F8FBF9]">
                        <td className="px-5 py-4 sm:px-8">
                          <input
                            type="hidden"
                            name="riderId"
                            value={row.riderId}
                          />
                          <Link
                            href={`/jeu/coureurs/${row.riderId}`}
                            className="font-black text-[#183F37] hover:text-[#176951]"
                          >
                            {row.firstName} {row.lastName}
                          </Link>
                          {row.isDefaultQualified ? (
                            <span className="mt-1 block text-[10px] font-black uppercase tracking-wide text-[#278B70]">
                              Qualifié par défaut
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-4">
                          <span className="flex items-center gap-2 text-sm font-bold text-[#315B3E]">
                            <span
                              className={`fi fi-${row.countryCode.toLowerCase()} rounded shadow-sm`}
                              role="img"
                              aria-label={`Drapeau ${row.countryName}`}
                            />
                            {row.countryName}
                          </span>
                          <span className="mt-1 block text-xs font-semibold text-[#789087]">
                            {row.nationalRank
                              ? `${row.nationalRank}e national`
                              : "Non classé"}
                          </span>
                        </td>
                        <SelectionCheckbox
                          name="road"
                          riderId={row.riderId}
                          riderName={`${row.firstName} ${row.lastName}`}
                          discipline="CN en ligne"
                          selection={row.road}
                        />
                        <SelectionCheckbox
                          name="timeTrial"
                          riderId={row.riderId}
                          riderName={`${row.firstName} ${row.lastName}`}
                          discipline="CN CLM"
                          selection={row.timeTrial}
                          last
                        />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#315B3E]/10 bg-[#F8FBF9] px-5 py-5 sm:px-8">
                <p className="max-w-2xl text-xs font-semibold leading-5 text-[#60756E]">
                  Les choix enregistrés remplacent la sélection automatique et
                  restent prioritaires, même si le classement national évolue.
                </p>
                {canEdit ? (
                  <NationalChampionshipSelectionSubmitButton />
                ) : (
                  <span className="rounded-full bg-[#60756E]/10 px-4 py-2 text-xs font-black text-[#60756E]">
                    Inscriptions closes
                  </span>
                )}
              </div>
            </form>
          ) : (
            <p className="px-6 py-10 text-center text-sm font-semibold text-[#60756E]">
              Aucun coureur actif n’est présent dans l’effectif.
            </p>
          )}
        </section>
      </section>
    </main>
  );
}

function SelectionCheckbox({
  name,
  riderId,
  riderName,
  discipline,
  selection,
  last = false,
}: {
  name: "road" | "timeTrial";
  riderId: string;
  riderName: string;
  discipline: string;
  selection: NationalChampionshipSelectionCell;
  last?: boolean;
}) {
  return (
    <td className={`px-4 py-4 text-center ${last ? "sm:pr-8" : ""}`}>
      <label className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-xl border border-[#315B3E]/15 bg-white transition hover:border-[#278B70]/45 has-disabled:cursor-not-allowed has-disabled:bg-[#EEF2F0]">
        <input
          type="checkbox"
          name={name}
          value={riderId}
          defaultChecked={selection.checked}
          disabled={!selection.editable}
          aria-label={`${discipline} pour ${riderName}`}
          className="h-5 w-5 accent-[#176951] disabled:opacity-50"
        />
      </label>
      {!selection.editionId ? (
        <span className="mt-1 block text-[10px] font-bold text-[#B83D48]">
          Épreuve absente
        </span>
      ) : !selection.editable ? (
        <span className="mt-1 block text-[10px] font-bold text-[#789087]">
          Verrouillé
        </span>
      ) : null}
    </td>
  );
}

function ScheduleBadge({
  label,
  fallback,
  departureAt,
}: {
  label: string;
  fallback: string;
  departureAt: string | null;
}) {
  const schedule = departureAt
    ? new Intl.DateTimeFormat("fr-FR", {
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Paris",
      }).format(new Date(departureAt))
    : fallback;

  return (
    <span className="rounded-full bg-white/10 px-3 py-2 text-[#DCE9E3]">
      {label} · {schedule}
    </span>
  );
}

function readSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
