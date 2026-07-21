"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import { runRaceSimulatorAction } from "@/app/jeu/simulateur-course/actions";
import { RaceStageProfile } from "@/components/game/race-stage-profile";
import { RACE_PROFILE_LABELS } from "@/lib/game/race-calendar";
import {
  INITIAL_RACE_SIMULATOR_STATE,
  type RaceSimulatorLogEntry,
  type RaceSimulatorLogType,
  type RaceSimulatorResultRow,
  type RaceSimulatorRun,
  type RaceSimulatorStageOption,
  type RaceSimulatorTeam,
} from "@/lib/game/race-simulator";
import { RACE_ROLE_LABELS } from "@/lib/game/race-simulation";

const MAXIMUM_RIDER_COUNT = 200;

const RATING_LABELS = {
  flat: "Plaine",
  mountain: "Montagne",
  hills: "Vallons",
  cobbles: "Pavés",
  downhill: "Descente",
  sprint: "Sprint",
  acceleration: "Accélération",
  timeTrial: "Chrono",
  prologue: "Prologue",
  endurance: "Endurance",
  resistance: "Résistance",
  recovery: "Récupération",
  breakaway: "Échappée",
} as const;

const LOG_FILTERS: Array<{
  value: "all" | RaceSimulatorLogType;
  label: string;
}> = [
  { value: "all", label: "Tout" },
  { value: "event", label: "Événements" },
  { value: "group", label: "Groupes" },
  { value: "incident", label: "Incidents" },
  { value: "prime", label: "Primes" },
  { value: "result", label: "Résultat" },
];

export function RaceSimulatorWorkbench({
  stages,
  teams,
}: {
  stages: RaceSimulatorStageOption[];
  teams: RaceSimulatorTeam[];
}) {
  const allRiderIds = useMemo(
    () => teams.flatMap((team) => team.riders.map((rider) => rider.id)),
    [teams]
  );
  const contractedRiderIds = useMemo(
    () =>
      teams
        .filter((team) => team.kind === "team")
        .flatMap((team) => team.riders.map((rider) => rider.id)),
    [teams]
  );
  const [selectedRiderIds, setSelectedRiderIds] = useState<string[]>(() =>
    (contractedRiderIds.length >= 2 ? contractedRiderIds : allRiderIds).slice(
      0,
      MAXIMUM_RIDER_COUNT
    )
  );
  const [selectedStageId, setSelectedStageId] = useState(stages[0]?.id ?? "");
  const [seed, setSeed] = useState("laboratoire-1");
  const [teamSearch, setTeamSearch] = useState("");
  const [logFilter, setLogFilter] = useState<"all" | RaceSimulatorLogType>(
    "all"
  );
  const [state, formAction, pending] = useActionState(
    runRaceSimulatorAction,
    INITIAL_RACE_SIMULATOR_STATE
  );
  const resultRef = useRef<HTMLDivElement>(null);
  const selectedSet = useMemo(
    () => new Set(selectedRiderIds),
    [selectedRiderIds]
  );
  const selectedStage =
    stages.find((stage) => stage.id === selectedStageId) ?? stages[0];
  const normalizedSearch = teamSearch.trim().toLocaleLowerCase("fr");
  const visibleTeams = teams.filter((team) => {
    if (!normalizedSearch) return true;
    return (
      team.name.toLocaleLowerCase("fr").includes(normalizedSearch) ||
      team.riders.some((rider) =>
        `${rider.firstName} ${rider.lastName}`
          .toLocaleLowerCase("fr")
          .includes(normalizedSearch)
      )
    );
  });
  const selectedTeamCount = teams.filter((team) =>
    team.riders.some((rider) => selectedSet.has(rider.id))
  ).length;
  const selectionIsValid = selectedRiderIds.length >= 2;

  useEffect(() => {
    if (state.status === "success") {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [state]);

  function toggleTeam(team: RaceSimulatorTeam) {
    const teamIds = team.riders.map((rider) => rider.id);
    const allSelected = teamIds.every((riderId) => selectedSet.has(riderId));
    setSelectedRiderIds((current) => {
      if (allSelected) {
        return current.filter((riderId) => !teamIds.includes(riderId));
      }
      return [
        ...new Set([...current, ...teamIds]),
      ].slice(0, MAXIMUM_RIDER_COUNT);
    });
  }

  function toggleRider(riderId: string) {
    setSelectedRiderIds((current) =>
      current.includes(riderId)
        ? current.filter((id) => id !== riderId)
        : current.length < MAXIMUM_RIDER_COUNT
          ? [...current, riderId]
          : current
    );
  }

  function selectVisibleTeams() {
    const visibleIds = visibleTeams.flatMap((team) =>
      team.riders.map((rider) => rider.id)
    );
    setSelectedRiderIds((current) =>
      [...new Set([...current, ...visibleIds])].slice(0, MAXIMUM_RIDER_COUNT)
    );
  }

  return (
    <div className="space-y-8">
      <form action={formAction} className="space-y-6">
        {selectedRiderIds.map((riderId) => (
          <input key={riderId} type="hidden" name="riderIds" value={riderId} />
        ))}

        <section className="overflow-hidden rounded-[2rem] border border-[#315B3E]/15 bg-white shadow-[0_24px_70px_rgba(19,60,46,0.11)]">
          <header className="border-b border-[#315B3E]/10 bg-[linear-gradient(135deg,#071A17,#176951)] px-6 py-6 text-white sm:px-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#9BE0CA]">
                  Étape 1 · profil de course
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  Choisir une course existante
                </h2>
              </div>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#D6E7DF]">
                {stages.length} profil{stages.length > 1 ? "s" : ""} en base
              </span>
            </div>
          </header>

          <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[minmax(17rem,0.72fr)_minmax(0,1.28fr)]">
            <div className="space-y-5">
              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.16em] text-[#315B3E]">
                  Profil de course
                </span>
                <select
                  name="stageId"
                  value={selectedStageId}
                  onChange={(event) => setSelectedStageId(event.target.value)}
                  className="mt-2 min-h-12 w-full rounded-xl border border-[#315B3E]/25 bg-[#F8FBF9] px-4 text-sm font-black text-[#183F37] outline-none transition focus:border-[#278B70] focus:ring-2 focus:ring-[#278B70]/20"
                >
                  {stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.16em] text-[#315B3E]">
                  Graine de simulation
                </span>
                <span className="mt-2 flex gap-2">
                  <input
                    name="seed"
                    value={seed}
                    onChange={(event) => setSeed(event.target.value)}
                    required
                    maxLength={80}
                    className="min-h-12 min-w-0 flex-1 rounded-xl border border-[#315B3E]/25 bg-[#F8FBF9] px-4 text-sm font-bold text-[#183F37] outline-none transition focus:border-[#278B70] focus:ring-2 focus:ring-[#278B70]/20"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setSeed(`test-${Date.now().toString(36)}`)
                    }
                    className="min-h-12 rounded-xl border border-[#176951]/20 bg-[#DDF3E7] px-4 text-xs font-black text-[#176951] transition hover:bg-[#C8EBD9]"
                  >
                    Nouvelle
                  </button>
                </span>
              </label>

              {selectedStage ? (
                <dl className="grid grid-cols-2 gap-3 rounded-2xl border border-[#315B3E]/10 bg-[#F3F8F5] p-4 text-sm">
                  <StageFact
                    label="Profil"
                    value={RACE_PROFILE_LABELS[selectedStage.profileType]}
                  />
                  <StageFact
                    label="Distance"
                    value={`${formatDecimal(selectedStage.distanceKm)} km`}
                  />
                  <StageFact
                    label="Type"
                    value={formatStageType(selectedStage.stageType)}
                  />
                  <StageFact
                    label="Tronçons"
                    value={String(selectedStage.segments.length)}
                  />
                </dl>
              ) : null}
            </div>

            {selectedStage ? (
              <div className="rounded-2xl border border-[#315B3E]/12 bg-[#0B302B] p-4 sm:p-5">
                <RaceStageProfile
                  segments={selectedStage.segments}
                  tone="dark"
                  showLegend
                />
              </div>
            ) : null}
          </div>
        </section>

        <section className="overflow-hidden rounded-[2rem] border border-[#315B3E]/15 bg-white shadow-[0_24px_70px_rgba(19,60,46,0.11)]">
          <header className="border-b border-[#315B3E]/10 px-6 py-6 sm:px-8">
            <div className="flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#278B70]">
                  Étape 2 · start-list libre
                </p>
                <h2 className="mt-2 text-2xl font-black text-[#183F37]">
                  Inscrire les équipes et choisir les agents libres
                </h2>
                <p className="mt-2 text-sm font-semibold text-[#60756E]">
                  {selectedRiderIds.length} coureurs · {selectedTeamCount} équipes sélectionnées
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={selectVisibleTeams}
                  className="min-h-10 rounded-xl border border-[#176951]/20 bg-[#DDF3E7] px-4 text-xs font-black text-[#176951] transition hover:bg-[#C8EBD9]"
                >
                  Tout sélectionner
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRiderIds([])}
                  className="min-h-10 rounded-xl border border-[#315B3E]/15 bg-white px-4 text-xs font-black text-[#60756E] transition hover:bg-[#F3F8F5]"
                >
                  Vider
                </button>
              </div>
            </div>

            <label className="mt-5 block max-w-xl">
              <span className="sr-only">Filtrer les équipes et les coureurs</span>
              <input
                type="search"
                value={teamSearch}
                onChange={(event) => setTeamSearch(event.target.value)}
                placeholder="Filtrer une équipe ou un coureur…"
                className="min-h-11 w-full rounded-xl border border-[#315B3E]/20 bg-[#F8FBF9] px-4 text-sm font-bold text-[#183F37] outline-none transition focus:border-[#278B70] focus:ring-2 focus:ring-[#278B70]/20"
              />
            </label>
          </header>

          <div className="grid gap-4 p-5 sm:p-8 xl:grid-cols-2">
            {visibleTeams.map((team) => (
              <TeamSelectionCard
                key={team.id}
                team={team}
                selectedSet={selectedSet}
                selectedCount={selectedRiderIds.length}
                onToggleTeam={() => toggleTeam(team)}
                onToggleRider={toggleRider}
              />
            ))}
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-[#315B3E]/10 bg-[#F3F8F5] px-6 py-5 sm:px-8">
            <div>
              <p className="font-black text-[#183F37]">
                {selectedRiderIds.length} / {MAXIMUM_RIDER_COUNT} coureurs
              </p>
              <p className="mt-1 text-xs font-semibold text-[#60756E]">
                Les rôles sont attribués automatiquement par le moteur selon le profil choisi.
              </p>
            </div>
            <button
              type="submit"
              disabled={!selectionIsValid || pending}
              className="inline-flex min-h-13 items-center justify-center rounded-xl bg-[#F2C94C] px-7 py-3 text-sm font-black uppercase tracking-wide text-[#17261E] shadow-md transition hover:-translate-y-0.5 hover:bg-[#F7DA73] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
            >
              {pending ? "Simulation en cours…" : "Lancer la course"}
            </button>
          </footer>
        </section>
      </form>

      {state.status !== "idle" ? (
        <div
          role="status"
          className={`rounded-2xl border px-5 py-4 text-sm font-bold ${
            state.status === "success"
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : "border-red-300 bg-red-50 text-red-900"
          }`}
        >
          {state.message}
        </div>
      ) : null}

      {state.run ? (
        <div ref={resultRef} className="scroll-mt-6 space-y-6">
          <SimulationSummary run={state.run} />
          <SimulationClassification results={state.run.results} />
          <SimulationLogs
            logs={state.run.logs}
            filter={logFilter}
            onFilterChange={setLogFilter}
          />
        </div>
      ) : null}
    </div>
  );
}

function TeamSelectionCard({
  team,
  selectedSet,
  selectedCount,
  onToggleTeam,
  onToggleRider,
}: {
  team: RaceSimulatorTeam;
  selectedSet: Set<string>;
  selectedCount: number;
  onToggleTeam: () => void;
  onToggleRider: (riderId: string) => void;
}) {
  const selectedRiders = team.riders.filter((rider) => selectedSet.has(rider.id));
  const allSelected = selectedRiders.length === team.riders.length;

  return (
    <fieldset className="overflow-hidden rounded-2xl border border-[#315B3E]/15 bg-[#F8FBF9]">
      <legend className="sr-only">{team.name}</legend>
      <div
        className="flex items-center justify-between gap-3 border-b border-[#315B3E]/10 px-4 py-3"
        style={{ borderLeft: `6px solid ${team.primaryColor}` }}
      >
        <button
          type="button"
          onClick={onToggleTeam}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span
            aria-hidden="true"
            className="h-9 w-9 shrink-0 rounded-xl border-2 shadow-sm"
            style={{
              background: `linear-gradient(135deg, ${team.primaryColor} 0 50%, ${team.secondaryColor} 50% 100%)`,
              borderColor: `${team.primaryColor}66`,
            }}
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-black text-[#183F37]">
              {team.name}
            </span>
            <span className="mt-0.5 block text-[11px] font-bold text-[#60756E]">
              {team.kind === "free_agent_pool" ? "Bassin de test · " : ""}
              {selectedRiders.length} / {team.riders.length} sélectionnés
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={onToggleTeam}
          className={`min-h-9 rounded-lg px-3 text-[10px] font-black uppercase tracking-wide transition ${
            allSelected
              ? "bg-[#176951] text-white"
              : "border border-[#176951]/20 bg-white text-[#176951] hover:bg-[#DDF3E7]"
          }`}
        >
          {allSelected ? "Sélectionnés" : "Sélectionner"}
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto p-2">
        {team.riders.map((rider) => {
          const checked = selectedSet.has(rider.id);
          const disabled = !checked && selectedCount >= MAXIMUM_RIDER_COUNT;
          return (
            <label
              key={rider.id}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${
                checked ? "bg-[#DDF3E7]" : "hover:bg-white"
              } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => onToggleRider(rider.id)}
                className="h-4 w-4 shrink-0 accent-[#176951]"
              />
              <span
                className={`fi fi-${rider.countryCode.toLowerCase()} shrink-0 rounded-sm shadow-sm`}
                role="img"
                aria-label={`Drapeau ${rider.countryName}`}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black text-[#183F37]">
                  {rider.firstName} {rider.lastName}
                </span>
                <span className="mt-0.5 block text-[10px] font-bold text-[#60756E]">
                  {rider.age} ans · forme {rider.form} · MOY {getOverall(rider.ratings)}
                </span>
              </span>
              <span className="hidden items-center gap-1.5 sm:flex">
                <RatingChip label="MON" value={rider.ratings.mountain} />
                <RatingChip label="VAL" value={rider.ratings.hills} />
                <RatingChip label="BAR" value={rider.ratings.breakaway} />
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function RatingChip({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-[#176951] shadow-sm">
      {label} {value}
    </span>
  );
}

function SimulationSummary({
  run,
}: {
  run: RaceSimulatorRun;
}) {
  const podium = run.results.filter((result) => result.rank !== null).slice(0, 3);
  return (
    <section className="overflow-hidden rounded-[2rem] bg-[#071A17] text-white shadow-[0_28px_80px_rgba(7,26,23,0.24)]">
      <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(66,185,154,0.22),transparent_42%)] px-6 py-6 sm:px-8">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#9BE0CA]">
          Simulation terminée · seed {run.seed}
        </p>
        <h2 className="mt-2 text-3xl font-black">{run.stageName}</h2>
        <p className="mt-2 text-sm font-semibold text-[#AFC6BB]">
          {formatDecimal(run.distanceKm)} km · {run.segmentCount} tronçons · {run.riderCount} coureurs · {run.teamCount} équipes
        </p>
      </div>
      <div className="grid gap-3 p-5 sm:grid-cols-3 sm:p-8">
        {podium.map((result, index) => (
          <article
            key={result.riderId}
            className={`relative overflow-hidden rounded-2xl border p-5 ${
              index === 0
                ? "border-[#F2C94C]/50 bg-[#F2C94C]/10 sm:-translate-y-2"
                : "border-white/10 bg-white/5"
            }`}
          >
            <span className="text-3xl font-black text-[#F2C94C]">
              {result.rank}
            </span>
            <h3 className="mt-3 text-lg font-black">{result.riderName}</h3>
            <p className="mt-1 text-xs font-bold text-[#AFC6BB]">
              {result.teamName}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <NoteBadge label="Profil" value={result.profileNote} highlighted />
              <NoteBadge label="MOY" value={result.overallNote} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function SimulationClassification({
  results,
}: {
  results: RaceSimulatorResultRow[];
}) {
  const winnerTime = results.find((result) => result.rank === 1)?.elapsedTimeSeconds ?? 0;
  return (
    <section className="overflow-hidden rounded-[2rem] border border-[#315B3E]/15 bg-white shadow-[0_24px_70px_rgba(19,60,46,0.1)]">
      <header className="border-b border-[#315B3E]/10 px-6 py-5 sm:px-8">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#278B70]">
          Classement et notes du moteur
        </p>
        <h2 className="mt-2 text-2xl font-black text-[#183F37]">
          Résultats complets
        </h2>
      </header>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left">
          <thead className="bg-[#F3F8F5] text-[10px] font-black uppercase tracking-wider text-[#60756E]">
            <tr>
              <th className="px-4 py-3 sm:px-6">Rang</th>
              <th className="px-4 py-3">Coureur</th>
              <th className="px-4 py-3">Temps</th>
              <th className="px-4 py-3">Profil</th>
              <th className="px-4 py-3">Moy.</th>
              <th className="px-4 py-3">Forme</th>
              <th className="px-4 py-3">Énergie</th>
              <th className="px-4 py-3 sm:px-6">Détail des notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#315B3E]/10">
            {results.map((result) => (
              <tr key={result.riderId} className="align-top hover:bg-[#F8FBF9]">
                <td className="px-4 py-4 sm:px-6">
                  <span className={`grid h-9 w-9 place-items-center rounded-full text-sm font-black ${getRankClassName(result.rank)}`}>
                    {result.rank ?? "AB"}
                  </span>
                </td>
                <td className="min-w-56 px-4 py-4">
                  <p className="font-black text-[#183F37]">{result.riderName}</p>
                  <p className="mt-1 flex items-center gap-2 text-xs font-bold text-[#60756E]">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: result.teamPrimaryColor }}
                    />
                    {result.teamName}
                  </p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[#78947D]">
                    {RACE_ROLE_LABELS[result.role]}
                    {result.injuryLabel ? ` · ${result.injuryLabel}` : ""}
                  </p>
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm font-black text-[#183F37]">
                  {result.status === "did_not_finish" ? (
                    <span className="text-red-700">Abandon</span>
                  ) : result.rank === 1 ? (
                    formatDuration(winnerTime)
                  ) : (
                    `+${formatGap(result.gapToWinnerSeconds)}`
                  )}
                </td>
                <td className="px-4 py-4"><NoteBadge label="PRO" value={result.profileNote} highlighted /></td>
                <td className="px-4 py-4"><NoteBadge label="MOY" value={result.overallNote} /></td>
                <td className="px-4 py-4 text-sm font-black text-[#183F37]">{result.form}</td>
                <td className="px-4 py-4 text-sm font-black text-[#176951]">{formatDecimal(result.energyAfter)}</td>
                <td className="min-w-80 px-4 py-4 sm:px-6">
                  <details>
                    <summary className="cursor-pointer text-xs font-black text-[#176951] underline decoration-[#176951]/25 underline-offset-4">
                      Afficher les 13 notes
                    </summary>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {Object.entries(result.ratings).map(([key, value]) => (
                        <span key={key} className="rounded-lg bg-[#F3F8F5] px-2 py-1.5 text-[10px] font-bold text-[#60756E]">
                          {RATING_LABELS[key as keyof typeof RATING_LABELS]} <strong className="text-[#183F37]">{value}</strong>
                        </span>
                      ))}
                    </div>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SimulationLogs({
  logs,
  filter,
  onFilterChange,
}: {
  logs: RaceSimulatorLogEntry[];
  filter: "all" | RaceSimulatorLogType;
  onFilterChange: (filter: "all" | RaceSimulatorLogType) => void;
}) {
  const filteredLogs =
    filter === "all" ? logs : logs.filter((log) => log.type === filter);
  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#071A17] text-white shadow-[0_24px_70px_rgba(7,26,23,0.2)]">
      <header className="border-b border-white/10 px-6 py-5 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#72D4B7]">
              Trace détaillée
            </p>
            <h2 className="mt-2 text-2xl font-black">Journal du moteur</h2>
            <p className="mt-2 text-sm font-semibold text-[#AFC6BB]">
              {logs.length} entrées : rôles, tronçons, groupes, écarts, énergie, événements et incidents.
            </p>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1.5 font-mono text-[10px] font-bold text-[#BFD1C6]">
            lecture seule
          </span>
        </div>
        <nav className="mt-5 flex flex-wrap gap-2" aria-label="Filtrer le journal">
          {LOG_FILTERS.map((candidate) => (
            <button
              key={candidate.value}
              type="button"
              onClick={() => onFilterChange(candidate.value)}
              className={`min-h-9 rounded-lg px-3 text-[10px] font-black uppercase tracking-wide transition ${
                filter === candidate.value
                  ? "bg-[#F2C94C] text-[#17261E]"
                  : "border border-white/10 bg-white/5 text-[#BFD1C6] hover:bg-white/10"
              }`}
            >
              {candidate.label}
            </button>
          ))}
        </nav>
      </header>
      <ol className="max-h-[58rem] overflow-y-auto divide-y divide-white/[0.07]">
        {filteredLogs.map((log) => (
          <li key={log.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[6rem_9rem_minmax(0,1fr)] sm:px-8">
            <span className="font-mono text-[10px] font-bold text-[#78998C]">
              #{String(log.sequence).padStart(3, "0")}
              {log.completedDistanceKm !== null
                ? ` · ${formatDecimal(log.completedDistanceKm)} km`
                : ""}
            </span>
            <span className={`h-fit w-fit rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${getLogTypeClassName(log.type)}`}>
              {formatLogType(log.type)}
            </span>
            <span>
              <strong className="block text-sm text-[#FFFDF4]">{log.title}</strong>
              <span className="mt-1 block font-mono text-xs leading-6 text-[#BFD1C6]">{log.message}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function StageFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-black uppercase tracking-wider text-[#78947D]">{label}</dt>
      <dd className="mt-1 font-black text-[#183F37]">{value}</dd>
    </div>
  );
}

function NoteBadge({
  label,
  value,
  highlighted = false,
}: {
  label: string;
  value: number;
  highlighted?: boolean;
}) {
  return (
    <span className={`inline-flex min-w-16 items-center justify-center rounded-full px-2.5 py-1 text-[10px] font-black ${
      highlighted
        ? "bg-[#F2C94C] text-[#17261E]"
        : "bg-[#DDF3E7] text-[#176951]"
    }`}>
      {label} {formatDecimal(value)}
    </span>
  );
}

function getOverall(ratings: RaceSimulatorTeam["riders"][number]["ratings"]) {
  const values = Object.values(ratings);
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function getRankClassName(rank: number | null) {
  if (rank === 1) return "bg-[#F2C94C] text-[#17261E]";
  if (rank === 2) return "bg-[#D9E1E5] text-[#314148]";
  if (rank === 3) return "bg-[#D9A06D] text-[#42220C]";
  if (rank === null) return "bg-red-100 text-red-700";
  return "bg-[#DDF3E7] text-[#176951]";
}

function getLogTypeClassName(type: RaceSimulatorLogType) {
  if (type === "incident") return "bg-red-400/15 text-red-200";
  if (type === "prime") return "bg-[#F2C94C]/15 text-[#F2C94C]";
  if (type === "result") return "bg-purple-400/15 text-purple-200";
  if (type === "event") return "bg-blue-400/15 text-blue-200";
  if (type === "group") return "bg-emerald-400/15 text-emerald-200";
  return "bg-white/10 text-[#BFD1C6]";
}

function formatLogType(type: RaceSimulatorLogType) {
  const labels: Record<RaceSimulatorLogType, string> = {
    setup: "Initialisation",
    segment: "Tronçon",
    event: "Événement",
    group: "Groupe",
    incident: "Incident",
    prime: "Prime",
    result: "Résultat",
  };
  return labels[type];
}

function formatStageType(type: RaceSimulatorStageOption["stageType"]) {
  if (type === "individual_time_trial") return "Chrono individuel";
  if (type === "team_time_trial") return "Chrono par équipes";
  if (type === "prologue") return "Prologue";
  return "Course en ligne";
}

function formatDuration(totalSeconds: number) {
  const rounded = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(rounded / 3_600);
  const minutes = Math.floor((rounded % 3_600) / 60);
  const seconds = rounded % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}′ ${String(seconds).padStart(2, "0")}″`;
}

function formatGap(totalSeconds: number) {
  const rounded = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return minutes > 0
    ? `${minutes}′ ${String(seconds).padStart(2, "0")}″`
    : `${seconds}″`;
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 1,
  }).format(value);
}
