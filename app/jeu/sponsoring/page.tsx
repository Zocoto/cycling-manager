import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { GameHeader } from "../../../components/game/game-header";
import { SponsorLogo } from "../../../components/game/sponsor-logo";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import type { PersistedSponsorOffer } from "../../../services/persisted-sponsor-offers";
import {
  getSponsoringStateForAuthUser,
  type PersistedSponsorContract,
  type SponsorContractObjective,
  type SponsoringState,
} from "../../../services/sponsoring-workflow";
import type { PersistedSponsorObjective } from "../../../types/sponsor-objective";
import {
  signSponsorOfferAction,
  terminateSponsorContractAction,
} from "./actions";
import { FutureSponsoringSection } from "./future-sponsoring-section";
import {
  ConfirmSponsorButton,
  SponsorJerseySelector,
  TerminateSponsorContractButton,
} from "./sponsoring-controls";

export const metadata: Metadata = {
  title: "Sponsoring",
  description:
    "Étudiez les propositions de sponsoring disponibles pour votre équipe dans Cyclostratège.",
};

type SponsoringPageProps = {
  searchParams?: Promise<{
    erreur?: string | string[];
    succes?: string | string[];
  }>;
};

export default async function SponsoringPage({
  searchParams,
}: SponsoringPageProps) {
  const resolvedSearchParams =
    searchParams
      ? await searchParams
      : {};

  const actionError = readSearchParameter(
    resolvedSearchParams.erreur
  );

  const actionSuccess =
    readSearchParameter(
      resolvedSearchParams.succes
    );

  const supabase =
    await createSupabaseServerClient();

  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  let sponsoringState: SponsoringState | null =
    null;

  let sponsoringError: string | null = null;

  try {
    sponsoringState =
      await getSponsoringStateForAuthUser(
        user.id
      );
  } catch (error) {
    console.error(
      "Impossible de récupérer l’état du sponsoring :",
      error
    );

    sponsoringError = getErrorMessage(error);
  }

  const availableOfferCount =
    sponsoringState?.kind === "offers"
      ? sponsoringState.offers.length
      : sponsoringState?.kind === "active" ||
          sponsoringState?.kind === "terminated"
        ? sponsoringState.future.kind === "offers"
          ? sponsoringState.future.offers.length
          : null
        : null;

  const headerSponsor =
    sponsoringState?.kind === "active" ||
    sponsoringState?.kind ===
      "jersey-selection"
      ? sponsoringState.contract.sponsor
      : null;

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        sponsor={headerSponsor}
        maxWidth="wide"
      />

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
                {getPageIntroduction(
                  sponsoringState
                )}
              </p>
            </div>

            {availableOfferCount !== null &&
            !sponsoringError ? (
              <div className="rounded-2xl border border-[#315B3E]/20 bg-white/85 px-5 py-4 text-right shadow-[0_14px_34px_rgba(19,60,46,0.08)]">
                <p className="text-2xl font-black">
                  {availableOfferCount}
                </p>

                <p className="mt-1 text-sm font-semibold text-[#60756E]">
                  {formatOfferCount(
                    availableOfferCount
                  )}
                </p>
              </div>
            ) : null}
          </header>

          {sponsoringState ? (
            <SponsoringStatusNotice
              state={sponsoringState}
            />
          ) : null}

          {actionSuccess === "rupture" ? (
            <ActionSuccessMessage />
          ) : null}

          {actionError ? (
            <ActionErrorMessage
              message={actionError}
            />
          ) : null}

          {sponsoringError ? (
            <SponsoringErrorMessage
              message={sponsoringError}
            />
          ) : null}

          {!sponsoringError &&
          sponsoringState?.kind === "offers" &&
          sponsoringState.offers.length ===
            0 ? (
            <EmptyOffers />
          ) : null}

          {!sponsoringError &&
          sponsoringState?.kind === "offers" &&
          sponsoringState.offers.length > 0 ? (
            <OffersSection
              offers={sponsoringState.offers}
            />
          ) : null}

          {!sponsoringError &&
          sponsoringState?.kind ===
            "jersey-selection" ? (
            <JerseySelectionSection
              contract={
                sponsoringState.contract
              }
            />
          ) : null}

          {!sponsoringError &&
          sponsoringState?.kind === "active" ? (
            <>
              <ActiveSponsorSection
                contract={
                  sponsoringState.contract
                }
              />

              <FutureSponsoringSection
                state={sponsoringState.future}
              />
            </>
          ) : null}

          {!sponsoringError &&
          sponsoringState?.kind ===
            "terminated" ? (
            <>
              <TerminatedSponsorSection
                contract={
                  sponsoringState.contract
                }
              />

              <FutureSponsoringSection
                state={sponsoringState.future}
              />
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function SponsoringStatusNotice({
  state,
}: {
  state: SponsoringState;
}) {
  if (state.kind === "jersey-selection") {
    return (
      <aside className="mt-8 flex items-start gap-4 rounded-2xl border border-[#D99A32]/30 bg-[#FFF4D6]/90 px-5 py-4 shadow-[0_12px_30px_rgba(102,72,18,0.07)]">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F2C94C] text-[#40320A]">
          <JerseyIcon />
        </span>

        <div>
          <p className="font-black text-[#604B0F]">
            Votre sponsor est signé
          </p>

          <p className="mt-1 text-sm leading-6 text-[#715F2A]">
            Le contrat avec{" "}
            <strong>
              {state.contract.sponsor.name}
            </strong>{" "}
            est enregistré. Sélectionnez maintenant
            l’un des trois maillots proposés pour
            activer définitivement le partenariat et
            recevoir le budget sponsor.
          </p>
        </div>
      </aside>
    );
  }

  if (state.kind === "terminated") {
    return (
      <aside className="mt-8 flex items-start gap-4 rounded-2xl border border-red-300 bg-red-50/95 px-5 py-4 shadow-[0_12px_30px_rgba(127,29,29,0.07)]">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-700 text-white">
          <BrokenContractIcon />
        </span>

        <div>
          <p className="font-black text-red-900">
            Votre contrat a été rompu
          </p>

          <p className="mt-1 text-sm leading-6 text-red-800">
            Le partenariat avec{" "}
            <strong>
              {state.contract.sponsor.name}
            </strong>{" "}
            est terminé. Votre équipe a retrouvé son
            identité amateur. Aucune nouvelle signature
            ne peut activer un sponsor pendant la saison
            en cours ; les offres pour la saison suivante
            ouvrent à partir du jour 21.
          </p>
        </div>
      </aside>
    );
  }

  if (state.kind === "active") {
    return (
      <aside className="mt-8 flex items-start gap-4 rounded-2xl border border-[#278B70]/25 bg-[#D7EEE8]/90 px-5 py-4 shadow-[0_12px_30px_rgba(19,60,46,0.06)]">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#42B99A] text-[#07302A]">
          <CheckIcon />
        </span>

        <div>
          <p className="font-black text-[#0B4A3B]">
            Votre partenariat est actif
          </p>

          <p className="mt-1 text-sm leading-6 text-[#48665F]">
            Le sponsor principal, le maillot et le
            budget de votre équipe sont désormais
            enregistrés pour la saison en cours.
          </p>
        </div>
      </aside>
    );
  }

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

function OffersSection({
  offers,
}: {
  offers: PersistedSponsorOffer[];
}) {
  return (
    <>
      <section className="mt-8 grid items-stretch gap-6 xl:grid-cols-3">
        {offers.map((offer) => (
          <SponsorOfferCard
            key={offer.id}
            offer={offer}
          />
        ))}
      </section>

      <p className="mt-6 text-sm leading-7 text-[#60756E]">
        Les objectifs de cette première version
        utilisent des courses et classements
        provisoires. Ils sont enregistrés avec
        l’offre et ne changent pas au rechargement
        de la page. Ils seront reliés au calendrier
        sportif réel dans une future évolution.
      </p>
    </>
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
        secondaryColor={
          sponsor.colors.secondary
        }
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
            {offer.objectives.map(
              (objective) => (
                <SponsorObjectiveItem
                  key={objective.id}
                  objective={objective}
                  accentColor={
                    sponsor.colors.accent
                  }
                  textColor={
                    sponsor.colors.text
                  }
                />
              )
            )}
          </ol>
        </section>

        <div className="mt-auto pt-7">
          <form
            action={signSponsorOfferAction}
          >
            <input
              type="hidden"
              name="offerId"
              value={offer.id}
            />

            <ConfirmSponsorButton
              sponsorName={sponsor.name}
              budgetLabel={formatMoney(
                offer.proposedBudget
              )}
              durationLabel={formatDuration(
                offer.contractDurationSeasons
              )}
              objectives={offer.objectives.map(
                (objective) => objective.name
              )}
            />
          </form>

          <p className="mt-3 text-center text-xs font-semibold leading-5 text-[#7A8C86]">
            La signature est définitive. Les deux
            autres propositions seront retirées et le
            choix du maillot sera demandé
            immédiatement après.
          </p>
        </div>
      </div>
    </article>
  );
}

function JerseySelectionSection({
  contract,
}: {
  contract: PersistedSponsorContract;
}) {
  const sponsor = contract.sponsor;

  return (
    <section className="mt-8">
      <div
        className="overflow-hidden rounded-2xl border bg-white shadow-[0_22px_55px_rgba(19,60,46,0.12)]"
        style={{
          borderColor: `${sponsor.colors.primary}45`,
          background: `linear-gradient(145deg, ${sponsor.colors.background}, #FFFFFF 38%, #FFFFFF)`,
        }}
      >
        <div
          aria-hidden="true"
          className="h-2 w-full"
          style={{
            background: `linear-gradient(90deg, ${sponsor.colors.primary}, ${sponsor.colors.accent}, ${sponsor.colors.secondary})`,
          }}
        />

        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[320px_1fr]">
          <div
            className="flex min-h-52 items-center justify-center rounded-2xl border bg-white/90 p-6"
            style={{
              borderColor: `${sponsor.colors.primary}28`,
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

          <div>
            <p
              className="text-xs font-extrabold uppercase tracking-[0.18em]"
              style={{
                color: sponsor.colors.primary,
              }}
            >
              Contrat signé
            </p>

            <h2
              className="mt-3 text-3xl font-black tracking-[-0.03em]"
              style={{
                color: sponsor.colors.text,
              }}
            >
              Choisissez le maillot de{" "}
              {sponsor.name}
            </h2>

            <p className="mt-4 max-w-3xl leading-7 text-[#60756E]">
              Votre accord avec ce sponsor est
              enregistré. Vous disposez de trois
              propositions visuelles : une version
              classique, une version moderne et une
              version plus audacieuse.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <ContractMetric
                label="Budget annuel"
                value={formatMoney(
                  contract.budgetPerSeason,
                  contract.currencyCode
                )}
                detail="Versé après validation du maillot"
                primaryColor={
                  sponsor.colors.primary
                }
                backgroundColor={
                  sponsor.colors.background
                }
              />

              <ContractMetric
                label="Durée du contrat"
                value={formatDuration(
                  contract.contractDurationSeasons
                )}
                detail="Sponsor principal"
                primaryColor={
                  sponsor.colors.primary
                }
                backgroundColor={
                  sponsor.colors.background
                }
              />
            </div>
          </div>
        </div>
      </div>

      <SponsorJerseySelector
        contractId={contract.id}
        sponsor={sponsor}
      />

      <ContractObjectivesSection
        contract={contract}
      />
    </section>
  );
}

function ActiveSponsorSection({
  contract,
}: {
  contract: PersistedSponsorContract;
}) {
  const sponsor = contract.sponsor;

  const selectedJersey =
    sponsor.jerseys.find(
      (jersey) =>
        jersey.id ===
        contract.selectedJerseyId
    ) ?? null;

  return (
    <section className="mt-8">
      <article
        className="relative overflow-hidden rounded-2xl border bg-white shadow-[0_24px_60px_rgba(19,60,46,0.13)]"
        style={{
          borderColor: `${sponsor.colors.primary}50`,
          background: `linear-gradient(145deg, ${sponsor.colors.background}, #FFFFFF 32%, #FFFFFF 70%, ${sponsor.colors.secondary}66)`,
        }}
      >
        <SponsorColorDecoration
          primaryColor={
            sponsor.colors.primary
          }
          secondaryColor={
            sponsor.colors.secondary
          }
          accentColor={sponsor.colors.accent}
        />

        <div
          aria-hidden="true"
          className="relative h-2 w-full"
          style={{
            background: `linear-gradient(90deg, ${sponsor.colors.primary}, ${sponsor.colors.accent}, ${sponsor.colors.secondary})`,
          }}
        />

        <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[340px_1fr]">
          <div
            className="flex min-h-64 items-center justify-center rounded-2xl border bg-white/90 p-7"
            style={{
              borderColor: `${sponsor.colors.primary}30`,
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

          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className="rounded-full px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider"
                style={{
                  backgroundColor:
                    sponsor.colors.primary,
                  color: "#FFFFFF",
                }}
              >
                Sponsor actif
              </span>

              <CountryFlag
                isoAlpha2={sponsor.countryCode}
                countryName={getCountryName(
                  sponsor.countryCode
                )}
              />
            </div>

            <h2
              className="mt-5 text-4xl font-black tracking-[-0.04em]"
              style={{
                color: sponsor.colors.text,
              }}
            >
              {sponsor.name}
            </h2>

            <p className="mt-3 text-sm font-extrabold uppercase tracking-[0.15em] text-[#60756E]">
              {sponsor.sector} · Prestige{" "}
              {sponsor.prestige} / 5
            </p>

            <p className="mt-5 max-w-3xl leading-7 text-[#60756E]">
              {sponsor.description}
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <ContractMetric
                label="Budget annuel"
                value={formatMoney(
                  contract.budgetPerSeason,
                  contract.currencyCode
                )}
                detail="Budget sponsor actif"
                primaryColor={
                  sponsor.colors.primary
                }
                backgroundColor={
                  sponsor.colors.background
                }
              />

              <ContractMetric
                label="Durée"
                value={formatDuration(
                  contract.contractDurationSeasons
                )}
                detail="Contrat principal"
                primaryColor={
                  sponsor.colors.primary
                }
                backgroundColor={
                  sponsor.colors.background
                }
              />

              <ContractMetric
                label="Maillot retenu"
                value={
                  selectedJersey?.name ??
                  "Maillot validé"
                }
                detail={
                  selectedJersey
                    ? formatJerseyStyle(
                        selectedJersey.style
                      )
                    : "Modèle enregistré"
                }
                primaryColor={
                  sponsor.colors.primary
                }
                backgroundColor={
                  sponsor.colors.background
                }
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm font-semibold text-[#60756E]">
              {contract.signedAt ? (
                <p>
                  Signature :{" "}
                  <strong className="text-[#294B42]">
                    {formatDate(
                      contract.signedAt
                    )}
                  </strong>
                </p>
              ) : null}

              {contract.activatedAt ? (
                <p>
                  Activation :{" "}
                  <strong className="text-[#294B42]">
                    {formatDate(
                      contract.activatedAt
                    )}
                  </strong>
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </article>

      <ContractObjectivesSection
        contract={contract}
      />

      <aside className="mt-6 rounded-2xl border border-[#315B3E]/15 bg-white/80 px-5 py-4 text-sm leading-7 text-[#60756E]">
        Le suivi sportif détaillé des objectifs sera
        connecté aux courses, résultats et classements
        lors de la future US de complétude des
        objectifs sponsors.
      </aside>

      <EarlyTerminationSection
        contract={contract}
      />
    </section>
  );
}

function EarlyTerminationSection({
  contract,
}: {
  contract: PersistedSponsorContract;
}) {
  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-red-300 bg-red-50/90 shadow-[0_18px_44px_rgba(127,29,29,0.08)]">
      <div className="border-b border-red-200 bg-red-100/80 px-5 py-4 sm:px-6">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-red-700">
          Décision exceptionnelle
        </p>

        <h2 className="mt-1 text-xl font-black text-red-950">
          Rupture anticipée du contrat
        </h2>
      </div>

      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_360px] lg:items-center">
        <div>
          <p className="leading-7 text-red-900">
            Vous pouvez mettre immédiatement fin au
            partenariat avec{" "}
            <strong>
              {contract.sponsor.name}
            </strong>
            . Cette décision retire le sponsor et son
            maillot de votre équipe.
          </p>

          <ul className="mt-4 grid gap-2 text-sm font-semibold leading-6 text-red-800">
            <li>
              • Pénalité immédiate de 10 points de
              réputation, avec un minimum final de 0.
            </li>

            <li>
              • Les objectifs non atteints seront
              considérés comme échoués.
            </li>

            <li>
              • Le budget déjà versé reste acquis à
              l’équipe.
            </li>

            <li>
              • Aucune nouvelle offre avant la saison
              suivante.
            </li>
          </ul>
        </div>

        <form
          action={
            terminateSponsorContractAction
          }
          className="rounded-xl border border-red-200 bg-white p-4"
        >
          <input
            type="hidden"
            name="contractId"
            value={contract.id}
          />

          <TerminateSponsorContractButton
            sponsorName={
              contract.sponsor.name
            }
            reputationPenalty={10}
          />

          <p className="mt-3 text-center text-xs font-semibold leading-5 text-red-700">
            Cette opération est irréversible.
          </p>
        </form>
      </div>
    </section>
  );
}

function TerminatedSponsorSection({
  contract,
}: {
  contract: PersistedSponsorContract;
}) {
  const sponsor = contract.sponsor;

  const selectedJersey =
    sponsor.jerseys.find(
      (jersey) =>
        jersey.id ===
        contract.selectedJerseyId
    ) ?? null;

  return (
    <section className="mt-8">
      <article
        className="overflow-hidden rounded-2xl border border-red-300 bg-white shadow-[0_22px_55px_rgba(127,29,29,0.1)]"
      >
        <div className="h-2 w-full bg-red-700" />

        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[320px_1fr]">
          <div className="flex min-h-56 items-center justify-center rounded-2xl border border-red-200 bg-red-50/60 p-6 opacity-80 grayscale-[0.25]">
            <SponsorLogo
              src={sponsor.logoPath}
              alt={`Ancien logo de ${sponsor.name}`}
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

          <div>
            <span className="inline-flex rounded-full bg-red-100 px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider text-red-800">
              Contrat rompu
            </span>

            <h2 className="mt-4 text-3xl font-black tracking-[-0.03em] text-red-950">
              {sponsor.name}
            </h2>

            <p className="mt-3 leading-7 text-[#60756E]">
              Ce sponsor n’est plus associé à votre
              équipe. Le contrat reste conservé dans
              votre historique avec son budget, son
              maillot et ses objectifs.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <ContractMetric
                label="Budget annuel"
                value={formatMoney(
                  contract.budgetPerSeason,
                  contract.currencyCode
                )}
                detail="Budget déjà versé et conservé"
                primaryColor="#B91C1C"
                backgroundColor="#FEF2F2"
              />

              <ContractMetric
                label="Ancien maillot"
                value={
                  selectedJersey?.name ??
                  "Maillot enregistré"
                }
                detail={
                  selectedJersey
                    ? formatJerseyStyle(
                        selectedJersey.style
                      )
                    : "Modèle archivé"
                }
                primaryColor="#B91C1C"
                backgroundColor="#FEF2F2"
              />

              <ContractMetric
                label="Pénalité"
                value={`-${contract.reputationPenalty} points`}
                detail="Réputation du Directeur Sportif"
                primaryColor="#B91C1C"
                backgroundColor="#FEF2F2"
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm font-semibold text-[#60756E]">
              {contract.terminatedAt ? (
                <p>
                  Rupture :{" "}
                  <strong className="text-red-900">
                    {formatDate(
                      contract.terminatedAt
                    )}
                  </strong>
                </p>
              ) : null}

              <p>
                Motif :{" "}
                <strong className="text-red-900">
                  {formatTerminationReason(
                    contract.terminationReason
                  )}
                </strong>
              </p>
            </div>
          </div>
        </div>
      </article>

      <ContractObjectivesSection
        contract={contract}
      />

      <aside className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm leading-7 text-amber-950">
        Votre équipe évolue désormais sous son identité
        amateur. À partir du jour 21, de nouvelles
        propositions pourront être signées uniquement
        pour la saison suivante. Leur activation restera
        différée jusqu’au jour 1.
      </aside>
    </section>
  );
}

function ContractObjectivesSection({
  contract,
}: {
  contract: PersistedSponsorContract;
}) {
  const sponsor = contract.sponsor;

  return (
    <section
      className="mt-8 overflow-hidden rounded-2xl border bg-white/90 shadow-[0_18px_44px_rgba(19,60,46,0.08)]"
      style={{
        borderColor: `${sponsor.colors.primary}30`,
      }}
    >
      <div
        className="flex flex-wrap items-center justify-between gap-4 border-b px-5 py-4 sm:px-6"
        style={{
          borderColor: `${sponsor.colors.primary}24`,
          background: `linear-gradient(90deg, ${sponsor.colors.background}, rgba(255,255,255,0.94))`,
        }}
      >
        <div>
          <p
            className="text-xs font-extrabold uppercase tracking-[0.16em]"
            style={{
              color: sponsor.colors.primary,
            }}
          >
            Engagements contractuels
          </p>

          <h2
            className="mt-1 text-xl font-black"
            style={{
              color: sponsor.colors.text,
            }}
          >
            {contract.objectives.length} objectifs
            saisonniers
          </h2>
        </div>

        <span
          className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-black"
          style={{
            backgroundColor:
              sponsor.colors.primary,
            color: "#FFFFFF",
          }}
        >
          {contract.objectives.length}
        </span>
      </div>

      <ol className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
        {contract.objectives.map(
          (objective) => (
            <ContractObjectiveItem
              key={objective.id}
              objective={objective}
              accentColor={
                sponsor.colors.accent
              }
              textColor={sponsor.colors.text}
            />
          )
        )}
      </ol>
    </section>
  );
}

function ContractObjectiveItem({
  objective,
  accentColor,
  textColor,
}: {
  objective: SponsorContractObjective;
  accentColor: string;
  textColor: string;
}) {
  return (
    <li className="flex items-start gap-3 rounded-xl border border-[#315B3E]/10 bg-white/75 px-4 py-3">
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black"
        style={{
          backgroundColor: `${accentColor}25`,
          color: textColor,
        }}
      >
        {objective.displayOrder}
      </span>

      <div>
        <p
          className="text-sm font-black leading-5"
          style={{
            color: textColor,
          }}
        >
          {objective.name}
        </p>

        <p className="mt-1 text-xs font-semibold text-[#7A8C86]">
          {formatObjectiveStatus(
            objective.status
          )}
        </p>
      </div>
    </li>
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

function ContractMetric({
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

      <p className="mt-2 text-lg font-black">
        {value}
      </p>

      <p className="mt-1 text-xs font-semibold leading-5 text-[#7A8C86]">
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

function ActionSuccessMessage() {
  return (
    <div
      role="status"
      className="mt-8 rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-5 text-emerald-950"
    >
      <p className="font-black">
        Le contrat sponsor a été rompu.
      </p>

      <p className="mt-2 text-sm leading-6">
        L’identité amateur de votre équipe a été
        restaurée et la pénalité de réputation a été
        appliquée.
      </p>
    </div>
  );
}

function ActionErrorMessage({
  message,
}: {
  message: string;
}) {
  return (
    <div
      role="alert"
      className="mt-8 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-5 text-amber-950"
    >
      <p className="font-black">
        L’opération n’a pas pu être réalisée.
      </p>

      <p className="mt-2 text-sm leading-6">
        {message}
      </p>
    </div>
  );
}

function SponsoringErrorMessage({
  message,
}: {
  message: string;
}) {
  return (
    <div
      role="alert"
      className="mt-8 rounded-2xl border border-red-300 bg-red-50 px-5 py-5 text-red-900"
    >
      <p className="font-black">
        L’espace sponsoring n’a pas pu être préparé.
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
        Aucun sponsor compatible avec votre
        réputation et votre situation actuelle n’a pu
        être proposé.
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

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function JerseyIcon() {
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
      <path d="m8 4-4 2-2 5 4 2v7h12v-7l4-2-2-5-4-2-2 3h-4Z" />
    </svg>
  );
}

function BrokenContractIcon() {
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
      <path d="m8 4-4 2-2 5 4 2v7h5" />
      <path d="m16 4 4 2 2 5-4 2v2" />
      <path d="m10 7 2 3 2-3" />
      <path d="m14 15-5 5" />
      <path d="m9 15 5 5" />
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

function readSearchParameter(
  value: string | string[] | undefined
): string | null {
  if (typeof value === "string") {
    return value.trim() || null;
  }

  if (Array.isArray(value)) {
    return value[0]?.trim() || null;
  }

  return null;
}

function getPageIntroduction(
  state: SponsoringState | null
): string {
  if (state?.kind === "jersey-selection") {
    return "Votre contrat est signé. Choisissez maintenant l’identité visuelle que votre équipe portera pendant toute la durée du partenariat.";
  }

  if (state?.kind === "active") {
    return "Consultez votre sponsor principal et préparez, lorsque la fenêtre J21–J28 est ouverte, le partenariat de la saison suivante.";
  }

  if (state?.kind === "terminated") {
    return "Consultez l’historique du contrat rompu et préparez un nouveau partenaire pour la saison suivante à partir du jour 21.";
  }

  return "Comparez les budgets, les durées de contrat et les objectifs proposés avant de choisir le partenaire principal de votre équipe.";
}

function getErrorMessage(
  error: unknown
): string {
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

function formatMoney(
  value: number,
  currencyCode = "EUR"
): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDuration(value: number): string {
  return `${value} saison${value === 1 ? "" : "s"}`;
}

function formatOfferCount(value: number): string {
  return `${value} offre${value === 1 ? "" : "s"} disponible${value === 1 ? "" : "s"}`;
}

function formatJerseyStyle(
  style: "classic" | "modern" | "bold"
): string {
  const labels = {
    classic: "Style classique",
    modern: "Style moderne",
    bold: "Style audacieux",
  };

  return labels[style];
}

function formatObjectiveStatus(
  status: string
): string {
  const labels: Record<string, string> = {
    draft: "Objectif en préparation",
    active: "Suivi disponible prochainement",
    completed: "Objectif terminé",
    cancelled: "Annulé après la rupture",
  };

  return (
    labels[status] ??
    "Statut de l’objectif indisponible"
  );
}

function formatTerminationReason(
  reason: string | null
): string {
  if (
    reason ===
    "director_early_termination"
  ) {
    return "Rupture anticipée par le Directeur Sportif";
  }

  return reason
    ? reason
    : "Motif non renseigné";
}

function formatDate(value: string): string {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Date inconnue";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(parsedDate);
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