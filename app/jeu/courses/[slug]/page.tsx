import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { registerForRaceAction } from "./actions";

import { GameHeader } from "@/components/game/game-header";
import { RaceRegistrationButton } from "@/components/game/race-registration-button";
import {
  RACE_CATEGORY_STYLE,
  RACE_PROFILE_LABELS,
  getEditionDayRange,
  getRegistrationAvailability,
  type RaceCalendarEdition,
  type RaceProfileType,
} from "@/lib/game/race-calendar";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import {
  getActiveSeasonRaceCalendar,
  getCurrentRaceUserContext,
  getRacePastWinners,
  type CurrentRaceUserContext,
  type RacePastWinner,
} from "@/services/race-calendar";

type RaceProfilePageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    inscription?: string | string[];
    erreur?: string | string[];
  }>;
};

export async function generateMetadata({
  params,
}: RaceProfilePageProps): Promise<Metadata> {
  const { slug } = await params;
  const readableName = slug
    .split("-")
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1)
    )
    .join(" ");

  return {
    title: readableName,
    description: `Consultez la fiche de ${readableName} dans Cyclostratège.`,
  };
}

export default async function RaceProfilePage({
  params,
  searchParams,
}: RaceProfilePageProps) {
  const [{ slug }, resolvedSearchParams] =
    await Promise.all([params, searchParams]);

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    notFound();
  }

  const supabase =
    await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const [headerData, calendar] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getActiveSeasonRaceCalendar(supabase),
  ]);
  const edition = calendar?.editions.find(
    (candidate) => candidate.slug === slug
  );

  if (!calendar || !edition) {
    notFound();
  }

  let raceUserContext: CurrentRaceUserContext = {
    reputationPoints: 0,
    registration: null,
  };
  let contextError: string | null = null;
  let pastWinners: RacePastWinner[] = [];
  let winnersError = false;

  const [contextResult, winnersResult] =
    await Promise.all([
      getCurrentRaceUserContext(
        supabase,
        user.id,
        edition.id
      )
        .then((context) => ({
          context,
          error: null,
        }))
        .catch((error: unknown) => ({
          context: null,
          error,
        })),
      getRacePastWinners(
        supabase,
        edition.raceId
      )
        .then((winners) => ({
          winners,
          error: null,
        }))
        .catch((error: unknown) => ({
          winners: [] as RacePastWinner[],
          error,
        })),
    ]);

  if (contextResult.context) {
    raceUserContext = contextResult.context;
  }

  if (contextResult.error) {
    console.error(
      "Impossible de charger le contexte d'inscription de la course :",
      contextResult.error
    );
    contextError =
      "Votre situation d’inscription n’a pas pu être vérifiée.";
  }

  pastWinners = winnersResult.winners;

  if (winnersResult.error) {
    console.error(
      "Impossible de charger le palmarès de la course :",
      winnersResult.error
    );
    winnersError = true;
  }

  const successMessage = readSingleSearchParam(
    resolvedSearchParams.inscription
  );
  const errorMessage = readSingleSearchParam(
    resolvedSearchParams.erreur
  );
  const style =
    RACE_CATEGORY_STYLE[edition.categoryCode];
  const { startDay, endDay } =
    getEditionDayRange(edition);
  const startDate = calendar.days.find(
    (day) => day.dayNumber === startDay
  )?.calendarDate;
  const endDate = calendar.days.find(
    (day) => day.dayNumber === endDay
  )?.calendarDate;
  const totalDistance = edition.stages.reduce(
    (total, stage) => total + stage.distanceKm,
    0
  );

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

      <section className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 sm:py-12">
        <Link
          href="/jeu/calendrier"
          className="inline-flex items-center gap-2 text-sm font-extrabold text-[#176951] transition hover:text-[#0B302B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176951]"
        >
          <span aria-hidden="true">←</span>
          Retour au calendrier
        </Link>

        <article className="mt-5 overflow-hidden rounded-[2rem] border border-[#315B3E]/15 bg-white/90 shadow-[0_24px_70px_rgba(19,60,46,0.12)]">
          <header
            className="relative overflow-hidden px-6 py-8 text-white sm:px-10 sm:py-10"
            style={{
              background: `linear-gradient(135deg, ${style.border}, ${style.background})`,
            }}
          >
            <div
              aria-hidden="true"
              className="absolute -right-16 -top-24 h-72 w-72 rounded-full border-[42px] border-white/10"
            />

            <div className="relative flex flex-wrap items-start justify-between gap-7">
              <div className="flex min-w-0 items-start gap-5">
                <span
                  className={`fi fi-${edition.countryCode.toLowerCase()} mt-1 shrink-0 rounded shadow-lg`}
                  style={{
                    fontSize: "3.25rem",
                    lineHeight: 1,
                  }}
                  role="img"
                  aria-label={`Drapeau ${edition.countryName}`}
                />

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/25 bg-black/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]">
                      {style.label}
                    </span>
                    <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]">
                      {edition.raceFormat ===
                      "stage_race"
                        ? "Course à étapes"
                        : "Course d’un jour"}
                    </span>
                  </div>

                  <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">
                    {edition.name}
                  </h1>
                  <p className="mt-3 text-sm font-bold text-white/80 sm:text-base">
                    {edition.countryName} · J{startDay}
                    {endDay > startDay
                      ? ` à J${endDay}`
                      : ""}
                  </p>
                </div>
              </div>

              <div className="grid min-w-56 grid-cols-2 gap-3 rounded-2xl border border-white/20 bg-black/15 p-4 backdrop-blur">
                <RaceHeroStat
                  label="Étapes"
                  value={String(
                    edition.stages.length
                  )}
                />
                <RaceHeroStat
                  label="Distance"
                  value={`${formatDistance(totalDistance)} km`}
                />
              </div>
            </div>
          </header>

          <div className="p-5 sm:p-8 lg:p-10">
            {successMessage === "confirmee" ? (
              <div className="mb-6 rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-900">
                Votre équipe est bien inscrite à cette course.
              </div>
            ) : null}

            {errorMessage ? (
              <div className="mb-6 rounded-xl border border-red-300 bg-red-50 px-5 py-4 text-sm font-bold text-red-900">
                {errorMessage.slice(0, 300)}
              </div>
            ) : null}

            <div className="grid gap-8 xl:grid-cols-[minmax(0,1.5fr)_minmax(330px,0.65fr)]">
              <div>
                <section>
                  <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#176951]">
                    Parcours
                  </p>
                  <h2 className="mt-2 text-2xl font-black text-[#0B302B]">
                    {edition.raceFormat ===
                    "stage_race"
                      ? `${edition.stages.length} étapes au programme`
                      : "Le profil de la course"}
                  </h2>

                  <div className="mt-5 space-y-3">
                    {edition.stages.map((stage) => (
                      <StageCard
                        key={stage.id}
                        stage={stage}
                        showStageNumber={
                          edition.raceFormat ===
                          "stage_race"
                        }
                      />
                    ))}
                  </div>
                </section>

                <section className="mt-8 rounded-2xl border border-[#315B3E]/15 bg-[#F6FAF7] p-6">
                  <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#176951]">
                    Palmarès
                  </p>
                  <h2 className="mt-2 text-xl font-black text-[#0B302B]">
                    Anciens vainqueurs
                  </h2>
                  {pastWinners.length > 0 ? (
                    <div className="mt-4 overflow-hidden rounded-xl border border-[#315B3E]/15 bg-white">
                      {pastWinners.map((winner) => (
                        <div
                          key={`${winner.gameYear}-${winner.riderId}`}
                          className="flex flex-wrap items-center justify-between gap-3 border-b border-[#315B3E]/10 px-5 py-4 last:border-none"
                        >
                          <div>
                            <p className="font-black text-[#0B302B]">
                              {winner.riderName}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-[#688176]">
                              {winner.teamName}
                            </p>
                          </div>
                          <span className="rounded-full bg-[#D7EEE8] px-3 py-1.5 text-xs font-black text-[#176951]">
                            Saison {winner.gameYear}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 rounded-xl border border-dashed border-[#315B3E]/25 bg-white px-5 py-5 text-sm font-semibold leading-6 text-[#688176]">
                      {winnersError
                        ? "Le palmarès est momentanément indisponible."
                        : "Aucun vainqueur précédent : cette édition inaugure l’histoire de la course. Les saisons terminées alimenteront automatiquement ce palmarès."}
                    </p>
                  )}
                </section>
              </div>

              <aside className="space-y-5">
                <RegistrationPanel
                  edition={edition}
                  context={raceUserContext}
                  contextError={contextError}
                />

                <section className="rounded-2xl border border-[#315B3E]/15 bg-white p-6 shadow-sm">
                  <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#176951]">
                    Informations
                  </p>
                  <dl className="mt-5 space-y-4">
                    <DefinitionRow
                      label="Dates"
                      value={formatDateRange(
                        startDate,
                        endDate
                      )}
                    />
                    <DefinitionRow
                      label="Départ"
                      value={formatDeparture(
                        edition.stages[0]
                          ?.departureAt
                      )}
                    />
                    <DefinitionRow
                      label="Clôture"
                      value={formatDeparture(
                        edition.registrationClosesAt
                      )}
                    />
                    <DefinitionRow
                      label="Réputation minimale"
                      value={
                        edition.minimumReputation ===
                        null
                          ? "À définir"
                          : `${edition.minimumReputation} pts`
                      }
                    />
                  </dl>
                </section>

                {edition.raceFormat ===
                "stage_race" ? (
                  <SecondaryClassifications
                    edition={edition}
                  />
                ) : null}
              </aside>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}

function RegistrationPanel({
  edition,
  context,
  contextError,
}: {
  edition: RaceCalendarEdition;
  context: CurrentRaceUserContext;
  contextError: string | null;
}) {
  const registration = context.registration;
  const availability =
    getRegistrationAvailability({
      policy: edition.registrationPolicy,
      closesAt: edition.registrationClosesAt,
      minimumReputation:
        edition.minimumReputation,
      reputationPoints:
        context.reputationPoints,
    });

  if (registration) {
    return (
      <section className="rounded-2xl border border-emerald-400/35 bg-[#0B302B] p-6 text-white shadow-[0_18px_45px_rgba(7,26,23,0.2)]">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#9BE0BC]">
          Inscription
        </p>
        <h2 className="mt-3 text-xl font-black">
          Équipe inscrite
        </h2>
        <p className="mt-3 text-sm leading-6 text-[#D6DFD2]">
          Votre participation est acceptée. La sélection des coureurs sera disponible dans la prochaine étape du MVP.
        </p>
        <span className="mt-5 inline-flex rounded-full bg-emerald-400/15 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-[#9BE0BC]">
          {registration.status === "accepted"
            ? "Acceptée"
            : registration.status}
        </span>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-[#0B302B] p-6 text-white shadow-[0_18px_45px_rgba(7,26,23,0.2)]">
      <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#9BE0BC]">
        Inscription
      </p>
      <h2 className="mt-3 text-xl font-black">
        Engager votre équipe
      </h2>

      <p className="mt-3 text-sm leading-6 text-[#D6DFD2]">
        Votre nationalité n’entre pas dans les critères. Seuls votre niveau de réputation et la catégorie de la course sont pris en compte.
      </p>

      <div className="mt-5 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
        <span className="text-xs font-bold text-[#BFD1C6]">
          Votre réputation
        </span>
        <span className="font-black text-[#F2C94C]">
          {context.reputationPoints} pts
        </span>
      </div>

      {contextError ? (
        <RegistrationNotice tone="error">
          {contextError}
        </RegistrationNotice>
      ) : availability === "open" ? (
        <form
          action={registerForRaceAction}
          className="mt-5"
        >
          <input
            type="hidden"
            name="editionId"
            value={edition.id}
          />
          <input
            type="hidden"
            name="slug"
            value={edition.slug}
          />
          <RaceRegistrationButton />
          <p className="mt-3 text-center text-[11px] font-semibold leading-5 text-[#9FB5A8]">
            Acceptation automatique. La liste des coureurs sera choisie séparément.
          </p>
        </form>
      ) : availability === "closed" ? (
        <RegistrationNotice tone="warning">
          Les inscriptions sont fermées : la limite de huit heures avant le départ est dépassée.
        </RegistrationNotice>
      ) : availability ===
        "reputation_locked" ? (
        <RegistrationNotice tone="warning">
          Votre réputation est insuffisante pour cette catégorie.
        </RegistrationNotice>
      ) : (
        <RegistrationNotice tone="neutral">
          Les paliers de réputation de cette catégorie seront bientôt annoncés. L’inscription reste verrouillée jusque-là.
        </RegistrationNotice>
      )}
    </section>
  );
}

function RegistrationNotice({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "warning" | "neutral" | "error";
}) {
  const className =
    tone === "warning"
      ? "border-amber-300/35 bg-amber-300/10 text-amber-100"
      : tone === "error"
        ? "border-red-300/35 bg-red-300/10 text-red-100"
        : "border-white/15 bg-white/5 text-[#D6DFD2]";

  return (
    <p
      className={`mt-5 rounded-xl border px-4 py-3 text-sm font-semibold leading-6 ${className}`}
    >
      {children}
    </p>
  );
}

function StageCard({
  stage,
  showStageNumber,
}: {
  stage: RaceCalendarEdition["stages"][number];
  showStageNumber: boolean;
}) {
  return (
    <article className="grid gap-4 rounded-2xl border border-[#315B3E]/15 bg-white p-4 shadow-sm sm:grid-cols-[90px_minmax(0,1fr)_180px] sm:items-center sm:p-5">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-wider text-[#688176]">
          J{stage.dayNumber}
        </p>
        <p className="mt-1 font-black text-[#0B302B]">
          {showStageNumber
            ? `Étape ${stage.stageNumber}`
            : "Classique"}
        </p>
      </div>

      <div className="min-w-0">
        <h3 className="truncate font-black text-[#0B302B]">
          {stage.name}
        </h3>
        <p className="mt-1 text-sm font-semibold text-[#688176]">
          {RACE_PROFILE_LABELS[stage.profileType]} ·{" "}
          {formatDistance(stage.distanceKm)} km
        </p>
      </div>

      <ProfilePreview
        profileType={stage.profileType}
      />
    </article>
  );
}

function ProfilePreview({
  profileType,
}: {
  profileType: RaceProfileType;
}) {
  const pathByProfile: Record<
    RaceProfileType,
    string
  > = {
    flat: "M0 30 L40 28 L80 29 L120 27 L160 29",
    sprint:
      "M0 29 L45 27 L90 28 L120 25 L145 28 L160 19",
    hilly:
      "M0 30 L25 18 L45 28 L70 14 L95 27 L125 11 L160 29",
    mountain:
      "M0 31 L25 27 L48 16 L65 22 L93 4 L112 18 L135 8 L160 29",
    cobbles:
      "M0 29 L18 24 L36 28 L54 20 L72 27 L90 19 L108 26 L126 18 L144 26 L160 22",
    time_trial:
      "M0 29 L32 27 L64 23 L96 25 L128 18 L160 20",
    mixed:
      "M0 30 L30 26 L55 15 L82 27 L105 8 L130 24 L160 18",
  };

  return (
    <svg
      viewBox="0 0 160 36"
      role="img"
      aria-label={`Profil ${RACE_PROFILE_LABELS[profileType]}`}
      className="h-12 w-full text-[#176951]"
      preserveAspectRatio="none"
    >
      <path
        d={`${pathByProfile[profileType]} L160 36 L0 36 Z`}
        fill="currentColor"
        opacity="0.15"
      />
      <path
        d={pathByProfile[profileType]}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SecondaryClassifications({
  edition,
}: {
  edition: RaceCalendarEdition;
}) {
  const hasMountain = edition.stages.some(
    (stage) =>
      stage.profileType === "mountain" ||
      stage.profileType === "hilly"
  );
  const hasSprint = edition.stages.some(
    (stage) =>
      stage.profileType === "sprint" ||
      stage.profileType === "flat"
  );

  return (
    <section className="rounded-2xl border border-[#315B3E]/15 bg-[#F6FAF7] p-6">
      <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#176951]">
        Classements annexes
      </p>
      <div className="mt-4 space-y-3">
        <ClassificationRow
          label="Grand Prix de la montagne"
          isPresent={hasMountain}
        />
        <ClassificationRow
          label="Grand Prix du sprint"
          isPresent={hasSprint}
        />
      </div>
      <p className="mt-4 text-xs font-semibold leading-5 text-[#688176]">
        Les barèmes et résultats détaillés seront activés avec le moteur de simulation.
      </p>
    </section>
  );
}

function ClassificationRow({
  label,
  isPresent,
}: {
  label: string;
  isPresent: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[#315B3E]/10 bg-white px-4 py-3">
      <span className="text-sm font-bold text-[#315B3E]">
        {label}
      </span>
      <span
        className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
          isPresent
            ? "bg-[#D7EEE8] text-[#176951]"
            : "bg-[#EDF2EF] text-[#688176]"
        }`}
      >
        {isPresent ? "Prévu" : "Non prévu"}
      </span>
    </div>
  );
}

function DefinitionRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#315B3E]/10 pb-4 last:border-none last:pb-0">
      <dt className="text-sm font-semibold text-[#688176]">
        {label}
      </dt>
      <dd className="text-right text-sm font-black text-[#0B302B]">
        {value}
      </dd>
    </div>
  );
}

function RaceHeroStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-extrabold uppercase tracking-wider text-white/65">
        {label}
      </p>
      <p className="mt-1 text-lg font-black">
        {value}
      </p>
    </div>
  );
}

function formatDistance(value: number) {
  return value.toLocaleString("fr-FR", {
    maximumFractionDigits: 0,
  });
}

function formatDateRange(
  startDate: string | undefined,
  endDate: string | undefined
) {
  if (!startDate) {
    return "Non renseignées";
  }

  const formatter = new Intl.DateTimeFormat(
    "fr-FR",
    {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }
  );
  const formattedStart = formatter.format(
    new Date(`${startDate}T00:00:00Z`)
  );

  if (!endDate || endDate === startDate) {
    return formattedStart;
  }

  return `${formattedStart} – ${formatter.format(
    new Date(`${endDate}T00:00:00Z`)
  )}`;
}

function formatDeparture(
  value: string | null | undefined
) {
  if (!value) {
    return "Non renseignée";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

function readSingleSearchParam(
  value: string | string[] | undefined
) {
  return Array.isArray(value)
    ? value[0] ?? null
    : value ?? null;
}
