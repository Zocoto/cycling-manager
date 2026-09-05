import Image from "next/image";
import type { CSSProperties } from "react";

import Link from "@/components/ui/app-link";

import { AmateurTeamJersey } from "@/components/game/amateur-team-jersey";
import { AmateurTeamAffiliationPanel } from "@/components/game/amateur-team-affiliation-panel";
import {
  GameSectionTabLink,
  GameSectionTabs,
} from "@/components/game/game-section-tabs";
import { FederationFinancePreview } from "@/components/game/federation-finance-preview";
import { FederationElectionPanel } from "@/components/game/federation-election-panel";
import { FederationCoursesPanel } from "@/components/game/federation-courses-panel";
import { FederationInfrastructureCatalog } from "@/components/game/federation-infrastructure-catalog";
import { FederationLounge } from "@/components/game/federation-lounge";
import { FederationSelectionWorkbench } from "@/components/game/federation-selection-workbench";
import { NationalJerseyPreviewEditor } from "@/components/game/national-jersey-preview-editor";
import { RiderAvatar } from "@/components/game/rider-avatar";
import type { FederationChatOverview } from "@/lib/game/federation-chat";
import {
  buildFederationObjectives,
  type FederationObjective,
} from "@/lib/game/federation-objectives";
import { getFederationNationTheme } from "@/lib/game/federation-nation-theme";
import type { GlobalSearchResult } from "@/lib/game/global-search";
import type { PublishedNationalJersey } from "@/lib/game/national-jersey-preview";
import {
  FEDERATION_MANAGEMENT_START_GAME_YEAR,
  getFederationDivisionPreview,
  getFederationManagementPhase,
  type NationalFederationTab,
} from "@/lib/game/national-federations";
import { createNationalChampionRiderJersey } from "@/lib/rider-jersey";
import type {
  FederationChampion,
  NationalFederationSnapshot,
} from "@/services/national-federations";
import type { FederationFinanceBaseline } from "@/services/federation-finances";
import type { FederationObjectiveMetrics } from "@/services/federation-objectives";
import type { FederationCoursesState } from "@/services/federation-courses";
import type { FederationRaceCreationState } from "@/services/federation-race-creation";
import type { FederationGovernanceOverview } from "@/services/federation-governance";
import type {
  FederationInternationalPerformance,
  FederationInternationalResults,
} from "@/services/federation-international-results";
import type { FederationInfrastructureState } from "@/services/federation-infrastructures";
import type { FederationSelectionRider } from "@/services/federation-selection-pool";
import type { FederationSelectionState } from "@/services/federation-selections";
import type { FederationTreasuryState } from "@/services/federation-treasury";
import type { FederationTeamJerseyArtwork } from "@/services/federation-team-jerseys";
import type { NationRankingEntry } from "@/services/uci-rankings";
import type { AmateurTeamAffiliationState } from "@/services/amateur-team-affiliation";

type NationalFederationViewProps = {
  country: {
    id: string;
    code: string;
    name: string;
  };
  snapshot: NationalFederationSnapshot;
  nationRanking: NationRankingEntry | null;
  memberTeams: GlobalSearchResult[];
  memberTeamCount: number;
  selectedTab: NationalFederationTab;
  publishedJersey: PublishedNationalJersey | null;
  federationChat: FederationChatOverview | null;
  financeBaseline: FederationFinanceBaseline | null;
  selectionRiders: FederationSelectionRider[];
  internationalResults: FederationInternationalResults | null;
  governanceOverview: FederationGovernanceOverview | null;
  coursesState?: FederationCoursesState | null;
  raceCreationState?: FederationRaceCreationState | null;
  selectionState: FederationSelectionState | null;
  treasuryState: FederationTreasuryState | null;
  infrastructureState: FederationInfrastructureState | null;
  objectiveMetrics?: FederationObjectiveMetrics | null;
  memberTeamJerseys?: Record<string, FederationTeamJerseyArtwork>;
  amateurAffiliationState?: AmateurTeamAffiliationState | null;
  affiliationCountries?: Array<{ id: string; name: string; code: string }>;
};

const numberFormatter = new Intl.NumberFormat("fr-FR");
const moneyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const TAB_CONTENT: Array<{
  id: NationalFederationTab;
  label: string;
  description: string;
}> = [
  {
    id: "overview",
    label: "Vue d’ensemble",
    description: "Identité, membres et palmarès",
  },
  {
    id: "selections",
    label: "Sélections",
    description: "Compositions préparées dès J1",
  },
  {
    id: "infrastructures",
    label: "Infrastructures",
    description: "Académies et bâtiments communs",
  },
  {
    id: "finances",
    label: "Finances",
    description: "Dotations et solidarité",
  },
  {
    id: "races",
    label: "Courses",
    description: "Patrimoine, accueil et création",
  },
  {
    id: "governance",
    label: "Gouvernance",
    description: "Présidence, maillot et journal",
  },
  {
    id: "lounge",
    label: "Salon fédéral",
    description: "Échanges privés entre affiliés",
  },
];

export function NationalFederationView({
  country,
  snapshot,
  nationRanking,
  memberTeams,
  memberTeamCount,
  selectedTab,
  publishedJersey,
  federationChat,
  financeBaseline,
  selectionRiders,
  internationalResults,
  governanceOverview,
  coursesState = null,
  raceCreationState = null,
  selectionState,
  treasuryState,
  infrastructureState,
  objectiveMetrics = null,
  memberTeamJerseys = {},
  amateurAffiliationState = null,
  affiliationCountries = [],
}: NationalFederationViewProps) {
  const phase = getFederationManagementPhase(snapshot.season.gameYear);
  const division = getFederationDivisionPreview(nationRanking?.rank ?? null);
  const isPreview = phase === "preview";
  const baseHref = `/jeu/federations/${country.code.toLowerCase()}`;
  const nationTheme = getFederationNationTheme(
    country.code,
    publishedJersey?.design,
  );
  const federationStyle = {
    "--federation-primary": nationTheme.primary,
    "--federation-secondary": nationTheme.secondary,
    "--federation-accent": nationTheme.accent,
    "--federation-soft": nationTheme.soft,
    "--federation-ink": nationTheme.ink,
  } as CSSProperties;

  return (
    <div style={federationStyle}>
      <header
        className="relative mt-5 overflow-hidden rounded-[2rem] px-6 py-8 text-white shadow-[0_24px_70px_rgba(19,60,46,0.2)] sm:px-10 sm:py-10"
        style={{
          background: `linear-gradient(135deg, ${nationTheme.primary} 0%, ${nationTheme.secondary} 72%, ${nationTheme.accent} 150%)`,
        }}
      >
        <div
          aria-hidden="true"
          className="absolute -right-20 -top-28 h-96 w-96 rounded-full border-[64px] border-white/5"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-1"
          style={{
            background: `linear-gradient(90deg, ${nationTheme.secondary}, ${nationTheme.accent}, ${nationTheme.secondary})`,
          }}
        />

        <div className="relative grid gap-7 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <span className="flex h-20 w-28 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-xl sm:h-24 sm:w-32">
              <CountryFlag countryCode={country.code} countryName={country.name} />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[var(--federation-accent)]">
                  Fédération nationale
                </p>
                {snapshot.viewer.isAffiliated ? (
                  <span className="rounded-full bg-[#F2C94C] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#19352E]">
                    Votre fédération
                  </span>
                ) : (
                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#D6DFD2]">
                    Consultation publique
                  </span>
                )}
              </div>
              <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
                Fédération de {country.name}
              </h1>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#D6DFD2] sm:text-base">
                Le centre commun des équipes affiliées, de la sélection
                nationale et du développement cycliste du pays.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2">
            <HeroMetric
              label="Classement UCI"
              value={nationRanking ? `#${nationRanking.rank}` : "—"}
            />
            <HeroMetric label="Nations Cup" value={division.label} compact />
            <HeroMetric label="Présidence" value="Automatique" />
            <HeroMetric
              label="Trésorerie"
              value={isPreview ? `S${FEDERATION_MANAGEMENT_START_GAME_YEAR}` : moneyFormatter.format(0)}
              highlight
            />
          </div>
        </div>
      </header>

      {selectedTab !== "overview" ? (
        isPreview ? <SeasonTwoPreviewNotice /> : <AutomaticModeNotice />
      ) : null}

      <GameSectionTabs
        ariaLabel="Rubriques de la fédération"
        columns={7}
        className="mt-7"
      >
        {TAB_CONTENT.map((tab) => (
          <GameSectionTabLink
            key={tab.id}
            href={`${baseHref}?onglet=${tab.id}`}
            label={tab.label}
            description={tab.description}
            active={selectedTab === tab.id}
          />
        ))}
      </GameSectionTabs>

      <div className="mt-7">
        {selectedTab === "overview" ? (
          <OverviewPanel
            country={country}
            snapshot={snapshot}
            nationRanking={nationRanking}
            memberTeams={memberTeams}
            memberTeamCount={memberTeamCount}
            divisionLabel={division.label}
            internationalResults={internationalResults}
            objectiveMetrics={objectiveMetrics}
            memberTeamJerseys={memberTeamJerseys}
            amateurAffiliationState={amateurAffiliationState}
            affiliationCountries={affiliationCountries}
          />
        ) : selectedTab === "selections" ? (
          <SelectionsPanel
            country={country}
            snapshot={snapshot}
            riders={selectionRiders}
            selectionState={selectionState}
          />
        ) : selectedTab === "infrastructures" ? (
          <InfrastructuresPanel
            countryCode={country.code}
            snapshot={snapshot}
            managementLocked={isPreview}
            infrastructureState={infrastructureState}
          />
        ) : selectedTab === "finances" ? (
          <FinancesPanel
            nationRank={nationRanking?.rank ?? 173}
            division={division.division}
            baseline={financeBaseline}
            countryCode={country.code}
            gameYear={snapshot.season.gameYear}
            treasuryState={treasuryState}
          />
        ) : selectedTab === "races" ? (
          coursesState ? (
            <FederationCoursesPanel
              countryCode={country.code}
              gameYear={snapshot.season.gameYear}
              state={coursesState}
              raceCreationState={raceCreationState}
            />
          ) : (
            <EmptyState>
              Le portefeuille de courses n’a pas pu être chargé pour cette nation.
            </EmptyState>
          )
        ) : selectedTab === "governance" ? (
          <GovernancePanel
            country={country}
            snapshot={snapshot}
            publishedJersey={publishedJersey}
            governanceOverview={governanceOverview}
          />
        ) : snapshot.viewer.isAffiliated &&
          snapshot.viewer.teamId &&
          federationChat ? (
          <FederationLounge
            countryId={country.id}
            countryCode={country.code}
            countryName={country.name}
            currentTeamId={snapshot.viewer.teamId}
            initialMessages={federationChat.messages}
            initialHasMore={federationChat.hasMore}
          />
        ) : (
          <FederationLoungePanel
            countryName={country.name}
            isAffiliated={snapshot.viewer.isAffiliated}
          />
        )}
      </div>
    </div>
  );
}

function SeasonTwoPreviewNotice() {
  return (
    <aside className="mt-6 flex flex-col gap-4 rounded-2xl border border-[#D5AC18]/35 bg-[#FFF9DE] p-5 shadow-[0_12px_30px_rgba(100,75,0,0.08)] sm:flex-row sm:items-center">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#F2C94C] text-xl font-black text-[#19352E]">
        S3
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-black text-[#4A3A00]">
          Préfiguration ouverte — gestion inchangée en Saison 2
        </p>
        <p className="mt-1 text-sm font-semibold leading-6 text-[#75631C]">
          Vous pouvez explorer toutes les pages et les données réelles de la
          nation. Aucune élection, dépense, sélection ou construction fédérale
          ne peut modifier la Saison 2.
        </p>
      </div>
      <span className="w-fit rounded-full border border-[#D5AC18]/30 bg-white/70 px-4 py-2 text-[10px] font-black uppercase tracking-[0.13em] text-[#806300]">
        Activation Saison 3
      </span>
    </aside>
  );
}

function AutomaticModeNotice() {
  return (
    <aside className="mt-6 rounded-2xl border border-[var(--federation-secondary)]/25 bg-[#E8F7F1] px-5 py-4 text-sm font-bold text-[var(--federation-secondary)]">
      La fédération fonctionne automatiquement tant qu’aucun président n’est
      élu. Les échéances sportives ne peuvent jamais être bloquées.
    </aside>
  );
}

function OverviewPanel({
  country,
  snapshot,
  nationRanking,
  memberTeams,
  memberTeamCount,
  divisionLabel,
  internationalResults,
  objectiveMetrics,
  memberTeamJerseys,
  amateurAffiliationState,
  affiliationCountries,
}: {
  country: NationalFederationViewProps["country"];
  snapshot: NationalFederationSnapshot;
  nationRanking: NationRankingEntry | null;
  memberTeams: GlobalSearchResult[];
  memberTeamCount: number;
  divisionLabel: string;
  internationalResults: FederationInternationalResults | null;
  objectiveMetrics: FederationObjectiveMetrics | null;
  memberTeamJerseys: Record<string, FederationTeamJerseyArtwork>;
  amateurAffiliationState: AmateurTeamAffiliationState | null;
  affiliationCountries: Array<{ id: string; name: string; code: string }>;
}) {
  const objectiveGameYear = Math.max(
    FEDERATION_MANAGEMENT_START_GAME_YEAR,
    snapshot.season.gameYear,
  );
  const objectives = buildFederationObjectives({
    gameYear: objectiveGameYear,
    nationRank: nationRanking?.rank ?? null,
    referenceMemberTeamCount:
      objectiveMetrics?.referenceMemberTeamCount ?? memberTeamCount,
    currentMemberTeamCount: memberTeamCount,
    naturalizationCount: objectiveMetrics?.naturalizationCount ?? 0,
    manuallySubmittedSelectionCount:
      objectiveMetrics?.manuallySubmittedSelectionCount ?? 0,
    nationsCupRank: objectiveMetrics?.nationsCupRank ?? null,
    worldRank: internationalResults?.world?.rank ?? null,
    continentalRank: internationalResults?.continental?.rank ?? null,
  });

  return (
    <div className="space-y-7">
      <FederationObjectivesBoard
        objectives={objectives}
        gameYear={objectiveGameYear}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <OverviewMetric
          eyebrow="Rayonnement"
          label="Points UCI"
          value={numberFormatter.format(nationRanking?.points ?? 0)}
          detail={`${numberFormatter.format(nationRanking?.riderCount ?? 0)} coureurs classés`}
        />
        <OverviewMetric
          eyebrow="Collectif"
          label="Équipes affiliées"
          value={numberFormatter.format(memberTeamCount)}
          detail="Nationalité sportive de la saison"
        />
        <OverviewMetric
          eyebrow="Compétition"
          label="Division prévisionnelle"
          value={divisionLabel}
          detail="D’après le classement UCI actuel"
        />
        <OverviewMetric
          eyebrow="Formation"
          label="Impact académies"
          value={`${snapshot.academies.totalImpactPercentage} %`}
          detail={`${snapshot.academies.centers.length} centre${snapshot.academies.centers.length > 1 ? "s" : ""} international${snapshot.academies.centers.length > 1 ? "aux" : ""}`}
        />
      </section>

      {amateurAffiliationState && affiliationCountries.length > 0 ? (
        <AmateurTeamAffiliationPanel
          countries={affiliationCountries}
          state={amateurAffiliationState}
        />
      ) : null}

      <section className="rounded-[2rem] border border-[#315B3E]/12 bg-white p-6 shadow-[0_16px_45px_rgba(19,60,46,0.07)] sm:p-8">
        <SectionHeading
          eyebrow="Repères internationaux"
          title="Derniers classements de la nation"
          description="La meilleure place nationale est extraite des derniers Championnats du monde et continentaux réellement terminés. La Nations Cup ouvrira son historique à sa première édition S3."
        />
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <InternationalResultCard
            label="Championnats du monde"
            performance={internationalResults?.world ?? null}
          />
          <InternationalResultCard
            label="Championnats continentaux"
            performance={internationalResults?.continental ?? null}
          />
          <article className="rounded-2xl border border-[#315B3E]/12 bg-[#F8FBF9] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--federation-secondary)]">
              Nations Cup
            </p>
            <p className="mt-3 text-2xl font-black text-[#183F37]">À venir</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#60756E]">
              Première édition et premier classement de groupe en Saison 3.
            </p>
          </article>
        </div>
      </section>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <section className="rounded-[2rem] border border-[#315B3E]/12 bg-white p-6 shadow-[0_16px_45px_rgba(19,60,46,0.07)] sm:p-8">
          <SectionHeading
            eyebrow="Structures"
            title={`Équipes affiliées à ${country.name}`}
            description="L’affiliation suit la nationalité sportive du sponsor pendant la saison."
          />
          <div className="mt-5 space-y-3">
            {memberTeams.length > 0 ? (
              memberTeams.map((team) => (
                <Link
                  key={team.entity_id}
                  href={`/jeu/equipes/${team.public_identifier}`}
                  className="flex items-center gap-3 rounded-2xl border border-[#315B3E]/12 bg-[#F8FBF9] p-4 transition hover:-translate-y-0.5 hover:border-[var(--federation-secondary)]/40 hover:shadow-[0_12px_26px_rgba(19,60,46,0.1)]"
                >
                  <TeamJerseyPreview
                    artwork={memberTeamJerseys[team.entity_id]}
                    teamName={team.display_name}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-black text-[#183F37]">
                      {team.display_name}
                    </span>
                    <span className="mt-1 block truncate text-xs font-semibold text-[#60756E]">
                      {team.sporting_director_name ?? "Gestion automatique"}
                    </span>
                  </span>
                  <span className="text-lg font-black text-[var(--federation-secondary)]" aria-hidden="true">
                    →
                  </span>
                </Link>
              ))
            ) : (
              <EmptyState>
                Aucune équipe n’est affiliée actuellement. La fédération reste
                néanmoins active en mode automatique.
              </EmptyState>
            )}
          </div>
          {memberTeams.length < memberTeamCount ? (
            <p className="mt-4 text-xs font-bold text-[#60756E]">
              {memberTeams.length} équipes affichées sur {memberTeamCount}.
            </p>
          ) : null}
        </section>

        <section className="rounded-[2rem] border border-[#315B3E]/12 bg-white p-6 shadow-[0_16px_45px_rgba(19,60,46,0.07)] sm:p-8">
          <SectionHeading
            eyebrow="Maillots distinctifs · Mémoire sportive"
            title="Palmarès de la nation"
            description="Les champions en titre portent leur maillot distinctif ; l’historique reste consultable juste après."
          />
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <ChampionCard
              countryCode={country.code}
              label="Professionnels · Route"
              champion={snapshot.champions.professional.road}
            />
            <ChampionCard
              countryCode={country.code}
              label="Professionnels · CLM"
              champion={snapshot.champions.professional.time_trial}
            />
            <ChampionCard
              countryCode={country.code}
              label="Juniors · Route"
              champion={snapshot.champions.junior.road}
            />
            <ChampionCard
              countryCode={country.code}
              label="Juniors · CLM"
              champion={snapshot.champions.junior.time_trial}
            />
          </div>
          <p className="mt-7 text-[10px] font-black uppercase tracking-[0.14em] text-[#60756E]">
            Historique des titres
          </p>
          <PalmaresList palmares={snapshot.palmares} />
        </section>
      </div>
    </div>
  );
}

function SelectionsPanel({
  country,
  snapshot,
  riders,
  selectionState,
}: {
  country: NationalFederationViewProps["country"];
  snapshot: NationalFederationSnapshot;
  riders: FederationSelectionRider[];
  selectionState: FederationSelectionState | null;
}) {
  const programmeGameYear = Math.max(
    FEDERATION_MANAGEMENT_START_GAME_YEAR,
    snapshot.season.gameYear,
  );
  const isQuadriennialSeason = programmeGameYear % 4 === 0;
  const events = [
    {
      day: 15,
      name: "Championnats continentaux",
      detail: "Sélection nationale · route et contre-la-montre",
    },
    {
      day: 24,
      name: isQuadriennialSeason ? "Jeux quadriennaux" : "Nations Cup",
      detail: isQuadriennialSeason
        ? "Édition exceptionnelle à la place de la Nations Cup"
        : "Cinq profils · classement de division et de groupe",
    },
    {
      day: 24,
      name: "Nations Cup juniors",
      detail: "Sélection fédérale · 6 juniors issus des écoles ou DevTeams",
    },
    {
      day: 26,
      name: "Championnats du monde",
      detail: "Sélection nationale · route et contre-la-montre",
    },
  ];

  return (
    <div className="space-y-7">
      <LockedFeatureHeader
        eyebrow={snapshot.season.gameYear < 3 ? "Préparation Saison 3" : "Programme international"}
        title="Composer tôt, sécuriser automatiquement"
        description="Dès J1, le président préparera ses listes. Chaque équipe validera uniquement ses propres coureurs et toute place laissée vacante sera complétée automatiquement avant le départ."
      />

      <section className="grid gap-4 lg:grid-cols-3">
        {events.map((event) => (
          <article
            key={event.day}
            className="relative overflow-hidden rounded-[1.65rem] border border-[#315B3E]/12 bg-white p-6 shadow-[0_14px_36px_rgba(19,60,46,0.07)]"
          >
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#2D74DA,#F2C94C,#C75348,#42B99A,#8D60C7)]"
            />
            <div className="flex items-start justify-between gap-4">
              <span className="rounded-xl bg-[var(--federation-primary)] px-3 py-2 text-sm font-black text-white">
                J{event.day}
              </span>
              <StatusPill>
                {snapshot.season.gameYear < 3 ? "Gestion verrouillée" : "Calendrier officiel"}
              </StatusPill>
            </div>
            <h3 className="mt-5 text-xl font-black text-[#183F37]">
              {event.name}
            </h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#60756E]">
              {event.detail}
            </p>
            <p className="mt-5 border-t border-[#315B3E]/10 pt-4 text-xs font-black uppercase tracking-[0.12em] text-[var(--federation-secondary)]">
              Repère arc-en-ciel dans le calendrier
            </p>
          </article>
        ))}
      </section>

      <FederationSelectionWorkbench
        countryCode={country.code}
        countryName={country.name}
        riders={riders}
        gameYear={snapshot.season.gameYear}
        selectionState={selectionState}
      />
    </div>
  );
}

function InfrastructuresPanel({
  countryCode,
  snapshot,
  managementLocked,
  infrastructureState,
}: {
  countryCode: string;
  snapshot: NationalFederationSnapshot;
  managementLocked: boolean;
  infrastructureState: FederationInfrastructureState | null;
}) {
  return (
    <div className="space-y-7">
      <section className="overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_45px_rgba(19,60,46,0.07)]">
        <div className="grid gap-6 bg-[var(--federation-primary)] p-6 text-white sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--federation-accent)]">
              Formation internationale existante
            </p>
            <h2 className="mt-2 text-3xl font-black">
              {snapshot.academies.centers.length} académie
              {snapshot.academies.centers.length > 1 ? "s" : ""} · impact{" "}
              {snapshot.academies.totalImpactPercentage} %
            </h2>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#D6DFD2]">
              Cette probabilité partagée peut ajouter une étoile de potentiel à
              un jeune généré dans la nation, dans la limite globale de 90 %.
            </p>
          </div>
          <div className="min-w-48 rounded-2xl border border-white/15 bg-white/10 p-4">
            <div className="flex items-center justify-between text-xs font-black">
              <span>Impact cumulé</span>
              <span>{snapshot.academies.totalImpactPercentage}/90 %</span>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-[#F2C94C]"
                style={{
                  width: `${(snapshot.academies.totalImpactPercentage / 90) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-6 sm:grid-cols-2 sm:p-8 xl:grid-cols-3">
          {snapshot.academies.centers.length > 0 ? (
            snapshot.academies.centers.map((academy) => (
              <article
                key={academy.teamId}
                className="rounded-2xl border border-[#315B3E]/12 bg-[#F8FBF9] p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-[#183F37]">
                      {academy.teamName}
                    </p>
                    <p className="mt-1 text-xs font-bold text-[#60756E]">
                      Centre international
                    </p>
                  </div>
                  <span className="rounded-full bg-[#DDF3E7] px-3 py-1 text-xs font-black text-[var(--federation-secondary)]">
                    {academy.qualityLevel} ★
                  </span>
                </div>
                <p className="mt-4 text-sm font-black text-[var(--federation-secondary)]">
                  +{academy.contributionPercentage} % de contribution
                </p>
              </article>
            ))
          ) : (
            <div className="sm:col-span-2 xl:col-span-3">
              <EmptyState>
                Aucune académie internationale terminée dans ce pays.
              </EmptyState>
            </div>
          )}
        </div>
      </section>

      <FederationInfrastructureCatalog
        countryCode={countryCode}
        managementLocked={managementLocked}
        infrastructureState={infrastructureState}
      />
    </div>
  );
}

function FinancesPanel({
  nationRank,
  division,
  baseline,
  countryCode,
  gameYear,
  treasuryState,
}: {
  nationRank: number;
  division: 1 | 2 | 3 | 4;
  baseline: FederationFinanceBaseline | null;
  countryCode: string;
  gameYear: number;
  treasuryState: FederationTreasuryState | null;
}) {
  if (!baseline) {
    return (
      <EmptyState>
        La projection financière n’a pas pu être préparée pour cette nation.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-7">
      <LockedFeatureHeader
        eyebrow="Trésorerie fédérale"
        title="Projection officielle du budget Saison 3"
        description="Le calcul s’appuie désormais sur le classement UCI et les courses réellement disputées en Saison 2. Les dons, aides et dépenses restent verrouillés jusqu’au passage en Saison 3."
      />

      <FederationFinancePreview
        initialNationRank={nationRank}
        initialDivision={division}
        baseline={baseline}
        countryCode={countryCode}
        gameYear={gameYear}
        treasuryState={treasuryState}
      />
    </div>
  );
}

function GovernancePanel({
  country,
  snapshot,
  publishedJersey,
  governanceOverview,
}: {
  country: NationalFederationViewProps["country"];
  snapshot: NationalFederationSnapshot;
  publishedJersey: PublishedNationalJersey | null;
  governanceOverview: FederationGovernanceOverview | null;
}) {
  return (
    <div className="space-y-7">
      {governanceOverview ? (
        <FederationElectionPanel
          countryCode={country.code}
          overview={governanceOverview}
        />
      ) : null}

      <div>
        <section className="rounded-[2rem] border border-[#315B3E]/12 bg-white p-6 shadow-[0_16px_45px_rgba(19,60,46,0.07)] sm:p-8">
          <SectionHeading
            eyebrow="Transparence"
            title="Journal public"
            description="Chaque décision financière ou sportive importante y sera horodatée."
          />
          <ol className="mt-6 space-y-4">
            {governanceOverview?.journal.length ? (
              governanceOverview.journal.map((entry) => (
                <JournalEntry
                  key={entry.id}
                  day={entry.dayNumber ? `J${entry.dayNumber}` : "—"}
                  title={entry.title}
                  detail={entry.detail}
                />
              ))
            ) : (
              <JournalEntry
                day={`J${snapshot.season.currentDayNumber}`}
                title="Préfiguration de la fédération ouverte"
                detail="Le journal enregistrera automatiquement les candidatures, votes, décisions et opérations fédérales."
              />
            )}
          </ol>
        </section>
      </div>

      <NationalJerseyPreviewEditor
        countryCode={country.code}
        countryName={country.name}
        publishedJersey={publishedJersey}
        canPublish={snapshot.viewer.isAffiliated}
      />
    </div>
  );
}

function FederationObjectivesBoard({
  objectives,
  gameYear,
}: {
  objectives: FederationObjective[];
  gameYear: number;
}) {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-[#1E7A60]/35 bg-[linear-gradient(135deg,var(--federation-primary)_0%,var(--federation-secondary)_100%)] p-6 text-white shadow-[0_20px_52px_rgba(19,60,46,0.2)] sm:p-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--federation-accent)]">
            Feuille de route · Saison {gameYear}
          </p>
          <h2 className="mt-2 text-3xl font-black">Objectifs fédéraux</h2>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#D6E9E2]">
            Cinq objectifs prioritaires, contrôlés automatiquement à partir des
            données de la saison.
          </p>
        </div>
        <span className="w-fit rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black text-[#C9F2DF]">
          {objectives.filter((objective) => objective.completed).length}/5 validés
        </span>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {objectives.map((objective, index) => (
          <ObjectiveProgressCard
            key={objective.id}
            objective={objective}
            number={index + 1}
          />
        ))}
      </div>
    </section>
  );
}

function ObjectiveProgressCard({
  number,
  objective,
}: {
  number: number;
  objective: FederationObjective;
}) {
  return (
    <article className="flex min-h-64 flex-col rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-2xl font-black text-[var(--federation-accent)]">
          {String(number).padStart(2, "0")}
        </span>
        <span className="text-[9px] font-black uppercase tracking-[0.11em] text-[#C9E3D7]">
          {objective.eyebrow}
        </span>
      </div>
      <h3 className="mt-4 font-black leading-5 text-white">{objective.title}</h3>
      <p className="mt-2 flex-1 text-xs font-semibold leading-5 text-[#C9E3D7]">
        {objective.detail}
      </p>
      <div className="mt-5">
        <div className="flex items-center justify-between gap-3 text-[10px] font-black">
          <span className={objective.completed ? "text-[#F2C94C]" : "text-white"}>
            {objective.completed ? "✓ Objectif rempli" : objective.currentLabel}
          </span>
          <span className="text-[#C9E3D7]">{objective.targetLabel}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/20">
          <div
            className={objective.completed ? "h-full rounded-full bg-[#F2C94C]" : "h-full rounded-full bg-[#75D7B5]"}
            style={{ width: `${objective.progressPercentage}%` }}
          />
        </div>
      </div>
    </article>
  );
}

function FederationLoungePanel({
  countryName,
  isAffiliated,
}: {
  countryName: string;
  isAffiliated: boolean;
}) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white p-6 shadow-[0_16px_45px_rgba(19,60,46,0.07)] sm:p-10">
      <div
        aria-hidden="true"
        className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#DDF3E7] blur-2xl"
      />
      <div className="relative mx-auto max-w-3xl text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[var(--federation-primary)] text-2xl text-[#F2C94C]">
          ◌
        </span>
        <p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-[var(--federation-secondary)]">
          Salon privé de la fédération
        </p>
        <h2 className="mt-2 text-3xl font-black text-[#183F37]">
          Le vestiaire de {countryName}
        </h2>
        <p className="mt-4 text-sm font-semibold leading-7 text-[#60756E]">
          Le salon réutilisera la messagerie existante afin de ne pas créer un
          second moteur temps réel. Messages épinglés, annonces du président et
          échanges entre équipes affiliées seront regroupés ici à partir de la
          Saison 3.
        </p>
        <span className="mt-6 inline-flex rounded-full border border-[#315B3E]/15 bg-[#F2F8F5] px-4 py-2 text-xs font-black text-[#60756E]">
          {isAffiliated
            ? "Accès reconnu · ouverture en Saison 3"
            : "Lecture réservée aux équipes affiliées en Saison 3"}
        </span>
      </div>
    </section>
  );
}

function HeroMetric({
  label,
  value,
  highlight = false,
  compact = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/15 bg-white/10 px-4 py-4 text-center backdrop-blur">
      <p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#BFD1C6]">
        {label}
      </p>
      <p
        className={`mt-1 font-black ${compact ? "text-sm" : "text-xl"} ${highlight ? "text-[#F2C94C]" : "text-white"}`}
      >
        {value}
      </p>
    </div>
  );
}

function InternationalResultCard({
  label,
  performance,
}: {
  label: string;
  performance: FederationInternationalPerformance | null;
}) {
  return (
    <article className="rounded-2xl border border-[#315B3E]/12 bg-[#F8FBF9] p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--federation-secondary)]">
        {label}
      </p>
      {performance ? (
        <>
          <p className="mt-3 text-2xl font-black text-[#183F37]">
            {performance.rank}
            <sup>{performance.rank === 1 ? "er" : "e"}</sup>
          </p>
          <p className="mt-2 font-black text-[#315B3E]">
            {performance.riderName}
          </p>
          <p className="mt-1 text-xs font-semibold leading-5 text-[#60756E]">
            {performance.editionName} · {performance.seasonName}
          </p>
        </>
      ) : (
        <>
          <p className="mt-3 text-2xl font-black text-[#183F37]">—</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#60756E]">
            Aucun résultat classé enregistré pour cette nation.
          </p>
        </>
      )}
    </article>
  );
}

function OverviewMetric({
  eyebrow,
  label,
  value,
  detail,
}: {
  eyebrow: string;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-[1.65rem] border border-[#315B3E]/12 bg-white p-5 shadow-[0_14px_36px_rgba(19,60,46,0.06)]">
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--federation-secondary)]">
        {eyebrow}
      </p>
      <p className="mt-3 text-sm font-black text-[#60756E]">{label}</p>
      <p className="mt-1 text-2xl font-black text-[#183F37]">{value}</p>
      <p className="mt-2 text-xs font-semibold leading-5 text-[#789087]">
        {detail}
      </p>
    </article>
  );
}

function ChampionCard({
  countryCode,
  label,
  champion,
}: {
  countryCode: string;
  label: string;
  champion?: FederationChampion;
}) {
  const href = champion
    ? champion.category === "professional"
      ? `/jeu/coureurs/${champion.riderId}`
      : `/jeu/centre-de-formation/development/${champion.riderId}`
    : null;

  const content = (
    <span className="flex flex-col items-center text-center">
      {champion ? (
        <RiderAvatar
          profileKey={champion.avatarProfileKey}
          seed={champion.avatarSeed}
          riderId={champion.riderId}
          age={champion.age}
          jersey={createNationalChampionRiderJersey({
            countryCode,
            championshipType: champion.discipline,
          })}
          label={`Portrait de ${champion.riderName}, champion national`}
          className="h-28 w-28 border-4 border-white shadow-lg"
        />
      ) : (
        <span className="grid h-28 w-28 place-items-center rounded-full border-4 border-white bg-[#E8F0EC] text-3xl shadow-lg" aria-hidden="true">
          ♛
        </span>
      )}
      <span className="mt-4 block text-[10px] font-black uppercase tracking-[0.13em] text-[var(--federation-secondary)]">
        {label}
      </span>
      <span className="mt-2 block font-black text-[#183F37]">
        {champion?.riderName ?? "Titre à attribuer"}
      </span>
      <span className="mt-1 block text-xs font-semibold text-[#60756E]">
        {champion?.teamName ?? champion?.seasonName ?? "Prochaine édition automatique"}
      </span>
    </span>
  );

  return href ? (
    <Link
      href={href}
      className="rounded-2xl border border-[#D5AC18]/20 bg-[#FFFDF4] p-5 transition hover:-translate-y-0.5 hover:border-[#D5AC18]/45 hover:shadow-md"
    >
      {content}
    </Link>
  ) : (
    <article className="rounded-2xl border border-dashed border-[#315B3E]/18 bg-[#F8FBF9] p-5">
      {content}
    </article>
  );
}

function TeamJerseyPreview({
  artwork,
  teamName,
}: {
  artwork: FederationTeamJerseyArtwork | undefined;
  teamName: string;
}) {
  if (artwork?.kind === "sponsor") {
    return (
      <span className="relative h-16 w-14 shrink-0 overflow-hidden rounded-xl bg-white shadow-sm">
        <Image
          src={artwork.imagePath}
          alt={`Maillot de ${teamName}`}
          fill
          sizes="56px"
          className="object-contain p-1"
        />
      </span>
    );
  }

  return artwork?.kind === "amateur" ? (
    <span className="grid h-16 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-white shadow-sm">
      <AmateurTeamJersey
        jersey={artwork.jersey}
        teamName={teamName}
        className="h-16 w-14"
      />
    </span>
  ) : (
    <span className="grid h-16 w-14 shrink-0 place-items-center rounded-xl bg-[var(--federation-secondary)] text-xs font-black text-white">
      {getInitials(teamName)}
    </span>
  );
}

function PalmaresList({ palmares }: { palmares: FederationChampion[] }) {
  if (palmares.length === 0) {
    return (
      <div className="mt-5">
        <EmptyState>Le premier titre apparaîtra après son attribution.</EmptyState>
      </div>
    );
  }

  return (
    <ol className="mt-5 max-h-[28rem] space-y-3 overflow-y-auto pr-1">
      {palmares.slice(0, 20).map((title, index) => (
        <li
          key={`${title.category}-${title.discipline}-${title.gameYear}-${title.riderId}-${index}`}
          className="flex items-center gap-3 rounded-2xl bg-[#F2F8F5] px-4 py-3"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-sm font-black text-[var(--federation-secondary)] shadow-sm">
            S{title.gameYear}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-black text-[#183F37]">
              {title.riderName}
            </span>
            <span className="mt-0.5 block text-xs font-semibold text-[#60756E]">
              {title.category === "junior" ? "Junior" : "Professionnel"} ·{" "}
              {title.discipline === "road" ? "Route" : "CLM"}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function LockedFeatureHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="rounded-[2rem] border border-[#315B3E]/12 bg-[var(--federation-primary)] p-6 text-white shadow-[0_18px_45px_rgba(19,60,46,0.14)] sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--federation-accent)]">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-3xl font-black">{title}</h2>
          <p className="mt-3 max-w-4xl text-sm font-semibold leading-6 text-[#D6DFD2]">
            {description}
          </p>
        </div>
        <span className="w-fit shrink-0 rounded-full bg-[#F2C94C] px-4 py-2 text-[10px] font-black uppercase tracking-[0.13em] text-[#19352E]">
          Consultation uniquement
        </span>
      </div>
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--federation-secondary)]">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-black text-[#183F37] sm:text-3xl">
        {title}
      </h2>
      <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#60756E]">
        {description}
      </p>
    </div>
  );
}

function JournalEntry({
  day,
  title,
  detail,
  future = false,
}: {
  day: string;
  title: string;
  detail: string;
  future?: boolean;
}) {
  return (
    <li className="flex gap-4">
      <span
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xs font-black ${future ? "bg-[#EEF3F1] text-[#60756E]" : "bg-[#DDF3E7] text-[var(--federation-secondary)]"}`}
      >
        {day}
      </span>
      <div className="border-b border-[#315B3E]/10 pb-4">
        <p className="font-black text-[#183F37]">{title}</p>
        <p className="mt-1 text-sm font-semibold leading-6 text-[#60756E]">
          {detail}
        </p>
      </div>
    </li>
  );
}

function StatusPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="w-fit rounded-full border border-[#315B3E]/12 bg-[#EEF3F1] px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-[#60756E]">
      {children}
    </span>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-[#315B3E]/20 bg-[#F8FBF9] px-5 py-8 text-center text-sm font-semibold text-[#60756E]">
      {children}
    </p>
  );
}

function CountryFlag({
  countryCode,
  countryName,
}: {
  countryCode: string;
  countryName: string;
}) {
  return (
    <span
      role="img"
      aria-label={`Drapeau : ${countryName}`}
      className={`fi fi-${countryCode.toLowerCase()} text-6xl shadow-sm`}
    />
  );
}

function getInitials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
