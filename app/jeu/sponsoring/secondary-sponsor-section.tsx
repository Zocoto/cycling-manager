import { SecondarySponsorLogo } from "@/components/game/secondary-sponsor-logo";
import Link from "@/components/ui/app-link";
import { SponsorCountryBadge } from "@/components/game/sponsor-country-badge";
import { SponsorObjectiveTitle } from "@/components/game/sponsor-objective-title";
import { TeamNationalityBadges } from "@/components/game/team-nationality-badges";
import { SecondarySponsorRosterObjective } from "@/components/game/secondary-sponsor-roster-objective";
import type { SecondarySponsorObjective } from "@/lib/game/secondary-sponsor";
import type {
  SecondarySponsorContract,
  SecondarySponsorOffer,
  SecondarySponsoringState,
} from "@/services/secondary-sponsors";
import { signSecondarySponsorOfferAction } from "./actions";
import { SecondarySponsorJerseyEditor } from "./secondary-sponsor-jersey-editor";

const moneyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function SecondarySponsorSection({
  state,
}: {
  state: SecondarySponsoringState | null;
}) {
  if (!state) {
    return (
      <SecondaryNotice
        title="Équipe indisponible"
        text="Terminez la création de votre équipe avant de négocier un sponsor secondaire."
      />
    );
  }

  return (
    <>
      {state.activeContract ? (
        <SecondarySponsorContractDetails contract={state.activeContract} />
      ) : null}
      <SecondarySponsorStateContent state={state} />
    </>
  );
}

function SecondarySponsorStateContent({
  state,
}: {
  state: SecondarySponsoringState;
}) {
  if (state.kind === "unavailable-season") {
    return (
      <SecondaryNotice
        title="Ouverture en saison 4"
        text="Les premiers contrats secondaires seront négociables à J21 de la saison précédant la saison 4."
      />
    );
  }

  if (state.kind === "window-locked") {
    return (
      <SecondaryNotice
        title={`Négociations ouvertes au jour ${state.opensOnDay}`}
        text={`Les propositions pour ${state.targetSeasonName} apparaîtront au J${state.opensOnDay}.`}
      />
    );
  }

  if (state.kind === "reputation-locked") {
    const progress = Math.min(
      100,
      Math.round((state.currentReputation / state.requiredReputation) * 100),
    );
    return (
      <section className="mt-8 rounded-2xl border border-[#D99A32]/30 bg-[#FFF4D6]/90 p-6 shadow-[0_16px_38px_rgba(102,72,18,0.07)]">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#8B6417]">
          Accès Très Haut Niveau
        </p>
        <h2 className="mt-2 text-2xl font-black text-[#604B0F]">
          1 500 points de réputation requis
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#715F2A]">
          Un sponsor secondaire devient négociable dès que votre réputation
          atteint ce palier. Les points ne sont pas dépensés à la signature.
        </p>
        <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/80">
          <div
            className="h-full rounded-full bg-[#D99A32]"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-sm font-black text-[#8B6417]">
          {state.currentReputation.toLocaleString("fr-FR")} /{" "}
          {state.requiredReputation.toLocaleString("fr-FR")}
        </p>
      </section>
    );
  }

  if (state.kind === "offers") {
    return (
      <div className="mt-8">
        <aside className="rounded-2xl border border-[#278B70]/20 bg-[#D7EEE8]/75 p-5 text-sm leading-6 text-[#315B57]">
          <p>Ces partenaires sont sélectionnés selon l’identité de votre équipe et de vos coureurs.</p>
          <p>{`Chaque prime dépend d’un objectif accompli, pour ${state.targetSeasonName}.`}</p>
        </aside>
        <div className="mt-6 grid items-stretch gap-6 xl:grid-cols-3">
          {state.offers.map((offer) => (
            <SecondarySponsorOfferCard
              key={offer.id}
              offer={offer}
              targetSeasonName={state.targetSeasonName}
            />
          ))}
        </div>
      </div>
    );
  }

  if (state.kind === "principal-required") {
    return (
      <SecondaryNotice
        title="Sponsor principal à choisir d’abord"
        text={`Signez d’abord un sponsor principal couvrant ${state.targetSeasonName} pour obtenir des offres secondaires adaptées à son budget.`}
        action={{ href: "/jeu/sponsoring", label: "Choisir le sponsor principal" }}
      />
    );
  }

  return <SecondarySponsorContractDetails contract={state.contract} />;
}

function SecondarySponsorContractDetails({ contract }: { contract: SecondarySponsorContract }) {
  return (
    <div className="space-y-7">
      <SecondarySponsorContractCard contract={contract} />

      {contract.baseJersey ? (
        <SecondarySponsorJerseyEditor
          key={`${contract.id}:${contract.baseJersey.jersey.id}`}
          contractId={contract.id}
          targetSeasonName={contract.targetSeasonName}
          principalSponsor={contract.baseJersey.sponsor}
          jersey={contract.baseJersey.jersey}
          secondarySponsor={contract.sponsor}
          initialPlacement={contract.logoPlacement}
        />
      ) : contract.status === "planned" ? (
        <SecondaryNotice
          title="Maillot principal à choisir d’abord"
          text={`Choisissez le maillot principal de ${contract.targetSeasonName} avant de placer le logo secondaire.`}
          action={{ href: "/jeu/sponsoring", label: "Choisir le prochain maillot" }}
        />
      ) : null}
    </div>
  );
}

function SecondarySponsorContractCard({
  contract,
}: {
  contract: SecondarySponsorContract;
}) {
  const principalName = contract.principalTeamName ?? contract.baseJersey?.futureTeamName;
  const combinedName = principalName
    ? `${principalName} - ${contract.sponsor.name}`
    : contract.sponsor.name;
  const isActive = contract.status === "active";

  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-[#278B70]/20 bg-white shadow-[0_18px_45px_rgba(19,60,46,0.08)]">
      <div
        className="h-2"
        style={{
          background: `linear-gradient(90deg, ${contract.sponsor.primaryColor}, ${contract.sponsor.accentColor})`,
        }}
      />
      <div className="grid gap-6 p-6 md:grid-cols-[220px_1fr] md:p-8">
        <div className="flex min-h-32 items-center justify-center rounded-2xl border border-[#315B3E]/10 bg-white p-5">
          <SecondarySponsorLogo sponsor={contract.sponsor} />
        </div>
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#278B70]">
            {isActive ? "Sponsor secondaire actif" : "Contrat secondaire signé"}
            {" · "}
            {contract.targetSeasonName}
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.035em] text-[#082A2A]">
            {combinedName}
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#60756E]">
            {isActive
              ? "Chaque objectif accompli verse sa prime immédiatement. Ce partenaire n’a ni budget annuel ni jauge de satisfaction."
              : "Le nouveau nom, le logo et la nationalité du partenaire entreront en vigueur au J1. Le sponsor secondaire n’a ni budget annuel ni jauge de satisfaction."}
          </p>
          <div className="mt-4">
            <TeamNationalityBadges countryCodes={[contract.baseJersey?.sponsor.countryCode ?? contract.sponsor.countryCode, contract.sponsor.countryCode]} />
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {contract.objectives.map((objective) => (
              <article
                key={objective.id}
                className="rounded-xl border border-[#315B3E]/10 bg-[#F4F7F5] p-3 text-sm font-bold text-[#193F38] transition hover:border-[#278B70]/35"
              >
                <SecondaryObjectiveTitle objective={objective} />
                <span className="mt-1 block text-xs font-black text-[#278B70]">
                  +{moneyFormatter.format(objective.cashReward)}
                </span>
                <SecondaryObjectiveTerms objective={objective} />
                {isActive ? (
                  <span className="mt-1 block text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#72847E]">
                    {formatSecondaryObjectiveStatus(
                      objective.status,
                      objective.bestRank,
                    )}
                  </span>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SecondarySponsorOfferCard({
  offer,
  targetSeasonName,
}: {
  offer: SecondarySponsorOffer;
  targetSeasonName: string;
}) {
  const sponsor = offer.sponsor;
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#315B3E]/15 bg-white shadow-[0_18px_45px_rgba(19,60,46,0.09)]">
      <div
        className="h-2"
        style={{
          background: `linear-gradient(90deg, ${sponsor.primaryColor}, ${sponsor.accentColor})`,
        }}
      />
      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full bg-[#EAF5F3] px-3 py-1 text-xs font-black uppercase tracking-wider text-[#176951]">
            Secondaire
          </span>
          <SponsorCountryBadge
            countryCode={sponsor.countryCode}
            primaryColor={sponsor.primaryColor}
          />
        </div>
        <div className="mt-5 flex min-h-32 items-center justify-center rounded-2xl border border-[#315B3E]/10 bg-white p-5">
          <SecondarySponsorLogo sponsor={sponsor} />
        </div>
        <p
          className="mt-5 text-xs font-extrabold uppercase tracking-[0.14em]"
          style={{ color: sponsor.primaryColor }}
        >
          Prestige {sponsor.prestige} / 5 · {targetSeasonName}
        </p>
        <h3 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#082A2A]">
          {sponsor.name}
        </h3>
        <div className="mt-4">
          <TeamNationalityBadges countryCodes={[...(offer.principalCountryCode ? [offer.principalCountryCode] : []), sponsor.countryCode]} />
        </div>
        <section className="mt-5 rounded-xl border border-[#315B3E]/10 bg-[#F4F7F5] p-4">
          <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#60756E]">
            {offer.objectives.length} objectifs rémunérés
          </p>
          <ol className="mt-3 space-y-3">
            {offer.objectives.map((objective) => (
              <li
                key={objective.id}
                className="text-sm font-bold leading-5 text-[#193F38]"
              >
                <SecondaryObjectiveTitle objective={objective} />
                <span className="mt-0.5 block text-xs font-black text-[#278B70]">
                  +{moneyFormatter.format(objective.cashReward)}
                </span>
                <SecondaryObjectiveTerms objective={objective} />
              </li>
            ))}
          </ol>
        </section>
        <p className="mt-4 text-sm font-black text-[#0B4A3B]">
          Maximum : {moneyFormatter.format(offer.totalMaximumReward)}
        </p>
        {typeof offer.principalBudgetPerSeason === "number" && offer.principalBudgetPerSeason > 0
          && typeof offer.maximumRewardBudget === "number" && offer.maximumRewardBudget >= 0 ? (
            <p className="mt-1 text-[11px] font-semibold leading-5 text-[#60756E]">
              {`Plafond de primes : ${moneyFormatter.format(offer.maximumRewardBudget)} (30 % du budget principal de ${moneyFormatter.format(offer.principalBudgetPerSeason)}).`}
            </p>
          ) : null}
        <form action={signSecondarySponsorOfferAction} className="mt-auto pt-6">
          <input type="hidden" name="offerId" value={offer.id} />
          <button
            type="submit"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#082A2A] px-5 py-3 text-sm font-black text-white transition hover:bg-[#12473F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#42B99A] focus-visible:ring-offset-2"
          >
            Signer {sponsor.name}
          </button>
        </form>
      </div>
    </article>
  );
}

function SecondaryObjectiveTitle({ objective }: { objective: SecondarySponsorObjective }) {
  if (objective.kind === "roster_nationality") {
    return <SecondarySponsorRosterObjective countryCode={objective.nationalityCountryCode} requiredCount={objective.requiredRiderCount} />;
  }
  return <SponsorObjectiveTitle targetDetails={{ kind: "race_result", raceSlug: objective.raceSlug, raceLabel: objective.raceLabel, raceEditionId: objective.raceEditionId }}>{objective.name}</SponsorObjectiveTitle>;
}

function SecondaryObjectiveTerms({ objective }: { objective: SecondarySponsorObjective }) {
  return <>
    {objective.kind === "roster_nationality" ? (
      <SecondarySponsorRosterObjective countryCode={objective.nationalityCountryCode} requiredCount={objective.requiredRiderCount} currentCount={objective.currentRiderCount} progress />
    ) : null}
    {(objective.reputationPenalty ?? 0) > 0 ? (
      <p className="mt-1 text-xs font-bold leading-5 text-[#A13A32]">{`En cas d’échec : −${objective.reputationPenalty} réputation`}</p>
    ) : null}
  </>;
}

function formatSecondaryObjectiveStatus(
  status: "draft" | "active" | "achieved" | "failed" | "cancelled",
  bestRank: number | null,
): string {
  const rank = bestRank
    ? bestRank === 1
      ? "1er"
      : `${bestRank}e`
    : null;
  if (status === "achieved") return `Atteint${rank ? ` · ${rank}` : ""}`;
  if (status === "failed") return `Échoué${rank ? ` · ${rank}` : ""}`;
  if (status === "cancelled") return "Neutralisé";
  return "En cours";
}

function SecondaryNotice({ title, text, action }: { title: string; text: string; action?: { href: string; label: string } }) {
  return (
    <aside className="mt-8 rounded-2xl border border-[#278B70]/20 bg-white/90 p-6 shadow-[0_14px_34px_rgba(19,60,46,0.06)]">
      <h2 className="text-xl font-black text-[#0B4A3B]">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#60756E]">
        {text}
      </p>
      {action ? (
        <Link href={action.href} className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#082A2A] px-5 py-3 text-sm font-black text-white transition hover:bg-[#12473F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#42B99A] focus-visible:ring-offset-2">
          {action.label}
        </Link>
      ) : null}
    </aside>
  );
}
