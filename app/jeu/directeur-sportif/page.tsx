import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { GameHeader } from "../../../components/game/game-header";
import { DeleteSportingDirectorAccount } from "../../../components/game/delete-sporting-director-account";
import { SponsorJerseyPreview } from "../../../components/game/sponsor-jersey-preview";
import { SponsorLogo } from "../../../components/game/sponsor-logo";
import { SportingDirectorAvatar } from "../../../components/game/sporting-director-avatar";
import {
  SportingDirectorProfileForm,
  type CountryOption,
} from "../../../components/game/sporting-director-profile-form";
import { SportingDirectorReputation } from "../../../components/game/sporting-director-reputation";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import {
  getActiveTeamSponsorIdentityForAuthUser,
  type TeamSponsorIdentity,
} from "../../../services/team-sponsor-identity";

export const metadata: Metadata = {
  title: "Profil du Directeur Sportif",
  description:
    "Complétez votre profil de Directeur Sportif dans Cyclostratège.",
};

type SportingDirectorProfile = {
  id: string;
  username: string;
  display_name: string;
  country_id: string | null;
  avatar_key: string | null;
  reputation_points: number;
  is_email_visible: boolean;
  created_at: string;
};

type CountryRow = {
  id: string;
  name: string;
  iso_alpha2: string;
};

export default async function SportingDirectorProfilePage() {
  const supabase =
    await createSupabaseServerClient();

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabasePublishableKey =
    process.env
      .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (
    !supabaseUrl ||
    !supabasePublishableKey
  ) {
    throw new Error(
      "Les variables Supabase nécessaires sont manquantes."
    );
  }

  const publicSupabase = createClient(
    supabaseUrl,
    supabasePublishableKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );

  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const [profileResult, countriesResult] =
    await Promise.all([
      supabase
        .from("sporting_directors")
        .select(
          `
            id,
            username,
            display_name,
            country_id,
            avatar_key,
            reputation_points,
            is_email_visible,
            created_at
          `
        )
        .eq("auth_user_id", user.id)
        .maybeSingle<SportingDirectorProfile>(),

      publicSupabase
        .from("countries")
        .select(
          `
            id,
            name,
            iso_alpha2
          `
        )
        .eq("is_active", true)
        .order("name", {
          ascending: true,
        }),
    ]);

  let teamSponsorIdentity:
    TeamSponsorIdentity | null = null;

  let teamSponsorIdentityError:
    string | null = null;

  try {
    teamSponsorIdentity =
      await getActiveTeamSponsorIdentityForAuthUser(
        user.id
      );
  } catch (error) {
    console.error(
      "Impossible de récupérer l’identité commerciale de l’équipe :",
      error
    );

    teamSponsorIdentityError =
      getErrorMessage(error);
  }

  const sportingDirector =
    profileResult.data;

  if (
    profileResult.error ||
    !sportingDirector
  ) {
    console.error(
      "Impossible de récupérer le profil du Directeur Sportif :",
      profileResult.error
    );
  }

  if (countriesResult.error) {
    console.error(
      "Impossible de récupérer le référentiel des pays :",
      countriesResult.error
    );
  }

  const countries: CountryOption[] = (
    (countriesResult.data ?? []) as CountryRow[]
  ).map((country) => ({
    id: country.id,
    name: country.name,
    isoAlpha2: country.iso_alpha2,
  }));

  const selectedCountry =
    countries.find(
      (country) =>
        country.id ===
        sportingDirector?.country_id
    ) ?? null;

  const displayName =
    sportingDirector?.display_name ??
    sportingDirector?.username ??
    "Directeur Sportif";

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        displayName={displayName}
        sponsor={teamSponsorIdentity?.sponsor ?? null}
      />

      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-96 bg-linear-to-b from-[#D7EEE8] to-transparent"
        />

        <MountainDecoration />

        <div className="relative mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
          <Link
            href="/jeu"
            className="inline-flex items-center gap-2 rounded-md text-sm font-bold text-[#176951] transition hover:text-[#0B302B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]"
          >
            <BackArrowIcon />
            Retour au bureau
          </Link>

          <header className="mt-8 max-w-3xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#278B70]">
              Directeur Sportif
            </p>

            <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] sm:text-5xl">
              Gérer votre profil
            </h1>

            <p className="mt-5 max-w-2xl text-lg leading-8 text-[#48665F]">
              Définissez votre identité de Directeur
              Sportif et consultez votre progression
              dans l’univers de Cyclostratège.
            </p>
          </header>

          {teamSponsorIdentityError ? (
            <TeamSponsorIdentityWarning
              message={teamSponsorIdentityError}
            />
          ) : null}

          {!sportingDirector ? (
            <ProfileUnavailableMessage />
          ) : (
            <div className="mt-10 space-y-6">
              <article className="rounded-2xl border border-[#315B3E]/20 bg-white p-6 shadow-[0_18px_45px_rgba(19,60,46,0.1)] sm:p-8">
                <div className="border-b border-[#315B3E]/10 pb-6">
                  <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#278B70]">
                    Votre identité
                  </p>

                  <h2 className="mt-2 text-2xl font-black">
                    Profil du Directeur Sportif
                  </h2>

                  <p className="mt-3 max-w-3xl leading-7 text-[#60756E]">
                    Ces informations vous
                    représenteront dans votre bureau
                    et dans les différentes rubriques
                    de votre carrière.
                  </p>
                </div>

                <section className="mt-7 rounded-xl border border-[#315B3E]/15 bg-[#F5F9F7] p-5 sm:p-6">
                  <SportingDirectorReputation
                    reputationPoints={
                      sportingDirector.reputation_points
                    }
                  />
                </section>

                <div className="mt-8">
                  <SportingDirectorProfileForm
                    countries={countries}
                    initialDisplayName={
                      sportingDirector.display_name
                    }
                    initialCountryId={
                      sportingDirector.country_id
                    }
                    initialAvatarKey={
                      sportingDirector.avatar_key
                    }
                    initialIsEmailVisible={
                      sportingDirector.is_email_visible
                    }
                  />
                </div>
              </article>

              <ProfileSummaryCard
                displayName={displayName}
                username={
                  sportingDirector.username
                }
                email={user.email ?? null}
                isEmailVisible={
                  sportingDirector.is_email_visible
                }
                selectedCountry={
                  selectedCountry
                }
                avatarKey={
                  sportingDirector.avatar_key
                }
                reputationPoints={
                  sportingDirector.reputation_points
                }
                teamSponsorIdentity={
                  teamSponsorIdentity
                }
                />

              <DeleteSportingDirectorAccount
                displayName={displayName}
                teamName={
                  teamSponsorIdentity?.teamName ??
                  "Votre équipe amateur"
                }
              />
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function ProfileSummaryCard({
  displayName,
  username,
  email,
  isEmailVisible,
  selectedCountry,
  avatarKey,
  reputationPoints,
  teamSponsorIdentity,
}: {
  displayName: string;
  username: string;
  email: string | null;
  isEmailVisible: boolean;
  selectedCountry: CountryOption | null;
  avatarKey: string | null;
  reputationPoints: number;
  teamSponsorIdentity:
    TeamSponsorIdentity | null;
}) {
  return (
    <article className="rounded-2xl border border-[#315B3E]/20 bg-[#0B302B] p-6 text-[#FFFDF4] shadow-[0_20px_50px_rgba(7,26,23,0.18)] sm:p-8">
      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#7CCF9C]">
        Aperçu du profil
      </p>

      <div className="mt-5 hidden md:grid md:grid-cols-[minmax(0,1fr)_150px_330px] md:items-center md:gap-7">
        <SportingDirectorIdentity
          displayName={displayName}
          username={username}
          email={email}
          isEmailVisible={isEmailVisible}
          selectedCountry={selectedCountry}
          avatarKey={avatarKey}
        />

        <div className="flex justify-center">
          {teamSponsorIdentity ? (
            <SponsorJerseyPreview
              sponsor={
                teamSponsorIdentity.sponsor
              }
              jersey={
                teamSponsorIdentity.selectedJersey
              }
              className="h-36 w-32 drop-shadow-xl"
            />
          ) : (
            <CyclingJerseyIcon />
          )}
        </div>

        <TeamCommercialIdentity
          identity={teamSponsorIdentity}
        />
      </div>

      <div className="mt-5 space-y-6 md:hidden">
        <SportingDirectorIdentity
          displayName={displayName}
          username={username}
          email={email}
          isEmailVisible={isEmailVisible}
          selectedCountry={selectedCountry}
          avatarKey={avatarKey}
        />

        <div className="flex items-center justify-center gap-5 rounded-xl border border-white/10 bg-white/5 p-4">
          {teamSponsorIdentity ? (
            <SponsorJerseyPreview
              sponsor={
                teamSponsorIdentity.sponsor
              }
              jersey={
                teamSponsorIdentity.selectedJersey
              }
              className="h-32 w-28 shrink-0 drop-shadow-xl"
            />
          ) : (
            <CyclingJerseyIcon />
          )}

          <TeamCommercialIdentity
            identity={teamSponsorIdentity}
            compact
          />
        </div>
      </div>

      <div className="mt-6 border-t border-white/10 pt-5">
        <SportingDirectorReputation
          reputationPoints={reputationPoints}
          compact
        />
      </div>
    </article>
  );
}

function SportingDirectorIdentity({
  displayName,
  username,
  email,
  isEmailVisible,
  selectedCountry,
  avatarKey,
}: {
  displayName: string;
  username: string;
  email: string | null;
  isEmailVisible: boolean;
  selectedCountry: CountryOption | null;
  avatarKey: string | null;
}) {
  return (
    <div className="flex min-w-0 items-center gap-5">
      {avatarKey ? (
        <SportingDirectorAvatar
          avatarKey={avatarKey}
          size="large"
          label={`Avatar de ${displayName}`}
        />
      ) : (
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-[#42B99A] text-2xl font-black text-[#07302A]">
          {getInitials(displayName)}
        </div>
      )}

      <div className="min-w-0">
        <h2 className="truncate text-2xl font-black">
          {displayName}
        </h2>

        <p className="mt-1 text-sm font-semibold text-[#BFD1C6]">
          @{username}
        </p>

        <div className="mt-3 flex items-center gap-3">
          {selectedCountry ? (
            <>
              <CountryFlag
                isoAlpha2={
                  selectedCountry.isoAlpha2
                }
                countryName={
                  selectedCountry.name
                }
              />

              <span className="font-semibold text-[#FFFDF4]">
                {selectedCountry.name}
              </span>
            </>
          ) : (
            <span className="text-sm font-semibold text-[#BFD1C6]">
              Nationalité à compléter
            </span>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#9FB5A8]">
          {!isEmailVisible ? (
            <>
              <PrivacyIcon />
              <span>
                Adresse e-mail masquée
              </span>
            </>
          ) : (
            <span className="break-all">
              {email ??
                "Adresse e-mail non disponible"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function TeamCommercialIdentity({
  identity,
  compact = false,
}: {
  identity: TeamSponsorIdentity | null;
  compact?: boolean;
}) {
  if (!identity) {
    return (
      <div>
        <p
          className={[
            "font-black text-[#FFFDF4]",
            compact
              ? "text-lg"
              : "text-xl",
          ].join(" ")}
        >
          Aucun sponsor actif
        </p>

        <p className="mt-2 text-sm font-semibold text-[#9FB5A8]">
          Équipe amateur
        </p>
      </div>
    );
  }

  const sponsor = identity.sponsor;

  return (
    <div className="min-w-0">
      <div
        className="flex h-16 w-full max-w-48 items-center justify-center overflow-hidden rounded-xl border bg-white px-4 py-2"
        style={{
          borderColor: `${sponsor.colors.accent}66`,
          backgroundColor:
            sponsor.colors.background,
        }}
      >
        <SponsorLogo
          src={sponsor.logoPath}
          alt={`Logo de ${sponsor.name}`}
          sponsorName={sponsor.name}
          primaryColor={
            sponsor.colors.primary
          }
          backgroundColor={
            sponsor.colors.background
          }
          textColor={sponsor.colors.text}
        />
      </div>

      <p
        className={[
          "mt-4 font-black text-[#FFFDF4]",
          compact
            ? "text-lg"
            : "text-xl",
        ].join(" ")}
      >
        {identity.teamName}
      </p>

      <p className="mt-1 text-sm font-semibold text-[#BFD1C6]">
        Sponsor principal : {sponsor.name}
      </p>

      <p className="mt-2 text-xs font-semibold text-[#9FB5A8]">
        {formatMoney(
          identity.budgetPerSeason,
          identity.currencyCode
        )}{" "}
        par saison ·{" "}
        {formatDuration(
          identity.contractDurationSeasons
        )}
      </p>
    </div>
  );
}

function CyclingJerseyIcon() {
  return (
    <div className="flex h-32 w-28 shrink-0 items-center justify-center">
      <svg
        aria-label="Maillot cycliste gris de l’équipe amateur"
        role="img"
        viewBox="0 0 140 160"
        className="h-full w-full drop-shadow-xl"
      >
        <path
          d="M46 11
             L59 18
             L70 23
             L81 18
             L94 11
             L124 29
             L114 60
             L99 53
             L96 144
             Q70 153 44 144
             L41 53
             L26 60
             L16 29
             Z"
          fill="#AEB8B5"
          stroke="#E7ECE9"
          strokeLinejoin="round"
          strokeWidth="3"
        />

        <path
          d="M46 11
             Q49 32 70 37
             Q91 32 94 11
             L81 18
             L70 23
             L59 18
             Z"
          fill="#65716D"
        />

        <path
          d="M46 11
             Q50 26 59 31
             L46 49
             L41 53
             L26 60
             L16 29
             Z"
          fill="#8F9A96"
        />

        <path
          d="M94 11
             Q90 26 81 31
             L94 49
             L99 53
             L114 60
             L124 29
             Z"
          fill="#8F9A96"
        />

        <path
          d="M42 54
             Q52 61 70 61
             Q88 61 98 54
             L97 83
             Q84 89 70 89
             Q56 89 43 83
             Z"
          fill="#C5CDCA"
        />

        <path
          d="M43 84
             Q56 91 70 91
             Q84 91 97 84
             L96 111
             Q84 116 70 116
             Q56 116 44 111
             Z"
          fill="#8A9591"
        />

        <path
          d="M44 112
             Q56 118 70 118
             Q84 118 96 112
             L96 144
             Q70 153 44 144
             Z"
          fill="#B9C2BF"
        />

        <path
          d="M70 37V146"
          fill="none"
          stroke="#F0F3F1"
          strokeWidth="2.5"
        />

        <path
          d="M66 43H74"
          stroke="#65716D"
          strokeLinecap="round"
          strokeWidth="3"
        />

        <path
          d="M66 51H74"
          stroke="#65716D"
          strokeLinecap="round"
          strokeWidth="3"
        />

        <path
          d="M42 54L47 141"
          fill="none"
          stroke="#737F7B"
          strokeWidth="2"
          opacity="0.7"
        />

        <path
          d="M98 54L93 141"
          fill="none"
          stroke="#737F7B"
          strokeWidth="2"
          opacity="0.7"
        />

        <path
          d="M48 137Q70 144 92 137"
          fill="none"
          stroke="#66726E"
          strokeWidth="4"
        />

        <circle
          cx="70"
          cy="72"
          r="8"
          fill="#727E7A"
          opacity="0.5"
        />

        <path
          d="M65 72H75M70 67V77"
          stroke="#DCE2DF"
          strokeLinecap="round"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}

function PrivacyIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4 shrink-0"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect
        x="4"
        y="8"
        width="12"
        height="9"
        rx="2"
      />

      <path d="M7 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

function CountryFlag({
  isoAlpha2,
  countryName,
}: {
  isoAlpha2: string;
  countryName: string;
}) {
  const normalizedCode = isoAlpha2
    .trim()
    .toLowerCase();

  if (!/^[a-z]{2}$/.test(normalizedCode)) {
    return (
      <span
        role="img"
        aria-label={`Drapeau : ${countryName}`}
      >
        🏳️
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label={`Drapeau : ${countryName}`}
      className={[
        "fi",
        `fi-${normalizedCode}`,
        "shrink-0 overflow-hidden rounded-sm text-2xl shadow-sm",
      ].join(" ")}
    />
  );
}

function ProfileUnavailableMessage() {
  return (
    <div className="mt-10 rounded-xl border border-red-300 bg-red-50 px-5 py-4 text-sm font-semibold text-red-800">
      Votre compte est connecté, mais votre profil de
      Directeur Sportif n’a pas pu être récupéré.
    </div>
  );
}

function TeamSponsorIdentityWarning({
  message,
}: {
  message: string;
}) {
  return (
    <div className="mt-8 rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-900">
      L’identité commerciale de l’équipe n’a pas pu
      être chargée. Le reste du profil reste
      disponible.
      <span className="mt-1 block text-xs font-medium">
        {message}
      </span>
    </div>
  );
}

function BackArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M17 10H4" />
      <path d="m9 5-5 5 5 5" />
    </svg>
  );
}

function getInitials(value: string): string {
  const initials = value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) =>
      part.charAt(0).toUpperCase()
    )
    .join("");

  return initials || "DS";
}

function getErrorMessage(
  error: unknown
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Une erreur inattendue est survenue.";
}

function formatMoney(
  value: number,
  currencyCode: string
): string {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value.toLocaleString(
      "fr-FR"
    )} ${currencyCode}`;
  }
}

function formatDuration(
  value: number
): string {
  return `${value} saison${value === 1 ? "" : "s"}`;
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
