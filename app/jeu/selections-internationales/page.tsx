import type { Metadata } from "next";
import Link from "@/components/ui/app-link";
import { redirect } from "next/navigation";

import { answerInternationalSelectionAction } from "./actions";
import { GameHeader } from "@/components/game/game-header";
import { InternationalSelectionSubmitButton } from "@/components/game/international-selection-submit-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
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
      "La sélection est définitive et remplace les courses ou stages en conflit.",
  },
  automatic: {
    label: "Participation automatique",
    className: "border-[#278B70]/25 bg-[#E8F7F1] text-[#176951]",
    description:
      "Aucun refus n’a été reçu : le coureur participe au championnat.",
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
  } = await supabase.auth.getUser();

  if (authenticationError || !user) redirect("/connexion");

  const [headerData, selections] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getCurrentDirectorInternationalSelections({
      authUserId: user.id,
    }),
  ]);

  const pendingCount = selections.filter(
    (selection) => selection.canRespond
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
            <span className="w-fit rounded-2xl border border-white/15 bg-white/10 px-5 py-4 text-sm font-black text-white backdrop-blur">
              {pendingCount} décision{pendingCount > 1 ? "s" : ""} à traiter
            </span>
          </div>
        </header>

        {decision === "confirmee" ? (
          <FeedbackBanner tone="success">
            La participation est validée. Les courses et stages qui se
            chevauchent ont été annulés pour ce coureur.
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
            selections.map((selection) => (
              <SelectionCard
                key={selection.candidateId}
                selection={selection}
              />
            ))
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
                {selection.riderName}
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
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#60756E]">
              {status.description}
            </p>
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
              <span className="rounded-full bg-[#EEF5F1] px-3 py-1.5">
                Note {selection.overallRating.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {selection.canRespond ? (
          <div className="grid min-w-60 gap-3">
            <form action={answerInternationalSelectionAction}>
              <input
                type="hidden"
                name="candidateId"
                value={selection.candidateId}
              />
              <input type="hidden" name="decision" value="confirm" />
              <InternationalSelectionSubmitButton
                variant="confirm"
                pendingLabel="Validation…"
              >
                Valider et donner la priorité
              </InternationalSelectionSubmitButton>
            </form>
            <form action={answerInternationalSelectionAction}>
              <input
                type="hidden"
                name="candidateId"
                value={selection.candidateId}
              />
              <input type="hidden" name="decision" value="decline" />
              <InternationalSelectionSubmitButton
                variant="decline"
                pendingLabel="Refus…"
              >
                Refuser la sélection
              </InternationalSelectionSubmitButton>
            </form>
            <p className="text-center text-[11px] font-bold leading-5 text-[#60756E]">
              La décision est définitive.
            </p>
          </div>
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
