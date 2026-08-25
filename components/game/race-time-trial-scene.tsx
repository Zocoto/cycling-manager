"use client";

import { useMemo, type CSSProperties } from "react";

import { SideRaceCyclist } from "@/components/game/race-cyclist-detailed";
import { RaceRoadChalk } from "@/components/game/race-road-chalk";
import { RaceRoadsideCrowd } from "@/components/game/race-roadside-crowd";
import { RaceSceneryBackdrop } from "@/components/game/race-scenery-detailed";
import { RaceWeatherOverlay } from "@/components/game/race-weather-overlay";
import {
  buildTimeTrialStartSchedule,
  getTimeTrialSplitIndexes,
  getTimeTrialSplitStandings,
  getTimeTrialStartIntervalSeconds,
  getTimeTrialVisualFrame,
  selectSpacedTimeTrialUnits,
  type TimeTrialVisualUnit,
} from "@/lib/game/race-time-trial-visual";
import type {
  RiderSimulationInput,
  StageSimulationInput,
  StageSimulationResult,
} from "@/lib/game/race-simulation";
import {
  DEFAULT_RACE_WORLD_FLOW_DURATION_SECONDS,
  getRaceRoadMarkingMotion,
} from "@/lib/game/race-visual-motion";
import { getTeamMonogram } from "@/lib/game/race-visuals";
import type { RaceWeather } from "@/lib/game/race-weather";

export function RaceTimeTrialScene({
  input,
  simulation,
  riderById,
  displayedIndex,
  segmentProgress,
  isMoving,
  weather,
  favoriteNames,
}: {
  input: StageSimulationInput;
  simulation: StageSimulationResult;
  riderById: Map<string, RiderSimulationInput>;
  displayedIndex: number;
  segmentProgress: number;
  isMoving: boolean;
  weather: RaceWeather;
  favoriteNames: readonly string[];
}) {
  const roadMarkingMotion = getRaceRoadMarkingMotion({
    cycleDistance: 13,
    viewportDistance: 100,
    sceneryDurationSeconds: DEFAULT_RACE_WORLD_FLOW_DURATION_SECONDS,
  });
  const schedule = useMemo(
    () => buildTimeTrialStartSchedule({ input, simulation }),
    [input, simulation],
  );
  const raceProgress = Math.max(
    0,
    Math.min(
      1,
      (displayedIndex + segmentProgress) /
        Math.max(1, input.segments.length),
    ),
  );
  const frame = getTimeTrialVisualFrame(
    schedule,
    raceProgress,
    simulation.timeline,
  );
  const interval = getTimeTrialStartIntervalSeconds(
    schedule.length,
    input.stageType,
  );
  const isTeamTimeTrial = input.stageType === "team_time_trial";
  const activeUnits = isTeamTimeTrial
    ? frame.active.slice(0, 6)
    : selectSpacedTimeTrialUnits(frame.active);
  const activeSegment = input.segments[displayedIndex] ?? input.segments[0];
  const teamPalettes = getEngagedTeamPalettes(input.riders);
  const splitIndexes = getTimeTrialSplitIndexes(simulation.timeline.length);
  const courseDistanceKm =
    simulation.timeline.at(-1)?.completedDistanceKm ??
    input.segments.reduce((total, segment) => total + segment.distanceKm, 0);
  const intermediateSplitMarkers = splitIndexes
    .filter((splitIndex) => splitIndex < simulation.timeline.length - 1)
    .map((splitIndex, markerIndex) => ({
      snapshot: simulation.timeline[splitIndex],
      label: markerIndex + 1,
      left:
        7 +
        (simulation.timeline[splitIndex].completedDistanceKm /
          Math.max(1, courseDistanceKm)) *
          86,
    }));

  return (
    <div data-time-trial-live={isTeamTimeTrial ? "team" : "individual"}>
      <div className="mt-6">
        <p className="mb-2 text-right text-[10px] font-bold text-[#8FA99D] lg:hidden">
          Glissez horizontalement pour suivre le chrono
        </p>
        <div
          dir="rtl"
          role="region"
          aria-label="Visualisation du contre-la-montre"
          className="-mx-3 overflow-x-auto px-3 pb-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:overflow-visible lg:px-0"
        >
          <div
            dir="ltr"
            data-time-trial-initial-empty={raceProgress === 0 ? "true" : undefined}
            className="relative h-80 min-w-[58rem] overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(#8EC9D7_0_42%,#7FAB72_42%_100%)] shadow-inner shadow-black/30 lg:min-w-0"
          >
            <RaceSceneryBackdrop
              kind={activeSegment?.terrain === "climb" ? "forest" : "fields"}
              isMoving={isMoving}
              showSpectators={false}
            />
            <svg
              aria-hidden="true"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full"
            >
              <path d="M0 43H100V83H0Z" fill="#C7B98D" />
              <path d="M0 46H100V80H0Z" fill="#35453F" />
              <path
                d="M0 63H100"
                fill="none"
                stroke="rgba(255,255,255,0.72)"
                strokeWidth="0.8"
                strokeDasharray="7 6"
                vectorEffect="non-scaling-stroke"
                data-road-flow-direction="right-to-left"
                className={isMoving ? "cm-race-road-marking-svg" : ""}
                style={
                  {
                    "--cm-race-road-marking-cycle-distance":
                      roadMarkingMotion.cycleDistance,
                    "--cm-race-road-marking-cycle-duration":
                      `${roadMarkingMotion.durationSeconds}s`,
                  } as CSSProperties
                }
              />
              <RaceRoadChalk
                show={activeSegment?.terrain === "climb"}
                favoriteNames={favoriteNames}
                roadLeft={46}
                roadRight={46}
                roadDepth={34}
                isMoving={isMoving}
              />
            </svg>
            <RaceRoadsideCrowd
              show
              isMoving={isMoving}
              roadLeftY={147}
              roadRightY={147}
              roadDepthY={109}
              terrain={activeSegment?.terrain ?? "flat"}
              teamPalettes={teamPalettes}
            />
            <RaceWeatherOverlay weather={weather} />

            <div className="absolute left-[7%] top-[43%] z-10 h-[40%] w-1 bg-[#F2C94C] shadow-[0_0_16px_rgba(242,201,76,0.5)]" />
            <span className="absolute left-[7%] top-[38%] z-20 -translate-x-1/2 rounded bg-[#F2C94C] px-2 py-1 text-[8px] font-black uppercase text-[#17261E]">
              Départ
            </span>
            <div className="absolute left-[93%] top-[43%] z-10 h-[40%] w-1.5 bg-[repeating-linear-gradient(0deg,#fff_0_6px,#17261E_6px_12px)]" />
            <span className="absolute left-[93%] top-[38%] z-20 -translate-x-1/2 rounded bg-white px-2 py-1 text-[8px] font-black uppercase text-[#17261E]">
              Arrivée
            </span>

            {intermediateSplitMarkers.map((marker) => (
              <div
                key={marker.snapshot.segmentNumber}
                aria-hidden="true"
                data-time-trial-split-line={marker.snapshot.segmentNumber}
                className="absolute top-[43%] z-[9] h-[40%] border-l border-dashed border-[#72D4B7]/75"
                style={{ left: `${marker.left}%` }}
              >
                <span className="absolute -top-5 left-1/2 -translate-x-1/2 rounded bg-[#102C28]/90 px-1.5 py-0.5 text-[7px] font-black text-[#9BE0CA]">
                  I{marker.label}
                </span>
              </div>
            ))}

            <div className="absolute left-4 top-4 z-30 max-w-[47%] rounded-xl bg-[#071A17]/90 px-3 py-2 backdrop-blur">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#F2C94C]">
                {isTeamTimeTrial ? "Chrono par équipes" : "Chrono individuel"}
              </p>
              <p className="mt-1 text-[10px] font-bold text-[#C1D3CA]">
                {schedule.length} départs · toutes les {formatInterval(interval)}
              </p>
              <p className="mt-1 text-[9px] font-semibold text-[#9BB3A8]">
                Ordre inversé du général · pointages intermédiaires en direct
              </p>
            </div>

            <div className="absolute right-4 top-4 z-30 rounded-xl border border-white/15 bg-[#071A17]/90 px-3 py-2 text-right backdrop-blur">
              <p className="text-[9px] font-black uppercase tracking-widest text-[#9BE0CA]">
                Prochain départ
              </p>
              <p className="mt-0.5 text-sm font-black text-white">
                {frame.next?.label ?? "Tous partis"}
              </p>
              {frame.secondsUntilNext !== null ? (
                <p className="text-[10px] font-black tabular-nums text-[#F2C94C]">
                  -{formatCountdown(frame.secondsUntilNext)}
                </p>
              ) : null}
            </div>

            {activeUnits.map((unit, unitIndex) => {
              const left = 7 + unit.progress * 86;
              const riders = unit.riderIds
                .map((riderId) => riderById.get(riderId))
                .filter((rider): rider is RiderSimulationInput => Boolean(rider))
                .slice(0, isTeamTimeTrial ? 5 : 1);
              return (
                <div
                  key={unit.id}
                  data-time-trial-starter={unit.id}
                  data-time-trial-lane={isTeamTimeTrial ? "team" : "single-file"}
                  data-time-trial-pacing={
                    unit.pacingBias > 0.045
                      ? "fast-start"
                      : unit.pacingBias < -0.045
                        ? "negative-split"
                        : "even"
                  }
                  className="absolute z-20 -translate-x-1/2 transition-[left] duration-700 ease-linear"
                  style={{
                    left: `${left}%`,
                    top: isTeamTimeTrial ? `${49 + (unitIndex % 3) * 8}%` : "55%",
                  }}
                  title={`${unit.label} · départ n°${unit.startOrder}`}
                >
                  <div className={isTeamTimeTrial ? "relative h-10 w-24" : "relative h-10 w-20"}>
                    {riders.map((rider, riderIndex) => (
                      <div
                        key={rider.id}
                        className="absolute"
                        style={{
                          left: `${riderIndex * -9}px`,
                          top: `${riderIndex * 3}px`,
                          zIndex: riders.length - riderIndex,
                        }}
                      >
                        <SideRaceCyclist
                          rider={rider}
                          isMoving={isMoving}
                          className="h-10 w-[4.5rem]"
                          timeTrial
                          rearDiscWheel={hasDiscWheel(rider.id)}
                        />
                      </div>
                    ))}
                  </div>
                  <span className={`absolute left-1/2 top-full -translate-x-1/2 whitespace-nowrap rounded-full bg-[#071A17]/90 px-2 py-1 text-[8px] font-black text-white shadow-lg ${isTeamTimeTrial ? "" : "max-w-[7rem] truncate"}`}>
                    {unit.label}
                    {!isTeamTimeTrial && riders[0]
                      ? ` · ${getTeamMonogram(riders[0].teamName)}`
                      : ""}
                  </span>
                </div>
              );
            })}

            {raceProgress === 0 ? (
              <div className="absolute inset-x-0 bottom-5 z-20 text-center text-[10px] font-black uppercase tracking-widest text-white/65">
                Route libre · premier coureur sur la rampe
              </div>
            ) : frame.active.length === 0 && frame.finished.length === schedule.length ? (
              <div className="absolute inset-x-0 bottom-5 z-20 text-center text-[10px] font-black uppercase tracking-widest text-[#FFF4C4]">
                Tous les concurrents ont terminé
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <TimeTrialSplitBoards
        splitIndexes={splitIndexes}
        simulation={simulation}
        schedule={schedule}
        raceElapsedSeconds={frame.raceElapsedSeconds}
        courseDistanceKm={courseDistanceKm}
        riderById={riderById}
        isTeamTimeTrial={isTeamTimeTrial}
      />
    </div>
  );
}

function TimeTrialSplitBoards({
  splitIndexes,
  simulation,
  schedule,
  raceElapsedSeconds,
  courseDistanceKm,
  riderById,
  isTeamTimeTrial,
}: {
  splitIndexes: number[];
  simulation: StageSimulationResult;
  schedule: readonly TimeTrialVisualUnit[];
  raceElapsedSeconds: number;
  courseDistanceKm: number;
  riderById: Map<string, RiderSimulationInput>;
  isTeamTimeTrial: boolean;
}) {
  const boards = splitIndexes.flatMap((splitIndex) => {
    const snapshot = simulation.timeline[splitIndex];
    if (!snapshot) return [];

    const recordedStandings = getTimeTrialSplitStandings({
      schedule,
      snapshot,
      raceElapsedSeconds,
      courseDistanceKm,
      limit: schedule.length,
    });
    return recordedStandings.length > 0
      ? [{
          splitIndex,
          snapshot,
          recordedCount: recordedStandings.length,
          standings: recordedStandings.slice(0, 20),
        }]
      : [];
  });

  if (boards.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-xs font-semibold text-[#8FA99D]">
        Le premier tableau apparaîtra dès le passage du premier coureur au pointage.
      </div>
    );
  }

  return (
    <section className="mt-4" aria-label="Tableaux des temps intermédiaires">
      <div className="flex gap-4 overflow-x-auto pb-2">
        {boards.map(({ splitIndex, snapshot, recordedCount, standings }) => {
          const isFinish = splitIndex === simulation.timeline.length - 1;
          const splitPosition = splitIndexes.indexOf(splitIndex) + 1;
          return (
            <article
              key={snapshot.segmentNumber}
              data-time-trial-split={snapshot.segmentNumber}
              data-time-trial-recorded-count={recordedCount}
              className="w-[18rem] shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]"
            >
              <header className="border-b border-white/10 bg-[#102C28] px-4 py-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-[#72D4B7]">
                  {isFinish
                    ? "Temps à l’arrivée"
                    : `Intermédiaire ${splitPosition}`}
                </p>
                <div className="mt-1 flex items-end justify-between gap-3">
                  <p className="text-sm font-black text-white">
                    Km {formatDistance(snapshot.completedDistanceKm)}
                  </p>
                  <p className="text-[8px] font-black uppercase tracking-wider text-[#78978A]">
                    {recordedCount}/{schedule.length}{" "}
                    {isTeamTimeTrial ? "équipes pointées" : "temps relevés"}
                  </p>
                </div>
              </header>
              <ol className="divide-y divide-white/10">
                {standings.map((standing, index) => {
                  const rider = riderById.get(standing.riderIds[0] ?? "");
                  const label = isTeamTimeTrial
                    ? standing.label
                    : rider?.name ?? standing.label;
                  const teamCode = rider
                    ? getTeamMonogram(rider.teamName)
                    : null;
                  return (
                    <li
                      key={standing.id}
                      className="flex items-center gap-2 px-4 py-2 text-[11px] font-semibold"
                    >
                      <span className="w-5 font-black text-[#F2C94C]">
                        {index + 1}
                      </span>
                      <span
                        className="min-w-0 flex-1 truncate text-white"
                        title={rider?.teamName}
                      >
                        {label}
                        {!isTeamTimeTrial && teamCode ? (
                          <span className="ml-1 text-[9px] font-black text-[#78978A]">
                            {teamCode}
                          </span>
                        ) : null}
                      </span>
                      <span className="font-black tabular-nums text-[#BBD1C6]">
                        {standing.gapToLeaderSeconds === 0
                          ? "MT"
                          : `+${formatGap(standing.gapToLeaderSeconds)}`}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </article>
          );
        })}
      </div>
    </section>
  );
}
function getEngagedTeamPalettes(riders: readonly RiderSimulationInput[]) {
  return [
    ...new Map(
      riders.map((rider) => [
        rider.teamId,
        {
          teamId: rider.teamId,
          primaryColor:
            rider.teamJersey?.primaryColor ?? rider.teamPrimaryColor,
          secondaryColor:
            rider.teamJersey?.secondaryColor ?? rider.teamSecondaryColor,
        },
      ]),
    ).values(),
  ];
}

function hasDiscWheel(riderId: string) {
  return (
    [...riderId].reduce(
      (total, character) =>
        (total * 31 + character.charCodeAt(0)) >>> 0,
      19,
    ) % 3 !== 0
  );
}

function formatInterval(seconds: number) {
  return seconds >= 60 ? `${seconds / 60} min` : `${seconds} s`;
}

function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function formatGap(seconds: number) {
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return minutes ? `${minutes}’${String(rest).padStart(2, "0")}”` : `${rest}”`;
}

function formatDistance(distance: number) {
  return Number.isInteger(distance) ? String(distance) : distance.toFixed(1);
}
