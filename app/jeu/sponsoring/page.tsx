import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SponsorLogo } from "../../../components/game/sponsor-logo";
import { WheelLogo } from "../../../components/ui/wheel-logo";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import {
  getOrCreateSponsorOffersForAuthUser,
  type PersistedSponsorOffer,
} from "../../../services/persisted-sponsor-offers";
import type { PersistedSponsorObjective } from "../../../types/sponsor-objective";
import { logoutAccount } from "../actions";

export const metadata: Metadata = {
  title: "Sponsoring",
  description:
    "Étudiez les propositions de sponsoring disponibles pour votre équipe dans Cyclostratège.",
};

export default async function SponsoringPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  let offers: PersistedSponsorOffer[] = [];
  let offersError: string | null = null;

  try {
    offers =
      await getOrCreateSponsorOffersForAuthUser(
        user.id
      );
  } catch (error) {
    console.error(
      "Impossible de récupérer les offres de sponsoring :",
      error
    );

    offersError = getErrorMessage(error);
  }

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader />

      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-96 bg-linear-to-b from-[#D7EEE8] to-transparent"
        />

        <MountainDecoration />

        <div className="relative mx-auto max-w-[1500px] px-5 py-10 sm:px-8 sm:py-14">
          <Link
            href="/jeu"
            className="inline-flex items-center gap-2 text-sm font-extrabold text-[#176951] transition hover:text-[#0B4A3B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]"
          >
            <BackIcon />
            Retour au bureau
          </Link>

          <header className="mt-7 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#278B70]">
                Développement de l’équipe
              </p>

              <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] sm:text-5xl">
                Sponsoring
              </h1>

              <p className="mt-4 max-w-3xl text-lg leading-8 text-[#48665F]">
                Comparez les budgets, les durées de
                contrat et les objectifs proposés avant de
                choisir le partenaire principal de votre
                équipe.
              </p>
            </div>

            {!offersError ? (
              <div className="rounded-2xl border border-[#315B3E]/20 bg-white/85 px-5 py-4 text-right shadow-[0_14px_34px_rgba(19,60,46,0.08)]">
                <p className="text-2xl font-black">
                  {offers.length}
                </p>

                <p className="mt-1 text-sm font-semibold text-[#60756E]">
                  {formatOfferCount(offers.length)}
                </p>
              </div>
            ) : null}
          </header>

          <OfferPersistenceNotice />

          {offersError ? (
            <OffersErrorMessage
              message={offersError}
            />
          ) : null}

          {!offersError && offers.length === 0 ? (
            <EmptyOffers />
          ) : null}

          {!offersError && offers.length > 0 ? (
            <section className="mt-8 grid items-stretch gap-6 xl:grid-cols-3">
              {offers.map((offer) => (
                <SponsorOfferCard
                  key={offer.id}
                  offer={offer}
                />
              ))}
            </section>
          ) : null}

          {!offersError && offers.length > 0 ? (
            <p className="mt-6 text-sm leading-7 text-[#60756E]">
              Les objectifs de cette première version
              utilisent des courses et classements
              provisoires. Ils sont enregistrés avec
              l’offre et ne changent pas au rechargement
              de la page. Ils seront reliés au calendrier
              sportif réel dans une future évolution.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function GameHeader() {
  return (
    <header className="relative z-20 border-b border-[#78947D]/25 bg-[#071A17] text-[#FFFDF4] shadow-lg shadow-black/15">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-5 px-5 py-4 sm:px-8">
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

        <form action={logoutAccount}>
          <button
            type="submit"
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#F2C94C]/45 bg-[#F2C94C]/10 px-4 py-2 text-xs font-extrabold uppercase tracking-widest text-[#F2C94C] transition hover:bg-[#F2C94C] hover:text-[#071A17] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C]"
          >
            Se déconnecter
          </button>
        </form>
      </div>
    </header>
  );
}

function OfferPersistenceNotice() {
  return (
    <aside className="mt-8 flex items-start gap-4 rounded-2xl border border-[#278B70]/20 bg-[#D7EEE8]/85 px-5 py-4 shadow-[0_12px_30px_rgba(19,60,46,0.06)]">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#42B99A] text-[#07302A]">
        <LockIcon />
      </span>

      <div>
        <p className="font-black text-[#0B4A3B]">
          Vos propositions sont réservées
        </p>

        <p className="mt-1 text-sm leading-6 text-[#48665F]">
          Ces offres ont été générées pour votre
          Directeur Sportif et enregistrées pour la
          saison actuelle. Leurs budgets, durées et
          objectifs resteront identiques lors de vos
          prochaines visites.
        </p>
      </div>
    </aside>
  );
}

function SponsorOfferCard({
  offer,
}: {
  offer: PersistedSponsorOffer;
}) {
  const sponsor = offer.sponsor;

  return (
    <article
      className="relative flex h-full flex-col overflow-hidden rounded-2xl border bg-white shadow-[0_22px_55px_rgba(19,60,46,0.12)]"
      style={{
        borderColor: `${sponsor.colors.primary}55`,
        background: `linear-gradient(145deg, ${sponsor.colors.background} 0%, #FFFFFF 24%, #FFFFFF 76%, ${sponsor.colors.secondary}88 100%)`,
        boxShadow: `0 22px 55px ${sponsor.colors.primary}1C`,
      }}
    >
      <SponsorColorDecoration
        primaryColor={sponsor.colors.primary}
        secondaryColor={sponsor.colors.secondary}
        accentColor={sponsor.colors.accent}
      />

      <div
        aria-hidden="true"
        className="relative h-2 w-full"
        style={{
          background: `linear-gradient(90deg, ${sponsor.colors.primary}, ${sponsor.colors.accent}, ${sponsor.colors.secondary})`,
        }}
      />

      <div className="relative flex flex-1 flex-col p-6 sm:p-7">
        <div className="flex items-center justify-between gap-4">
          <span
            className="rounded-full border px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider"
            style={{
              borderColor: `${sponsor.colors.primary}44`,
              backgroundColor:
                sponsor.colors.background,
              color: sponsor.colors.text,
            }}
          >
            Offre ouverte
          </span>

          <CountryFlag
            isoAlpha2={sponsor.countryCode}
            countryName={getCountryName(
              sponsor.countryCode
            )}
          />
        </div>

        <div
          className="relative mt-5 flex min-h-36 items-center justify-center overflow-hidden rounded-2xl border bg-white/90 px-6 py-5"
          style={{
            borderColor: `${sponsor.colors.primary}30`,
            boxShadow: `inset 0 0 40px ${sponsor.colors.primary}0D`,
          }}
        >
          <span
            aria-hidden="true"
            className="absolute -left-10 -top-12 h-28 w-28 rounded-full opacity-10"
            style={{
              backgroundColor:
                sponsor.colors.primary,
            }}
          />

          <span
            aria-hidden="true"
            className="absolute -bottom-14 -right-8 h-32 w-32 rounded-full opacity-10"
            style={{
              backgroundColor:
                sponsor.colors.accent,
            }}
          />

          <div className="relative flex w-full justify-center">
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
        </div>

        <div className="mt-5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wider"
              style={{
                backgroundColor:
                  sponsor.colors.background,
                color: sponsor.colors.text,
              }}
            >
              {sponsor.sector}
            </span>

            <span
              className="rounded-full border bg-white/75 px-3 py-1 text-xs font-bold"
              style={{
                borderColor: `${sponsor.colors.primary}30`,
                color: sponsor.colors.primary,
              }}
            >
              Prestige {sponsor.prestige} / 5
            </span>
          </div>

          <h2
            className="mt-4 text-2xl font-black tracking-[-0.025em]"
            style={{
              color: sponsor.colors.text,
            }}
          >
            {sponsor.name}
          </h2>

          <p className="mt-3 leading-7 text-[#60756E]">
            {sponsor.description}
          </p>
        </div>

        <section className="mt-6 grid grid-cols-2 gap-3">
          <OfferMetric
            label="Budget annuel"
            value={formatMoney(
              offer.proposedBudget
            )}
            detail="Versé par saison"
            primaryColor={
              sponsor.colors.primary
            }
            backgroundColor={
              sponsor.colors.background
            }
          />

          <OfferMetric
            label="Durée proposée"
            value={formatDuration(
              offer.contractDurationSeasons
            )}
            detail="Contrat principal"
            primaryColor={
              sponsor.colors.primary
            }
            backgroundColor={
              sponsor.colors.background
            }
          />
        </section>

        <section
          className="mt-6 overflow-hidden rounded-xl border bg-white/85"
          style={{
            borderColor: `${sponsor.colors.primary}30`,
          }}
        >
          <div
            className="flex items-center justify-between gap-3 border-b px-4 py-3"
            style={{
              borderColor: `${sponsor.colors.primary}24`,
              background: `linear-gradient(90deg, ${sponsor.colors.background}, rgba(255,255,255,0.92))`,
            }}
          >
            <div>
              <p
                className="text-xs font-extrabold uppercase tracking-[0.15em]"
                style={{
                  color: sponsor.colors.primary,
                }}
              >
                Engagements sportifs
              </p>

              <h3
                className="mt-1 font-black"
                style={{
                  color: sponsor.colors.text,
                }}
              >
                {offer.objectives.length} objectifs
                saisonniers
              </h3>
            </div>

            <span
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-black"
              style={{
                backgroundColor:
                  sponsor.colors.primary,
                color: "#FFFFFF",
              }}
            >
              {offer.objectives.length}
            </span>
          </div>

          <ol className="grid gap-x-5 gap-y-2.5 px-4 py-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            {offer.objectives.map((objective) => (
              <SponsorObjectiveItem
                key={objective.id}
                objective={objective}
                accentColor={
                  sponsor.colors.accent
                }
                textColor={sponsor.colors.text}
              />
            ))}
          </ol>
        </section>

        <div className="mt-auto pt-7">
          <button
            type="button"
            disabled
            className="inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center rounded-xl border border-[#315B3E]/15 bg-[#EDF2EF] px-5 py-3 text-sm font-extrabold uppercase tracking-widest text-[#7A8C86]"
          >
            Signature bientôt disponible
          </button>

          <p className="mt-3 text-center text-xs font-semibold leading-5 text-[#7A8C86]">
            La sélection du maillot et la validation
            définitive du contrat seront ajoutées lors de
            la prochaine étape.
          </p>
        </div>
      </div>
    </article>
  );
}

function SponsorColorDecoration({
  primaryColor,
  secondaryColor,
  accentColor,
}: {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <span
        className="absolute -right-20 top-16 h-56 w-56 rounded-full opacity-[0.06]"
        style={{
          backgroundColor: primaryColor,
        }}
      />

      <span
        className="absolute -left-24 bottom-24 h-48 w-48 rounded-full opacity-[0.08]"
        style={{
          backgroundColor: accentColor,
        }}
      />

      <span
        className="absolute -right-8 bottom-52 h-px w-48 -rotate-12 opacity-70"
        style={{
          backgroundColor: secondaryColor,
        }}
      />
    </div>
  );
}

function OfferMetric({
  label,
  value,
  detail,
  primaryColor,
  backgroundColor,
}: {
  label: string;
  value: string;
  detail: string;
  primaryColor: string;
  backgroundColor: string;
}) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{
        borderColor: `${primaryColor}28`,
        backgroundColor,
      }}
    >
      <p
        className="text-xs font-extrabold uppercase tracking-[0.12em]"
        style={{
          color: primaryColor,
        }}
      >
        {label}
      </p>

      <p className="mt-2 text-lg font-black sm:text-xl">
        {value}
      </p>

      <p className="mt-1 text-xs font-semibold text-[#7A8C86]">
        {detail}
      </p>
    </div>
  );
}

function SponsorObjectiveItem({
  objective,
  accentColor,
  textColor,
}: {
  objective: PersistedSponsorObjective;
  accentColor: string;
  textColor: string;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        aria-hidden="true"
        className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
        style={{
          backgroundColor: accentColor,
        }}
      />

      <p
        className="text-sm font-bold leading-5"
        style={{
          color: textColor,
        }}
      >
        {objective.name}
      </p>
    </li>
  );
}

function OffersErrorMessage({
  message,
}: {
  message: string;
}) {
  return (
    <div className="mt-8 rounded-2xl border border-red-300 bg-red-50 px-5 py-5 text-red-900">
      <p className="font-black">
        Les offres de sponsoring n’ont pas pu être
        préparées.
      </p>

      <p className="mt-2 text-sm leading-6">
        {message}
      </p>
    </div>
  );
}

function EmptyOffers() {
  return (
    <div className="mt-8 rounded-2xl border border-[#315B3E]/20 bg-white/90 px-6 py-16 text-center shadow-[0_18px_44px_rgba(19,60,46,0.09)]">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#D7EEE8] text-[#176951]">
        <BriefcaseIcon />
      </div>

      <h2 className="mt-5 text-2xl font-black">
        Aucune offre disponible
      </h2>

      <p className="mx-auto mt-3 max-w-xl leading-7 text-[#60756E]">
        Aucun sponsor compatible avec votre réputation
        et votre situation actuelle n’a pu être proposé.
      </p>
    </div>
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
        className="text-2xl"
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

function BackIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12.5 4.5-5.5 5.5 5.5 5.5" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect
        x="5"
        y="10"
        width="14"
        height="10"
        rx="2"
      />

      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function BriefcaseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-8 w-8"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h16v12H4z" />
      <path d="M8 7V4h8v3" />
      <path d="M4 12h16" />
    </svg>
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Une erreur inattendue est survenue.";
}

function getCountryName(
  countryCode: string
): string {
  const countryNames: Record<string, string> = {
    BE: "Belgique",
    ES: "Espagne",
    FR: "France",
  };

  return (
    countryNames[countryCode.toUpperCase()] ??
    countryCode.toUpperCase()
  );
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDuration(value: number): string {
  return `${value} saison${value === 1 ? "" : "s"}`;
}

function formatOfferCount(value: number): string {
  return `${value} offre${value === 1 ? "" : "s"} disponible${value === 1 ? "" : "s"}`;
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