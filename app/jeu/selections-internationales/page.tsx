import type { Metadata } from "next";
import Link from "@/components/ui/app-link";
import { redirect } from "next/navigation";

import { answerInternationalSelectionsAction } from "./actions";
import { GameHeader } from "@/components/game/game-header";
import { InternationalSelectionSubmitButton } from "@/components/game/international-selection-submit-button";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import {
  INTERNATIONAL_CHAMPIONSHIPS_HREF,
  getInternationalChampionshipDirectoryHref,
} from "@/lib/game/international-championship-navigation";
import {
  getCurrentDirectorInternationalSelections,
  type InternationalChampionshipSelection,
  type InternationalSelectionResponseStatus,
} from "@/services/international-championship-selections";

export const metadata: Metadata = {
  title: "Sélections internationales",
  description:
    "Validez ou refusez la participation de vos coureurs aux championnats continentaux et du monde.",
};

type InternationalSelectionsPageProps = {
  searchParams: Promise<{
    decision?: string | string[];
    erreur?: string | string[];
  }>;
};

const STATUS_CONTENT: Record<
  InternationalSelectionResponseStatus,
  { label: string; className: string; description: string }
> = {
  pending: {
    label: "Réponse attendue",
    className: "border-[#D4A82F]/30 bg-[#FFF7D9] text-[#7A5B09]",
    description:
      "Sans réponse avant le départ, la participation sera confirmée automatiquement.",
  },
  confirmed: {
    label: "Participation validée",
    className: "border-[#278B70]/25 bg-[#E8F7F1] text-[#176951]",
    description:
      "La sélection est définitive et remplace les courses, demandes de WildCard ou stages en conflit.",
  },
  automatic: {
    label: "Participation automatique",
    className: "border-[#278B70]/25 bg-[#E8F7F1] text-[#176951]",
    description:
      "Aucun refus n’a été reçu : le coureur participe au championnat.",
  },
  declined: {
    label: "Participation refusée",
    className: "border-[#B94848]/25 bg-[#FFF1EF] text-[#9A3434]",
    description:
      "Le coureur a été retiré et le réserviste suivant de sa nation a été appelé.",
  },
  ineligible_injury: {
    label: "Remplacé — blessure",
    className: "border-[#B94848]/25 bg-[#FFF1EF] text-[#9A3434]",
    description:
      "La blessure rend le coureur inéligible. Le suivant au classement national prend sa place.",
  },
  unavailable: {
    label: "Non disponible",
    className: "border-[#60756E]/25 bg-[#EEF3F1] text-[#526760]",
    description:
      "Aucune équipe active ne peut matérialiser cette sélection dans la startlist.",
  },
};

export default async function InternationalSelectionsPage({
  searchParams,
}: InternationalSelectionsPageProps) {
  const resolvedSearchParams = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) redirect("/connexion");

  const [headerData, selections] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getCurrentDirectorInternationalSelections({
      authUserId: user.id,
      processDue: false,
    }),
  ]);

  const pendingCount = selections.filter(
    (selection) => selection.canRespond,
  ).length;
  const decision = readSingleSearchParam(resolvedSearchParams.decision);
  const errorMessage = readSingleSearchParam(resolvedSearchParams.erreur);

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
          href="/jeu"
          className="inline-flex items-center gap-2 text-sm font-extrabold text-[#176951] transition hover:text-[#0B302B]"
        >
          <span aria-hidden="true">←</span>
          Retour au bureau
        </Link>

        <header className="relative mt-5 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#071A17,#176951)] px-6 py-8 text-white shadow-[0_24px_70px_rgba(19,60,46,0.18)] sm:px-10 sm:py-10">
          <div
            aria-hidden="true"
            className="absolute -right-16 -top-24 h-72 w-72 rounded-full border-[42px] border-white/10"
          />
          <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="max-w-3xl">
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#F2C94C]">
                Équipes nationales · Décision à H‑24
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
                Sélections internationales
              </h1>
              <p className="mt-4 text-sm font-semibold leading-6 text-[#D6DFD2] sm:text-base">
                Les 20 meilleures nations sont figées à H‑24, puis leurs huit
                meilleurs coureurs valides sont appelés. Une sélection vaut
                accord par défaut tant que vous ne la refusez pas.
              </p>
            </div>
            <div className="grid gap-3">
              <span className="w-fit rounded-2xl border border-white/15 bg-white/10 px-5 py-4 text-sm font-black text-white backdrop-blur">
                {pendingCount} décision{pendingCount > 1 ? "s" : ""} à traiter
              </span>
              <Link
                href={INTERNATIONAL_CHAMPIONSHIPS_HREF}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#F2C94C] px-5 text-sm font-black text-[#183F37] transition hover:bg-[#FFDB63]"
              >
                Profils et startlists →
              </Link>
            </div>
          </div>
        </header>

        {decision === "confirmee" ? (
          <FeedbackBanner tone="success">
            La participation est validée. Les courses, demandes de WildCard et
            stages qui se chevauchent ont été mis à jour pour ce coureur. Tout
            stage non démarré qui a été annulé a également été remboursé.
          </FeedbackBanner>
        ) : null}

        {decision === "refusee" ? (
          <FeedbackBanner tone="neutral">
            Le refus est enregistré. Le coureur suivant au classement de sa
            nation a été appelé automatiquement.
          </FeedbackBanner>
        ) : null}

        {errorMessage ? (
          <FeedbackBanner tone="error">{errorMessage}</FeedbackBanner>
        ) : null}

        <section className="mt-7 space-y-5">
          {selections.length > 0 ? (
            pendingCount > 0 ? (
              <form
                action={answerInternationalSelectionsAction}
                className="space-y-5"
              >
                {selections.map((selection) => (
                  <SelectionCard
                    key={selection.candidateId}
                    selection={selection}
                  />
                ))}
                <div className="sticky bottom-4 z-20 rounded-2xl border border-[#315B3E]/15 bg-white/95 p-4 shadow-[0_18px_55px_rgba(19,60,46,0.2)] backdrop-blur sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-5">
                  <div>
                    <p className="text-sm font-black text-[#183F37]">
                      Arbitrage groupé · {pendingCount} convocation
                      {pendingCount > 1 ? "s" : ""}
                    </p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-[#60756E]">
                      Choisissez Valider ou Refuser sur chaque fiche, puis
                      enregistrez toutes vos décisions avec un seul chargement.
                    </p>
                  </div>
                  <div className="mt-4 shrink-0 sm:mt-0">
                    <InternationalSelectionSubmitButton
                      variant="confirm"
                      pendingLabel="Enregistrement du lot…"
                    >
                      Enregistrer les {pendingCount} décision
                      {pendingCount > 1 ? "s" : ""}
                    </InternationalSelectionSubmitButton>
                  </div>
                </div>
              </form>
            ) : (
              selections.map((selection) => (
                <SelectionCard
                  key={selection.candidateId}
                  selection={selection}
                />
              ))
            )
          ) : (
            <div className="rounded-[2rem] border border-dashed border-[#315B3E]/25 bg-white px-6 py-12 text-center shadow-[0_16px_45px_rgba(19,60,46,0.06)]">
              <p className="text-xl font-black text-[#183F37]">
                Aucune sélection à traiter
              </p>
              <p className="mx-auto mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#60756E]">
                Les convocations apparaîtront ici dès que le classement sera
                figé, exactement 24 heures avant un championnat continental ou
                mondial.
              </p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function SelectionCard({
  selection,
}: {
  selection: InternationalChampionshipSelection;
}) {
  const status = STATUS_CONTENT[selection.responseStatus];
  const hasCalendarConflict =
    selection.conflictingRaceNames.length > 0 ||
    selection.conflictingWildcardRaceNames.length > 0 ||
    selection.conflictingCampNames.length > 0;

  return (
    <article
      id={`selection-${selection.candidateId}`}
      className="scroll-mt-8 overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_45px_rgba(19,60,46,0.08)]"
    >
      <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="flex min-w-0 gap-4">
          <span
            className={`fi fi-${selection.countryCode.toLowerCase()} mt-1 shrink-0 rounded shadow-md`}
            style={{ fontSize: "2.6rem", lineHeight: 1 }}
            role="img"
            aria-label={`Drapeau ${selection.countryName}`}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-black text-[#183F37] sm:text-2xl">
                <Link
                  href={`/jeu/coureurs/${selection.riderId}`}
                  className="rounded-sm underline decoration-[#176951]/25 underline-offset-4 transition hover:text-[#176951] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176951]/35"
                  aria-label={`Voir les statistiques de ${selection.riderName}`}
                >
                  {selection.riderName}
                </Link>
              </h2>
              <span
                className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${status.className}`}
              >
                {status.label}
              </span>
            </div>
            <p className="mt-2 text-sm font-extrabold text-[#176951]">
              {selection.championshipName} · J{selection.dayNumber} ·{" "}
              {formatDeparture(selection.departureAt)}
            </p>
            <Link
              href={getInternationalChampionshipDirectoryHref(
                selection.championshipSlug,
              )}
              className="mt-2 inline-flex text-xs font-black text-[#176951] underline decoration-[#176951]/30 underline-offset-4 transition hover:text-[#0B302B]"
            >
              Voir le profil et la startlist →
            </Link>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#60756E]">
              {selection.responseStatus === "pending" && hasCalendarConflict
                ? "Sans validation explicite, cette convocation conflictuelle sera abandonnée et vos engagements seront conservés."
                : status.description}
            </p>
            {selection.canRespond && hasCalendarConflict ? (
              <div className="mt-4 space-y-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-950">
                {selection.conflictingRaceNames.length > 0 ? (
                  <p>
                    {selection.conflictingRaceNames.length === 1 ? (
                      <>
                        Si vous acceptez la convocation, votre coureur sera
                        désinscrit de la course{" "}
                        {selection.conflictingRaceNames[0]}.
                      </>
                    ) : (
                      <>
                        Si vous acceptez la convocation, votre coureur sera
                        désinscrit des courses suivantes :{" "}
                        {selection.conflictingRaceNames.join(", ")}.
                      </>
                    )}
                  </p>
                ) : null}
                {selection.conflictingWildcardRaceNames.length > 0 ? (
                  <div className="space-y-1">
                    <p>
                      {selection.conflictingWildcardRaceNames.length === 1 ? (
                        <>
                          Une demande de WildCard est en cours pour la course{" "}
                          {selection.conflictingWildcardRaceNames[0]}.
                        </>
                      ) : (
                        <>
                          Des demandes de WildCard sont en cours pour les
                          courses suivantes :{" "}
                          {selection.conflictingWildcardRaceNames.join(", ")}.
                        </>
                      )}
                    </p>
                    <p>
                      Si vous acceptez la convocation, ce coureur sera retiré
                      de la composition proposée. Si aucun autre coureur n’y
                      reste inscrit, la demande de participation sera annulée.
                    </p>
                  </div>
                ) : null}
                {selection.conflictingCampNames.length > 0 ? (
                  <div className="space-y-1">
                    <p>
                      {selection.conflictingCampNames.length === 1 ? (
                        <>
                          L’activité programmée suivante sera également annulée
                          pour votre coureur :{" "}
                          {selection.conflictingCampNames[0]}.
                        </>
                      ) : (
                        <>
                          Les activités programmées suivantes seront également
                          annulées pour votre coureur :{" "}
                          {selection.conflictingCampNames.join(", ")}.
                        </>
                      )}
                    </p>
                    <p>
                      Le coût d’un stage qui n’a pas encore commencé sera
                      remboursé. Un stage déjà commencé ne le sera pas.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-black text-[#315B3E]">
              <span className="rounded-full bg-[#EEF5F1] px-3 py-1.5">
                #{selection.riderRank} {selection.countryName}
              </span>
              <span className="rounded-full bg-[#EEF5F1] px-3 py-1.5">
                Nation #{selection.nationRank}
              </span>
              <span className="rounded-full bg-[#EEF5F1] px-3 py-1.5">
                {selection.uciPoints} pts UCI
              </span>
              <span
                className={`rounded-full border px-3 py-1.5 ${getFormBadgeClasses(selection.currentForm)}`}
              >
                Forme {selection.currentForm}/100
              </span>
              <span className="rounded-full bg-[#EEF5F1] px-3 py-1.5">
                Note {selection.overallRating.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {selection.canRespond ? (
          <fieldset className="grid min-w-60 gap-3">
            <legend className="mb-1 text-xs font-black uppercase tracking-[0.12em] text-[#60756E]">
              Décision du DS
            </legend>
            <input
              type="hidden"
              name="candidateId"
              value={selection.candidateId}
            />
            {selection.conflictingRaceNames.map((raceName) => (
              <input
                key={`race:${raceName}`}
                type="hidden"
                name={`acknowledgedConflict:${selection.candidateId}`}
                value={`course:${raceName}`}
              />
            ))}
            {selection.conflictingWildcardRaceNames.map((raceName) => (
              <input
                key={`wildcard:${raceName}`}
                type="hidden"
                name={`acknowledgedConflict:${selection.candidateId}`}
                value={`wildcard:${raceName}`}
              />
            ))}
            {selection.conflictingCampNames.map((campName) => (
              <input
                key={`camp:${campName}`}
                type="hidden"
                name={`acknowledgedConflict:${selection.candidateId}`}
                value={`activité:${campName}`}
              />
            ))}
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-[#278B70]/25 bg-[#E8F7F1] px-4 py-3 text-sm font-black text-[#176951] transition hover:bg-[#DDF3EA] has-[:checked]:border-[#176951] has-[:checked]:ring-2 has-[:checked]:ring-[#176951]/20">
              <input
                type="radio"
                name={`decision:${selection.candidateId}`}
                value="confirm"
                required
                className="h-4 w-4 accent-[#176951]"
              />
              Valider la convocation
            </label>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-[#B94848]/25 bg-[#FFF1EF] px-4 py-3 text-sm font-black text-[#9A3434] transition hover:bg-[#FFE3DF] has-[:checked]:border-[#B94848] has-[:checked]:ring-2 has-[:checked]:ring-[#B94848]/20">
              <input
                type="radio"
                name={`decision:${selection.candidateId}`}
                value="decline"
                required
                className="h-4 w-4 accent-[#B94848]"
              />
              Refuser la sélection
            </label>
            <p className="text-center text-[11px] font-bold leading-5 text-[#60756E]">
              Le choix sera appliqué avec le bouton global.
            </p>
          </fieldset>
        ) : (
          <Link
            href={`/jeu/coureurs/${selection.riderId}`}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#315B3E]/15 bg-[#F5FAF7] px-5 py-3 text-sm font-black text-[#176951] transition hover:bg-[#E8F7F1]"
          >
            Voir le coureur
          </Link>
        )}
      </div>
    </article>
  );
}

function FeedbackBanner({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "success" | "neutral" | "error";
}) {
  const className =
    tone === "success"
      ? "border-emerald-300 bg-emerald-50 text-emerald-900"
      : tone === "error"
        ? "border-red-300 bg-red-50 text-red-900"
        : "border-sky-300 bg-sky-50 text-sky-900";

  return (
    <div
      className={`mt-6 rounded-2xl border px-5 py-4 text-sm font-bold ${className}`}
    >
      {children}
    </div>
  );
}

function formatDeparture(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function readSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getFormBadgeClasses(form: number) {
  if (form >= 85) {
    return "border-emerald-300 bg-emerald-50 text-emerald-800";
  }

  if (form >= 65) {
    return "border-amber-300 bg-amber-50 text-amber-900";
  }

  return "border-rose-300 bg-rose-50 text-rose-800";
}
