"use client";

import Link from "@/components/ui/app-link";
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";

import {
  completeTutorialRaceAction,
  runTutorialRaceAction,
} from "@/app/jeu/course-initiation/actions";
import { useTutorial } from "@/components/tutorial/tutorial-provider";
import {
  TUTORIAL_RACE_SEGMENTS,
  TUTORIAL_RACE_SELECTION_SIZE,
  type TutorialRaceRider,
} from "@/lib/tutorial/tutorial-race";
import type { RaceSimulatorRun } from "@/lib/game/race-simulator";

type TutorialRacePhase =
  | "selection"
  | "live"
  | "results";

export function TutorialRaceExperience({
  riders,
  teamName,
  initialRun,
  initialSelectedRiderIds,
  initiallyCompleted,
}: {
  riders: TutorialRaceRider[];
  teamName: string;
  initialRun: RaceSimulatorRun | null;
  initialSelectedRiderIds: string[];
  initiallyCompleted: boolean;
}) {
  const router = useRouter();

  const {
    synchronizeTutorialProgress,
  } = useTutorial();

  const [
    selectedRiderIds,
    setSelectedRiderIds,
  ] = useState<string[]>(() =>
    initialSelectedRiderIds.filter(
      (riderId) =>
        riders.some(
          (rider) => rider.id === riderId,
        ),
    ),
  );

  const [run, setRun] =
    useState<RaceSimulatorRun | null>(
      initialRun,
    );

  const [phase, setPhase] =
    useState<TutorialRacePhase>(
      initialRun
        ? "results"
        : "selection",
    );

  const [
    visibleLogCount,
    setVisibleLogCount,
  ] = useState(
    initialRun
      ? initialRun.logs.length
      : 0,
  );

  const [paused, setPaused] =
    useState(false);

  const [speed, setSpeed] =
    useState<1 | 2 | 4>(2);

  const [completed, setCompleted] =
    useState(initiallyCompleted);

  const [message, setMessage] =
    useState<string | null>(null);

  const [isPending, startTransition] =
    useTransition();

  const selectedRiders = useMemo(
    () =>
      selectedRiderIds
        .map((riderId) =>
          riders.find(
            (rider) =>
              rider.id === riderId,
          ),
        )
        .filter(
          (
            rider,
          ): rider is TutorialRaceRider =>
            Boolean(rider),
        ),
    [riders, selectedRiderIds],
  );

  useEffect(() => {
    if (
      phase !== "live" ||
      !run ||
      paused
    ) {
      return;
    }

    const intervalId =
      window.setInterval(() => {
        setVisibleLogCount((current) => {
          const next = Math.min(
            run.logs.length,
            current + 1,
          );

          if (next >= run.logs.length) {
            window.clearInterval(
              intervalId,
            );

            window.setTimeout(() => {
              setPhase("results");
            }, 450);
          }

          return next;
        });
      }, Math.max(160, 850 / speed));

    return () => {
      window.clearInterval(intervalId);
    };
  }, [paused, phase, run, speed]);

  function toggleRider(riderId: string) {
    setSelectedRiderIds((current) => {
      if (current.includes(riderId)) {
        return current.filter(
          (candidate) =>
            candidate !== riderId,
        );
      }

      if (
        current.length >=
        TUTORIAL_RACE_SELECTION_SIZE
      ) {
        setMessage(
          `La sélection est limitée à ${TUTORIAL_RACE_SELECTION_SIZE} coureurs.`,
        );

        return current;
      }

      setMessage(null);
      return [...current, riderId];
    });
  }

  function runSimulation() {
    if (
      selectedRiderIds.length !==
      TUTORIAL_RACE_SELECTION_SIZE
    ) {
      setMessage(
        `Sélectionnez exactement ${TUTORIAL_RACE_SELECTION_SIZE} coureurs.`,
      );

      return;
    }

    startTransition(async () => {
      setMessage(null);

      const result =
        await runTutorialRaceAction({
          riderIds:
            selectedRiderIds,
        });

      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      synchronizeTutorialProgress(
        result.progress,
      );

      setRun(result.run);
      setVisibleLogCount(
        Math.min(2, result.run.logs.length),
      );
      setPaused(false);
      setPhase("live");
    });
  }

  function completeJourney() {
    startTransition(async () => {
      setMessage(null);

      const result =
        await completeTutorialRaceAction();

      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      synchronizeTutorialProgress(
        result.progress,
      );

      setCompleted(true);
      router.refresh();
    });
  }

  function restartExperience() {
    setRun(null);
    setVisibleLogCount(0);
    setPaused(false);
    setMessage(null);
    setPhase("selection");
  }

  return (
    <div className="space-y-6">
      <TutorialRaceProgress
        phase={phase}
        completed={completed}
      />

      <RaceProfile />

      {message ? (
        <p
          role="alert"
          className="rounded-xl border border-[#D6A63C]/30 bg-[#FFF4D6] px-4 py-3 text-sm font-bold text-[#765A18]"
        >
          {message}
        </p>
      ) : null}

      {phase === "selection" ? (
        <SelectionPanel
          riders={riders}
          selectedRiderIds={
            selectedRiderIds
          }
          teamName={teamName}
          pending={isPending}
          onToggle={toggleRider}
          onRun={runSimulation}
        />
      ) : null}

      {phase === "live" && run ? (
        <LivePanel
          run={run}
          visibleLogCount={
            visibleLogCount
          }
          paused={paused}
          speed={speed}
          onTogglePause={() =>
            setPaused((current) => !current)
          }
          onSpeedChange={setSpeed}
          onShowResults={() => {
            setVisibleLogCount(
              run.logs.length,
            );
            setPhase("results");
          }}
        />
      ) : null}

      {phase === "results" && run ? (
        <ResultsPanel
          run={run}
          teamName={teamName}
          completed={completed}
          pending={isPending}
          onComplete={completeJourney}
          onRestart={restartExperience}
        />
      ) : null}
    </div>
  );
}

function TutorialRaceProgress({
  phase,
  completed,
}: {
  phase: TutorialRacePhase;
  completed: boolean;
}) {
  const steps = [
    {
      key: "selection",
      label: "Sélection",
    },
    {
      key: "live",
      label: "Direct",
    },
    {
      key: "results",
      label: "Résultats",
    },
  ] as const;

  const activeIndex = completed
    ? steps.length
    : steps.findIndex(
        (step) => step.key === phase,
      );

  return (
    <nav
      aria-label="Progression de la course d’initiation"
      className="grid gap-2 rounded-2xl border border-[#315B3E]/15 bg-white p-3 shadow-sm sm:grid-cols-3"
    >
      {steps.map((step, index) => {
        const done =
          completed || index < activeIndex;
        const active =
          !completed &&
          index === activeIndex;

        return (
          <div
            key={step.key}
            className={[
              "flex items-center gap-3 rounded-xl px-4 py-3",
              done
                ? "bg-[#DDF3E7] text-[#176951]"
                : active
                  ? "bg-[#0B302B] text-white"
                  : "bg-[#F5F9F7] text-[#789087]",
            ].join(" ")}
          >
            <span className="grid h-7 w-7 place-items-center rounded-full border border-current text-xs font-black">
              {done ? "✓" : index + 1}
            </span>

            <span className="text-sm font-black">
              {step.label}
            </span>
          </div>
        );
      })}
    </nav>
  );
}

function RaceProfile() {
  const labels = {
    flat: "Plaine",
    climb: "Montée",
    descent: "Descente",
  } as const;

  return (
    <section
      data-tutorial-id="tutorial-race-profile"
      className="overflow-hidden rounded-2xl border border-[#315B3E]/15 bg-white shadow-[0_18px_50px_rgba(19,60,46,0.09)]"
    >
      <header className="bg-[#0B302B] px-6 py-5 text-white">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#7CCF9C]">
          Profil pédagogique
        </p>

        <h2 className="mt-1 text-xl font-black">
          120 km · six terrains à lire
        </h2>

        <p className="mt-2 text-sm font-semibold leading-6 text-[#BFD1C6]">
          Comparez les notes principales de vos coureurs avec les difficultés
          successives du parcours.
        </p>
      </header>

      <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-6">
        {TUTORIAL_RACE_SEGMENTS.map(
          (segment) => (
            <article
              key={segment.segmentNumber}
              className={[
                "rounded-xl border p-4",
                segment.surface ===
                "cobbles"
                  ? "border-[#7D6951]/25 bg-[#F3EFE8]"
                  : segment.terrain ===
                      "climb"
                    ? "border-[#C66C4B]/25 bg-[#FFF1EA]"
                    : segment.terrain ===
                        "descent"
                      ? "border-[#4B78A8]/25 bg-[#EDF5FC]"
                      : "border-[#278B70]/15 bg-[#F2F8F5]",
              ].join(" ")}
            >
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#789087]">
                Tronçon {segment.segmentNumber}
              </p>

              <p className="mt-2 font-black text-[#183F37]">
                {labels[segment.terrain]}
              </p>

              <p className="mt-1 text-xs font-semibold text-[#60756E]">
                {segment.distanceKm} km
                {segment.averageGradientPct !==
                0
                  ? ` · ${segment.averageGradientPct > 0 ? "+" : ""}${segment.averageGradientPct} %`
                  : ""}
              </p>

              {segment.surface ===
              "cobbles" ? (
                <span className="mt-3 inline-flex rounded-full bg-[#7D6951]/12 px-2 py-1 text-[10px] font-black text-[#6A5843]">
                  Pavés
                </span>
              ) : null}
            </article>
          ),
        )}
      </div>
    </section>
  );
}

function SelectionPanel({
  riders,
  selectedRiderIds,
  teamName,
  pending,
  onToggle,
  onRun,
}: {
  riders: TutorialRaceRider[];
  selectedRiderIds: string[];
  teamName: string;
  pending: boolean;
  onToggle: (riderId: string) => void;
  onRun: () => void;
}) {
  return (
    <section
      data-tutorial-id="tutorial-race-selection"
      className="overflow-hidden rounded-2xl border border-[#315B3E]/15 bg-white shadow-[0_20px_55px_rgba(19,60,46,0.1)]"
    >
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#315B3E]/10 bg-[#F5F9F7] px-6 py-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#278B70]">
            {teamName}
          </p>

          <h2 className="mt-1 text-2xl font-black">
            Choisissez cinq coureurs
          </h2>

          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#60756E]">
            Commencez par MON, VAL, PLA, PAV, SPR, CLM et PRO. Les autres
            caractéristiques affinent ensuite votre décision.
          </p>
        </div>

        <span className="rounded-full bg-[#0B302B] px-4 py-2 text-sm font-black text-white">
          {selectedRiderIds.length} / {TUTORIAL_RACE_SELECTION_SIZE}
        </span>
      </header>

      <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
        {riders.map((rider) => {
          const selected =
            selectedRiderIds.includes(
              rider.id,
            );

          return (
            <button
              key={rider.id}
              type="button"
              aria-pressed={selected}
              disabled={
                pending ||
                (!selected &&
                  selectedRiderIds.length >=
                    TUTORIAL_RACE_SELECTION_SIZE)
              }
              onClick={() =>
                onToggle(rider.id)
              }
              className={[
                "rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]",
                selected
                  ? "border-[#278B70] bg-[#E1F4EC] shadow-sm"
                  : "border-[#315B3E]/15 bg-white hover:border-[#278B70]/40 hover:bg-[#F8FBF9]",
                pending
                  ? "cursor-wait opacity-60"
                  : "",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-[#183F37]">
                    {rider.firstName} {rider.lastName}
                  </p>

                  <p className="mt-1 text-xs font-semibold text-[#60756E]">
                    {rider.countryCode.toUpperCase()} · {rider.age} ans
                  </p>
                </div>

                <span
                  className={[
                    "grid h-7 w-7 place-items-center rounded-full border text-xs font-black",
                    selected
                      ? "border-[#176951] bg-[#176951] text-white"
                      : "border-[#315B3E]/25 text-transparent",
                  ].join(" ")}
                >
                  ✓
                </span>
              </div>

              <div className="mt-4 grid grid-cols-7 gap-1">
                {[
                  ["MON", rider.ratings.mountain],
                  ["VAL", rider.ratings.hills],
                  ["PLA", rider.ratings.flat],
                  ["PAV", rider.ratings.cobbles],
                  ["SPR", rider.ratings.sprint],
                  ["CLM", rider.ratings.timeTrial],
                  ["PRO", rider.ratings.prologue],
                ].map(([label, value]) => (
                  <span
                    key={String(label)}
                    title={`${label} : ${value}`}
                    className="rounded-md bg-[#0B302B] px-1 py-1.5 text-center"
                  >
                    <span className="block text-[8px] font-black text-[#9BE0BC]">
                      {label}
                    </span>

                    <span className="mt-0.5 block text-xs font-black text-white">
                      {value}
                    </span>
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <footer className="border-t border-[#315B3E]/10 bg-[#F5F9F7] px-6 py-5">
        <button
          type="button"
          disabled={
            pending ||
            selectedRiderIds.length !==
              TUTORIAL_RACE_SELECTION_SIZE
          }
          onClick={onRun}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#F2C94C] px-6 text-sm font-black uppercase tracking-[0.08em] text-[#071A17] shadow-md transition hover:bg-[#FFD968] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#B8C5BE] disabled:text-[#60756E] disabled:shadow-none"
        >
          {pending
            ? "Simulation en cours…"
            : "Lancer le direct"}
        </button>
      </footer>
    </section>
  );
}

function LivePanel({
  run,
  visibleLogCount,
  paused,
  speed,
  onTogglePause,
  onSpeedChange,
  onShowResults,
}: {
  run: RaceSimulatorRun;
  visibleLogCount: number;
  paused: boolean;
  speed: 1 | 2 | 4;
  onTogglePause: () => void;
  onSpeedChange: (
    speed: 1 | 2 | 4,
  ) => void;
  onShowResults: () => void;
}) {
  const visibleLogs =
    run.logs.slice(
      0,
      visibleLogCount,
    );

  const progress =
    run.logs.length > 0
      ? Math.round(
          (visibleLogCount /
            run.logs.length) *
            100,
        )
      : 100;

  return (
    <section
      data-tutorial-id="tutorial-race-live"
      className="overflow-hidden rounded-2xl border border-[#315B3E]/15 bg-[#071A17] text-white shadow-[0_24px_70px_rgba(7,26,23,0.24)]"
    >
      <header className="border-b border-white/10 bg-white/[0.04] px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#7CCF9C]">
              Replay accéléré · moteur officiel
            </p>

            <h2 className="mt-1 text-2xl font-black">
              Direct du Critérium
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onTogglePause}
              className="min-h-9 rounded-lg border border-white/15 bg-white/8 px-3 text-xs font-black transition hover:bg-white/14"
            >
              {paused ? "Reprendre" : "Pause"}
            </button>

            {[1, 2, 4].map(
              (candidate) => (
                <button
                  key={candidate}
                  type="button"
                  aria-pressed={
                    speed === candidate
                  }
                  onClick={() =>
                    onSpeedChange(
                      candidate as 1 | 2 | 4,
                    )
                  }
                  className={[
                    "min-h-9 rounded-lg border px-3 text-xs font-black transition",
                    speed === candidate
                      ? "border-[#F2C94C] bg-[#F2C94C] text-[#071A17]"
                      : "border-white/15 bg-white/8 text-white hover:bg-white/14",
                  ].join(" ")}
                >
                  ×{candidate}
                </button>
              ),
            )}

            <button
              type="button"
              onClick={onShowResults}
              className="min-h-9 rounded-lg bg-[#176951] px-4 text-xs font-black text-white transition hover:bg-[#278B70]"
            >
              Voir le classement
            </button>
          </div>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[#F2C94C] transition-[width] duration-200"
            style={{
              width: `${progress}%`,
            }}
          />
        </div>

        <p className="mt-2 text-xs font-bold text-[#BFD1C6]">
          {visibleLogCount} / {run.logs.length} événements révélés
        </p>
      </header>

      <ol className="max-h-[620px] divide-y divide-white/10 overflow-y-auto">
        {visibleLogs.map((log) => (
          <li
            key={log.id}
            className="grid gap-2 px-6 py-4 sm:grid-cols-[110px_minmax(0,1fr)]"
          >
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7CCF9C]">
              {log.completedDistanceKm !==
              null
                ? `${Math.round(log.completedDistanceKm)} km`
                : "Course"}
            </span>

            <span>
              <span className="block text-sm font-black text-white">
                {log.title}
              </span>

              <span className="mt-1 block text-sm font-semibold leading-6 text-[#BFD1C6]">
                {log.message}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ResultsPanel({
  run,
  teamName,
  completed,
  pending,
  onComplete,
  onRestart,
}: {
  run: RaceSimulatorRun;
  teamName: string;
  completed: boolean;
  pending: boolean;
  onComplete: () => void;
  onRestart: () => void;
}) {
  const classified = [...run.results]
    .filter(
      (result) =>
        result.rank !== null,
    )
    .sort(
      (left, right) =>
        (left.rank ?? 999) -
        (right.rank ?? 999),
    );

  return (
    <section
      data-tutorial-id="tutorial-race-results"
      className="overflow-hidden rounded-2xl border border-[#315B3E]/15 bg-white shadow-[0_22px_60px_rgba(19,60,46,0.11)]"
    >
      <header className="border-b border-[#315B3E]/10 bg-[#0B302B] px-6 py-6 text-white">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#7CCF9C]">
          Résultat de démonstration
        </p>

        <h2 className="mt-1 text-2xl font-black">
          Classement final
        </h2>

        <p className="mt-2 text-sm font-semibold leading-6 text-[#BFD1C6]">
          Ce classement n’est ajouté ni à la saison, ni au palmarès, ni aux
          finances, ni aux objectifs sportifs.
        </p>
      </header>

      <div className="overflow-x-auto">
        <table className="min-w-[760px] w-full border-collapse">
          <thead>
            <tr className="border-b border-[#315B3E]/10 bg-[#F5F9F7] text-left text-[10px] font-black uppercase tracking-[0.14em] text-[#60756E]">
              <th className="px-5 py-4">
                Rang
              </th>
              <th className="px-5 py-4">
                Coureur
              </th>
              <th className="px-5 py-4">
                Équipe
              </th>
              <th className="px-5 py-4 text-right">
                Écart
              </th>
              <th className="px-5 py-4 text-right">
                Note profil
              </th>
            </tr>
          </thead>

          <tbody>
            {classified.map((result) => {
              const isOwnTeam =
                result.teamName === teamName;

              return (
                <tr
                  key={result.riderId}
                  className={[
                    "border-b border-[#315B3E]/10 last:border-b-0",
                    isOwnTeam
                      ? "bg-[#E7F5EF]"
                      : "bg-white",
                  ].join(" ")}
                >
                  <td className="px-5 py-4 text-lg font-black text-[#183F37]">
                    {result.rank}
                  </td>

                  <td className="px-5 py-4">
                    <p className="font-black text-[#183F37]">
                      {result.riderName}
                    </p>

                    {result.injuryLabel ? (
                      <p className="mt-1 text-xs font-bold text-[#B54242]">
                        Incident simulé : {result.injuryLabel}
                      </p>
                    ) : null}
                  </td>

                  <td className="px-5 py-4 text-sm font-semibold text-[#60756E]">
                    {result.teamName}
                    {isOwnTeam ? " · votre équipe" : ""}
                  </td>

                  <td className="px-5 py-4 text-right font-black text-[#48665F]">
                    {formatGap(
                      result.gapToWinnerSeconds,
                    )}
                  </td>

                  <td className="px-5 py-4 text-right">
                    <span className="inline-flex rounded-lg bg-[#0B302B] px-3 py-1.5 text-sm font-black text-white">
                      {result.profileNote}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <footer className="border-t border-[#315B3E]/10 bg-[#F5F9F7] px-6 py-6">
        {completed ? (
          <div className="rounded-xl border border-[#278B70]/25 bg-[#DDF3E7] px-5 py-4">
            <p className="font-black text-[#176951]">
              Course d’initiation terminée
            </p>

            <p className="mt-1 text-sm font-semibold leading-6 text-[#48665F]">
              Le succès « Finaliser le didacticiel » est prêt dès que le
              tutoriel de base est également terminé.
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/jeu/objectifs"
                className="inline-flex min-h-10 items-center rounded-xl bg-[#176951] px-4 text-xs font-black text-white transition hover:bg-[#278B70]"
              >
                Voir mes objectifs
              </Link>

              <button
                type="button"
                onClick={onRestart}
                className="inline-flex min-h-10 items-center rounded-xl border border-[#278B70]/25 bg-white px-4 text-xs font-black text-[#176951] transition hover:bg-[#F2F8F5]"
              >
                Rejouer la course
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-black text-[#183F37]">
                Votre formation pratique est terminée
              </p>

              <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-[#60756E]">
                Validez cette course pour faire progresser l’objectif
                « Finaliser le didacticiel ».
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onRestart}
                className="min-h-11 rounded-xl border border-[#315B3E]/20 bg-white px-5 text-sm font-black text-[#48665F] transition hover:bg-[#F2F8F5]"
              >
                Recomposer l’équipe
              </button>

              <button
                type="button"
                disabled={pending}
                onClick={onComplete}
                className="min-h-11 rounded-xl bg-[#F2C94C] px-6 text-sm font-black text-[#071A17] shadow-md transition hover:bg-[#FFD968] disabled:cursor-wait disabled:opacity-60"
              >
                {pending
                  ? "Validation…"
                  : "Terminer mes premiers pas"}
              </button>
            </div>
          </div>
        )}
      </footer>
    </section>
  );
}

function formatGap(
  seconds: number,
): string {
  if (seconds <= 0) {
    return "Vainqueur";
  }

  const rounded = Math.round(seconds);

  if (rounded < 60) {
    return `+${rounded} s`;
  }

  const minutes = Math.floor(
    rounded / 60,
  );

  const remainingSeconds =
    rounded % 60;

  return `+${minutes} min ${String(
    remainingSeconds,
  ).padStart(2, "0")} s`;
}
