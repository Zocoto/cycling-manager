import { SponsorJerseyPreview } from "@/components/game/sponsor-jersey-preview";
import { SponsorLogo } from "@/components/game/sponsor-logo";
import type { PersistedSponsorOffer } from "@/services/persisted-sponsor-offers";
import type {
  FutureSponsoringState,
  PersistedSponsorContract,
} from "@/services/sponsoring-workflow";

import { signSponsorOfferAction } from "./actions";
import {
  ConfirmSponsorButton,
  SponsorJerseySelector,
} from "./sponsoring-controls";

export function FutureSponsoringSection({
  state,
}: {
  state: FutureSponsoringState;
}) {
  return (
    <section className="mt-10 border-t border-[#315B3E]/15 pt-10">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
            Préparation de la saison suivante
          </p>

          <h2 className="mt-3 text-3xl font-black tracking-[-0.035em]">
            {getFutureSectionTitle(state)}
          </h2>

          <p className="mt-3 max-w-3xl leading-7 text-[#60756E]">
            {getFutureSectionIntroduction(state)}
          </p>
        </div>

        <span className="rounded-full border border-[#278B70]/25 bg-[#D7EEE8] px-4 py-2 text-sm font-black text-[#0B4A3B]">
          {getTargetSeasonName(state)}
        </span>
      </header>

      {state.kind === "locked" ? (
        <FutureLockedNotice state={state} />
      ) : null}

      {state.kind === "continuing" ? (
        <ContinuingContractNotice state={state} />
      ) : null}

      {state.kind === "offers" ? (
        <FutureOffersSection state={state} />
      ) : null}

      {state.kind === "jersey-selection" ? (
        <FutureJerseySelection state={state} />
      ) : null}

      {state.kind === "planned" ? (
        <FuturePlannedContract state={state} />
      ) : null}
    </section>
  );
}

function FutureLockedNotice({
  state,
}: {
  state: Extract<FutureSponsoringState, { kind: "locked" }>;
}) {
  const remainingDays = Math.max(
    state.opensOnDay - state.currentDayNumber,
    0
  );

  return (
    <aside className="mt-7 rounded-2xl border border-amber-300 bg-amber-50 px-6 py-5 text-amber-950 shadow-[0_14px_34px_rgba(120,83,20,0.06)]">
      <p className="font-black">
        La fenêtre de sponsoring ouvrira au jour {state.opensOnDay}.
      </p>

      <p className="mt-2 leading-7">
        Vous êtes actuellement au jour {state.currentDayNumber}. Les offres
        destinées à {state.targetSeasonName} seront accessibles dans{" "}
        {remainingDays} jour{remainingDays === 1 ? "" : "s"}. Aucune
        signature ne peut activer un nouveau sponsor pendant la saison en
        cours.
      </p>
    </aside>
  );
}

function ContinuingContractNotice({
  state,
}: {
  state: Extract<
    FutureSponsoringState,
    { kind: "continuing" }
  >;
}) {
  return (
    <aside className="mt-7 rounded-2xl border border-[#278B70]/25 bg-[#D7EEE8]/85 px-6 py-5 text-[#0B4A3B] shadow-[0_14px_34px_rgba(19,60,46,0.06)]">
      <p className="font-black">
        Votre contrat actuel couvre déjà {state.targetSeasonName}.
      </p>

      <p className="mt-2 leading-7 text-[#48665F]">
        Aucun renouvellement n’est nécessaire cette saison. Le partenariat
        en cours reste valable jusqu’à la fin de la saison{" "}
        {state.contractEndGameYear}. Le prochain versement annuel et la
        continuité de l’identité commerciale seront traités lors du passage
        à la nouvelle saison.
      </p>
    </aside>
  );
}

function FutureOffersSection({
  state,
}: {
  state: Extract<FutureSponsoringState, { kind: "offers" }>;
}) {
  return (
    <>
      <aside className="mt-7 rounded-2xl border border-[#278B70]/20 bg-white/85 px-5 py-4 text-sm leading-7 text-[#48665F] shadow-[0_12px_30px_rgba(19,60,46,0.05)]">
        {state.mode === "renewal" ? (
          <>
            Une proposition de renouvellement de votre sponsor actuel est
            garantie. Les deux autres offres permettent de changer de
            partenaire pour {state.season.name}.
          </>
        ) : (
          <>
            Trois nouveaux partenaires sont proposés pour{" "}
            {state.season.name}. Le sponsor rompu pendant la saison actuelle
            est exclu de ce lot.
          </>
        )}
      </aside>

      <div className="mt-7 grid items-stretch gap-6 xl:grid-cols-3">
        {state.offers.map((offer) => (
          <FutureSponsorOfferCard
            key={offer.id}
            offer={offer}
            targetSeasonName={state.season.name}
          />
        ))}
      </div>

      <p className="mt-5 text-sm leading-7 text-[#60756E]">
        La signature prépare uniquement la saison suivante. Le budget, le
        nom commercial et le maillot ne seront appliqués qu’au jour 1 de{" "}
        {state.season.name}.
      </p>
    </>
  );
}

function FutureSponsorOfferCard({
  offer,
  targetSeasonName,
}: {
  offer: PersistedSponsorOffer;
  targetSeasonName: string;
}) {
  const sponsor = offer.sponsor;

  return (
    <article
      className="relative flex h-full flex-col overflow-hidden rounded-2xl border bg-white shadow-[0_20px_50px_rgba(19,60,46,0.1)]"
      style={{
        borderColor: `${sponsor.colors.primary}45`,
        background: `linear-gradient(145deg, ${sponsor.colors.background}, #FFFFFF 34%, #FFFFFF 78%, ${sponsor.colors.secondary}66)`,
      }}
    >
      <div
        aria-hidden="true"
        className="h-2 w-full"
        style={{
          background: `linear-gradient(90deg, ${sponsor.colors.primary}, ${sponsor.colors.accent}, ${sponsor.colors.secondary})`,
        }}
      />

      <div className="flex flex-1 flex-col p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span
            className="rounded-full px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider"
            style={{
              backgroundColor: sponsor.colors.background,
              color: sponsor.colors.text,
            }}
          >
            {offer.isRenewal
              ? "Renouvellement garanti"
              : "Offre saison suivante"}
          </span>

          <span className="text-xs font-black uppercase tracking-wider text-[#60756E]">
            {targetSeasonName}
          </span>
        </div>

        <div
          className="mt-5 flex min-h-36 items-center justify-center rounded-2xl border bg-white/90 p-5"
          style={{
            borderColor: `${sponsor.colors.primary}28`,
          }}
        >
          <SponsorLogo
            src={sponsor.logoPath}
            alt={`Logo de ${sponsor.name}`}
            sponsorName={sponsor.name}
            primaryColor={sponsor.colors.primary}
            backgroundColor={sponsor.colors.background}
            textColor={sponsor.colors.text}
          />
        </div>

        <p
          className="mt-5 text-xs font-extrabold uppercase tracking-[0.15em]"
          style={{ color: sponsor.colors.primary }}
        >
          {sponsor.sector} · Prestige {sponsor.prestige} / 5
        </p>

        <h3
          className="mt-2 text-2xl font-black tracking-[-0.025em]"
          style={{ color: sponsor.colors.text }}
        >
          {sponsor.name}
        </h3>

        <p className="mt-3 leading-7 text-[#60756E]">
          {sponsor.description}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <FutureMetric
            label="Budget annuel"
            value={formatMoney(offer.proposedBudget)}
            sponsor={sponsor}
          />

          <FutureMetric
            label="Durée"
            value={formatDuration(
              offer.contractDurationSeasons
            )}
            sponsor={sponsor}
          />
        </div>

        <section
          className="mt-5 rounded-xl border bg-white/80 p-4"
          style={{
            borderColor: `${sponsor.colors.primary}25`,
          }}
        >
          <p
            className="text-xs font-extrabold uppercase tracking-[0.14em]"
            style={{ color: sponsor.colors.primary }}
          >
            7 engagements pour la future saison
          </p>

          <ol className="mt-3 space-y-2.5">
            {offer.objectives.map((objective, index) => (
              <li
                key={objective.id}
                className="flex items-start gap-2.5 text-sm font-bold leading-5"
                style={{ color: sponsor.colors.text }}
              >
                <span
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black"
                  style={{
                    backgroundColor: `${sponsor.colors.accent}2A`,
                  }}
                >
                  {index + 1}
                </span>

                <span>{objective.name}</span>
              </li>
            ))}
          </ol>
        </section>

        <div className="mt-auto pt-6">
          <form action={signSponsorOfferAction}>
            <input
              type="hidden"
              name="offerId"
              value={offer.id}
            />

            <ConfirmSponsorButton
              sponsorName={sponsor.name}
              budgetLabel={formatMoney(offer.proposedBudget)}
              durationLabel={formatDuration(
                offer.contractDurationSeasons
              )}
              objectives={offer.objectives.map(
                (objective) => objective.name
              )}
              signatureMode="next-season"
              targetSeasonName={targetSeasonName}
            />
          </form>
        </div>
      </div>
    </article>
  );
}

function FutureJerseySelection({
  state,
}: {
  state: Extract<
    FutureSponsoringState,
    { kind: "jersey-selection" }
  >;
}) {
  const contract = state.contract;
  const sponsor = contract.sponsor;

  return (
    <div className="mt-7">
      <article
        className="overflow-hidden rounded-2xl border bg-white shadow-[0_20px_50px_rgba(19,60,46,0.1)]"
        style={{
          borderColor: `${sponsor.colors.primary}45`,
          background: `linear-gradient(145deg, ${sponsor.colors.background}, #FFFFFF 42%)`,
        }}
      >
        <div
          aria-hidden="true"
          className="h-2 w-full"
          style={{
            background: `linear-gradient(90deg, ${sponsor.colors.primary}, ${sponsor.colors.accent}, ${sponsor.colors.secondary})`,
          }}
        />

        <div className="grid gap-7 p-6 sm:p-8 lg:grid-cols-[280px_1fr]">
          <div className="flex min-h-48 items-center justify-center rounded-2xl border border-black/10 bg-white/90 p-5">
            <SponsorLogo
              src={sponsor.logoPath}
              alt={`Logo de ${sponsor.name}`}
              sponsorName={sponsor.name}
              primaryColor={sponsor.colors.primary}
              backgroundColor={sponsor.colors.background}
              textColor={sponsor.colors.text}
            />
          </div>

          <div>
            <p
              className="text-xs font-extrabold uppercase tracking-[0.16em]"
              style={{ color: sponsor.colors.primary }}
            >
              Contrat futur signé
            </p>

            <h3
              className="mt-3 text-3xl font-black tracking-[-0.035em]"
              style={{ color: sponsor.colors.text }}
            >
              Choisissez le maillot de {sponsor.name}
            </h3>

            <p className="mt-4 leading-7 text-[#60756E]">
              Le contrat est réservé pour {state.season.name}. Le modèle
              choisi sera enregistré maintenant, mais le sponsor, le budget
              et l’identité commerciale ne seront activés qu’au jour 1 de la
              future saison.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <FutureMetric
                label="Budget annuel futur"
                value={formatMoney(
                  contract.budgetPerSeason,
                  contract.currencyCode
                )}
                sponsor={sponsor}
              />

              <FutureMetric
                label="Durée future"
                value={formatDuration(
                  contract.contractDurationSeasons
                )}
                sponsor={sponsor}
              />
            </div>
          </div>
        </div>
      </article>

      <SponsorJerseySelector
        contractId={contract.id}
        sponsor={sponsor}
        activationMode="next-season"
        targetSeasonName={state.season.name}
      />
    </div>
  );
}

function FuturePlannedContract({
  state,
}: {
  state: Extract<FutureSponsoringState, { kind: "planned" }>;
}) {
  const contract = state.contract;
  const sponsor = contract.sponsor;
  const selectedJersey = sponsor.jerseys.find(
    (jersey) => jersey.id === contract.selectedJerseyId
  );

  return (
    <article
      className="mt-7 overflow-hidden rounded-2xl border bg-white shadow-[0_20px_50px_rgba(19,60,46,0.1)]"
      style={{
        borderColor: `${sponsor.colors.primary}45`,
        background: `linear-gradient(145deg, ${sponsor.colors.background}, #FFFFFF 38%, #FFFFFF 76%, ${sponsor.colors.secondary}60)`,
      }}
    >
      <div
        aria-hidden="true"
        className="h-2 w-full"
        style={{
          background: `linear-gradient(90deg, ${sponsor.colors.primary}, ${sponsor.colors.accent}, ${sponsor.colors.secondary})`,
        }}
      />

      <div className="grid items-center gap-7 p-6 sm:p-8 lg:grid-cols-[250px_minmax(0,1fr)_190px]">
        <div className="flex min-h-44 items-center justify-center rounded-2xl border border-black/10 bg-white/90 p-5">
          <SponsorLogo
            src={sponsor.logoPath}
            alt={`Logo de ${sponsor.name}`}
            sponsorName={sponsor.name}
            primaryColor={sponsor.colors.primary}
            backgroundColor={sponsor.colors.background}
            textColor={sponsor.colors.text}
          />
        </div>

        <div>
          <span
            className="inline-flex rounded-full px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider"
            style={{
              backgroundColor: sponsor.colors.primary,
              color: "#FFFFFF",
            }}
          >
            Contrat prêt pour J1
          </span>

          <h3
            className="mt-4 text-3xl font-black tracking-[-0.035em]"
            style={{ color: sponsor.colors.text }}
          >
            {sponsor.name}
          </h3>

          <p className="mt-3 leading-7 text-[#60756E]">
            Le sponsor et le maillot sont réservés pour{" "}
            {state.season.name}. Le contrat reste au statut planned : aucun
            budget n’a été versé et l’identité actuelle de l’équipe reste
            inchangée jusqu’au changement de saison.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <FutureMetric
              label="Budget à J1"
              value={formatMoney(
                contract.budgetPerSeason,
                contract.currencyCode
              )}
              sponsor={sponsor}
            />

            <FutureMetric
              label="Durée"
              value={formatDuration(
                contract.contractDurationSeasons
              )}
              sponsor={sponsor}
            />

            <FutureMetric
              label="Maillot"
              value={
                selectedJersey?.name ?? "Maillot enregistré"
              }
              sponsor={sponsor}
            />
          </div>
        </div>

        {selectedJersey ? (
          <div className="flex justify-center">
            <SponsorJerseyPreview
              sponsor={sponsor}
              jersey={selectedJersey}
              className="h-52 w-44 drop-shadow-xl"
            />
          </div>
        ) : null}
      </div>
    </article>
  );
}

function FutureMetric({
  label,
  value,
  sponsor,
}: {
  label: string;
  value: string;
  sponsor: PersistedSponsorContract["sponsor"];
}) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{
        borderColor: `${sponsor.colors.primary}28`,
        backgroundColor: sponsor.colors.background,
      }}
    >
      <p
        className="text-xs font-extrabold uppercase tracking-[0.11em]"
        style={{ color: sponsor.colors.primary }}
      >
        {label}
      </p>

      <p
        className="mt-2 font-black"
        style={{ color: sponsor.colors.text }}
      >
        {value}
      </p>
    </div>
  );
}

function getFutureSectionTitle(
  state: FutureSponsoringState
): string {
  if (state.kind === "locked") {
    return "La prochaine fenêtre n’est pas encore ouverte";
  }

  if (state.kind === "continuing") {
    return "Votre sponsor poursuit l’aventure";
  }

  if (state.kind === "offers") {
    return state.mode === "renewal"
      ? "Renouveler ou changer de partenaire"
      : "Choisir le prochain sponsor";
  }

  if (state.kind === "jersey-selection") {
    return "Finaliser l’identité de la future équipe";
  }

  return "Votre prochain sponsor est prêt";
}

function getFutureSectionIntroduction(
  state: FutureSponsoringState
): string {
  if (state.kind === "locked") {
    return "Les renouvellements et signatures destinés à la saison suivante sont regroupés entre les jours 21 et 28.";
  }

  if (state.kind === "continuing") {
    return "La durée du contrat en cours couvre déjà la prochaine saison. Aucune nouvelle décision commerciale n’est requise.";
  }

  if (state.kind === "offers") {
    return "Comparez les engagements proposés. Le contrat choisi restera en attente jusqu’au début de la prochaine saison.";
  }

  if (state.kind === "jersey-selection") {
    return "Le sponsor est signé pour la prochaine saison. Il reste à sélectionner le maillot qui sera activé au jour 1.";
  }

  return "La signature et le maillot sont enregistrés. L’activation, le versement du budget et le changement d’identité auront lieu au jour 1.";
}

function getTargetSeasonName(
  state: FutureSponsoringState
): string {
  if (
    state.kind === "offers" ||
    state.kind === "jersey-selection" ||
    state.kind === "planned"
  ) {
    return state.season.name;
  }

  return state.targetSeasonName;
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
