import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { WheelLogo } from "../../components/ui/wheel-logo";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { logoutAccount } from "./actions";

export const metadata: Metadata = {
  title: "Bureau du Directeur Sportif",
  description:
    "Pilotez votre carrière et votre équipe dans Cyclostratège.",
};

type SportingDirector = {
  id: string;
  username: string;
  display_name: string;
  country_id: string | null;
  onboarding_completed: boolean;
  created_at: string;
};

type ManagementModuleIcon =
  | "riders"
  | "sponsor"
  | "training"
  | "calendar"
  | "result"
  | "academy"
  | "camp"
  | "transfer";

export default async function GamePage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const {
    data: sportingDirector,
    error: profileError,
  } = await supabase
    .from("sporting_directors")
    .select(
      `
        id,
        username,
        display_name,
        country_id,
        onboarding_completed,
        created_at
      `
    )
    .eq("auth_user_id", user.id)
    .maybeSingle<SportingDirector>();

  if (profileError) {
    console.error(
      "Impossible de récupérer le profil du Directeur Sportif :",
      {
        code: profileError.code,
        message: profileError.message,
      }
    );
  }

  const displayName =
    sportingDirector?.display_name ??
    sportingDirector?.username ??
    "Directeur Sportif";

  const isProfileComplete = Boolean(
    sportingDirector?.country_id
  );

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader displayName={displayName} />

      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-96 bg-linear-to-b from-[#D7EEE8] to-transparent"
        />

        <MountainDecoration />

        <div className="relative mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
          <TeamIdentity />

          <header className="mt-8 max-w-3xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#278B70]">
              Bureau du Directeur Sportif
            </p>

            <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] sm:text-5xl">
              Bonjour, {displayName}.
            </h1>

            <p className="mt-5 max-w-2xl text-lg leading-8 text-[#48665F]">
              Suivez l’état de votre équipe, vos objectifs et les
              principaux domaines de votre carrière.
            </p>
          </header>

          {!sportingDirector && <ProfileErrorMessage />}

          <section className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <DirectorProfileCard
              sportingDirector={sportingDirector}
              email={user.email ?? null}
              isProfileComplete={isProfileComplete}
            />

            <ObjectivesCard
              isProfileComplete={isProfileComplete}
            />
          </section>

          <section className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <ManagementModuleCard
              icon="riders"
              title="Effectif"
              status={
                isProfileComplete
                  ? "7 coureurs à générer"
                  : "En attente"
              }
              description={
                isProfileComplete
                  ? "Votre profil est prêt. La génération de vos 7 premiers coureurs amateurs sera ajoutée dans une prochaine étape."
                  : "Complétez le profil de votre Directeur Sportif pour constituer votre premier effectif amateur."
              }
            />

            <ManagementModuleCard
              icon="sponsor"
              title="Sponsoring"
              status="Aucun sponsor"
              description="Consultez prochainement les offres disponibles, les contrats et les objectifs de vos sponsors."
            />

            <ManagementModuleCard
              icon="training"
              title="Entraînements"
              status="Aucun compte rendu"
              description="Les programmes, la progression et les derniers comptes rendus de vos coureurs apparaîtront ici."
            />

            <ManagementModuleCard
              icon="calendar"
              title="Courses"
              status="Aucune course"
              description="Consultez prochainement le calendrier, les inscriptions et les courses accessibles à votre équipe."
            />

            <ManagementModuleCard
              icon="result"
              title="Résultats"
              status="Aucun résultat"
              description="Les dernières performances, les classements et les points obtenus par votre équipe seront affichés ici."
            />

            <ManagementModuleCard
              icon="academy"
              title="Centre de formation"
              status="À développer"
              description="Détectez, recrutez et accompagnez les jeunes coureurs destinés à rejoindre votre effectif."
            />

            <ManagementModuleCard
              icon="camp"
              title="Stages"
              status="À développer"
              description="Planifiez des stages pour préparer vos coureurs et développer leurs qualités sportives."
            />

            <ManagementModuleCard
              icon="transfer"
              title="Bureau des transferts"
              status="À développer"
              description="Suivez les coureurs disponibles, vos négociations et les futurs mouvements de votre effectif."
            />
          </section>
        </div>
      </section>
    </main>
  );
}

function GameHeader({
  displayName,
}: {
  displayName: string;
}) {
  return (
    <header className="relative z-20 border-b border-[#78947D]/25 bg-[#071A17] text-[#FFFDF4] shadow-lg shadow-black/15">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-4 sm:px-8">
        <Link
          href="/jeu"
          className="flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C]"
        >
          <WheelLogo />

          <span>
            <span className="block text-lg font-extrabold uppercase leading-none">
              Cyclo
            </span>

            <span className="mt-1 block text-xs font-semibold uppercase tracking-[0.26em] text-[#F2C94C]">
              Stratège
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <span className="hidden text-sm font-semibold text-[#D6DFD2] md:inline">
            {displayName}
          </span>

          <form action={logoutAccount}>
            <button
              type="submit"
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#F2C94C]/45 bg-[#F2C94C]/10 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.1em] text-[#F2C94C] transition hover:bg-[#F2C94C] hover:text-[#071A17] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C]"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

function TeamIdentity() {
  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-[#315B3E]/20 bg-white/80 p-5 shadow-[0_16px_40px_rgba(19,60,46,0.08)] backdrop-blur sm:flex-row sm:items-center sm:p-6">
      <TeamJerseyPlaceholder />

      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#789087]">
          Identité sportive actuelle
        </p>

        <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
          Équipe amateur
        </h2>

        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-[#EAF5F3] px-3 py-1.5 text-xs font-bold text-[#176951]">
            Aucun sponsor actif
          </span>

          <span className="rounded-full bg-[#EDF2EF] px-3 py-1.5 text-xs font-bold text-[#60756E]">
            Bannière neutre
          </span>
        </div>
      </div>
    </section>
  );
}

function DirectorProfileCard({
  sportingDirector,
  email,
  isProfileComplete,
}: {
  sportingDirector: SportingDirector | null;
  email: string | null;
  isProfileComplete: boolean;
}) {
  const profileName =
    sportingDirector?.display_name ??
    sportingDirector?.username ??
    "Directeur Sportif";

  return (
    <article className="rounded-2xl border border-[#315B3E]/20 bg-white p-6 shadow-[0_18px_45px_rgba(19,60,46,0.1)] sm:p-7">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#D7EEE8] text-xl font-black text-[#278B70]">
          {getInitials(profileName)}
        </div>

        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#278B70]">
            Directeur Sportif
          </p>

          <h2 className="mt-1 text-2xl font-black">
            {profileName}
          </h2>
        </div>
      </div>

      <dl className="mt-7 grid gap-4 sm:grid-cols-2">
        <ProfileInformation
          label="Identifiant public"
          value={
            sportingDirector?.username
              ? `@${sportingDirector.username}`
              : "Non disponible"
          }
        />

        <ProfileInformation
          label="Nationalité"
          value={
            sportingDirector?.country_id
              ? "Renseignée"
              : "À compléter"
          }
        />

        <ProfileInformation
          label="Adresse e-mail"
          value={email ?? "Non disponible"}
        />

        <ProfileInformation
          label="Début de carrière"
          value={
            sportingDirector?.created_at
              ? formatCareerStart(
                  sportingDirector.created_at
                )
              : "Non disponible"
          }
        />
      </dl>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-[#315B3E]/10 pt-5">
        <span
          className={
            isProfileComplete
              ? "rounded-full bg-[#DDF3E8] px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.1em] text-[#176951]"
              : "rounded-full bg-[#FFF2BF] px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.1em] text-[#80640C]"
          }
        >
          {isProfileComplete
            ? "Profil initial complété"
            : "Profil incomplet"}
        </span>

        <span className="text-sm font-bold text-[#789087]">
          Modification disponible dans l’US suivante
        </span>
      </div>
    </article>
  );
}

function ObjectivesCard({
  isProfileComplete,
}: {
  isProfileComplete: boolean;
}) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-[#315B3E]/25 bg-[#0B302B] p-6 text-[#FFFDF4] shadow-[0_24px_60px_rgba(7,26,23,0.22)] sm:p-7">
      <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-[#42B99A] via-[#F2C94C] to-[#42B99A]" />

      <WheelDecoration />

      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#7CCF9C]">
              Objectifs
            </p>

            <h2 className="mt-2 text-2xl font-black">
              Vos priorités
            </h2>
          </div>

          <span className="rounded-full bg-white/10 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.12em] text-[#D6DFD2]">
            1 objectif affiché
          </span>
        </div>

        <div className="mt-7 rounded-xl border border-[#F2C94C]/30 bg-[#F2C94C]/10 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="rounded-full bg-[#F2C94C] px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.1em] text-[#071A17]">
              Objectif bloquant
            </span>

            <span className="text-sm font-bold text-[#F2C94C]">
              {isProfileComplete ? "1 / 1" : "0 / 1"}
            </span>
          </div>

          <h3 className="mt-5 text-xl font-black">
            Compléter le profil de votre Directeur Sportif
          </h3>

          <p className="mt-3 leading-7 text-[#D6DFD2]">
            Renseignez votre nationalité pour déterminer
            l’identité de votre équipe amateur et préparer la
            génération de vos 7 premiers coureurs.
          </p>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[#F2C94C] transition-all"
              style={{
                width: isProfileComplete ? "100%" : "35%",
              }}
            />
          </div>

          <div className="mt-5">
            {isProfileComplete ? (
              <p className="text-sm font-bold text-[#9BE0BC]">
                Objectif rempli. La création de votre équipe
                amateur sera la prochaine étape.
              </p>
            ) : (
              <p className="text-sm font-bold text-[#F2C94C]">
                La rubrique de modification du profil sera créée
                dans la prochaine User Story.
              </p>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function ManagementModuleCard({
  icon,
  title,
  status,
  description,
}: {
  icon: ManagementModuleIcon;
  title: string;
  status: string;
  description: string;
}) {
  return (
    <article className="group rounded-2xl border border-[#315B3E]/20 bg-white/90 p-6 shadow-[0_16px_38px_rgba(19,60,46,0.09)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_44px_rgba(19,60,46,0.13)]">
      <div className="flex items-start justify-between gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#D7EEE8] text-[#176951] transition group-hover:bg-[#42B99A] group-hover:text-[#07302A]">
          <ManagementModuleIcon icon={icon} />
        </span>

        <span className="rounded-full bg-[#EDF2EF] px-3 py-1 text-xs font-bold text-[#60756E]">
          {status}
        </span>
      </div>

      <h2 className="mt-6 text-xl font-black">
        {title}
      </h2>

      <p className="mt-3 leading-7 text-[#60756E]">
        {description}
      </p>
    </article>
  );
}

function ProfileInformation({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-[#F5F9F7] p-4">
      <dt className="text-xs font-bold uppercase tracking-[0.12em] text-[#789087]">
        {label}
      </dt>

      <dd className="mt-1 break-words font-semibold text-[#183F37]">
        {value}
      </dd>
    </div>
  );
}

function ProfileErrorMessage() {
  return (
    <div className="mt-8 rounded-xl border border-red-300 bg-red-50 px-5 py-4 text-sm font-semibold text-red-800">
      Votre compte est bien connecté, mais votre profil de
      Directeur Sportif n’a pas pu être récupéré.
    </div>
  );
}

function TeamJerseyPlaceholder() {
  return (
    <div
      aria-label="Emplacement du futur maillot de l’équipe"
      className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border border-[#315B3E]/15 bg-[#D7EEE8]"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 64 64"
        className="h-16 w-16 text-[#176951]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      >
        <path d="M23 10 15 14 7 27l9 6 5-7v28h22V26l5 7 9-6-8-13-8-4c-2 5-5 7-9 7s-7-2-9-7Z" />
        <path d="M23 10c1 4 4 7 9 7s8-3 9-7" />
        <path d="M21 36h22" />
      </svg>
    </div>
  );
}

function ManagementModuleIcon({
  icon,
}: {
  icon: ManagementModuleIcon;
}) {
  const paths: Record<
    ManagementModuleIcon,
    React.ReactNode
  > = {
    riders: (
      <>
        <circle cx="8" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M2.5 20c.5-4.5 2.5-7 5.5-7s5 2.5 5.5 7" />
        <path d="M14 14c3.5-.3 5.5 1.7 6 5" />
      </>
    ),
    sponsor: (
      <>
        <path d="M4 7h16v12H4z" />
        <path d="M8 7V4h8v3" />
        <path d="M4 12h16" />
      </>
    ),
    training: (
      <>
        <path d="M5 7v10M19 7v10" />
        <path d="M2 9v6M22 9v6" />
        <path d="M5 12h14" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4M17 3v4M3 10h18" />
        <path d="M8 14h3M13 14h3M8 17h3" />
      </>
    ),
    result: (
      <>
        <path d="M5 20V10h4v10" />
        <path d="M10 20V4h4v16" />
        <path d="M15 20v-7h4v7" />
      </>
    ),
    academy: (
      <>
        <path d="m3 10 9-5 9 5-9 5-9-5Z" />
        <path d="M7 13v4c3 2 7 2 10 0v-4" />
        <path d="M21 10v6" />
      </>
    ),
    camp: (
      <>
        <path d="m4 20 8-16 8 16" />
        <path d="M7 20h10" />
        <path d="m9 20 3-6 3 6" />
      </>
    ),
    transfer: (
      <>
        <path d="M4 7h13" />
        <path d="m14 4 3 3-3 3" />
        <path d="M20 17H7" />
        <path d="m10 14-3 3 3 3" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[icon]}
    </svg>
  );
}

function getInitials(value: string): string {
  const initials = value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return initials || "DS";
}

function formatCareerStart(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function MountainDecoration() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1440 420"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-x-0 top-48 h-80 w-full opacity-20"
    >
      <path
        d="M0 365 L170 215 L310 330 L490 105 L665 340 L835 180 L1005 350 L1190 135 L1440 315 L1440 420 L0 420 Z"
        fill="#78B9A3"
        opacity="0.34"
      />

      <path
        d="M0 390 L220 300 L370 380 L545 235 L720 395 L900 285 L1075 400 L1260 255 L1440 365"
        fill="none"
        stroke="#315B3E"
        strokeDasharray="17 15"
        strokeWidth="3"
        opacity="0.38"
      />
    </svg>
  );
}

function WheelDecoration() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full border border-white/10 opacity-55"
      style={{
        background:
          "repeating-conic-gradient(transparent 0deg 13deg, rgba(124,207,156,0.10) 13deg 14deg)",
      }}
    />
  );
}