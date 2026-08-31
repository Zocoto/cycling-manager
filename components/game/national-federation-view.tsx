import Link from "@/components/ui/app-link";

import {
  GameSectionTabLink,
  GameSectionTabs,
} from "@/components/game/game-section-tabs";
import { SvgCountryFlag } from "@/components/game/svg-country-flag";
import type { GlobalSearchResult } from "@/lib/game/global-search";
import {
  FEDERATION_MANAGEMENT_START_GAME_YEAR,
  getFederationDivisionPreview,
  getFederationManagementPhase,
  type NationalFederationTab,
} from "@/lib/game/national-federations";
import type {
  FederationChampion,
  NationalFederationSnapshot,
} from "@/services/national-federations";
import type { NationRankingEntry } from "@/services/uci-rankings";

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
    id: "governance",
    label: "Gouvernance",
    description: "Présidence et journal public",
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
}: NationalFederationViewProps) {
  const phase = getFederationManagementPhase(snapshot.season.gameYear);
  const division = getFederationDivisionPreview(nationRanking?.rank ?? null);
  const isPreview = phase === "preview";
  const baseHref = `/jeu/federations/${country.code.toLowerCase()}`;

  return (
    <>
      <header className="relative mt-5 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#071A17_0%,#0B302B_52%,#176951_100%)] px-6 py-8 text-white shadow-[0_24px_70px_rgba(19,60,46,0.2)] sm:px-10 sm:py-10">
        <div
          aria-hidden="true"
          className="absolute -right-20 -top-28 h-96 w-96 rounded-full border-[64px] border-white/5"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-1 bg-linear-to-r from-[#42B99A] via-[#F2C94C] to-[#42B99A]"
        />

        <div className="relative grid gap-7 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <span className="flex h-20 w-28 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-xl sm:h-24 sm:w-32">
              <CountryFlag countryCode={country.code} countryName={country.name} />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#9BE0BC]">
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

      {isPreview ? <SeasonTwoPreviewNotice /> : <AutomaticModeNotice />}

      <GameSectionTabs
        ariaLabel="Rubriques de la fédération"
        columns={6}
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
          />
        ) : selectedTab === "selections" ? (
          <SelectionsPanel snapshot={snapshot} />
        ) : selectedTab === "infrastructures" ? (
          <InfrastructuresPanel snapshot={snapshot} />
        ) : selectedTab === "finances" ? (
          <FinancesPanel />
        ) : selectedTab === "governance" ? (
          <GovernancePanel country={country} snapshot={snapshot} />
        ) : (
          <FederationLoungePanel
            countryName={country.name}
            isAffiliated={snapshot.viewer.isAffiliated}
          />
        )}
      </div>
    </>
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
    <aside className="mt-6 rounded-2xl border border-[#278B70]/25 bg-[#E8F7F1] px-5 py-4 text-sm font-bold text-[#176951]">
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
}: {
  country: NationalFederationViewProps["country"];
  snapshot: NationalFederationSnapshot;
  nationRanking: NationRankingEntry | null;
  memberTeams: GlobalSearchResult[];
  memberTeamCount: number;
  divisionLabel: string;
}) {
  return (
    <div className="space-y-7">
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

      <section className="rounded-[2rem] border border-[#315B3E]/12 bg-white p-6 shadow-[0_16px_45px_rgba(19,60,46,0.07)] sm:p-8">
        <SectionHeading
          eyebrow="Maillots distinctifs"
          title="Champions nationaux en titre"
          description="Les championnats restent intégralement automatiques. La fédération expose leurs vainqueurs et conservera leur historique."
        />
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ChampionCard
            label="Professionnels · Route"
            champion={snapshot.champions.professional.road}
          />
          <ChampionCard
            label="Professionnels · CLM"
            champion={snapshot.champions.professional.time_trial}
          />
          <ChampionCard
            label="Juniors · Route"
            champion={snapshot.champions.junior.road}
          />
          <ChampionCard
            label="Juniors · CLM"
            champion={snapshot.champions.junior.time_trial}
          />
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
                  className="flex items-center gap-3 rounded-2xl border border-[#315B3E]/12 bg-[#F8FBF9] p-4 transition hover:-translate-y-0.5 hover:border-[#278B70]/40 hover:shadow-[0_12px_26px_rgba(19,60,46,0.1)]"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#176951] text-xs font-black text-white">
                    {getInitials(team.display_name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-black text-[#183F37]">
                      {team.display_name}
                    </span>
                    <span className="mt-1 block truncate text-xs font-semibold text-[#60756E]">
                      {team.sporting_director_name ?? "Gestion automatique"}
                    </span>
                  </span>
                  <span className="text-lg font-black text-[#278B70]" aria-hidden="true">
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
            eyebrow="Mémoire sportive"
            title="Palmarès de la nation"
            description="Une première chronologie légère des titres nationaux déjà enregistrés."
          />
          <PalmaresList palmares={snapshot.palmares} />
        </section>
      </div>
    </div>
  );
}

function SelectionsPanel({ snapshot }: { snapshot: NationalFederationSnapshot }) {
  const nextGameYear = snapshot.season.gameYear + 1;
  const isQuadriennialSeason = nextGameYear % 4 === 0;
  const events = [
    {
      day: 22,
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
      day: 26,
      name: "Championnats du monde",
      detail: "Sélection nationale · route et contre-la-montre",
    },
  ];

  return (
    <div className="space-y-7">
      <LockedFeatureHeader
        eyebrow="Préparation Saison 3"
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
              <span className="rounded-xl bg-[#123F36] px-3 py-2 text-sm font-black text-white">
                J{event.day}
              </span>
              <StatusPill>Gestion verrouillée</StatusPill>
            </div>
            <h3 className="mt-5 text-xl font-black text-[#183F37]">
              {event.name}
            </h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#60756E]">
              {event.detail}
            </p>
            <p className="mt-5 border-t border-[#315B3E]/10 pt-4 text-xs font-black uppercase tracking-[0.12em] text-[#278B70]">
              Repère arc-en-ciel dans le calendrier
            </p>
          </article>
        ))}
      </section>

      <section className="rounded-[2rem] border border-[#315B3E]/12 bg-white p-6 shadow-[0_16px_45px_rgba(19,60,46,0.07)] sm:p-8">
        <SectionHeading
          eyebrow="Circuit de validation"
          title="Une sélection traçable de J1 au départ"
          description="L’assistant et la boîte mail conserveront chaque proposition, acceptation et refus."
        />
        <ol className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["01", "Proposition du président", "Toutes les compositions peuvent être préparées dès J1."],
            ["02", "Réponse des équipes", "Chaque club accepte ou refuse uniquement ses propres coureurs."],
            ["03", "Révision", "Le président ajuste sa liste à partir des réponses reçues."],
            ["04", "Sécurisation automatique", "Blessures, absences et places vacantes déclenchent les remplaçants."],
          ].map(([number, title, detail]) => (
            <li key={number} className="rounded-2xl bg-[#F2F8F5] p-5">
              <span className="text-2xl font-black text-[#42B99A]">{number}</span>
              <p className="mt-3 font-black text-[#183F37]">{title}</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#60756E]">
                {detail}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function InfrastructuresPanel({
  snapshot,
}: {
  snapshot: NationalFederationSnapshot;
}) {
  const buildings = [
    {
      name: "Bureau fédéral d’intégration",
      effect: "Crée un délai commun de naturalisation, sans cumul avec un meilleur Centre d’accueil d’équipe.",
      icon: "◎",
    },
    {
      name: "Institut fédéral du staff",
      effect: "Améliore subtilement l’efficacité du personnel de nationalité locale.",
      icon: "✦",
    },
    {
      name: "Bureau d’organisation",
      effect: "Augmente la part fédérale issue des courses réellement disputées dans le pays.",
      icon: "⌁",
    },
    {
      name: "Programme avantage du terrain",
      effect: "Renforce progressivement le bonus local des coureurs originaires du pays.",
      icon: "▲",
    },
  ];

  return (
    <div className="space-y-7">
      <section className="overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_45px_rgba(19,60,46,0.07)]">
        <div className="grid gap-6 bg-[#123F36] p-6 text-white sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9BE0BC]">
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
                  <span className="rounded-full bg-[#DDF3E7] px-3 py-1 text-xs font-black text-[#176951]">
                    {academy.qualityLevel} ★
                  </span>
                </div>
                <p className="mt-4 text-sm font-black text-[#278B70]">
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

      <section>
        <SectionHeading
          eyebrow="Patrimoine fédéral"
          title="Bâtiments proposés pour la Saison 3"
          description="Les effets sont présentés pour test, mais aucun chantier ni débit n’est possible pendant la Saison 2."
        />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {buildings.map((building) => (
            <article
              key={building.name}
              className="flex gap-4 rounded-[1.65rem] border border-[#315B3E]/12 bg-white p-5 shadow-[0_14px_36px_rgba(19,60,46,0.06)] sm:p-6"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#123F36] text-xl font-black text-[#F2C94C]">
                {building.icon}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-black text-[#183F37]">{building.name}</h3>
                  <StatusPill>Saison 3</StatusPill>
                </div>
                <p className="mt-2 text-sm font-semibold leading-6 text-[#60756E]">
                  {building.effect}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function FinancesPanel() {
  return (
    <div className="space-y-7">
      <LockedFeatureHeader
        eyebrow="Trésorerie fédérale"
        title="Un budget collectif séparé des équipes"
        description="Le solde sera créé au lancement de la Saison 3. Aucun prélèvement, don ou versement n’est effectué pendant la Saison 2."
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Dotation commune", "Socle identique pour toutes les fédérations actives", "40 %"],
          ["Classement UCI", "Performance nationale de la saison précédente", "25 %"],
          ["Nations Cup", "Résultats du groupe et de la division", "15 %"],
          ["Développement", "Objectifs, jeunesse et participation", "20 %"],
        ].map(([label, detail, value]) => (
          <OverviewMetric
            key={label}
            eyebrow="Dotation annuelle"
            label={label}
            value={value}
            detail={detail}
          />
        ))}
      </section>

      <div className="grid gap-7 lg:grid-cols-2">
        <section className="rounded-[2rem] border border-[#315B3E]/12 bg-white p-6 shadow-[0_16px_45px_rgba(19,60,46,0.07)] sm:p-8">
          <SectionHeading
            eyebrow="Recettes"
            title="Des revenus lisibles et plafonnés"
            description="La fédération percevra une faible part après le règlement effectif des courses du pays."
          />
          <FeatureList
            entries={[
              "Dotation annuelle selon les résultats précédents",
              "Part des courses selon leur rang et leurs partants réels",
              "Dons volontaires et irréversibles des équipes",
              "Revenus et coûts éventuels d’une édition accueillie",
              "Bonus plafonné pour les objectifs fédéraux",
            ]}
          />
        </section>

        <section className="rounded-[2rem] border border-[#315B3E]/12 bg-white p-6 shadow-[0_16px_45px_rgba(19,60,46,0.07)] sm:p-8">
          <SectionHeading
            eyebrow="Redistribution"
            title="Deux aides concrètes"
            description="Aucun transfert discrétionnaire libre ne sera laissé au président."
          />
          <div className="mt-5 space-y-3">
            <AidCard
              title="Fonds de solidarité"
              detail="Répartition automatique vers les équipes affiliées les plus modestes."
            />
            <AidCard
              title="Aide exceptionnelle"
              detail="Soutien rare, plafonné, voté et intégralement inscrit au journal public."
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function GovernancePanel({
  country,
  snapshot,
}: {
  country: NationalFederationViewProps["country"];
  snapshot: NationalFederationSnapshot;
}) {
  return (
    <div className="grid gap-7 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section className="rounded-[2rem] border border-[#315B3E]/12 bg-white p-6 shadow-[0_16px_45px_rgba(19,60,46,0.07)] sm:p-8">
        <SectionHeading
          eyebrow="Présidence"
          title="Mode automatique"
          description="Aucun candidat n’est nécessaire pour que la fédération fonctionne et engage ses sélections."
        />
        <div className="mt-6 rounded-2xl bg-[#123F36] p-6 text-white">
          <p className="text-xs font-black uppercase tracking-[0.15em] text-[#9BE0BC]">
            Direction actuelle
          </p>
          <p className="mt-2 text-2xl font-black">Administration fédérale</p>
          <p className="mt-3 text-sm font-semibold leading-6 text-[#D6DFD2]">
            Les sélections, remplacements et échéances seront traités même sans
            équipe affiliée ou sans candidat à la présidence.
          </p>
        </div>
        <FeatureList
          entries={[
            "Élection tous les deux saisons à compter de la Saison 3",
            "Une voix par équipe affiliée sur la liste électorale figée",
            "Retour automatique au mode assisté après une échéance manquée",
            "Conservation du dernier maillot national valide",
            "Aucune candidature hôte ou création coûteuse en mode automatique",
          ]}
        />

        <article className="mt-6 overflow-hidden rounded-2xl border border-[#315B3E]/12 bg-[#F8FBF9]">
          <div className="grid gap-5 p-5 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center">
            <NationalJerseyPreview
              countryCode={country.code}
              countryName={country.name}
            />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-black text-[#183F37]">
                  Atelier du maillot national
                </h3>
                <StatusPill>Saison 3</StatusPill>
              </div>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#60756E]">
                Le président disposera du drapeau complet et d’une bibliothèque
                contrôlée de ses emblèmes — aigle, feuille, croix, soleil ou
                blason — à déplacer sur le maillot.
              </p>
            </div>
          </div>
        </article>
      </section>

      <section className="rounded-[2rem] border border-[#315B3E]/12 bg-white p-6 shadow-[0_16px_45px_rgba(19,60,46,0.07)] sm:p-8">
        <SectionHeading
          eyebrow="Transparence"
          title="Journal public"
          description="Chaque décision financière ou sportive importante y sera horodatée."
        />
        <ol className="mt-6 space-y-4">
          <JournalEntry
            day={`J${snapshot.season.currentDayNumber}`}
            title="Préfiguration de la fédération ouverte"
            detail="Consultation autorisée sans aucune modification de la Saison 2."
          />
          <JournalEntry
            day="S3"
            title="Gestion automatique programmée"
            detail="La fédération sera opérationnelle même sans président ni équipe affiliée."
            future
          />
          <JournalEntry
            day="S3"
            title="Première liste électorale"
            detail="Les droits seront figés à l’ouverture du scrutin pour empêcher toute double affiliation."
            future
          />
        </ol>
      </section>
    </div>
  );
}

function NationalJerseyPreview({
  countryCode,
  countryName,
}: {
  countryCode: string;
  countryName: string;
}) {
  const clipPathId = `federation-jersey-${countryCode.toLowerCase()}`;

  return (
    <svg
      viewBox="0 0 120 132"
      role="img"
      aria-label={`Aperçu du futur maillot national de ${countryName}`}
      className="mx-auto h-32 w-28 drop-shadow-[0_12px_16px_rgba(19,60,46,0.18)]"
    >
      <defs>
        <clipPath id={clipPathId}>
          <path d="M39 9 19 18 5 48l19 10 8-14v78h56V44l8 14 19-10-14-30-20-9c-4 7-10 10-21 10S43 16 39 9Z" />
        </clipPath>
      </defs>
      <path
        d="M39 9 19 18 5 48l19 10 8-14v78h56V44l8 14 19-10-14-30-20-9c-4 7-10 10-21 10S43 16 39 9Z"
        fill="#F8FBF9"
        stroke="#123F36"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <SvgCountryFlag
        countryCode={countryCode}
        x="5"
        y="8"
        width={110}
        height={116}
        clipPathId={clipPathId}
        preserveAspectRatio="xMidYMid slice"
      />
      <path
        d="M32 72h56v18H32Z"
        fill="#123F36"
        fillOpacity="0.86"
        clipPath={`url(#${clipPathId})`}
      />
      <circle cx="60" cy="81" r="7" fill="#F2C94C" />
      <path
        d="M39 9c4 7 10 10 21 10S77 16 81 9"
        fill="none"
        stroke="#123F36"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
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
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#123F36] text-2xl text-[#F2C94C]">
          ◌
        </span>
        <p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-[#278B70]">
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
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#278B70]">
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
  label,
  champion,
}: {
  label: string;
  champion?: FederationChampion;
}) {
  const href = champion
    ? champion.category === "professional"
      ? `/jeu/coureurs/${champion.riderId}`
      : `/jeu/centre-de-formation/development/${champion.riderId}`
    : null;

  const content = (
    <>
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#FFF4B8] text-xl" aria-hidden="true">
        ♛
      </span>
      <span className="mt-4 block text-[10px] font-black uppercase tracking-[0.13em] text-[#278B70]">
        {label}
      </span>
      <span className="mt-2 block font-black text-[#183F37]">
        {champion?.riderName ?? "Titre à attribuer"}
      </span>
      <span className="mt-1 block text-xs font-semibold text-[#60756E]">
        {champion?.seasonName ?? "Prochaine édition automatique"}
      </span>
    </>
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
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-sm font-black text-[#176951] shadow-sm">
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
    <section className="rounded-[2rem] border border-[#315B3E]/12 bg-[#123F36] p-6 text-white shadow-[0_18px_45px_rgba(19,60,46,0.14)] sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9BE0BC]">
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
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#278B70]">
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

function FeatureList({ entries }: { entries: string[] }) {
  return (
    <ul className="mt-6 space-y-3">
      {entries.map((entry) => (
        <li key={entry} className="flex gap-3 text-sm font-semibold leading-6 text-[#526B62]">
          <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#DDF3E7] text-[10px] font-black text-[#176951]">
            ✓
          </span>
          {entry}
        </li>
      ))}
    </ul>
  );
}

function AidCard({ title, detail }: { title: string; detail: string }) {
  return (
    <article className="rounded-2xl border border-[#315B3E]/12 bg-[#F8FBF9] p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-black text-[#183F37]">{title}</h3>
        <StatusPill>Saison 3</StatusPill>
      </div>
      <p className="mt-2 text-sm font-semibold leading-6 text-[#60756E]">
        {detail}
      </p>
    </article>
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
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xs font-black ${future ? "bg-[#EEF3F1] text-[#60756E]" : "bg-[#DDF3E7] text-[#176951]"}`}
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
