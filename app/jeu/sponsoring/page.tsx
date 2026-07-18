import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { WheelLogo } from "../../../components/ui/wheel-logo";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import {
  getOrCreateSponsorOffersForAuthUser,
  type PersistedSponsorOffer,
} from "../../../services/persisted-sponsor-offers";
import type {
  PersistedSponsorObjective,
  SponsorObjectivePriority,
} from "../../../types/sponsor-objective";
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
            <section className="mt-8 grid items-start gap-6 xl:grid-cols-3">
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

  const maximumRenewalBonus =
    offer.objectives.reduce(
      (total, objective) =>
        total + objective.renewalBonusPercent,
      0
    );

  return (
    <article
      className="relative overflow-hidden rounded-2xl border bg-white/95 shadow-[0_22px_55px_rgba(19,60,46,0.12)]"
      style={{
        borderColor: sponsor.colors.primary,
      }}
    >
      <div
        aria-hidden="true"
        className="h-2 w-full"
        style={{
          background: `linear-gradient(90deg, ${sponsor.colors.primary}, ${sponsor.colors.secondary}, ${sponsor.colors.accent})`,
        }}
      />

      <div className="p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <SponsorIdentity offer={offer} />

          <CountryFlag
            isoAlpha2={sponsor.countryCode}
            countryName={getCountryName(
              sponsor.countryCode
            )}
          />
        </div>

        <div className="mt-6">
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

            <span className="rounded-full bg-[#EDF2EF] px-3 py-1 text-xs font-bold text-[#60756E]">
              Prestige {sponsor.prestige} / 5
            </span>
          </div>

          <h2 className="mt-4 text-2xl font-black">
            {sponsor.name}
          </h2>

          <p className="mt-3 leading-7 text-[#60756E]">
            {sponsor.description}
          </p>
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <OfferMetric
            label="Budget annuel"
            value={formatMoney(
              offer.proposedBudget
            )}
            detail="Versé par saison"
          />

          <OfferMetric
            label="Durée proposée"
            value={formatDuration(
              offer.contractDurationSeasons
            )}
            detail="Contrat principal"
          />

          <OfferMetric
            label="Réputation requise"
            value={String(
              sponsor.minimumReputation
            )}
            detail="Points minimum"
          />

          <OfferMetric
            label="Bonus potentiel"
            value={`+${formatPercentage(
              maximumRenewalBonus
            )}`}
            detail="Si tous les objectifs sont remplis"
          />
        </section>

        <section className="mt-7 overflow-hidden rounded-xl border border-[#315B3E]/15">
          <div
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-4"
            style={{
              backgroundColor:
                sponsor.colors.background,
              color: sponsor.colors.text,
            }}
          >
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] opacity-75">
                Engagements sportifs
              </p>

              <h3 className="mt-1 text-lg font-black">
                {offer.objectives.length} objectifs
                saisonniers
              </h3>
            </div>

            <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-extrabold">
              +1 % chacun
            </span>
          </div>

          <ol className="divide-y divide-[#315B3E]/10">
            {offer.objectives.map((objective) => (
              <SponsorObjectiveItem
                key={objective.id}
                objective={objective}
                accentColor={
                  sponsor.colors.accent
                }
              />
            ))}
          </ol>
        </section>

        <button
          type="button"
          disabled
          className="mt-7 inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center rounded-xl border border-[#315B3E]/15 bg-[#EDF2EF] px-5 py-3 text-sm font-extrabold uppercase tracking-widest text-[#7A8C86]"
        >
          Signature bientôt disponible
        </button>

        <p className="mt-3 text-center text-xs font-semibold leading-5 text-[#7A8C86]">
          La sélection du maillot et la validation
          définitive du contrat seront ajoutées lors de
          la prochaine étape.
        </p>
      </div>
    </article>
  );
}

function SponsorIdentity({
  offer,
}: {
  offer: PersistedSponsorOffer;
}) {
  const sponsor = offer.sponsor;

  return (
    <div className="flex min-w-0 items-center gap-4">
      <div
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border text-lg font-black shadow-sm"
        style={{
          backgroundColor:
            sponsor.colors.background,
          borderColor:
            sponsor.colors.secondary,
          color: sponsor.colors.text,
        }}
      >
        {getSponsorInitials(
          sponsor.shortName || sponsor.name
        )}
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-black">
          {sponsor.shortName}
        </p>

        <p className="mt-1 text-xs font-bold uppercase tracking-widest text-[#7A8C86]">
          Offre ouverte
        </p>

        <div className="mt-2 flex items-center gap-1.5">
          {[
            sponsor.colors.primary,
            sponsor.colors.secondary,
            sponsor.colors.accent,
          ].map((color) => (
            <span
              key={color}
              className="h-3 w-3 rounded-full border border-black/10"
              style={{
                backgroundColor: color,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function OfferMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-[#315B3E]/15 bg-[#F6FAF8] p-4">
      <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#278B70]">
        {label}
      </p>

      <p className="mt-2 text-xl font-black">
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
}: {
  objective: PersistedSponsorObjective;
  accentColor: string;
}) {
  return (
    <li className="flex gap-3 bg-white px-4 py-4">
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black"
        style={{
          backgroundColor: accentColor,
          color: "#082A2A",
        }}
      >
        {objective.displayOrder}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="font-black leading-6">
            {objective.name}
          </p>

          <ObjectivePriorityBadge
            priority={objective.priority}
          />
        </div>

        <p className="mt-1 text-sm leading-6 text-[#60756E]">
          {objective.description}
        </p>
      </div>
    </li>
  );
}

function ObjectivePriorityBadge({
  priority,
}: {
  priority: SponsorObjectivePriority;
}) {
  const presentation: Record<
    SponsorObjectivePriority,
    {
      label: string;
      className: string;
    }
  > = {
    optional: {
      label: "Optionnel",
      className:
        "bg-[#EDF2EF] text-[#60756E]",
    },
    standard: {
      label: "Standard",
      className:
        "bg-[#D7EEE8] text-[#176951]",
    },
    important: {
      label: "Important",
      className:
        "bg-[#F2C94C]/25 text-[#7A5900]",
    },
    mandatory: {
      label: "Prioritaire",
      className:
        "bg-[#F3D7D7] text-[#9B3131]",
    },
  };

  return (
    <span
      className={[
        "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider",
        presentation[priority].className,
      ].join(" ")}
    >
      {presentation[priority].label}
    </span>
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

function getSponsorInitials(value: string): string {
  const initials = value
    .trim()
    .split(/[\s-]+/)
    .slice(0, 2)
    .map((part) =>
      part.charAt(0).toUpperCase()
    )
    .join("");

  return initials || "SP";
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

function formatPercentage(value: number): string {
  return `${new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 2,
  }).format(value)} %`;
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