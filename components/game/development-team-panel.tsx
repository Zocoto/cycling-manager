import Link from "@/components/ui/app-link";

import { registerDevelopmentRaceAction } from "@/app/jeu/centre-de-formation/development-actions";
import type {
  DevelopmentRace,
  DevelopmentRaceProfile,
  DevelopmentRaceResult,
  DevelopmentRider,
  DevelopmentTeamOverview,
} from "@/services/development-team";
import {
  createAmateurRiderJersey,
  createNationalChampionRiderJersey,
  createWorldChampionRiderJersey,
  type RiderJerseyAppearance,
} from "@/lib/rider-jersey";
import type { AmateurJerseyConfig } from "@/lib/amateur-team";

import { AmateurTeamJersey } from "./amateur-team-jersey";
import { DevelopmentPodiumProgressionBadge } from "./development-podium-progression-badge";
import {
  GameSectionTabLink,
  GameSectionTabs,
} from "./game-section-tabs";
import { DevelopmentTeamBuilder } from "./development-team-builder";
import { DevelopmentTeamJerseyEditor } from "./development-team-jersey-editor";
import { DevelopmentTeamRosterEditor } from "./development-team-roster-editor";
import { RiderAvatar } from "./rider-avatar";

export type DevelopmentTeamView =
  | "effectif"
  | "calendrier"
  | "resultats"
  | "maillot";

const PROFILE_LABELS: Record<DevelopmentRaceProfile, string> = {
  flat: "Plaine",
  sprint: "Sprint",
  hilly: "Vallonné",
  mountain: "Montagne",
  cobbles: "Pavés",
  time_trial: "Contre-la-montre",
  mixed: "Mixte",
};

export function DevelopmentTeamPanel({
  overview,
  activeView,
}: {
  overview: DevelopmentTeamOverview;
  activeView: DevelopmentTeamView;
}) {
  if (!overview.team) {
    return <DevelopmentTeamOpening overview={overview} />;
  }

  return (
    <div className="mt-7 space-y-5">
      <DevelopmentTeamHero overview={overview} />
      {overview.seasonThreeCompetitionEnabled ? (
        <Link
          href="/jeu/classements?circuit=juniors&vue=individuel"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#F2C94C]/35 bg-[#FFF8D8] px-5 py-4 text-sm font-black text-[#705400] transition hover:border-[#D8A900] hover:bg-[#FFF3BC]"
        >
          <span>Classements juniors S3 · individuel, Dev Teams et nations</span>
          <span aria-hidden="true">Voir les classements →</span>
        </Link>
      ) : null}
      <DevelopmentTeamNavigation activeView={activeView} overview={overview} />
      {activeView === "effectif" ? <DevelopmentRoster overview={overview} /> : null}
      {activeView === "calendrier" ? <DevelopmentCalendar overview={overview} /> : null}
      {activeView === "resultats" ? <DevelopmentResults overview={overview} /> : null}
      {activeView === "maillot" ? (
        <DevelopmentTeamJerseyEditor
          teamName={overview.team.displayName}
          initialJersey={overview.team.jersey}
        />
      ) : null}
    </div>
  );
}

function DevelopmentTeamOpening({ overview }: { overview: DevelopmentTeamOverview }) {
  return (
    <div className="mt-7 space-y-5">
      <section className="relative overflow-hidden rounded-[2rem] bg-[linear-gradient(125deg,#071A17_0%,#0B302B_58%,#176951_100%)] p-7 text-white shadow-[0_24px_65px_rgba(7,26,23,0.2)] sm:p-9">
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <span className="inline-flex rounded-full bg-[#F2C94C] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#071A17]">
              Nouvelle structure jouable
            </span>
            <h2 className="mt-4 text-4xl font-black tracking-[-0.045em] sm:text-5xl">
              Fondez {overview.expectedTeamName}
            </h2>
            <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-[#D6E3DE] sm:text-base">
              Sélectionnez la génération qui courra sous vos couleurs, dessinez son
              maillot puis engagez-la sur {overview.races.length} rendez-vous juniors sans écran live :
              chaque classique livre son classement à l’arrivée et chaque tour publie ses étapes jour après jour.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <OpeningMetric value="J1–J7" label="Création" />
            <OpeningMetric value="11" label="Coureurs max." />
            <OpeningMetric value={String(overview.races.length)} label="Épreuves" />
          </div>
        </div>
      </section>

      {overview.creationWindowOpen ? (
        overview.eligibleRiders.length ? (
          <DevelopmentTeamBuilder
            teamName={overview.expectedTeamName}
            riders={overview.eligibleRiders}
            defaultJersey={overview.defaultJersey}
          />
        ) : (
          <EmptyState
            title="L’école doit d’abord accueillir un junior"
            detail="Signez au moins un jeune depuis un rapport de scouting avant la fin de J7."
          />
        )
      ) : (
        <section className="rounded-[1.75rem] border border-[#D89A31]/30 bg-[#FFF8DF] p-6">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9A6818]">
            Fenêtre annuelle fermée
          </p>
          <h3 className="mt-2 text-2xl font-black text-[#63440F]">
            La sélection ouvrira à J1 de la prochaine saison
          </h3>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#85662F]">
            Nous sommes à J{overview.currentDayNumber}. La composition est volontairement
            limitée à J1–J7 pour éviter qu’un DS ne recrute des spécialistes après avoir
            découvert le parcours des premières courses.
          </p>
        </section>
      )}

      <CalendarPreview races={overview.races} />
    </div>
  );
}

function DevelopmentTeamHero({ overview }: { overview: DevelopmentTeamOverview }) {
  const team = overview.team!;
  return (
    <section className="overflow-hidden rounded-[2rem] bg-[#0B302B] p-6 text-white shadow-[0_20px_55px_rgba(7,26,23,0.18)] sm:p-7">
      <div className="grid gap-6 lg:grid-cols-[180px_minmax(0,1fr)_auto] lg:items-center">
        <div className="rounded-2xl bg-white/5 p-2 text-center">
          <AmateurTeamJersey
            jersey={team.jersey}
            teamName={team.displayName}
            className="mx-auto h-40 w-32 drop-shadow-xl"
          />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9BE0CA]">
            {overview.seasonName} · Année junior
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
            {team.displayName}
          </h2>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#C5DAD2]">
            {overview.rosterEditable
              ? `L’effectif reste modifiable jusqu’à la fin de J7. Nous sommes à J${overview.currentDayNumber}.`
              : "L’effectif est verrouillé depuis J8 pour le reste de la saison."} Les
            inscriptions restent libres course par course jusqu’à la veille du départ.
          </p>
          {overview.seasonThreeCompetitionEnabled ? (
            <p className="mt-3 text-xs font-black text-[#F2C94C]">
              Circuit S3 actif · barèmes officiels, CN dès 16 ans, Mondiaux et Piccolo Giro.
            </p>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
          <HeroMetric value={overview.roster.length} label="Juniors" />
          <HeroMetric value={overview.statistics.registrations} label="Engagements" />
          <HeroMetric value={overview.statistics.podiums} label="Podiums" />
          <HeroMetric value={overview.statistics.wins} label="Victoires" />
        </div>
      </div>
    </section>
  );
}

function DevelopmentTeamNavigation({
  activeView,
  overview,
}: {
  activeView: DevelopmentTeamView;
  overview: DevelopmentTeamOverview;
}) {
  const items: Array<[DevelopmentTeamView, string, string]> = [
    ["effectif", "Effectif", `${overview.roster.length} juniors`],
    ["calendrier", "Calendrier", `${overview.races.length} épreuves`],
    ["resultats", "Résultats", `${overview.statistics.completedRaces} classés`],
    ["maillot", "Maillot", "Identité visuelle"],
  ];
  return (
    <GameSectionTabs
      ariaLabel="Vues de l’équipe de développement"
      columns={4}
    >
      {items.map(([view, label, detail]) => (
        <GameSectionTabLink
          key={view}
          href={`/jeu/centre-de-formation?onglet=development&dev=${view}`}
          active={view === activeView}
          label={label}
          description={detail}
        />
      ))}
    </GameSectionTabs>
  );
}

function DevelopmentRoster({ overview }: { overview: DevelopmentTeamOverview }) {
  return (
    <section>
      <SectionTitle
        eyebrow="Effectif de développement"
        title="Les onze de demain"
        detail={
          overview.rosterEditable
            ? "La composition peut encore évoluer jusqu’à la fin de J7. Ouvrez une fiche pour consulter le profil détaillé d’un junior."
            : "La composition est figée depuis J8. Ouvrez une fiche pour consulter les notes, les affinités météo et les résultats détaillés."
        }
      />
      {overview.rosterEditable ? (
        <DevelopmentTeamRosterEditor
          riders={overview.eligibleRiders}
          selectedRiderIds={overview.roster.map((rider) => rider.id)}
        />
      ) : null}
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {overview.roster.map((rider) => (
          <Link
            key={rider.id}
            href={`/jeu/centre-de-formation/development/${rider.id}`}
            className="group flex items-center gap-4 rounded-2xl border border-[#315B3E]/12 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#176951]/35 hover:shadow-md"
          >
            <div className="relative">
              <RiderAvatar
                riderId={rider.id}
                profileKey={rider.profileKey}
                seed={rider.avatarSeed}
                age={rider.age}
                jersey={getDevelopmentRiderJersey(rider, overview.team!.jersey)}
                label={`${rider.firstName} ${rider.lastName}`}
                className="h-16 w-16 border-2 border-[#E5F4ED]"
              />
              <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-[#F2C94C] text-[10px] font-black text-[#071A17]">
                {rider.raceNumber}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-black text-[#183F37] group-hover:text-[#176951]">
                {rider.firstName} {rider.lastName}
              </p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#60756E]">
                {rider.countryCode} · {rider.age} ans · Junior
              </p>
              <p className="mt-2 text-xs font-black text-[#278B70]">
                {rider.sportingProfile}
              </p>
              <RiderCompetitionBadges rider={rider} />
            </div>
            <span className="text-lg font-black text-[#A6B8B1] transition group-hover:translate-x-1 group-hover:text-[#176951]">→</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function DevelopmentCalendar({ overview }: { overview: DevelopmentTeamOverview }) {
  return (
    <section>
      <SectionTitle
        eyebrow="Calendrier U19"
        title="Dix rendez-vous, des résultats au fil des jours"
        detail="Chaque étape d’un tour est publiée le jour où elle se dispute. Une sélection peut être remplacée jusqu’à la veille du départ."
      />
      <div className="mt-4 space-y-3">
        {overview.races.map((race) => (
          <RaceRegistrationCard key={race.id} race={race} overview={overview} />
        ))}
      </div>
    </section>
  );
}

function RaceRegistrationCard({
  race,
  overview,
}: {
  race: DevelopmentRace;
  overview: DevelopmentTeamOverview;
}) {
  const selectedIds = new Set(race.registration?.riderIds ?? []);
  const registeredRiders = overview.roster.filter((rider) => selectedIds.has(rider.id));
  const eligibleRiders = overview.roster.filter((rider) =>
    isRiderEligibleForDevelopmentRace(rider, race),
  );
  return (
    <article className="overflow-hidden rounded-2xl border border-[#315B3E]/12 bg-white shadow-sm">
      <div className="grid gap-4 p-4 lg:grid-cols-[100px_minmax(0,1fr)_auto] lg:items-center sm:p-5">
        <div className="rounded-xl bg-[#EAF5F3] px-3 py-3 text-center">
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#60756E]">Jour</p>
          <p className="mt-1 text-2xl font-black text-[#176951]">
            {race.startDayNumber === race.endDayNumber ? `J${race.startDayNumber}` : `J${race.startDayNumber}–${race.endDayNumber}`}
          </p>
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {race.isWorldChampionship ? <Badge tone="world">Mondial junior</Badge> : null}
            {race.competitionType.startsWith("national_") ? <Badge tone="national">CN junior</Badge> : null}
            {race.raceFormat === "stage_race" ? <Badge tone="tour">Mini-tour</Badge> : null}
            <Badge tone="profile">{PROFILE_LABELS[race.profileType]}</Badge>
          </div>
          <h3 className="mt-2 text-xl font-black text-[#183F37]">{race.name}</h3>
          <p className="mt-1 text-xs font-semibold text-[#60756E]">
            <span className={`fi fi-${race.countryCode.toLowerCase()} mr-2 rounded-sm`} />
            {race.locationName} · {race.stages.length} étape{race.stages.length > 1 ? "s" : ""} · sélection {race.selectionMinimum}–{race.selectionMaximum}
          </p>
          {race.selectionMode === "automatic" ? (
            <p className="mt-2 text-[10px] font-black uppercase tracking-[0.08em] text-[#5A2D82]">
              Sélection nationale automatique · top {race.selectionMaximum} de chaque nation
            </p>
          ) : null}
          {race.stages.length > 1 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {race.stages.map((stage) => (
                <span key={stage.id} className="rounded-full bg-[#F4F7F5] px-2 py-1 text-[9px] font-bold text-[#60756E]">
                  J{stage.dayNumber} · {PROFILE_LABELS[stage.profileType]} · {stage.distanceKm} km
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <RaceStatus
          race={race}
          registeredCount={registeredRiders.length}
          currentDayNumber={overview.currentDayNumber}
        />
      </div>

      {race.canRegister ? (
        <details className="border-t border-[#315B3E]/10 bg-[#FAFCFB]">
          <summary className="cursor-pointer px-5 py-3 text-xs font-black text-[#176951]">
            {race.registration ? "Modifier la sélection" : "Composer la sélection"}
          </summary>
          <form action={registerDevelopmentRaceAction} className="border-t border-[#315B3E]/8 p-4 sm:p-5">
            <input type="hidden" name="raceEditionId" value={race.id} />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {eligibleRiders.map((rider) => (
                <label key={rider.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#315B3E]/12 bg-white p-3">
                  <input
                    type="checkbox"
                    name="riderIds"
                    value={rider.id}
                    defaultChecked={selectedIds.has(rider.id)}
                    className="h-4 w-4 accent-[#176951]"
                  />
                  <RiderAvatar
                    riderId={rider.id}
                    profileKey={rider.profileKey}
                    seed={rider.avatarSeed}
                    age={rider.age}
                    jersey={getDevelopmentRiderJersey(rider, overview.team!.jersey)}
                    label={`${rider.firstName} ${rider.lastName}`}
                    className="h-10 w-10"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-black text-[#183F37]">{rider.firstName} {rider.lastName}</span>
                    <span className="text-[9px] font-bold text-[#60756E]">{rider.sportingProfile}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-semibold text-[#60756E]">
                Entre {race.selectionMinimum} et {race.selectionMaximum} coureurs · clôture au début de J{race.startDayNumber}
              </p>
              <button type="submit" className="min-h-11 rounded-xl bg-[#176951] px-5 text-xs font-black uppercase tracking-[0.08em] text-white">
                Enregistrer l’engagement
              </button>
            </div>
          </form>
        </details>
      ) : race.registration ? (
        <div className="flex flex-wrap gap-2 border-t border-[#315B3E]/10 bg-[#FAFCFB] px-5 py-3">
          {registeredRiders.map((rider) => (
            <span key={rider.id} className="rounded-full bg-[#E5F4ED] px-3 py-1 text-[10px] font-black text-[#176951]">
              {rider.firstName} {rider.lastName}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function DevelopmentResults({ overview }: { overview: DevelopmentTeamOverview }) {
  const raceIdsWithResults = new Set(
    overview.results.map((result) => result.raceEditionId),
  );
  const publishedRaces = overview.races.filter((race) =>
    raceIdsWithResults.has(race.id),
  );
  if (!publishedRaces.length) {
    return <EmptyState title="Les premiers résultats arriveront à J8" detail="Les classiques sont publiées à l’arrivée et les étapes des tours apparaissent chaque jour de course." />;
  }
  return (
    <section>
      <SectionTitle
        eyebrow="Résultats bruts"
        title="La vérité de la ligne"
        detail="Les étapes sont dévoilées au fil du tour. Le classement général final, les primes et les progressions sont validés à l’arrivée."
      />
      <div className="mt-4 space-y-4">
        {publishedRaces.map((race, index) => (
          <RaceResultsBlock
            key={race.id}
            race={race}
            results={overview.results}
            developmentTeamId={overview.team!.id}
            defaultOpen={index === publishedRaces.length - 1}
          />
        ))}
      </div>
    </section>
  );
}

function RaceResultsBlock({
  race,
  results,
  developmentTeamId,
  defaultOpen,
}: {
  race: DevelopmentRace;
  results: DevelopmentRaceResult[];
  developmentTeamId: string;
  defaultOpen: boolean;
}) {
  const general = results
    .filter((result) => result.raceEditionId === race.id && result.scope === "general")
    .sort((left, right) => left.rank - right.rank);
  const publishedStages = race.stages.filter((stage) =>
    results.some(
      (result) => result.stageId === stage.id && result.scope === "stage",
    ),
  );
  const latestPublishedStage = publishedStages.at(-1) ?? null;
  const latestStageResults = latestPublishedStage
    ? results
        .filter(
          (result) =>
            result.stageId === latestPublishedStage.id &&
            result.scope === "stage",
        )
        .sort((left, right) => left.rank - right.rank)
    : [];
  const bestOwn =
    general.find((result) => result.developmentTeamId === developmentTeamId) ??
    latestStageResults.find(
      (result) => result.developmentTeamId === developmentTeamId,
    );
  const bestOwnLabel = general.length
    ? "Meilleur au général"
    : latestPublishedStage
      ? `Dernière étape · n°${latestPublishedStage.number}`
      : "Meilleur résultat";
  return (
    <details open={defaultOpen} className="overflow-hidden rounded-2xl border border-[#315B3E]/12 bg-white shadow-sm">
      <summary className="cursor-pointer list-none p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge tone={race.isWorldChampionship ? "world" : race.raceFormat === "stage_race" ? "tour" : "profile"}>
                {race.isWorldChampionship ? "Mondial" : race.raceFormat === "stage_race" ? "Mini-tour" : PROFILE_LABELS[race.profileType]}
              </Badge>
              <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#789087]">
                {race.status === "completed"
                  ? `J${race.endDayNumber}`
                  : `${publishedStages.length}/${race.stages.length} étapes`}
              </span>
            </div>
            <h3 className="mt-2 text-xl font-black text-[#183F37]">{race.name}</h3>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#789087]">{bestOwnLabel}</p>
            <p className="mt-1 text-lg font-black text-[#176951]">{bestOwn ? `${bestOwn.rank}${bestOwn.rank === 1 ? "er" : "e"}` : "Non engagé"}</p>
          </div>
        </div>
      </summary>
      <div className="border-t border-[#315B3E]/10 p-4 sm:p-5">
        {race.raceFormat === "stage_race"
          ? publishedStages.map((stage) => {
              const stageResults = results
                .filter((result) => result.stageId === stage.id && result.scope === "stage")
                .sort((left, right) => left.rank - right.rank);
              return (
                <ResultTable
                  key={stage.id}
                  title={`Étape ${stage.number} · ${stage.name}`}
                  results={stageResults}
                  developmentTeamId={developmentTeamId}
                />
              );
            })
          : null}
        {general.length ? (
          <ResultTable
            title={race.raceFormat === "stage_race" ? "Classement général final" : "Classement final"}
            results={general}
            developmentTeamId={developmentTeamId}
          />
        ) : race.raceFormat === "stage_race" ? (
          <p className="rounded-xl border border-[#315B3E]/10 bg-[#F8FBF9] px-4 py-3 text-xs font-bold text-[#60756E]">
            Le classement général final sera publié après la dernière étape.
          </p>
        ) : null}
      </div>
    </details>
  );
}

function ResultTable({
  title,
  results,
  developmentTeamId,
}: {
  title: string;
  results: DevelopmentRaceResult[];
  developmentTeamId: string;
}) {
  return (
    <div className="mb-5 last:mb-0">
      <h4 className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#315B3E]">{title}</h4>
      <div className="overflow-x-auto rounded-xl border border-[#315B3E]/10">
        <table className="w-full min-w-[680px] border-collapse text-left text-xs">
          <thead className="bg-[#0B302B] text-white">
            <tr><th className="px-3 py-2.5 text-center">#</th><th className="px-3 py-2.5">Coureur</th><th className="px-3 py-2.5">Équipe</th><th className="px-3 py-2.5 text-right">Pts</th><th className="px-3 py-2.5 text-right">Temps</th><th className="px-3 py-2.5 text-right">Écart</th></tr>
          </thead>
          <tbody>
            {results.map((result) => {
              const own = result.developmentTeamId === developmentTeamId;
              return (
                <tr key={result.id} className={own ? "bg-[#FFF6C9] font-black" : "odd:bg-white even:bg-[#F8FBF9]"}>
                  <td className="px-3 py-2.5 text-center font-black text-[#176951]">{result.rank}</td>
                  <td className="px-3 py-2.5 text-[#183F37]">
                    <DevelopmentResultRiderLink result={result} />
                    <span className="ml-2 text-[9px] font-bold text-[#789087]">{result.countryCode}</span>
                    {result.podiumProgression ? (
                      <DevelopmentPodiumProgressionBadge
                        progression={result.podiumProgression}
                      />
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 text-[#60756E]">{result.teamName}</td>
                  <td className="px-3 py-2.5 text-right font-black tabular-nums text-[#B57B00]">{result.points || "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#183F37]">{formatRaceTime(result.elapsedTimeSeconds)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#60756E]">{result.gapToWinnerSeconds === 0 ? "—" : `+${formatGap(result.gapToWinnerSeconds)}`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DevelopmentResultRiderLink({
  result,
}: {
  result: Pick<DevelopmentRaceResult, "academyRiderId" | "riderName">;
}) {
  return result.academyRiderId ? (
    <Link
      href={`/jeu/centre-de-formation/development/${result.academyRiderId}`}
      className="hover:text-[#176951] hover:underline"
    >
      {result.riderName}
    </Link>
  ) : (
    result.riderName
  );
}

function CalendarPreview({ races }: { races: DevelopmentRace[] }) {
  return (
    <section className="rounded-[1.75rem] border border-[#315B3E]/12 bg-white p-5 shadow-sm sm:p-6">
      <SectionTitle eyebrow="Aperçu du programme" title="Le calendrier de la relève" detail={`${races.length} épreuves de J8 à J27, avec les championnats nationaux, le Piccolo Giro et les deux titres mondiaux juniors.`} />
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {races.map((race) => (
          <div key={race.id} className="rounded-xl border border-[#315B3E]/10 bg-[#FAFCFB] p-3">
            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#278B70]">J{race.startDayNumber}{race.endDayNumber !== race.startDayNumber ? `–${race.endDayNumber}` : ""}</p>
            <p className="mt-1 text-xs font-black text-[#183F37]">{race.shortName}</p>
            <p className="mt-1 text-[9px] font-bold text-[#789087]">{race.isWorldChampionship ? "Championnat du monde" : race.competitionType.startsWith("national_") ? "Championnat national" : race.raceFormat === "stage_race" ? `${race.stages.length} étapes · Mini-GT` : PROFILE_LABELS[race.profileType]}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function RaceStatus({
  race,
  registeredCount,
  currentDayNumber,
}: {
  race: DevelopmentRace;
  registeredCount: number;
  currentDayNumber: number;
}) {
  if (race.status === "completed") return <span className="rounded-full bg-[#E5F4ED] px-3 py-2 text-[10px] font-black uppercase text-[#176951]">Résultats publiés</span>;
  if (race.raceFormat === "stage_race" && currentDayNumber >= race.startDayNumber && currentDayNumber < race.endDayNumber) return <span className="rounded-full bg-[#E4ECFF] px-3 py-2 text-[10px] font-black uppercase text-[#234B9A]">Tour en cours</span>;
  if (currentDayNumber >= race.endDayNumber) return <span className="rounded-full bg-[#EEF1EF] px-3 py-2 text-[10px] font-black uppercase text-[#60756E]">Résultats en cours</span>;
  if (race.registration) return <span className="rounded-full bg-[#FFF3BC] px-3 py-2 text-[10px] font-black uppercase text-[#7A5B00]">{registeredCount} engagés</span>;
  if (!race.canRegister) return <span className="rounded-full bg-[#EEF1EF] px-3 py-2 text-[10px] font-black uppercase text-[#789087]">Inscriptions closes</span>;
  return <span className="rounded-full bg-[#176951] px-3 py-2 text-[10px] font-black uppercase text-white">À composer</span>;
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "world" | "national" | "tour" | "profile" }) {
  const classes = tone === "world" ? "bg-[#E6D9F5] text-[#5A2D82]" : tone === "national" ? "bg-[#E4ECFF] text-[#234B9A]" : tone === "tour" ? "bg-[#FFF0B8] text-[#705400]" : "bg-[#E5F4ED] text-[#176951]";
  return <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] ${classes}`}>{children}</span>;
}

function SectionTitle({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
  return <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#278B70]">{eyebrow}</p><h3 className="mt-2 text-2xl font-black text-[#071A17]">{title}</h3><p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#60756E]">{detail}</p></div>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <section className="rounded-[1.75rem] border border-dashed border-[#315B3E]/25 bg-white p-10 text-center"><h3 className="text-2xl font-black text-[#183F37]">{title}</h3><p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-6 text-[#60756E]">{detail}</p></section>;
}

function OpeningMetric({ value, label }: { value: string; label: string }) {
  return <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-center"><p className="text-lg font-black text-[#F2C94C]">{value}</p><p className="mt-1 text-[8px] font-black uppercase tracking-[0.12em] text-[#B9D5CA]">{label}</p></div>;
}

function HeroMetric({ value, label }: { value: number; label: string }) {
  return <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-center"><p className="text-xl font-black text-[#F2C94C]">{value}</p><p className="mt-1 text-[8px] font-black uppercase tracking-[0.12em] text-[#B9D5CA]">{label}</p></div>;
}

function formatRaceTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  return hours > 0 ? `${hours}h ${String(minutes).padStart(2, "0")}′ ${String(remaining).padStart(2, "0")}″` : `${minutes}′ ${String(remaining).padStart(2, "0")}″`;
}

function formatGap(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return minutes > 0 ? `${minutes}′ ${String(remaining).padStart(2, "0")}″` : `${remaining}″`;
}

function getDevelopmentRiderJersey(
  rider: DevelopmentRider,
  teamJersey: AmateurJerseyConfig,
): RiderJerseyAppearance {
  if (rider.championshipTitle?.level === "world") {
    return createWorldChampionRiderJersey({
      championshipType: rider.championshipTitle.discipline,
    });
  }
  if (rider.championshipTitle?.level === "national") {
    return createNationalChampionRiderJersey({
      countryCode: rider.championshipTitle.countryCode,
      championshipType: rider.championshipTitle.discipline,
    });
  }
  return createAmateurRiderJersey(teamJersey);
}

function RiderCompetitionBadges({ rider }: { rider: DevelopmentRider }) {
  if (!rider.championshipTitle && !rider.proNationalCallup) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {rider.championshipTitle ? (
        <span className="rounded-full bg-[#FFF0B8] px-2 py-1 text-[8px] font-black uppercase text-[#705400]">
          {rider.championshipTitle.level === "world" ? "Champion du monde" : "Champion national"} · {rider.championshipTitle.discipline === "road" ? "Route" : "CLM"}
        </span>
      ) : null}
      {rider.proNationalCallup ? (
        <span className="rounded-full bg-[#E4ECFF] px-2 py-1 text-[8px] font-black uppercase text-[#234B9A]">
          Appelé en CN pro
        </span>
      ) : null}
    </div>
  );
}

function isRiderEligibleForDevelopmentRace(
  rider: DevelopmentRider,
  race: DevelopmentRace,
) {
  if (!race.competitionType.startsWith("national_")) return true;
  return rider.age >= 16 && rider.countryCode === race.countryCode;
}
